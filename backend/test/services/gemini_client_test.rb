require "test_helper"

class GeminiClientTest < ActiveSupport::TestCase
  Response = Struct.new(:body)

  def client_returning(body)
    client = GeminiClient.new(api_key: "k")
    client.define_singleton_method(:post) { |url, payload| (@calls ||= []) << [ url, payload ]; Response.new(body) }
    client
  end

  test "embed asks the free embedding model for 768 dimensions and returns the vector" do
    values = Array.new(768) { |i| i / 768.0 }
    client = client_returning({ embedding: { values: values } }.to_json)

    assert_equal values, client.embed("amount band: 250 to 1,000")
    url, payload = client.instance_variable_get(:@calls).first
    assert_includes url, "gemini-embedding-001:embedContent"
    assert_equal 768, payload[:outputDimensionality]
  end

  test "embed rejects a vector of the wrong size or unreadable JSON" do
    assert_raises(GeminiClient::Error) { client_returning({ embedding: { values: [ 0.1 ] } }.to_json).embed("x") }
    assert_raises(GeminiClient::Error) { client_returning({}.to_json).embed("x") }
    assert_raises(GeminiClient::Error) { client_returning("not json").embed("x") }
  end

  def client_with(models:, answers:)
    client = GeminiClient.new(api_key: "k", model: models.first, fallback_models: models.drop(1).join(", "))
    client.define_singleton_method(:post) do |url, _payload|
      (@urls ||= []) << url
      answer = answers.shift
      raise answer if answer.is_a?(GeminiClient::Error)

      Response.new({ candidates: [ { content: { parts: [ { text: answer } ] } } ] }.to_json)
    end
    client
  end

  def generate(client) = client.generate_json(system: "s", prompt: "p", schema: {})

  test "a model refused for quota hands the same call to the next model, which is the one reported" do
    client = client_with(models: %w[main-model spare-model], answers: [ GeminiClient::Error.new("Gemini returned 429", status: 429), '{"ok":true}' ])

    assert_equal({ "ok" => true }, generate(client))
    assert_equal "spare-model", client.model
    urls = client.instance_variable_get(:@urls)
    assert_equal 2, urls.size
    assert_includes urls.last, "spare-model:generateContent"
  end

  test "no fallback for a timeout or a bad request, and the last refusal is raised when every model refuses" do
    timeout = client_with(models: %w[a b], answers: [ GeminiClient::Error.new("Gemini request failed: Net::ReadTimeout") ])
    assert_raises(GeminiClient::Error) { generate(timeout) }
    assert_equal 1, timeout.instance_variable_get(:@urls).size

    bad = client_with(models: %w[a b], answers: [ GeminiClient::Error.new("Gemini returned 400", status: 400) ])
    assert_raises(GeminiClient::Error) { generate(bad) }

    all = client_with(models: %w[a b], answers: [ GeminiClient::Error.new("x", status: 429), GeminiClient::Error.new("y", status: 503) ])
    error = assert_raises(GeminiClient::Error) { generate(all) }
    assert_equal 503, error.status
  end

  test "without fallback models the client behaves as before" do
    client = client_with(models: %w[only], answers: [ '{"a":1}' ])
    assert_equal({ "a" => 1 }, generate(client))
    assert_equal "only", client.model
  end
end
