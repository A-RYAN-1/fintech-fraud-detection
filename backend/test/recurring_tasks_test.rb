require "test_helper"
require "fugit"

class RecurringTasksTest < ActiveSupport::TestCase
  test "production schedules the expiring holds job with a valid cron" do
    tasks = YAML.safe_load_file(Rails.root.join("config/recurring.yml")).fetch("production")
    task = tasks.fetch("expiring_holds")
    assert_equal "ExpiringHoldsJob", task["class"]
    assert Fugit.parse_cron(task["schedule"]), "schedule #{task['schedule']} is not a cron expression"
    assert Object.const_defined?(task["class"])
  end

  test "weekly reports stay off until mail delivery is configured" do
    assert_nil YAML.safe_load_file(Rails.root.join("config/recurring.yml")).fetch("production")["weekly_reports"]
  end
end
