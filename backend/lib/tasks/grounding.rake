namespace :analyst do
  desc "Read-only: how many saved case narratives passed, were rejected or needed no check (no Gemini calls, no writes)"
  task grounding_report: :environment do
    counts = Hash.new(0)
    AuditLog.where(event_type: CaseNarrative::EVENT).find_each do |log|
      counts[log.after_state.to_h.dig("grounding", "status") || "before_the_check"] += 1
    end
    total = counts.values.sum
    puts({ narratives: total, **counts.transform_keys(&:to_sym) }.to_json)
    checked = counts["passed"] + counts["rejected"]
    puts "AI drafts checked: #{checked}, rejected: #{counts['rejected']}" if checked.positive?
    puts "No AI draft has been checked yet; claim nothing about the rejection rate." if checked.zero?
  end
end
