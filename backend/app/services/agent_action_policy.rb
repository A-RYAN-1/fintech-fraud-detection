# Decides what the agent may do with one authorized PayPal payment. Pure: no database, no network.
#   - The rules and the model are the floor: a blocked payment is voided, a flagged one is held, whatever the AI says.
#   - The AI can only confirm or escalate: an approved payment the AI sends to review or block is held for a human.
#     The AI never voids by itself and never lifts a hold.
#   - An approved payment is captured only inside the admin limits; above them it is held.
module AgentActionPolicy
  Decision = Struct.new(:action, :reason, keyword_init: true)

  # rules_status: "SUCCESS", "FLAGGED" or "BLOCKED" (the transaction status after rules and model).
  # ai: the stored verdict hash (string keys) or nil. limit_breach: nil, or the sentence AutoCaptureLimits returned.
  def self.decide(rules_status:, ai:, limit_breach:)
    case rules_status.to_s.upcase
    when "BLOCKED"
      Decision.new(action: :void, reason: "Blocked by the risk rules; nothing is charged")
    when "FLAGGED"
      Decision.new(action: :hold, reason: "Flagged by the risk rules; a human decides")
    when "SUCCESS"
      ai_action = ai && ai["action"]
      if %w[review block].include?(ai_action)
        Decision.new(action: :hold, reason: "Rules approved it, the AI analyst escalated to #{ai_action == 'block' ? 'a block recommendation' : 'review'}; a human decides")
      elsif limit_breach
        Decision.new(action: :hold, reason: limit_breach)
      else
        Decision.new(action: :capture, reason: ai_action == "approve" ? "Approved by the rules and confirmed by the AI analyst, inside the limits" : "Approved by the rules, inside the limits")
      end
    else
      Decision.new(action: :hold, reason: "Unknown risk status; a human decides")
    end
  end
end
