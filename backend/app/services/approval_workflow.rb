# Four-eyes for money. A request is raised by one person and settled by a different admin:
#   - an approve or void above the requester's decision limit;
#   - every refund, whoever asks.
# Raising a request moves no money and calls PayPal zero times. Approving it runs the action through PaypalActions as
# the deciding admin, so the payment audit row names the admin, and the request row and its audit rows name the requester.
class ApprovalWorkflow
  class SelfApproval < StandardError; end
  class NotPending < StandardError; end

  MAX_NOTE = 200

  def initialize(client: nil)
    @client = client
  end

  def request!(payment:, action:, requester:, reason: nil, amount: nil)
    payment.with_lock do
      amount = validate_request!(payment, action, amount)
      raise PaypalActions::InvalidState, "A #{action} for this payment is already waiting for an admin" if ApprovalRequest.pending.exists?(payment: payment, action: action)

      request = ApprovalRequest.create!(payment: payment, action: action, amount: amount, reason: reason.to_s.squish.first(MAX_NOTE).presence, requested_by: requester)
      AuditLog.record!(event_type: "APPROVAL_REQUESTED", entity_type: "Transaction", entity_id: payment.id, actor: requester,
                       description: "#{requester.email} asked an admin to #{action} #{describe(request)}: #{reason.presence || 'no reason given'}",
                       after: { request_id: request.id, action: action, amount: amount&.to_s("F") }.compact, reason: reason)
      request
    end
  end

  def approve!(request, admin:, note: nil)
    request.with_lock do
      guard!(request, admin)
      actions = PaypalActions.new(client: @client || client_for(request.payment))
      why = "#{label(request)} requested by #{request.requested_by.email}#{request.reason ? " (#{request.reason})" : ''}, approved by #{admin.email}#{note.present? ? ": #{note}" : ''}"
      case request.action
      when "approve" then actions.capture(request.payment, actor: admin, reason: why)
      when "void" then actions.void(request.payment, actor: admin, reason: why)
      when "refund" then actions.refund(request.payment, actor: admin, reason: why, amount: request.amount)
      end
      settle!(request, admin, :approved, note)
    end
  end

  def reject!(request, admin:, note: nil)
    request.with_lock do
      guard!(request, admin)
      settle!(request, admin, :rejected, note)
    end
  end

  private

  def validate_request!(payment, action, amount)
    raise ArgumentError, "Unknown action" unless ApprovalRequest::ACTIONS.include?(action)

    case action
    when "refund"
      unless %w[CAPTURED PARTIALLY_REFUNDED].include?(payment.paypal_status)
        raise PaypalActions::InvalidState, "Cannot refund a payment that is #{payment.paypal_status.to_s.downcase.presence || 'not authorized'}"
      end

      remaining = payment.refundable_amount
      raise PaypalActions::InvalidAmount, "Nothing is left to refund" unless remaining.positive?

      value = amount.present? ? BigDecimal(amount.to_s) : remaining
      raise PaypalActions::InvalidAmount, "Refund must be more than 0 and at most #{remaining.to_s('F')} (what is left)" unless value.positive? && value <= remaining

      value
    else
      unless %w[AUTHORIZED HELD].include?(payment.paypal_status)
        raise PaypalActions::InvalidState, "Cannot #{action} a payment that is #{payment.paypal_status.to_s.downcase.presence || 'not authorized'}"
      end

      nil
    end
  end

  def guard!(request, admin)
    raise NotPending, "This request was already #{request.status}" unless request.pending?
    raise SelfApproval, "You asked for this yourself; a different admin has to settle it" if request.requested_by_id == admin.id
  end

  def settle!(request, admin, status, note)
    request.update!(status: status, decided_by: admin, decided_at: Time.current, decision_note: note.to_s.squish.first(MAX_NOTE).presence)
    AuditLog.record!(event_type: "APPROVAL_#{status.to_s.upcase}", entity_type: "Transaction", entity_id: request.payment_id, actor: admin,
                     description: "#{admin.email} #{status} the #{request.action} requested by #{request.requested_by.email}#{note.present? ? ": #{note}" : ''}",
                     before: { status: "pending" }, after: { status: status.to_s }, reason: note)
    request
  end

  def client_for(payment)
    payment.simulated? ? SimulatedPaypalClient.new : PaypalClient.new
  end

  def label(request)
    { "approve" => "Capture", "void" => "Void", "refund" => "Refund" }.fetch(request.action)
  end

  def describe(request)
    request.amount ? "of #{request.amount.to_s('F')}" : "of the payment"
  end
end
