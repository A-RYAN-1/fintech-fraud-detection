# Second risk score from a logistic regression exported by ml/train.py (config/ml/risk_model_v1.json).
# The score can only add a flag; blocking stays with the rules (see TransactionRiskEvaluator).
# Set ML_SCORE_ENABLED=false to switch it off without a deploy of new code.
class MlRiskScorer
  MODEL_PATH = Rails.root.join("config/ml/risk_model_v1.json")
  TOP_REASONS = 3
  LABELS = {
    "log_amount" => "Large amount",
    "log_amount_ratio" => "Amount far above the user's average",
    "first_txn" => "First transaction of the user",
    "log_txns_1m" => "Several transactions in the last minute",
    "log_txns_1h" => "Several transactions in the last hour",
    "night" => "Night-time transaction (00:00 to 06:00 UTC)",
    "pay_upi" => "Paid by UPI",
    "pay_bank_transfer" => "Paid by bank transfer",
    "pay_wallet" => "Paid from a wallet",
    "new_ip" => "IP address not seen before for this user",
    "untrusted_device" => "Device differs from the trusted device"
  }.freeze

  def self.enabled?
    ENV.fetch("ML_SCORE_ENABLED", "true") != "false"
  end

  def self.model
    @model ||= JSON.parse(File.read(MODEL_PATH)).freeze
  end

  # Returns { probability:, flag:, version:, reasons: [{ feature:, label:, contribution: }] },
  # or nil when the score is off or fails: a broken model must never stop a payment from being rules-checked.
  def self.score(vector)
    return nil unless enabled?

    new(model).score(vector)
  rescue StandardError => e
    Rails.logger.error("ML score skipped: #{e.class}: #{e.message}")
    nil
  end

  def initialize(model)
    @model = model
  end

  def score(vector)
    contributions = contributions_for(vector)
    logit = @model["intercept"] + contributions.sum
    probability = 1.0 / (1.0 + Math.exp(-logit))

    {
      probability: probability,
      flag: probability >= @model["flag_threshold"],
      version: @model["version"],
      reasons: top_reasons(contributions)
    }
  end

  private

  def contributions_for(vector)
    @model["features"].each_index.map do |i|
      @model["coef"][i] * (vector[i] - @model["mean"][i]) / @model["scale"][i]
    end
  end

  def top_reasons(contributions)
    @model["features"].zip(contributions)
      .select { |_, c| c > 0 }
      .max_by(TOP_REASONS) { |_, c| c }
      .map { |feature, c| { feature: feature, label: LABELS.fetch(feature, feature), contribution: c.round(3) } }
  end
end
