namespace :demo do
  desc "Seeded demo traffic through the real pipeline with simulated PayPal. SEED=42 CUSTOMERS=16 DAYS=14 LEAVE_OPEN=3 AI_LAST=0 RINGS=1. In production add CONFIRM=yes"
  task traffic: :environment do
    abort "Refusing to run in production without CONFIRM=yes" if Rails.env.production? && ENV["CONFIRM"] != "yes"

    report = DemoTraffic.new(seed: ENV.fetch("SEED", 42).to_i, customers: ENV.fetch("CUSTOMERS", 16).to_i, days: ENV.fetch("DAYS", 14).to_i,
                             leave_open: ENV.fetch("LEAVE_OPEN", 3).to_i, ai_last: ENV.fetch("AI_LAST", 0).to_i, rings: ENV.fetch("RINGS", 1).to_i).run
    puts report.to_h.map { |k, v| "#{k}=#{v}" }.join(" ")
  end

  desc "Create or reset the shared sandbox logins shown on the sign-in page: customer, reviewer and the guarded sandbox admin (idempotent; safe in production)"
  task judges: :environment do
    [
      { email: "john@example.com", first_name: "John", last_name: "Success", role: :customer, decision_limit: nil },
      { email: "judge.reviewer@sentrix.demo", first_name: "Judge", last_name: "Reviewer", role: :reviewer, decision_limit: 5000 },
      { email: User::SANDBOX_ADMIN_EMAIL, first_name: "Judge", last_name: "Admin", role: :admin, decision_limit: nil }
    ].each do |attrs|
      user = User.find_or_initialize_by(email: attrs[:email])
      user.assign_attributes(**attrs, status: :active, password: "password123")
      user.save!
      puts "ready #{user.email} role=#{user.role} limit=#{user.effective_decision_limit&.to_s('F') || 'none'}"
    end
  end

  desc "Remove everything demo:traffic created (users under demo.sentrix.test and their payments)"
  task clean: :environment do
    puts "removed #{DemoTraffic.clean!} payments"
  end
end
