require "json"

namespace :ai do
  desc "Run the AI analyst on the 30 labelled cases and print the agreement table (calls Gemini; paced for the free tier)"
  task evaluate: :environment do
    abort "GEMINI_API_KEY is not set" unless GeminiClient.configured?

    cases = JSON.parse(File.read(Rails.root.join("test/fixtures/files/ai_eval_cases.json")))
    pause = Integer(ENV.fetch("AI_EVAL_PAUSE", "12"))
    analyst = AiAnalyst.new
    rows = cases.map do |c|
      verdict = nil
      3.times do
        verdict = analyst.verdict(c["facts"])
        break if verdict

        sleep(pause * 2)
      end
      sleep(pause)
      warn "#{c['id']}: label=#{c['label']} rules=#{c['facts']['rules_decision']} ai=#{verdict && verdict[:action]}"
      { id: c["id"], label: c["label"], rules: c["facts"]["rules_decision"], ai: verdict&.dig(:action), confidence: verdict&.dig(:confidence), why: verdict&.dig(:explanation), model: verdict&.dig(:model) }
    end

    scored = rows.select { |r| r[:ai] }
    pct = ->(n, d) { d.zero? ? "n/a" : format("%.0f%% (%d of %d)", 100.0 * n / d, n, d) }
    puts "model: #{scored.first&.dig(:model)}  cases: #{rows.size}  answered: #{scored.size}"
    puts "rules agree with label: #{pct.call(rows.count { |r| r[:rules] == r[:label] }, rows.size)}"
    puts "AI agrees with label:   #{pct.call(scored.count { |r| r[:ai] == r[:label] }, scored.size)}"
    puts "AI agrees with rules:   #{pct.call(scored.count { |r| r[:ai] == r[:rules] }, scored.size)}"
    %w[approve review block].each do |klass|
      of_class = scored.select { |r| r[:label] == klass }
      puts "  label #{klass}: AI right #{pct.call(of_class.count { |r| r[:ai] == klass }, of_class.size)}, rules right #{pct.call(rows.count { |r| r[:label] == klass && r[:rules] == klass }, rows.count { |r| r[:label] == klass })}"
    end
    puts "disagreements with the label:"
    scored.reject { |r| r[:ai] == r[:label] }.each { |r| puts "  #{r[:id]} label=#{r[:label]} rules=#{r[:rules]} ai=#{r[:ai]} (#{r[:confidence]}): #{r[:why]}" }
    File.write(ENV["AI_EVAL_OUT"], JSON.pretty_generate(rows)) if ENV["AI_EVAL_OUT"]
  end
end
