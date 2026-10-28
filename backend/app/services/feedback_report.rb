# What the humans decided, compared with what each automatic signal said. A reviewer's decision on a held payment is the
# label (approve or block); a full refund of a captured payment later turns its label to block. Each signal votes safe or
# risky and is scored against the label:
#   rules  the rules and the model together (the payment's status: success is safe, flagged or blocked is risky)
#   ml     the model alone (score at or above its flag threshold is risky)
#   ai     the analyst (approve is safe, review or block is risky); missing when the analyst was down
# "false alarm" is a signal that called it risky when the human approved; "miss" is the reverse.
class FeedbackReport
  SIGNALS = %w[rules ml ai].freeze

  def initialize(scope: FraudEvaluation.where.not(human_label: nil))
    @evaluations = scope.includes(:financial_transaction, :labeled_by).order(labeled_at: :desc, id: :desc).to_a
  end

  def summary
    labels = @evaluations.map { |e| e.human_label }
    {
      labelled: @evaluations.size,
      human_approve: labels.count("approve"),
      human_block: labels.count("block"),
      signals: SIGNALS.to_h { |signal| [ signal, signal_stats(signal, @evaluations) ] },
      daily: daily
    }
  end

  # Rows where at least one signal disagreed with the human; `signal` narrows to one of them.
  def disagreements(signal: nil)
    rows = @evaluations.filter_map do |evaluation|
      wrong = SIGNALS.select { |s| (vote = vote_for(s, evaluation)) && vote != human_vote(evaluation) }
      next if wrong.empty? || (signal.present? && !wrong.include?(signal))

      serialize(evaluation, wrong)
    end
    rows
  end

  private

  def human_vote(evaluation)
    evaluation.human_label == "approve" ? :safe : :risky
  end

  def vote_for(signal, evaluation)
    case signal
    when "rules" then evaluation.financial_transaction.success? ? :safe : :risky
    when "ml" then evaluation.ml_score.nil? ? nil : (evaluation.ml_score >= ml_threshold ? :risky : :safe)
    when "ai" then (action = evaluation.ai_verdict&.dig("action")) ? (action == "approve" ? :safe : :risky) : nil
    end
  end

  def ml_threshold
    @ml_threshold ||= MlRiskScorer.model.fetch("flag_threshold")
  end

  def signal_stats(signal, evaluations)
    answered = evaluations.filter_map { |e| (v = vote_for(signal, e)) && [ v, human_vote(e) ] }
    agree = answered.count { |v, h| v == h }
    {
      answered: answered.size,
      agree: agree,
      agreement_rate: rate(agree, answered.size),
      false_alarms: answered.count { |v, h| v == :risky && h == :safe },
      misses: answered.count { |v, h| v == :safe && h == :risky }
    }
  end

  def daily
    @evaluations.group_by { |e| e.labeled_at.to_date }.sort.map do |day, rows|
      { date: day.iso8601, labelled: rows.size }.merge(SIGNALS.to_h { |s| [ s, signal_stats(s, rows)[:agreement_rate] ] })
    end
  end

  def rate(part, whole)
    whole.zero? ? nil : (part.to_f / whole).round(3)
  end

  def serialize(evaluation, wrong)
    payment = evaluation.financial_transaction
    {
      transaction_id: payment.id,
      amount: payment.amount.to_f,
      human_label: evaluation.human_label,
      label_source: evaluation.label_source,
      labeled_by: evaluation.labeled_by&.email,
      labeled_at: evaluation.labeled_at,
      rules_status: payment.status,
      rules_triggered: evaluation.rules_triggered.to_s.split(","),
      ml_score: evaluation.ml_score,
      ai_action: evaluation.ai_verdict&.dig("action"),
      ai_confidence: evaluation.ai_verdict&.dig("confidence"),
      ai_explanation: evaluation.ai_verdict&.dig("explanation"),
      disagreeing: wrong
    }
  end
end
