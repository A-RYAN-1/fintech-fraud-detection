# Every 30 minutes: read failed jobs and the analyst's counters into incidents. Reads only; it files nothing.
class IncidentScanJob < ApplicationJob
  queue_as :default

  def perform
    IncidentScan.run
  end
end
