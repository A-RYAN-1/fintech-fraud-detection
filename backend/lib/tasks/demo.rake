namespace :demo do
  desc "Seeded demo traffic through the real pipeline with simulated PayPal. SEED=42 CUSTOMERS=16 DAYS=14 LEAVE_OPEN=3 AI_LAST=0. In production add CONFIRM=yes"
  task traffic: :environment do
    abort "Refusing to run in production without CONFIRM=yes" if Rails.env.production? && ENV["CONFIRM"] != "yes"

    report = DemoTraffic.new(seed: ENV.fetch("SEED", 42).to_i, customers: ENV.fetch("CUSTOMERS", 16).to_i, days: ENV.fetch("DAYS", 14).to_i,
                             leave_open: ENV.fetch("LEAVE_OPEN", 3).to_i, ai_last: ENV.fetch("AI_LAST", 0).to_i).run
    puts report.to_h.map { |k, v| "#{k}=#{v}" }.join(" ")
  end

  desc "Remove everything demo:traffic created (users under demo.sentrix.test and their payments)"
  task clean: :environment do
    puts "removed #{DemoTraffic.clean!} payments"
  end
end
