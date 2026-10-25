module Api
  module V1
    class TransactionsController < ApplicationController
      before_action :authenticate_user!

      DEFAULT_PAGE = 1
      DEFAULT_PER_PAGE = 10
      MAX_PER_PAGE = 100
      SORT_COLUMNS = { "created_at" => :created_at, "amount" => :amount, "risk_score" => :risk_score }.freeze

      # GET /api/v1/transactions
      def index
        transactions = current_user.transactions.includes(:fraud_evaluation)

        # Search filter (searches ID, amount, payment_method)
        if params[:search].present?
          search_term = ActiveRecord::Base.sanitize_sql_like(params[:search].to_s.strip)
          transactions = transactions.where(
            "CAST(id AS TEXT) ILIKE :search OR CAST(amount AS TEXT) ILIKE :search OR payment_method ILIKE :search",
            search: "%#{search_term}%"
          )
        end

        # Date filters
        if params[:start_date].present?
          transactions = transactions.where("created_at >= ?", safe_parse_date(params[:start_date]).beginning_of_day)
        end

        if params[:end_date].present?
          transactions = transactions.where("created_at <= ?", safe_parse_date(params[:end_date]).end_of_day)
        end

        # Status filter
        if params[:status].present?
          transactions = transactions.where(status: params[:status].upcase)
        end

        # Payment method filter
        if params[:payment_method].present?
          transactions = transactions.where(payment_method: params[:payment_method])
        end

        # Risk score range filter
        if params[:min_risk_score].present?
          transactions = transactions.where("risk_score >= ?", params[:min_risk_score].to_i)
        end

        if params[:max_risk_score].present?
          transactions = transactions.where("risk_score <= ?", params[:max_risk_score].to_i)
        end

        # Amount range filter
        if params[:min_amount].present?
          transactions = transactions.where("amount >= ?", params[:min_amount].to_f)
        end

        if params[:max_amount].present?
          transactions = transactions.where("amount <= ?", params[:max_amount].to_f)
        end

        # Sorting
        sort_column = SORT_COLUMNS.fetch(params[:sort_by].to_s, :created_at)
        sort_direction = params[:sort_order] == "asc" ? :asc : :desc
        transactions = transactions.order(sort_column => sort_direction)

        # Pagination
        page = (params[:page] || DEFAULT_PAGE).to_i
        per_page = [(params[:per_page] || DEFAULT_PER_PAGE).to_i, MAX_PER_PAGE].min

        total_count = transactions.count
        transactions = transactions.offset((page - 1) * per_page).limit(per_page)

        # User stats
        user_stats = current_user.user_transaction_stat

        render_success({
          transactions: transactions.map { |t| serialize_transaction(t) },
          pagination: {
            current_page: page,
            total_pages: (total_count.to_f / per_page).ceil,
            total_count: total_count
          },
          user_stats: user_stats ? {
            total_transactions: current_user.transactions.count,
            total_volume: current_user.transactions.where(status: %w[SUCCESS FLAGGED]).sum(:amount).to_f,
            average_spending: user_stats.avg_amount.to_f,
            last_active: user_stats.last_updated_at
          } : nil
        })
      end

      # POST /api/v1/transactions
      def create
        transaction = current_user.transactions.new(transaction_params)
        transaction.ip_address = request.remote_ip

        if transaction.save
          status = TransactionRiskEvaluator.new(transaction).evaluate
          transaction.reload

          render_success(
            serialize_transaction(transaction),
            "Transaction processed successfully",
            :created
          )
        else
          render_error("Transaction failed", :unprocessable_entity, transaction.errors.full_messages)
        end
      rescue ActiveRecord::RecordInvalid => e
        render_error("Transaction processing failed", :internal_server_error, e.message)
      end

      private

      def transaction_params
        params.require(:transaction).permit(:amount, :payment_method, :device_id)
      end

      def safe_parse_date(date_string)
        Date.parse(date_string)
      rescue Date::Error
        Date.current
      end

      def serialize_transaction(transaction)
        {
          id: transaction.id,
          amount: transaction.amount.to_s,
          payment_method: transaction.payment_method,
          device_id: transaction.device_id,
          status: transaction.status.downcase,
          risk_score: transaction.risk_score,
          ip_address: transaction.ip_address,
          created_at: transaction.created_at,
          rules_triggered: transaction.fraud_evaluation&.rules_triggered || "",
          ml_score: transaction.fraud_evaluation&.ml_score&.round(4),
          ml_explanation: transaction.fraud_evaluation&.ml_explanation || [],
          ai_verdict: transaction.fraud_evaluation&.ai_verdict,
          feedback_submitted: transaction.fraud_evaluation&.is_accurate != nil
        }
      end
    end
  end
end
