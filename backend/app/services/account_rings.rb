# Account and device ring graph. Accounts are linked when they paid from the same device id; the link is followed up
# to MAX_DEPTH hops with one recursive query (user -> device -> user -> ...), so a ring of accounts that never share a
# single device pairwise is still found through the accounts between them. Only the last WINDOW of payments counts,
# and a device shared by more than HUB_LIMIT accounts (a public kiosk, an office machine) is ignored as a link.
#
# Two consumers, two shapes of output:
#   facts(user)   bands only, for the AI analyst (no id, email or device id leaves the server)
#   detail(user)  the members and the evidence behind each link, for staff in the review queue
class AccountRings
  MAX_DEPTH = 3
  WINDOW = 30.days
  HUB_LIMIT = 25
  MAX_MEMBERS = 50

  Member = Struct.new(:user_id, :email, :hops, :payments, :voided, :captured, keyword_init: true)

  def initialize(user, now: Time.current)
    @user = user
    @since = now - WINDOW
  end

  def facts
    others = members
    return { linked_accounts: "none", linked_accounts_voided_by_a_person: "none" } if others.empty?

    voided = others.count { |m| m.voided.positive? }
    { linked_accounts: band(others.size), linked_accounts_voided_by_a_person: voided.zero? ? "none" : "#{voided} of #{others.size}" }
  end

  def detail
    others = members
    { size: others.size + 1, depth: others.map(&:hops).max || 0, members: others.map(&:to_h),
      devices_shared: shared_device_count, window_days: WINDOW.in_days.to_i }
  end

  # The other accounts in the ring, nearest first. A ring needs at least one other account.
  def members
    @members ||= begin
      rows = walk
      ids = rows.keys
      return [] if ids.empty?

      stats = payment_stats(ids)
      emails = User.where(id: ids).pluck(:id, :email).to_h
      rows.map do |id, hops|
        s = stats[id] || { payments: 0, voided: 0, captured: 0 }
        Member.new(user_id: id, email: emails[id], hops: hops, payments: s[:payments], voided: s[:voided], captured: s[:captured])
      end.sort_by { |m| [ m.hops, -m.voided, m.email.to_s ] }
    end
  end

  private

  def band(count)
    if count == 1 then "1 other account"
    elsif count <= 3 then "2 to 3 other accounts"
    else "4 or more other accounts"
    end
  end

  # { user_id => fewest hops from @user }, excluding @user. UNION (not UNION ALL) plus the depth cap ends the walk.
  def walk
    sql = <<~SQL.squish
      WITH RECURSIVE edges AS (
        SELECT DISTINCT user_id, device_id FROM transactions
        WHERE device_id IS NOT NULL AND device_id <> '' AND created_at >= :since
      ), hubs AS (
        SELECT device_id FROM edges GROUP BY device_id HAVING COUNT(*) > :hub
      ), links AS (
        SELECT user_id, device_id FROM edges WHERE device_id NOT IN (SELECT device_id FROM hubs)
      ), walk(user_id, hops) AS (
        SELECT CAST(:uid AS bigint), 0
        UNION
        SELECT other.user_id, walk.hops + 1
        FROM walk
        JOIN links mine ON mine.user_id = walk.user_id
        JOIN links other ON other.device_id = mine.device_id AND other.user_id <> walk.user_id
        WHERE walk.hops < :depth
      )
      SELECT user_id, MIN(hops) AS hops FROM walk WHERE user_id <> :uid GROUP BY user_id ORDER BY MIN(hops), user_id LIMIT :cap
    SQL
    binds = { since: @since, hub: HUB_LIMIT, uid: @user.id, depth: MAX_DEPTH, cap: MAX_MEMBERS }
    ActiveRecord::Base.connection.select_rows(ActiveRecord::Base.sanitize_sql([ sql, binds ])).to_h { |id, hops| [ id.to_i, hops.to_i ] }
  end

  def shared_device_count
    mine = Transaction.where(user_id: @user.id).where("created_at >= ?", @since).where.not(device_id: [ nil, "" ]).distinct.pluck(:device_id)
    return 0 if mine.empty?

    Transaction.where(device_id: mine).where.not(user_id: @user.id).where("created_at >= ?", @since).distinct.count(:device_id)
  end

  # Payments, person-voided payments (a human label of block) and captured payments per member in the window.
  def payment_stats(ids)
    scope = Transaction.where(user_id: ids).where("transactions.created_at >= ?", @since)
    payments = scope.group(:user_id).count
    captured = scope.where(paypal_status: %w[CAPTURED PARTIALLY_REFUNDED]).group(:user_id).count
    voided = scope.joins(:fraud_evaluation).where(fraud_evaluations: { human_label: "block" }).group(:user_id).count
    ids.to_h { |id| [ id, { payments: payments[id].to_i, captured: captured[id].to_i, voided: voided[id].to_i } ] }
  end
end
