# Turns a transaction into the feature vector the model was trained on. The order and the arithmetic
# mirror ml/features.py; test/services/ml_risk_scorer_test.rb replays golden vectors to catch drift.
# Counts and the "new IP" check look at the user's earlier transactions, never the one being scored.
class MlFeatureBuilder
  NIGHT_HOURS = (0..5)
  RATIO_CAP = 50.0

  def initialize(transaction, user, stats)
    @transaction = transaction
    @user = user
    @stats = stats
  end

  def vector
    amount = @transaction.amount.to_f
    avg = @stats.avg_amount.to_f
    ratio = avg > 0 ? [ amount / avg, RATIO_CAP ].min : 0.0

    [
      Math.log(1 + amount),
      Math.log(1 + ratio),
      @stats.total_txns.zero? ? 1.0 : 0.0,
      Math.log(1 + earlier.where("created_at > ?", 1.minute.ago).count),
      Math.log(1 + earlier.where("created_at > ?", 1.hour.ago).count),
      NIGHT_HOURS.cover?(@transaction.created_at.utc.hour) ? 1.0 : 0.0,
      payment?("upi"),
      payment?("bank_transfer"),
      payment?("wallet"),
      new_ip? ? 1.0 : 0.0,
      untrusted_device? ? 1.0 : 0.0
    ]
  end

  private

  def earlier
    @user.transactions.where.not(id: @transaction.id)
  end

  def payment?(method)
    @transaction.payment_method == method ? 1.0 : 0.0
  end

  def new_ip?
    return false if @transaction.ip_address.blank? || @stats.total_txns.zero?

    !earlier.exists?(ip_address: @transaction.ip_address)
  end

  def untrusted_device?
    trusted = @user.devices.first
    trusted.present? && trusted.device_id != @transaction.device_id
  end
end
