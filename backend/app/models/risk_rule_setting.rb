class RiskRuleSetting < ApplicationRecord
  belongs_to :updated_by, class_name: "User", optional: true

  validates :key, presence: true, uniqueness: true, inclusion: { in: RiskRuleConfig::DEFINITIONS.keys }
  validates :value, presence: true, numericality: true
  validate :value_within_range
  validate :value_keeps_order

  private

  def value_within_range
    definition = RiskRuleConfig::DEFINITIONS[key]
    return if definition.nil? || value.nil?

    errors.add(:value, "must be between #{definition.min} and #{definition.max}") unless value.between?(definition.min, definition.max)
    errors.add(:value, "must be a whole number") if definition.integer && value != value.to_i
  end

  # Compares the new value with the effective values of the other keys in its ordered group.
  def value_keeps_order
    group = RiskRuleConfig::ORDERED_GROUPS.find { |keys| keys.include?(key) }
    return if group.nil? || value.nil?

    effective = RiskRuleConfig.defaults.merge(RiskRuleSetting.where.not(key: key).pluck(:key, :value).to_h { |k, v| [ k, v.to_d ] }).merge(key => value)
    group.each_cons(2) do |lower, higher|
      errors.add(:value, "#{lower} must stay below #{higher}") unless effective[lower] < effective[higher]
    end
  end
end
