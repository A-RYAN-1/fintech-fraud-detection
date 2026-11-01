require "test_helper"

class SimilarCasesTest < ActiveSupport::TestCase
  # Returns the vector it was built with and records the text it was given.
  class FakeClient
    attr_reader :texts

    def initialize(vector: nil, error: nil)
      @vector = vector
      @error = error
      @texts = []
    end

    def embed(text)
      @texts << text
      raise @error if @error

      @vector
    end
  end

  def vec(*head)
    head + Array.new(GeminiClient::EMBEDDING_DIMENSIONS - head.size, 0.0)
  end

  def payment(amount: 300, rules: "UNTRUSTED_DEVICE", label: nil)
    t = users(:one).transactions.create!(amount: amount, payment_method: "wallet", device_id: "device-secret-1", ip_address: "203.0.113.7",
                                         status: "FLAGGED", risk_score: 30, paypal_status: "HELD")
    FraudEvaluation.create!(financial_transaction: t, risk_score: 30, rules_triggered: rules, ml_score: 0.7, human_label: label,
                            labeled_at: (label ? Time.current : nil))
    t
  end

  def embedded(vector, **options)
    t = payment(**options)
    CaseEmbedding.create!(financial_transaction: t, embedding: vector, facts_text: "x", model: "m")
    t
  end

  def similar(transaction, client: FakeClient.new, guard: AnalystGuard.new)
    SimilarCases.new(transaction.reload, client: client, guard: guard)
  end

  test "the text is stable, sorted by key and carries no identifier" do
    t = payment
    text = SimilarCases.facts_text(AskAnalyst.new(t.reload).facts)

    assert_equal text, SimilarCases.facts_text(AskAnalyst.new(t.reload).facts)
    assert_includes text, "rules triggered: UNTRUSTED_DEVICE"
    assert_includes text, "amount band usd: 250 to 1,000"
    [ "device-secret-1", "203.0.113.7", users(:one).email, t.id.to_s ].each { |secret| assert_not_includes text, secret }
    keys = text.lines.map { |line| line.split(":").first }
    assert_equal keys.sort, keys
  end

  test "a decided case gets one vector, refreshed on a second call; an undecided case gets none" do
    decided = payment(label: "block")
    client = FakeClient.new(vector: vec(1.0))

    assert similar(decided, client: client).index!
    assert similar(decided, client: client).index!
    assert_equal 1, CaseEmbedding.where(financial_transaction_id: decided.id).count
    assert_equal "gemini-embedding-001", CaseEmbedding.last.model

    undecided = payment
    assert_nil similar(undecided, client: client).index!
    assert_equal 0, CaseEmbedding.where(financial_transaction_id: undecided.id).count
  end

  test "an embedding failure or an open circuit stores nothing" do
    decided = payment(label: "approve")
    assert_nil similar(decided, client: FakeClient.new(error: GeminiClient::Error.new("boom"))).index!

    guard = AnalystGuard.new(failure_threshold: 1)
    guard.failure("down")
    client = FakeClient.new(vector: vec(1.0))
    assert_nil similar(decided, client: client, guard: guard).index!
    assert_empty client.texts
    assert_equal 0, CaseEmbedding.count
  end

  test "the nearest three come back closest first with the human outcome and never the case itself" do
    me = embedded(vec(1.0, 0.0), label: "block")
    far = embedded(vec(0.0, 1.0), label: "approve")
    near = embedded(vec(1.0, 0.1), label: "block")
    mid = embedded(vec(1.0, 0.6), label: "approve")
    mid2 = embedded(vec(1.0, 2.0), label: "approve")
    undecided = payment
    CaseEmbedding.create!(financial_transaction: undecided, embedding: vec(1.0, 0.0), facts_text: "x", model: "m")

    result = similar(me, client: FakeClient.new(vector: vec(1.0, 0.0))).nearest

    assert_equal "embedding", result[:source]
    assert_equal [ near.id, mid.id, mid2.id ], result[:matches].map { |m| m[:payment_id] }
    assert_equal %w[block approve approve], result[:matches].map { |m| m[:human_outcome] }
    assert_equal result[:matches].map { |m| m[:distance] }.sort, result[:matches].map { |m| m[:distance] }
    assert_not_includes result[:matches].map { |m| m[:payment_id] }, far.id
    assert_not_includes result[:matches].map { |m| m[:payment_id] }, me.id
    assert_not_includes result[:matches].map { |m| m[:payment_id] }, undecided.id
    assert_equal "250 to 1,000", result[:matches].first[:amount_band_usd]
  end

  test "without embeddings it falls back to decided cases with the same rules and amount band, labelled rules" do
    current = payment
    same = payment(label: "approve")
    payment(label: "block", amount: 30)
    payment(label: "block", rules: "HIGH_VELOCITY")
    payment(rules: "UNTRUSTED_DEVICE")

    result = similar(current, client: FakeClient.new(error: GeminiClient::Error.new("boom"))).nearest

    assert_equal "rules", result[:source]
    assert_equal [ same.id ], result[:matches].map { |m| m[:payment_id] }
    assert_equal "approve", result[:matches].first[:human_outcome]
    assert_nil result[:matches].first[:distance]
  end

  test "when the analyst is off the rules match is used and the model is never called" do
    current = payment
    payment(label: "block")

    result = SimilarCases.new(current.reload, guard: AnalystGuard.new).nearest

    assert_equal "rules", result[:source]
    assert_equal 1, result[:matches].size
  end

  test "an embedding match list that is empty falls back to the rules match" do
    current = payment
    same = payment(label: "block")

    result = similar(current, client: FakeClient.new(vector: vec(1.0))).nearest

    assert_equal "rules", result[:source]
    assert_equal [ same.id ], result[:matches].map { |m| m[:payment_id] }
  end

  test "the embedding job indexes a decided evaluation and ignores a missing one" do
    decided = payment(label: "block")
    replace_class_method(AiAnalyst, :enabled?, -> { true }) do
      replace_class_method(GeminiClient, :new, ->(*) { FakeClient.new(vector: vec(1.0)) }) do
        CaseEmbeddingJob.perform_now(decided.fraud_evaluation.id)
      end
    end
    assert_equal 1, CaseEmbedding.count

    assert_nothing_raised { CaseEmbeddingJob.perform_now(0) }
  end
end
