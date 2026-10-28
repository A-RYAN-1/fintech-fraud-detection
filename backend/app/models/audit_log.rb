# One row per decision or change. The structured columns say who (actor, role), what changed (before and after) and why
# (reason); `description` stays the readable sentence. A system actor (jobs, the agent) has no user and no role.
class AuditLog < ApplicationRecord
  belongs_to :actor, class_name: "User", optional: true

  validates :event_type, :entity_type, :entity_id, presence: true

  # `actor` is a User, a String (a system name such as "System") or nil.
  def self.record!(event_type:, entity_type:, entity_id:, description:, actor: nil, before: nil, after: nil, reason: nil)
    user = actor if actor.is_a?(User)
    create!(event_type: event_type, entity_type: entity_type, entity_id: entity_id.to_s, description: description,
            actor: user, actor_role: user&.role || (actor.is_a?(String) ? "system" : nil),
            before_state: before, after_state: after, reason: reason.to_s.first(255).presence)
  end
end
