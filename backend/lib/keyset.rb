# Keyset (cursor) pagination for lists ordered newest first: the cursor is the created_at and id of the last row the
# client saw, and the next page is "rows older than that", found by walking an index, so page 500 costs what page 1
# costs. Offset pagination reads and throws away every skipped row. The id is the tie-break for equal timestamps.
module Keyset
  class InvalidCursor < ArgumentError; end

  # An opaque, URL-safe string for the last record of a page.
  def self.encode(record)
    Base64.urlsafe_encode64(JSON.generate([ record.created_at.utc.iso8601(6), record.id.to_s ]), padding: false)
  end

  def self.decode(cursor)
    time, id = JSON.parse(Base64.urlsafe_decode64(cursor.to_s))
    raise InvalidCursor, "Cursor is not valid" unless time.is_a?(String) && id.is_a?(String)

    [ Time.iso8601(time), id ]
  rescue ArgumentError, JSON::ParserError, TypeError
    raise InvalidCursor, "Cursor is not valid"
  end

  # One page of `scope` (a relation on a table with created_at and a uuid id) after `cursor`, newest first.
  # Returns [records, next_cursor]; next_cursor is nil on the last page. Reads one extra row to know there is more.
  def self.page(scope, cursor:, limit:)
    table = scope.klass.quoted_table_name
    scope = scope.reorder(created_at: :desc, id: :desc)
    if cursor.present?
      time, id = decode(cursor)
      scope = scope.where("(#{table}.created_at, #{table}.id) < (?, ?)", time, id)
    end
    rows = scope.limit(limit + 1).to_a
    more = rows.size > limit
    rows = rows.first(limit)
    [ rows, (more ? encode(rows.last) : nil) ]
  end
end
