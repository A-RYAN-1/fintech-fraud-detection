namespace :analyst do
  desc "Have the AI analyst read held payments it never read (advice only, marked read_after_hold). LIMIT=n PAUSE=7. In production add CONFIRM=yes"
  task backfill_held: :environment do
    abort "Refusing to run in production without CONFIRM=yes" if Rails.env.production? && ENV["CONFIRM"] != "yes"
    abort "The AI analyst is not configured or is switched off" unless AiAnalyst.enabled?

    limit = ENV["LIMIT"].presence&.to_i
    report = AnalystBackfill.new(limit: limit, pause: ENV.fetch("PAUSE", AnalystBackfill::DEFAULT_PAUSE).to_f).run
    puts report.map { |k, v| "#{k}=#{v}" }.join(" ")
  end
end
