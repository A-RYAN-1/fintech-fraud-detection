require "digest"

# Labelled evaluations as plain rows for retraining the second score on Kaggle (ml/retrain.py).
# A row exists only where a person decided a held payment (human_label) and the feature vector was stored.
# No user, payment or device identifiers leave the database: `row_key` is a one-way hash used only to make
# the train and hold-out split stable between runs.
class MlTrainingExport
  def self.rows
    FraudEvaluation.where.not(human_label: nil).where.not(ml_features: nil).order(:created_at, :id).map do |evaluation|
      {
        row_key: Digest::SHA256.hexdigest(evaluation.id.to_s)[0, 16],
        features: evaluation.ml_features,
        label: evaluation.human_label == "block" ? 1 : 0,
        ml_score: evaluation.ml_score,
        ml_version: evaluation.ml_version,
        rules_score: evaluation.risk_score
      }
    end
  end
end
