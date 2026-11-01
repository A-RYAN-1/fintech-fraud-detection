# Deterministic check that AI-written text about a case stays inside the case facts. No model call, no network.
# The analyst sees only the facts-only payload (AiFactsBuilder), so anything it writes that is not in that payload was
# made up. Three kinds of claim can be checked mechanically:
#   unknown_number  a number that is not in the facts (an amount, a score, a count, a percentage of the model probability)
#   unknown_rule    a rule name (UPPER_SNAKE) that did not fire on this case
#   identifier      an e-mail address, IP address, UUID or long hex string: the payload never contains one, so the text
#                   must not either
# The check is strict on purpose: a text that fails is replaced by the fixed rules-only text, which costs nothing.
# It does not judge wording, tone or whether the reasoning is good; it only proves the text cites nothing that is not
# in the facts.
module AnalystGrounding
  NUMBER = /\d+(?:,\d{3})*(?:\.\d+)?%?/
  RULE_NAME = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/
  IDENTIFIERS = {
    email: /[\w.+-]+@[\w-]+\.[\w.-]+/,
    ip_address: /\b\d{1,3}(?:\.\d{1,3}){3}\b/,
    uuid: /\b\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\b/,
    long_hex: /\b\h{16,}\b/
  }.freeze
  TOLERANCE = 0.005

  Issue = Struct.new(:kind, :detail)
  Result = Struct.new(:passed, :issues) do
    def to_h
      passed ? { status: "passed", issues: [] } : { status: "rejected", issues: issues.map { |i| { kind: i.kind, detail: i.detail } } }
    end
  end

  NOT_APPLICABLE = { status: "not_applicable", issues: [] }.freeze

  # texts: the strings the analyst wrote. facts: the payload it was given (symbol keys, as AiFactsBuilder returns).
  def self.check(texts, facts)
    text = Array(texts).compact.join("\n")
    issues = identifier_issues(text) + rule_issues(text, facts) + number_issues(text, facts)
    Result.new(issues.empty?, issues.uniq)
  end

  def self.identifier_issues(text)
    IDENTIFIERS.filter_map { |kind, pattern| Issue.new(:identifier, kind.to_s) if text.match?(pattern) }
  end

  def self.rule_issues(text, facts)
    known = Array(facts[:rules_triggered]).map(&:to_s)
    text.scan(RULE_NAME).uniq.reject { |name| known.include?(name) }.map { |name| Issue.new(:unknown_rule, name) }
  end

  def self.number_issues(text, facts)
    allowed = allowed_numbers(facts)
    # Identifiers are reported once as identifiers, not again as stray numbers.
    scrubbed = IDENTIFIERS.values.reduce(text) { |t, pattern| t.gsub(pattern, " ") }
    scrubbed.scan(NUMBER).uniq.reject { |token| allowed_token?(token, allowed) }.map { |token| Issue.new(:unknown_number, token) }
  end

  def self.allowed_numbers(facts)
    numbers = facts.to_json.scan(NUMBER).map { |token| to_number(token) }
    probability = facts[:model_risk_probability]
    numbers << (probability.to_f * 100).round if probability
    numbers
  end

  def self.allowed_token?(token, allowed)
    value = to_number(token)
    candidates = token.end_with?("%") ? [ value, value / 100.0 ] : [ value ]
    candidates.any? { |candidate| allowed.any? { |known| (known - candidate).abs <= TOLERANCE } }
  end

  def self.to_number(token)
    token.delete(",%").to_f
  end

  private_class_method :identifier_issues, :rule_issues, :number_issues, :allowed_numbers, :allowed_token?, :to_number
end
