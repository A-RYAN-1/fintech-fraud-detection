require "securerandom"

# Stands in for PaypalClient on a simulated payment: same methods, no network, no money. A simulated payment goes
# through the real pipeline (rules, model, AI analyst, admin limits, the agent's capture, hold or void); only the
# PayPal calls at the edges are replaced. Every id starts with SIM- so a simulated payment is always recognisable.
# Simulated state is local only: authorizations, captures and refunds exist as Sentrix rows, never at PayPal, and no
# merchant balance is modelled (an insufficient-balance refund can only be seen with the real sandbox).
class SimulatedPaypalClient
  PREFIX = "SIM-".freeze

  def self.simulated_id?(id)
    id.to_s.start_with?(PREFIX)
  end

  def create_order(**)
    { "id" => "#{PREFIX}ORDER-#{SecureRandom.hex(6).upcase}" }
  end

  def authorize_order(_order_id, **)
    { "id" => "#{PREFIX}AUTH-#{SecureRandom.hex(6).upcase}", "expiration_time" => Transaction::AUTHORIZATION_TTL.from_now.utc.iso8601 }
  end

  def capture(_authorization_id, **)
    { "id" => "#{PREFIX}CAPTURE-#{SecureRandom.hex(6).upcase}" }
  end

  def void(_authorization_id, **)
    {}
  end

  def refund(_capture_id, **)
    { "id" => "#{PREFIX}REFUND-#{SecureRandom.hex(6).upcase}" }
  end
end
