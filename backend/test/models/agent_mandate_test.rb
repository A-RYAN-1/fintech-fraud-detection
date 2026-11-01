require "test_helper"

class AgentMandateTest < ActiveSupport::TestCase
  def issue(**overrides)
    AgentMandate.issue!(user: users(:one), label: "Shopper", merchant: "Sentrix Demo Store", per_payment_cap: 100, total_cap: 250,
                        expires_at: 3.days.from_now, **overrides)
  end

  test "the token is returned once and only its digest is stored" do
    mandate, token = issue
    assert token.start_with?("smt_")
    assert_equal AgentMandate.digest(token), mandate.token_digest
    assert_not_includes mandate.attributes.values.map(&:to_s), token
    assert_equal token.last(4), mandate.token_hint
    assert_equal mandate, AgentMandate.find_by_token(token)
    assert_nil AgentMandate.find_by_token("smt_wrong")
    assert_nil AgentMandate.find_by_token(token.delete_prefix("smt_"))
  end

  test "caps must be positive, consistent and the expiry bounded" do
    assert_not AgentMandate.new(user: users(:one), label: "x", merchant: "m", per_payment_cap: 300, total_cap: 200, expires_at: 1.day.from_now).valid?
    assert_not AgentMandate.new(user: users(:one), label: "x", merchant: "m", per_payment_cap: 0, total_cap: 200, expires_at: 1.day.from_now).valid?
    assert_not AgentMandate.new(user: users(:one), label: "x", merchant: "m", per_payment_cap: 10, total_cap: 200, expires_at: 1.day.ago).valid?
    assert_not AgentMandate.new(user: users(:one), label: "x", merchant: "m", per_payment_cap: 10, total_cap: 200, expires_at: 90.days.from_now).valid?
  end

  test "refusal codes cover merchant, per-payment cap and total cap" do
    mandate, = issue
    assert_nil mandate.refusal_for(amount: BigDecimal("100"), merchant: "sentrix demo store")
    assert_equal "merchant_not_allowed", mandate.refusal_for(amount: BigDecimal("10"), merchant: "Other Shop")
    assert_equal "over_per_payment_cap", mandate.refusal_for(amount: BigDecimal("100.01"), merchant: "Sentrix Demo Store")
  end

  test "reserve adds to the spent amount until the total cap is reached" do
    mandate, = issue
    mandate.reserve!(amount: BigDecimal("100"), merchant: "Sentrix Demo Store")
    mandate.reserve!(amount: BigDecimal("100"), merchant: "Sentrix Demo Store")
    assert_equal BigDecimal("50"), mandate.reload.remaining
    error = assert_raises(AgentMandate::Refused) { mandate.reserve!(amount: BigDecimal("60"), merchant: "Sentrix Demo Store") }
    assert_equal "over_total_cap", error.code
    assert_equal BigDecimal("200"), mandate.reload.spent_amount
    mandate.reserve!(amount: BigDecimal("50"), merchant: "Sentrix Demo Store")
    assert_equal "exhausted", mandate.reload.status
  end

  test "release gives the cap back and never goes below zero" do
    mandate, = issue
    mandate.reserve!(amount: BigDecimal("40"), merchant: "Sentrix Demo Store")
    mandate.release!(BigDecimal("40"))
    assert_equal 0, mandate.reload.spent_amount
    mandate.release!(BigDecimal("40"))
    assert_equal 0, mandate.reload.spent_amount
  end

  test "revoked and expired mandates refuse everything" do
    mandate, = issue
    mandate.revoke!(by: users(:one))
    assert_equal "revoked", mandate.status
    assert_equal "mandate_revoked", mandate.refusal_for(amount: BigDecimal("1"), merchant: "Sentrix Demo Store")

    expired, = issue
    expired.update_columns(expires_at: 1.minute.ago)
    assert_equal "expired", expired.status
    assert_equal "mandate_expired", expired.refusal_for(amount: BigDecimal("1"), merchant: "Sentrix Demo Store")
  end
end
