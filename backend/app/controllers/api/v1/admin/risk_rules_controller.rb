module Api
  module V1
    module Admin
      class RiskRulesController < BaseController
        before_action :require_staff!, only: :index
        before_action :require_admin!, only: [ :update, :reset ]

        # GET /api/v1/admin/risk_rules
        def index
          render_success({ risk_rules: serialize_all })
        end

        # PATCH /api/v1/admin/risk_rules/:key  { value: 80 }
        def update
          key = params[:key].to_s
          return render_error("Unknown rule", :not_found) unless RiskRuleConfig::DEFINITIONS.key?(key)

          new_value = parse_value(params[:value])
          return render_error("Value must be a number", :unprocessable_entity) if new_value.nil?

          setting = RiskRuleSetting.find_or_initialize_by(key: key)
          old_value = RiskRuleConfig.get(key)
          setting.assign_attributes(value: new_value, updated_by: current_user)
          return render_error(setting.errors.full_messages.to_sentence, :unprocessable_entity) unless setting.valid?

          unless old_value == new_value
            ActiveRecord::Base.transaction do
              setting.save!
              record_change("RISK_RULE_CHANGED", key, "#{current_user.email} changed risk rule #{key} from #{format_number(old_value)} to #{format_number(new_value)}")
            end
            RiskRuleConfig.reset_cache!
          end

          render_success(serialize(key), "Risk rule updated")
        end

        # POST /api/v1/admin/risk_rules/reset
        def reset
          changed = RiskRuleConfig.defaults.reject { |key, default| RiskRuleConfig.get(key) == default }

          ActiveRecord::Base.transaction do
            changed.each do |key, default|
              RiskRuleSetting.find_or_initialize_by(key: key).update!(value: default, updated_by: current_user)
            end
            if changed.any?
              record_change("RISK_RULES_RESET", "all", "#{current_user.email} reset #{changed.size} risk rules to defaults: #{changed.keys.join(', ')}")
            end
          end
          RiskRuleConfig.reset_cache!

          render_success({ risk_rules: serialize_all }, "Risk rules reset to defaults")
        end

        private

        def parse_value(raw)
          return nil if raw.blank?

          BigDecimal(raw.to_s, exception: false)
        end

        def record_change(event_type, entity_id, description)
          AuditLog.create!(event_type: event_type, entity_type: "RiskRule", entity_id: entity_id, description: description)
        end

        def format_number(number)
          number.to_s("F").sub(/\.0+\z/, "")
        end

        def serialize_all
          RiskRuleConfig::DEFINITIONS.keys.map { |key| serialize(key) }
        end

        def serialize(key)
          definition = RiskRuleConfig::DEFINITIONS.fetch(key)
          {
            key: key,
            description: definition.description,
            value: RiskRuleConfig.get(key).to_f,
            default: definition.default,
            min: definition.min,
            max: definition.max,
            whole_number: definition.integer
          }
        end
      end
    end
  end
end
