# Has the analyst read held payments it never read: payments seeded with the analyst off (demo:traffic AI_LAST=0) or
# evaluated while it was down. The input is the same facts-only payload AskAnalyst rebuilds from what was stored. The
# verdict is stored as advice next to the rules decision with read_after_hold: true, so nobody mistakes it for the read
# taken at payment time; it never changes the payment's status, a hold or a decision. Calls are paced for the free tier
# (AnalystGuard allows 10 a minute); a skipped or failed read leaves the row as it was, so a re-run picks it up.
class AnalystBackfill
  DEFAULT_PAUSE = 7.0

  def initialize(analyst: AiAnalyst.new, limit: nil, pause: DEFAULT_PAUSE, sleeper: ->(seconds) { sleep(seconds) }, now: -> { Time.current })
    @analyst = analyst
    @limit = limit
    @pause = pause
    @sleeper = sleeper
    @now = now
  end

  def self.unread
    Transaction.where(paypal_status: "HELD").joins(:fraud_evaluation).where(fraud_evaluations: { ai_verdict: nil })
  end

  def run
    payments = self.class.unread.includes(:fraud_evaluation, :user).order(created_at: :desc, id: :desc)
    payments = payments.limit(@limit) if @limit
    read = skipped = 0
    payments.to_a.each_with_index do |payment, index|
      @sleeper.call(@pause) if index.positive?
      verdict = @analyst.verdict(AskAnalyst.new(payment).facts)
      if verdict
        payment.fraud_evaluation.update!(ai_verdict: verdict.merge(read_after_hold: true, read_at: @now.call.iso8601))
        read += 1
      else
        skipped += 1
      end
    end
    { read: read, skipped: skipped, left: self.class.unread.count }
  end
end
