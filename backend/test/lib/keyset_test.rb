require "test_helper"

class KeysetTest < ActiveSupport::TestCase
  setup do
    @user = users(:one)
    @user.transactions.destroy_all
    @base = Time.utc(2026, 10, 1, 12, 0, 0)
  end

  def make(at)
    @user.transactions.create!(amount: 5, device_id: "d", created_at: at)
  end

  def walk(limit)
    pages = []
    cursor = ""
    loop do
      rows, cursor = Keyset.page(@user.transactions, cursor: cursor, limit: limit)
      pages << rows.map(&:id)
      break if cursor.nil?
    end
    pages
  end

  test "walks every row once, newest first, and ends with a nil cursor" do
    rows = Array.new(7) { |i| make(@base + i.minutes) }
    pages = walk(3)
    assert_equal [ 3, 3, 1 ], pages.map(&:size)
    assert_equal rows.reverse.map(&:id), pages.flatten
  end

  test "rows with the same timestamp are not skipped or repeated across a page edge" do
    rows = Array.new(5) { make(@base) }
    pages = walk(2)
    assert_equal rows.map(&:id).sort.reverse, pages.flatten
    assert_equal pages.flatten.uniq, pages.flatten
  end

  test "a row added after the first page does not shift the next page" do
    Array.new(4) { |i| make(@base + i.minutes) }
    first, cursor = Keyset.page(@user.transactions, cursor: "", limit: 2)
    newest = make(@base + 1.hour)
    second, = Keyset.page(@user.transactions, cursor: cursor, limit: 2)
    assert_not_includes second.map(&:id), newest.id
    assert_empty first.map(&:id) & second.map(&:id)
    assert_equal 2, second.size
  end

  test "an empty list has no cursor" do
    rows, cursor = Keyset.page(@user.transactions, cursor: "", limit: 5)
    assert_empty rows
    assert_nil cursor
  end

  test "a cursor that is not ours is refused" do
    [ "garbage", Base64.urlsafe_encode64("[1,2]"), Base64.urlsafe_encode64('["not a time","x"]'), Base64.urlsafe_encode64("{}") ].each do |bad|
      assert_raises(Keyset::InvalidCursor) { Keyset.page(@user.transactions, cursor: bad, limit: 2) }
    end
  end

  test "a cursor round trips through encode and decode at microsecond precision" do
    t = make(@base + 0.123456.seconds)
    time, id = Keyset.decode(Keyset.encode(t))
    assert_equal t.id, id
    assert_equal t.created_at.to_f.round(6), time.to_f.round(6)
  end
end
