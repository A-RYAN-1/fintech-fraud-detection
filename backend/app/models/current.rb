class Current < ActiveSupport::CurrentAttributes
  # Risk rule values loaded once per request or job; Rails resets this between them.
  attribute :risk_rule_values
end
