# Lookup for the tunable numbers behind RiskRulesProcessor.
# DEFINITIONS holds the shipped defaults and the allowed range of each key; a row in
# risk_rule_settings overrides the default, and a missing row falls back to it.
class RiskRuleConfig
  Definition = Struct.new(:default, :min, :max, :integer, :description, keyword_init: true)

  DEFINITIONS = {
    "block_threshold" => Definition.new(default: 70, min: 1, max: 200, integer: true, description: "Risk score at or above which a transaction is blocked"),
    "flag_threshold" => Definition.new(default: 30, min: 1, max: 200, integer: true, description: "Risk score at or above which a transaction is flagged"),
    "first_txn_high_risk" => Definition.new(default: 30, min: 0, max: 100, integer: true, description: "Score for a first transaction above the high amount limit"),
    "high_amount_limit" => Definition.new(default: 100_000, min: 1, max: 100_000_000, integer: false, description: "Amount above which a first transaction is high risk"),
    "amount_deviation_high" => Definition.new(default: 40, min: 0, max: 100, integer: true, description: "Score when the amount reaches the high multiple of the user's average"),
    "amount_deviation_medium" => Definition.new(default: 30, min: 0, max: 100, integer: true, description: "Score when the amount reaches the medium multiple of the user's average"),
    "amount_deviation_low" => Definition.new(default: 20, min: 0, max: 100, integer: true, description: "Score when the amount reaches the low multiple of the user's average"),
    "deviation_multiplier_high" => Definition.new(default: 10, min: 1, max: 1000, integer: false, description: "High multiple of the user's average amount"),
    "deviation_multiplier_medium" => Definition.new(default: 5, min: 1, max: 1000, integer: false, description: "Medium multiple of the user's average amount"),
    "deviation_multiplier_low" => Definition.new(default: 2, min: 1, max: 1000, integer: false, description: "Low multiple of the user's average amount"),
    "rapid_velocity_low" => Definition.new(default: 20, min: 0, max: 100, integer: true, description: "Score for rapid medium-sized payments"),
    "rapid_velocity_medium" => Definition.new(default: 30, min: 0, max: 100, integer: true, description: "Score for rapid large payments"),
    "rapid_velocity_high" => Definition.new(default: 40, min: 0, max: 100, integer: true, description: "Score for rapid very large payments"),
    "velocity_window_seconds" => Definition.new(default: 60, min: 10, max: 3600, integer: true, description: "Window in which payments count as rapid"),
    "medium_amount_min" => Definition.new(default: 1_000, min: 1, max: 100_000_000, integer: false, description: "Lower bound of a medium amount"),
    "large_amount_min" => Definition.new(default: 10_000, min: 1, max: 100_000_000, integer: false, description: "Lower bound of a large amount"),
    "very_large_amount_min" => Definition.new(default: 50_000, min: 1, max: 100_000_000, integer: false, description: "Lower bound of a very large amount"),
    "untrusted_device_risk" => Definition.new(default: 30, min: 0, max: 100, integer: true, description: "Score when the device is not the user's trusted device"),
    "missing_device_risk" => Definition.new(default: 50, min: 0, max: 100, integer: true, description: "Score when the transaction has no device id")
  }.freeze

  # Each group must stay strictly increasing, in this order.
  ORDERED_GROUPS = [
    %w[flag_threshold block_threshold],
    %w[deviation_multiplier_low deviation_multiplier_medium deviation_multiplier_high],
    %w[medium_amount_min large_amount_min very_large_amount_min]
  ].freeze

  class << self
    def get(key)
      values.fetch(key.to_s)
    end

    # All values as { key => BigDecimal }, with the overrides applied. One query per request.
    def values
      Current.risk_rule_values ||= load_values
    end

    def reset_cache!
      Current.risk_rule_values = nil
    end

    def defaults
      DEFINITIONS.transform_values { |definition| definition.default.to_d }
    end

    private

    def load_values
      stored = RiskRuleSetting.pluck(:key, :value).to_h { |key, value| [ key, value.to_d ] }
      defaults.merge(stored.slice(*DEFINITIONS.keys))
    end
  end
end
