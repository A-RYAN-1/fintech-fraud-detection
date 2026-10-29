require "securerandom"

# Seeded demo traffic. Every payment goes through the real pipeline (rules, model, the agent's capture, hold or void)
# with SimulatedPaypalClient, so no PayPal call is made and no money exists. Customers, a reviewer and an analyst live
# under DOMAIN, so `DemoTraffic.clean!` removes everything this created and nothing else.
#
# Scenarios (device ids start with "demo-"; the reviewer's scripted decision is the ground truth the feedback loop reads):
#   normal      steady small payments on the customer's own device: captured by the agent
#   traveller   a legitimate customer on a new device with a larger amount: flagged, the reviewer approves (rules wrong)
#   ring        groups of four customers whose payments come from one shared device each: flagged, the reviewer voids
#               (rules right, but the shared device is a signal only a cross-customer view sees); `rings` sets how many
#   blocked     a much larger amount on a new device: blocked and voided by the rules
#   leave_open  the last held payments of the run stay held for a live demo
# Same seed gives the same plan.
class DemoTraffic
  DOMAIN = "demo.sentrix.test".freeze
  RING_DEVICE = "demo-ring-1".freeze
  RING_SIZE = 4

  Report = Struct.new(:created, :captured, :held, :voided, :decided, :left_open, :users, keyword_init: true)

  def initialize(seed: 42, customers: 16, days: 14, leave_open: 3, ai_last: 0, rings: 1)
    @rng = Random.new(seed)
    @customers = customers
    @days = days
    @leave_open = leave_open
    @ai_last = ai_last
    @rings = rings
    @client = SimulatedPaypalClient.new
    @counts = Hash.new(0)
    @password = "Demo-#{SecureRandom.hex(8)}"
  end

  # Removes everything a run created; returns how many payments went.
  def self.clean!
    users = User.where("email LIKE ?", "%@#{DOMAIN}")
    ids = Transaction.where(user_id: users.select(:id)).pluck(:id)
    ApprovalRequest.where(payment_id: ids).delete_all
    AuditLog.where(entity_type: "Transaction", entity_id: ids.map(&:to_s)).delete_all
    AuditLog.where(entity_type: "User", entity_id: users.pluck(:id).map(&:to_s)).delete_all
    AuditLog.where(actor_id: users.select(:id)).delete_all
    users.destroy_all
    ids.size
  end

  def run
    reviewer = staff("reviewer", :reviewer)
    analyst = staff("analyst", :analyst)
    people = Array.new(@customers) { |i| customer(i + 1) }
    plan = build_plan(people)
    held = []

    plan.each_with_index do |step, index|
      transaction = pay(step, ai_on: index >= plan.size - @ai_last)
      @counts[:created] += 1
      held << [ transaction, step ] if transaction.paypal_status == "HELD"
    end

    left = held.shuffle(random: @rng).first(@leave_open)
    (held - left).each { |transaction, step| decide(transaction, step, reviewer, analyst) }
    Report.new(created: @counts[:created], captured: @counts[:captured], held: @counts[:held], voided: @counts[:voided],
               decided: @counts[:decided], left_open: left.size, users: people.size + 2)
  end

  private

  def staff(name, role)
    User.find_or_create_by!(email: "demo.#{name}@#{DOMAIN}") do |u|
      u.password = @password
      u.first_name = "Demo"
      u.last_name = name.capitalize
      u.role = role
    end
  end

  def customer(number)
    User.find_or_create_by!(email: "demo.customer#{number}@#{DOMAIN}") do |u|
      u.password = @password
      u.first_name = %w[Asha Ravi Meera Kabir Isha Neel Tara Vikram Anaya Rohan Diya Arjun].fetch((number - 1) % 12)
      u.last_name = "Demo#{number}"
    end
  end

  # Every customer first builds a small history on their own device; the scenarios come after.
  def build_plan(people)
    bases = people.to_h { |user| [ user.id, 20 + @rng.rand(40) ] }
    history = []
    people.each_with_index do |user, i|
      (4 + @rng.rand(4)).times { history << { user: user, device: "demo-home-#{i + 1}", amount: jitter(bases[user.id]), scenario: :normal } }
    end

    later = []
    ring = people.first([ RING_SIZE * @rings, people.size ].min)
    ring.each_with_index do |user, i|
      group = i / RING_SIZE
      device = group.zero? ? RING_DEVICE : "demo-ring-#{group + 1}"
      2.times { later << { user: user, device: device, amount: jitter(bases[user.id] * 5.5), scenario: :ring, ring: true, group: group } }
    end
    people.drop(ring.size).each_with_index do |user, i|
      base = bases[user.id]
      home = "demo-home-#{people.index(user) + 1}"
      later << case i % 4
               when 0, 1 then { user: user, device: "demo-trip-#{i}", amount: jitter(base * 2.4), scenario: :traveller }
               when 2 then { user: user, device: "demo-new-#{i}", amount: jitter(base * 12), scenario: :blocked }
               else { user: user, device: home, amount: jitter(base), scenario: :normal }
               end
    end

    history + later
  end

  def jitter(value)
    (value * (0.85 + @rng.rand * 0.3)).round(2).clamp(5, 900)
  end

  def pay(step, ai_on:)
    previous = ENV["AI_ANALYST_ENABLED"]
    ENV["AI_ANALYST_ENABLED"] = ai_on ? (previous.presence || "true") : "false"
    checkout = PaypalCheckout.new(user: step[:user], client: @client)
    transaction = checkout.create_order(amount: step[:amount], device_id: step[:device], ip_address: ip_for(step))
    checkout.settle(transaction.paypal_order_id)
    transaction.reload
    spread(transaction)
    @counts[transaction.paypal_status.downcase.to_sym] += 1
    transaction
  ensure
    previous.nil? ? ENV.delete("AI_ANALYST_ENABLED") : ENV["AI_ANALYST_ENABLED"] = previous
  end

  def ip_for(step)
    step[:ring] ? "203.0.113.#{77 + step[:group]}" : "198.51.100.#{(step[:user].id % 200) + 1}"
  end

  # Old payments look old: the run covers the last `days` days.
  def spread(transaction)
    at = Time.current - @rng.rand(@days * 24 * 3600)
    transaction.update_columns(created_at: at, updated_at: at, paypal_authorized_at: at)
  end

  def decide(transaction, step, reviewer, analyst)
    actions = PaypalActions.new(client: @client)
    legit = !step[:ring]
    if @rng.rand < 0.5
      why = legit ? "matches the customer history" : "device is shared with other customers"
      proposal = legit ? "approve" : "void"
      AuditLog.record!(event_type: "DECISION_PROPOSED", entity_type: "Transaction", entity_id: transaction.id, actor: analyst,
                       description: "#{analyst.email} proposed to #{proposal}: #{why}", reason: why, after: { proposal: proposal })
    end
    if legit
      actions.capture(transaction, actor: reviewer, reason: "Approved by a human: customer verified")
    else
      actions.void(transaction, actor: reviewer, reason: "Voided by a human: shared device across customers")
    end
    stamp_label(transaction)
    @counts[:decided] += 1
  end

  # The decision is made some hours after the payment, so the agreement history spreads over the run.
  def stamp_label(transaction)
    evaluation = transaction.fraud_evaluation
    at = [ transaction.created_at + (1 + @rng.rand(20)).hours, Time.current ].min
    evaluation&.update_columns(labeled_at: at)
  end
end
