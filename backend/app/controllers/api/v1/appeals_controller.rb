module Api
  module V1
    # A customer answers a hold: one short note on a payment that is waiting for review. It is saved as an audit row
    # (CUSTOMER_APPEAL) the reviewer sees on the case. It changes nothing about the payment; a person still decides.
    class AppealsController < ApplicationController
      before_action :authenticate_user!

      MAX_NOTE = 250
      MIN_NOTE = 5

      # POST /api/v1/transactions/:transaction_id/appeal  { note: "..." }
      def create
        transaction = current_user.transactions.find(params[:transaction_id])
        return render_error("Only a payment that is waiting for review can be answered", :conflict) unless transaction.paypal_status == "HELD"
        return render_error("You already sent a note on this payment", :conflict) if Appeal.exists_for?(transaction)

        text = params.require(:note).to_s.squish
        if text.length < MIN_NOTE
          return render_error("Write at least #{MIN_NOTE} characters", :unprocessable_entity)
        end

        log = Appeal.record!(transaction, user: current_user, text: text.first(MAX_NOTE))
        render_success({ submitted_at: log.created_at, note: log.reason }, "Your note was sent to the reviewer", :created)
      rescue ActiveRecord::RecordNotFound
        render_error("Transaction not found", :not_found)
      end
    end
  end
end
