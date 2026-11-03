require "test_helper"

class DemoTrafficTest < ActiveSupport::TestCase
  setup { RiskRuleConfig.reset_cache! }

  def run_traffic(**options)
    # A real PayPal client must never be built: demo traffic is simulated end to end.
    replace_class_method(PaypalClient, :new, ->(*) { raise "PayPal must not be called" }) do
      DemoTraffic.new(**{ seed: 7, customers: 8, days: 7, leave_open: 2, agents: false }.merge(options)).run
    end
  end

  def demo_payments
    Transaction.joins(:user).where("users.email LIKE ?", "%@#{DemoTraffic::DOMAIN}")
  end

  test "a run makes every payment simulated and runs the real pipeline" do
    report = run_traffic

    assert_equal demo_payments.count, report.created
    assert demo_payments.all?(&:simulated?)
    assert_operator report.captured, :>, 0
    assert_operator report.voided, :>, 0
    assert_equal 2, report.left_open
    assert_equal 2, demo_payments.where(paypal_status: "HELD").count
    assert demo_payments.all? { |t| t.fraud_evaluation.present? }
  end

  test "the same seed gives the same outcome" do
    first = run_traffic.to_h
    DemoTraffic.clean!
    assert_equal first, run_traffic.to_h
  end

  test "reviewer decisions are audited with a role and the ring is voided while travellers are approved" do
    run_traffic

    ring = demo_payments.where(device_id: DemoTraffic::RING_DEVICE)
    assert ring.where(paypal_status: "VOIDED").exists?
    assert_not ring.where(paypal_status: "CAPTURED").exists?

    log = AuditLog.where(entity_type: "Transaction", actor_role: "reviewer").where("description LIKE ?", "%shared device%").first
    assert_not_nil log
    assert_equal "HELD", log.before_state["paypal_status"]
    assert_equal "VOIDED", log.after_state["paypal_status"]

    approved = AuditLog.where(event_type: "PAYPAL_CAPTURED", actor_role: "reviewer")
    assert approved.exists?, "legitimate travellers are approved by the reviewer"
  end

  test "the account ring graph finds the seeded ring and what the reviewer did with it" do
    run_traffic(customers: 12, rings: 1)
    ring_user = User.find(demo_payments.where(device_id: DemoTraffic::RING_DEVICE).pick(:user_id))
    detail = AccountRings.new(ring_user).detail

    assert_equal DemoTraffic::RING_SIZE, detail[:size]
    assert_equal 1, detail[:depth]
    assert detail[:members].all? { |m| m[:voided].positive? }
    assert_match(/of #{DemoTraffic::RING_SIZE - 1}\z/, AccountRings.new(ring_user).facts[:linked_accounts_voided_by_a_person])
  end

  test "rings scales the number of shared-device groups, each with its own device and IP" do
    run_traffic(customers: 12, rings: 2)

    devices = demo_payments.where("device_id LIKE ?", "demo-ring-%").distinct.pluck(:device_id).sort
    assert_equal %w[demo-ring-1 demo-ring-2], devices
    assert_equal 2, demo_payments.where("device_id LIKE ?", "demo-ring-%").distinct.pluck(:ip_address).size
  end

  test "clean removes what a run created and nothing else" do
    existing = users(:one).transactions.create!(amount: 10, payment_method: "wallet", device_id: "mine", status: "SUCCESS")
    run_traffic
    assert_operator demo_payments.count, :>, 0

    removed = DemoTraffic.clean!

    assert_operator removed, :>, 0
    assert_equal 0, demo_payments.count
    assert_equal 0, User.where("email LIKE ?", "%@#{DemoTraffic::DOMAIN}").count
    assert_equal 0, AuditLog.where(actor_role: %w[reviewer analyst]).where("description LIKE ?", "%demo.%").count
    assert Transaction.exists?(existing.id)
  end

  test "the AI analyst is off during generation unless asked for the last payments" do
    seen = []
    replace_class_method(AiAnalyst, :enabled?, -> { seen << ENV["AI_ANALYST_ENABLED"]; false }) { run_traffic(ai_last: 0) }
    assert seen.all? { |v| v == "false" } if seen.any?
    assert_nil ENV["AI_ANALYST_ENABLED"], "the environment is restored after the run"
  end

  test "seed_customer! gives a shared login a history once and never calls PayPal" do
    user = users(:one)
    # The model scores 00:00 to 06:00 UTC as night-time; pin the clock so this does not depend on when CI runs.
    added = travel_to(Time.utc(2026, 11, 3, 12, 0, 0)) do
      replace_class_method(PaypalClient, :new, ->(*) { raise "PayPal must not be called" }) do
        DemoTraffic.seed_customer!(user)
      end
    end

    paypal = user.transactions.where.not(paypal_status: [ nil, *HomeSummary::NOT_AUTHORIZED ])
    assert_equal 8, added
    assert_equal 8, paypal.count
    assert paypal.all?(&:simulated?)
    assert_equal({ "CAPTURED" => 6, "HELD" => 1, "VOIDED" => 1 }, paypal.group(:paypal_status).count)
    assert_equal 0, DemoTraffic.seed_customer!(user), "a second run adds nothing"
  end

  test "the agent persona has mandates, payments inside, refusals outside and one payment held on a new agent device" do
    report = run_traffic(agents: true)
    owner = User.find_by!(email: DemoTraffic::AGENT_OWNER)
    mandates = owner.agent_mandates.index_by(&:label)

    assert_equal 4, report.mandates
    assert_equal 4, report.refused
    assert_equal demo_payments.count, report.created
    assert demo_payments.all?(&:simulated?)
    assert_equal 4, AuditLog.where(event_type: "MANDATE_REFUSED").count
    assert_equal %w[merchant_not_allowed mandate_revoked over_per_payment_cap over_total_cap].sort,
                 AuditLog.where(event_type: "MANDATE_REFUSED").pluck(:reason).sort
    assert mandates.fetch("Gadget agent").revoked?
    assert_operator mandates.fetch("Travel agent").remaining, :<=, 20
    assert_operator mandates.fetch("Groceries agent").transactions.where(paypal_status: "CAPTURED").count, :>=, 3

    held = mandates.fetch("Deal hunter agent").transactions
    assert_equal [ "HELD" ], held.pluck(:paypal_status), "the new-device agent payment is held for a reviewer"
    assert_operator report.left_open, :>=, 1
  end

  test "clean removes the agent persona, its mandates and the mandate audit rows" do
    run_traffic(agents: true)
    assert_operator AgentMandate.count, :>=, 4

    DemoTraffic.clean!

    assert_equal 0, AgentMandate.count
    assert_equal 0, AuditLog.where(entity_type: "AgentMandate").count
    assert_equal 0, Transaction.where.not(agent_mandate_id: nil).count
    assert_nil User.find_by(email: DemoTraffic::AGENT_OWNER)
  end

  test "the agent persona does not change the plan of the other customers" do
    without = run_traffic(agents: false).to_h
    DemoTraffic.clean!
    with = run_traffic(agents: true).to_h

    assert_equal without[:decided], with[:decided]
    assert_equal without[:voided], with[:voided]
  end
end
