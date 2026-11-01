# Similar past cases: the nearest decided cases to a stored case, with what a person decided on each.
# Each decided case has one vector (CaseEmbedding) made by Gemini's free embedding model from the facts-only text
# (SimilarCases.facts_text: bands, flags, rule names, model reason labels; never ids, emails, IP addresses or device
# ids). Matching is cosine distance in Postgres (pgvector). When embeddings are unavailable (analyst off, guard
# skipped, call failed) a rules-based match is returned and marked source "rules": decided cases that fired the same
# rules in the same amount band. It is evidence for the reviewer; it never changes a payment or a decision.
class SimilarCases
  LIMIT = 3
  FALLBACK_POOL = 500

  def initialize(transaction, client: nil, guard: AnalystGuard.instance)
    @transaction = transaction
    @client = client
    @guard = guard
  end

  # The facts as stable text. Keys are sorted so the same facts always give the same text.
  def self.facts_text(facts)
    facts.sort_by { |key, _| key.to_s }.map { |key, value| "#{key.to_s.tr('_', ' ')}: #{Array(value).join(', ').presence || 'none'}" }.join("\n")
  end

  # Stores or refreshes the vector of a decided case. Returns the record, or nil when no embedding could be made.
  def index!
    return nil unless decided?

    text = facts_text
    vector = embed(text)
    return nil unless vector

    record = CaseEmbedding.find_or_initialize_by(financial_transaction_id: @transaction.id)
    record.update!(embedding: vector, facts_text: text, model: GeminiClient::EMBEDDING_MODEL)
    record
  end

  # { source: "embedding" | "rules", matches: [...] }
  def nearest
    vector = embed(facts_text)
    matches = vector ? by_embedding(vector) : nil
    return { source: "embedding", matches: matches } if matches&.any?

    { source: "rules", matches: by_rules }
  end

  private

  def facts_text
    self.class.facts_text(AskAnalyst.new(@transaction).facts)
  end

  def decided?
    @transaction.fraud_evaluation&.human_label.present?
  end

  def by_embedding(vector)
    sql = CaseEmbedding.sanitize_sql_array([ <<~SQL.squish, vector_literal(vector), @transaction.id, LIMIT ])
      SELECT ce.financial_transaction_id AS payment_id, t.amount, fe.rules_triggered, fe.human_label, fe.labeled_at,
             ce.embedding <=> ?::vector AS distance
      FROM case_embeddings ce
      JOIN transactions t ON t.id = ce.financial_transaction_id
      JOIN fraud_evaluations fe ON fe.transaction_id = ce.financial_transaction_id AND fe.human_label IS NOT NULL
      WHERE ce.financial_transaction_id <> ?
      ORDER BY distance
      LIMIT ?
    SQL
    ActiveRecord::Base.connection.select_all(sql).map do |row|
      serialize(row["payment_id"], row["amount"].to_d, row["rules_triggered"], row["human_label"], row["labeled_at"], row["distance"].to_f.round(4))
    end
  end

  def by_rules
    mine = rules_of(@transaction.fraud_evaluation&.rules_triggered)
    band = AiAnalyst.amount_band(@transaction.amount)
    pool = FraudEvaluation.where.not(human_label: nil).where.not(transaction_id: @transaction.id)
                          .order(labeled_at: :desc).limit(FALLBACK_POOL).includes(:financial_transaction)
    pool.select { |e| rules_of(e.rules_triggered) == mine && AiAnalyst.amount_band(e.financial_transaction.amount) == band }
        .first(LIMIT).map { |e| serialize(e.transaction_id, e.financial_transaction.amount, e.rules_triggered, e.human_label, e.labeled_at, nil) }
  end

  def serialize(id, amount, rules, label, decided_at, distance)
    { payment_id: id, amount_band_usd: AiAnalyst.amount_band(amount), rules_triggered: rules_of(rules), human_outcome: label,
      decided_at: decided_at, distance: distance }
  end

  def rules_of(raw)
    raw.to_s.split(",").map(&:strip).reject(&:blank?).sort
  end

  # nil on any skip or failure; the guard sees one success or one failure, as for every other Gemini call.
  def embed(text)
    return nil unless @client || AiAnalyst.enabled?
    return nil unless @guard.acquire == :ok

    vector = (@client || GeminiClient.new).embed(text)
    @guard.success
    vector
  rescue GeminiClient::Error => e
    @guard.failure(e.message)
    Rails.logger.warn("Similar cases embedding skipped: #{e.message}")
    nil
  end

  def vector_literal(vector)
    "[#{vector.join(',')}]"
  end
end
