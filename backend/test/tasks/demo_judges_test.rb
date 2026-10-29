require "test_helper"
require "rake"

class DemoJudgesTaskTest < ActiveSupport::TestCase
  setup do
    Rails.application.load_tasks unless Rake::Task.task_defined?("demo:judges")
    Rake::Task["demo:judges"].reenable
  end

  test "creates the three shared logins and resets a changed one" do
    assert_output(/ready judge\.admin@sentrix\.demo role=admin limit=none/) { Rake::Task["demo:judges"].invoke }

    admin = User.find_by!(email: User::SANDBOX_ADMIN_EMAIL)
    assert admin.sandbox_admin?
    assert User.find_by!(email: "judge.reviewer@sentrix.demo").reviewer?
    assert User.find_by!(email: "john@example.com").customer?
    assert User::DEMO_EMAILS.all? { |email| User.find_by!(email: email).demo_account? }

    admin.update!(role: :customer, status: :suspended, password: "changed-it1")
    Rake::Task["demo:judges"].reenable
    capture_io { Rake::Task["demo:judges"].invoke }
    admin.reload
    assert admin.admin?
    assert admin.active?
    assert admin.authenticate("password123")
  end
end
