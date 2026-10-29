# Payments were always in USD, but old notification texts printed the rupee sign. Fix the stored texts once.
class DollarSignInOldNotifications < ActiveRecord::Migration[8.1]
  def up
    execute "UPDATE notifications SET message = REPLACE(message, '₹', '$') WHERE message LIKE '%₹%'"
  end

  def down
    # Nothing to restore: the rupee sign was wrong.
  end
end
