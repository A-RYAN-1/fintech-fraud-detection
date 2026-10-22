module Api
  module V1
    class AnalyticsController < ApplicationController
      before_action :authenticate_user!

      # GET /api/v1/analytics?period=7d&status=FLAGGED&payment_method=card&start_date=2026-01-01&end_date=2026-02-01
      def show
        transactions = filter_transactions

        render_success({
          stats: build_stats(transactions),
          chart_data: build_chart_data(transactions, calculated_days),
          risk_distribution: build_risk_distribution(transactions),
          risk_score_ranges: build_risk_score_ranges(transactions),
          heatmap_data: build_heatmap_data(transactions),
          rules_triggered: build_rules_triggered(transactions),
          high_risk_transactions: build_high_risk_transactions(transactions)
        })
      end

      private

      def filter_transactions
        transactions = current_user.transactions

        # Date filtering
        if params[:start_date].present? && params[:end_date].present?
          transactions = transactions.where(
            "transactions.created_at >= ? AND transactions.created_at <= ?",
            safe_parse_date(params[:start_date]).beginning_of_day,
            safe_parse_date(params[:end_date]).end_of_day
          )
        elsif params[:period].present?
          days = parse_period(params[:period])
          transactions = transactions.where("transactions.created_at >= ?", days.days.ago.beginning_of_day) if days > 0
        end

        # Status filter
        if params[:status].present? && params[:status] != "all"
          transactions = transactions.where(status: params[:status].downcase)
        end

        # Payment method filter
        if params[:payment_method].present? && params[:payment_method] != "all"
          transactions = transactions.where(payment_method: params[:payment_method])
        end

        transactions
      end

      def calculated_days
        if params[:start_date].present? && params[:end_date].present?
          (safe_parse_date(params[:end_date]) - safe_parse_date(params[:start_date])).to_i + 1
        else
          parse_period(params[:period])
        end
      end

      def parse_period(period)
        case period
        when "7d" then 7
        when "30d" then 30
        when "90d" then 90
        when "all" then 0
        else 7
        end
      end

      def build_stats(transactions)
        total = transactions.count
        success_count = transactions.where(status: :success).count
        flagged_count = transactions.where(status: :flagged).count
        blocked_count = transactions.where(status: :blocked).count
        total_volume = transactions.where(status: [ :success, :flagged ]).sum(:amount).to_f
        average_spending = total > 0 ? (total_volume / total).round(2) : 0
        avg_risk_score = total > 0 ? transactions.average(:risk_score).to_f.round(1) : 0
        high_risk_count = transactions.where("risk_score >= ?", RiskRuleConfig.get(:block_threshold)).count

        {
          total_transactions: total,
          successful_transactions: success_count,
          flagged_transactions: flagged_count,
          blocked_transactions: blocked_count,
          total_volume: total_volume,
          average_spending: average_spending,
          success_rate: total > 0 ? ((success_count.to_f / total) * 100).round(1) : 0,
          risk_rate: total > 0 ? (((flagged_count + blocked_count).to_f / total) * 100).round(1) : 0,
          avg_risk_score: avg_risk_score,
          high_risk_count: high_risk_count
        }
      end

      def build_chart_data(transactions, days)
        # Group by date and status using SQL
        grouped = transactions
          .group("DATE(created_at)", :status)
          .count

        (0...days).map do |i|
          date = i.days.ago.to_date

          {
            date: date.strftime("%b %d"),
            success: grouped[[ date, "success" ]] || 0,
            flagged: grouped[[ date, "flagged" ]] || 0,
            blocked: grouped[[ date, "blocked" ]] || 0,
            total: (grouped[[ date, "success" ]] || 0) +
                   (grouped[[ date, "flagged" ]] || 0) +
                   (grouped[[ date, "blocked" ]] || 0) +
                   (grouped[[ date, "pending" ]] || 0)
          }
        end.reverse
      end

      def build_risk_distribution(transactions)
        low = transactions.where("risk_score < ?", RiskRuleConfig.get(:flag_threshold)).count
        medium = transactions.where("risk_score >= ? AND risk_score < ?", RiskRuleConfig.get(:flag_threshold), RiskRuleConfig.get(:block_threshold)).count
        high = transactions.where("risk_score >= ?", RiskRuleConfig.get(:block_threshold)).count

        [
          { name: "Low Risk", value: low, color: "#22c55e" },
          { name: "Medium Risk", value: medium, color: "#f59e0b" },
          { name: "High Risk", value: high, color: "#ef4444" }
        ]
      end

      def build_heatmap_data(transactions)
        # Group by day_of_week and hour using SQL
        grouped = transactions
          .group("EXTRACT(DOW FROM created_at)::integer", "EXTRACT(HOUR FROM created_at)::integer")
          .select(
            "EXTRACT(DOW FROM created_at)::integer AS dow",
            "EXTRACT(HOUR FROM created_at)::integer AS hour_of_day",
            "COUNT(*) AS txn_count",
            "COALESCE(AVG(risk_score), 0) AS avg_risk"
          )

        # Index results for fast lookup
        lookup = {}
        grouped.each do |row|
          lookup[[ row.dow, row.hour_of_day ]] = { count: row.txn_count, avg_risk: row.avg_risk.to_f }
        end

        days = %w[Sun Mon Tue Wed Thu Fri Sat]
        data = []

        7.times do |day|
          24.times do |hour|
            entry = lookup[[ day, hour ]]
            count = entry ? entry[:count] : 0
            avg_risk = entry ? entry[:avg_risk] : 0

            risk_level = if avg_risk >= RiskRuleConfig.get(:block_threshold) then "high"
                         elsif avg_risk >= RiskRuleConfig.get(:flag_threshold) then "medium"
                         else "low"
                         end

            data << { day: days[day], hour: hour, value: count, risk_level: risk_level }
          end
        end

        data
      end

      def build_risk_score_ranges(transactions)
        [
          { range: "0-20", min: 0, max: 20, count: transactions.where("risk_score >= 0 AND risk_score <= 20").count, color: "#22c55e" },
          { range: "21-40", min: 21, max: 40, count: transactions.where("risk_score >= 21 AND risk_score <= 40").count, color: "#84cc16" },
          { range: "41-60", min: 41, max: 60, count: transactions.where("risk_score >= 41 AND risk_score <= 60").count, color: "#f59e0b" },
          { range: "61-80", min: 61, max: 80, count: transactions.where("risk_score >= 61 AND risk_score <= 80").count, color: "#f97316" },
          { range: "81-100", min: 81, max: 100, count: transactions.where("risk_score >= 81 AND risk_score <= 100").count, color: "#ef4444" }
        ]
      end

      def build_rules_triggered(transactions)
        rules_counts = Hash.new(0)

        transactions.joins(:fraud_evaluation)
          .where.not(fraud_evaluations: { rules_triggered: [ nil, "" ] })
          .pluck("fraud_evaluations.rules_triggered")
          .each do |rules_str|
            rules_str.split(",").map(&:strip).reject(&:empty?).each do |rule|
              rules_counts[rule] += 1
            end
          end

        rules_counts
          .map { |name, count| { name: name.gsub("_", " "), count: count } }
          .sort_by { |r| -r[:count] }
          .first(6)
      end

      def build_high_risk_transactions(transactions)
        transactions
          .where("risk_score >= ?", RiskRuleConfig.get(:flag_threshold))
          .order(risk_score: :desc)
          .limit(5)
          .map do |t|
            {
              id: t.id,
              amount: t.amount.to_f,
              payment_method: t.payment_method,
              status: t.status,
              risk_score: t.risk_score
            }
          end
      end

      def safe_parse_date(date_string)
        Date.parse(date_string)
      rescue Date::Error
        Date.current
      end
    end
  end
end
