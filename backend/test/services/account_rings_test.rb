require "test_helper"

class AccountRingsTest < ActiveSupport::TestCase
  def customer(name)
    User.create!(email: "#{name}@rings.test", password: "password123", first_name: name.capitalize, last_name: "Ring", role: "customer", status: "active")
  end

  def pay(user, device, at: Time.current, **attrs)
    user.transactions.create!({ amount: 40, payment_method: "wallet", device_id: device, created_at: at }.merge(attrs))
  end

  setup do
    @a = customer("a")
    @b = customer("b")
    @c = customer("c")
    @d = customer("d")
  end

  test "an account on its own device has no ring" do
    pay(@a, "dev-a")
    assert_empty AccountRings.new(@a).members
    assert_equal({ linked_accounts: "none", linked_accounts_voided_by_a_person: "none" }, AccountRings.new(@a).facts)
  end

  test "two accounts on one device are linked both ways at one hop" do
    pay(@a, "dev-shared")
    pay(@b, "dev-shared")

    assert_equal [ @b.id ], AccountRings.new(@a).members.map(&:user_id)
    assert_equal [ 1 ], AccountRings.new(@a).members.map(&:hops)
    assert_equal [ @a.id ], AccountRings.new(@b).members.map(&:user_id)
    assert_equal "1 other account", AccountRings.new(@a).facts[:linked_accounts]
  end

  test "a chain is followed through the account between, up to three hops" do
    pay(@a, "dev-1")
    pay(@b, "dev-1")
    pay(@b, "dev-2")
    pay(@c, "dev-2")
    pay(@c, "dev-3")
    pay(@d, "dev-3")

    members = AccountRings.new(@a).members
    assert_equal [ [ @b.id, 1 ], [ @c.id, 2 ], [ @d.id, 3 ] ], members.map { |m| [ m.user_id, m.hops ] }
    assert_equal "2 to 3 other accounts", AccountRings.new(@a).facts[:linked_accounts]
  end

  test "a fourth hop is not followed" do
    e = customer("e")
    pay(@a, "dev-1"); pay(@b, "dev-1")
    pay(@b, "dev-2"); pay(@c, "dev-2")
    pay(@c, "dev-3"); pay(@d, "dev-3")
    pay(@d, "dev-4"); pay(e, "dev-4")

    assert_not_includes AccountRings.new(@a).members.map(&:user_id), e.id
  end

  test "payments older than the window do not link accounts" do
    pay(@a, "dev-old")
    pay(@b, "dev-old", at: 45.days.ago)
    assert_empty AccountRings.new(@a).members
  end

  test "a device shared by more than the hub limit is not a link" do
    crowd = Array.new(AccountRings::HUB_LIMIT + 1) { |i| customer("crowd#{i}") }
    crowd.each { |u| pay(u, "dev-kiosk") }
    pay(@a, "dev-kiosk")
    assert_empty AccountRings.new(@a).members
  end

  test "blank device ids never link" do
    [ @a, @b ].product([ "", nil ]).each do |user, device|
      user.transactions.build(amount: 40, payment_method: "wallet", device_id: device).save!(validate: false)
    end
    assert_empty AccountRings.new(@a).members
  end

  test "facts count linked accounts a person voided, and carry no identifier" do
    pay(@a, "dev-s")
    voided = pay(@b, "dev-s", paypal_status: "VOIDED")
    FraudEvaluation.create!(financial_transaction: voided, risk_score: 40, human_label: "block", label_source: "decision")
    pay(@c, "dev-s")

    facts = AccountRings.new(@a).facts
    assert_equal "2 to 3 other accounts", facts[:linked_accounts]
    assert_equal "1 of 2", facts[:linked_accounts_voided_by_a_person]
    text = facts.to_json
    [ @b.email, @c.email, "dev-s", @b.id.to_s ].each { |secret| assert_not_includes text, secret }
  end

  test "detail lists members nearest first with their payment counts" do
    pay(@a, "dev-s")
    pay(@b, "dev-s", paypal_status: "CAPTURED")
    pay(@b, "dev-s")
    detail = AccountRings.new(@a).detail

    assert_equal 2, detail[:size]
    assert_equal 1, detail[:depth]
    assert_equal 1, detail[:devices_shared]
    assert_equal({ user_id: @b.id, email: @b.email, hops: 1, payments: 2, voided: 0, captured: 1 }, detail[:members].first)
  end

  test "the walk ends on a cycle" do
    pay(@a, "dev-1"); pay(@b, "dev-1")
    pay(@b, "dev-2"); pay(@c, "dev-2")
    pay(@c, "dev-3"); pay(@a, "dev-3")
    assert_equal [ @b.id, @c.id ].sort, AccountRings.new(@a).members.map(&:user_id).sort
  end
end
