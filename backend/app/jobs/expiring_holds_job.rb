# Holds are PayPal authorizations and they lapse (29 days). A hold nobody decided must not lapse silently:
#   - ALERT_WINDOW before the end every admin and manager gets one high-priority notification;
#   - VOID_WINDOW before the end the system voids it itself. Voiding is the safe direction: the buyer is not charged and
#     the hold is released, which is the same thing PayPal would do at expiry, only recorded and explained in the log.
# The system never captures: only a human or the policy under its limits moves money.
class ExpiringHoldsJob < ApplicationJob
  queue_as :default

  ALERT_WINDOW = 72.hours
  VOID_WINDOW = 12.hours
  ACTOR = "System".freeze

  def perform
    held = Transaction.where(paypal_status: "HELD").where(paypal_authorization_expires_at: ..ALERT_WINDOW.from_now)
    held.find_each do |transaction|
      if transaction.paypal_authorization_expires_at <= VOID_WINDOW.from_now
        void(transaction)
      else
        alert(transaction)
      end
    end
  end

  private

  def void(transaction)
    client = transaction.simulated? ? SimulatedPaypalClient.new : PaypalClient.new
    expires = transaction.paypal_authorization_expires_at.utc.strftime("%Y-%m-%d %H:%M UTC")
    PaypalActions.new(client: client).void(transaction, actor: ACTOR, reason: "Hold expires #{expires} and nobody decided; voided before it lapsed, nothing was charged")
  rescue PaypalActions::InvalidState, PaypalClient::Error => e
    Rails.logger.error("ExpiringHoldsJob could not void #{transaction.id}: #{e.message}")
  end

  def alert(transaction)
    return if Notification.unscoped.where(notification_type: "system").exists?([ "data->>'transaction_id' = ? AND data->>'kind' = 'hold_expiring'", transaction.id.to_s ])

    hours = ((transaction.paypal_authorization_expires_at - Time.current) / 1.hour).floor
    User.where(role: %i[admin manager], status: :active).find_each do |user|
      user.notifications.create!(notification_type: "system", priority: "high", title: "A held payment is about to expire",
                                 message: "A held payment of #{transaction.amount.to_s('F')} expires in about #{hours} hours. Approve or void it in the review queue, or it is voided automatically 12 hours before it lapses.",
                                 data: { kind: "hold_expiring", transaction_id: transaction.id.to_s })
    end
  end
end
