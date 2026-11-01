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
end
