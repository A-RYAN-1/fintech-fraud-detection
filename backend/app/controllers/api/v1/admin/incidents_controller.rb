module Api
  module V1
    module Admin
      # The incident digest: failures grouped by what went wrong, each with a drafted GitHub issue. Staff read and can
      # refresh the scan; an admin approves (the draft is marked reported, the admin files it) or dismisses. Nothing here
      # files an issue, edits code, changes a rule or moves money.
      class IncidentsController < BaseController
        include Idempotent

        before_action :require_staff!, only: [ :index, :scan ]
        before_action :require_admin!, only: [ :approve, :dismiss, :suggest ]
        idempotent :approve, :dismiss, :suggest

        # GET /api/v1/admin/incidents?status=open|reported|dismissed|all
        def index
          status = params[:status].presence || "open"
          return render_error("Invalid status", :unprocessable_entity) unless status == "all" || Incident.statuses.key?(status)

          scope = Incident.includes(:decided_by).order(last_seen_at: :desc, id: :desc)
          scope = scope.where(status: status) unless status == "all"
          records, meta = paginate(scope)
          open_now = Incident.open.order(last_seen_at: :desc).to_a
          render_success({ incidents: records.map { |incident| serialize(incident) }, meta: meta,
                           digest: IncidentDrafter.digest(open_now), open_count: open_now.size })
        end

        # POST /api/v1/admin/incidents/scan  reads failed jobs and the analyst's counters into incidents now
        def scan
          render_success({ observed: IncidentScan.run, open_count: Incident.open.count }, "Scan finished")
        end

        # POST /api/v1/admin/incidents/:id/approve  { note: "...", issue_url: "https://github.com/..." }
        def approve
          incident = find_open
          return unless incident

          issue_url = params[:issue_url].to_s.strip.presence
          incident.assign_attributes(status: :reported, issue_url: issue_url)
          return render_error(incident.errors.full_messages.to_sentence, :unprocessable_entity) unless incident.valid?

          decide(incident, "INCIDENT_APPROVED", "approved the report for", issue_url ? { issue_url: issue_url } : {})
          render_success(serialize(incident.reload), "Report approved. File it from the link; nothing was filed for you.")
        end

        # POST /api/v1/admin/incidents/:id/dismiss  { note: "..." }
        def dismiss
          incident = find_open
          return unless incident

          incident.status = :dismissed
          decide(incident, "INCIDENT_DISMISSED", "dismissed", {})
          render_success(serialize(incident.reload), "Incident dismissed")
        end

        # POST /api/v1/admin/incidents/:id/suggest  asks the AI analyst for a likely cause (a labelled note, never an action)
        def suggest
          incident = Incident.find_by(id: params[:id])
          return render_error("Incident not found", :not_found) unless incident

          note = IncidentAdvisor.suggest(incident)
          return render_error("The AI analyst is not available right now. The draft stands without it.", :service_unavailable) unless note

          incident.update!(ai_note: note)
          render_success(serialize(incident), "Suggestion added")
        end

        private

        def find_open
          incident = Incident.find_by(id: params[:id])
          return render_error("Incident not found", :not_found) && nil unless incident
          return render_error("This incident is already #{incident.status}", :conflict) && nil unless incident.open?

          incident
        end

        def decide(incident, event, verb, after)
          ActiveRecord::Base.transaction do
            incident.update!(decided_by: current_user, decided_at: Time.current, decision_note: note)
            AuditLog.record!(event_type: event, entity_type: "Incident", entity_id: incident.id.to_s, actor: current_user,
                             description: "#{current_user.email} #{verb} \"#{incident.title}\" (#{incident.occurrences} occurrences)",
                             after: after.merge(status: incident.status), reason: note)
          end
        end

        def note
          params[:note].to_s.squish.first(200).presence
        end

        def serialize(incident)
          draft = IncidentDrafter.issue(incident)
          {
            id: incident.id, kind: incident.kind, title: incident.title, status: incident.status,
            occurrences: incident.occurrences, recurrences: incident.recurrences,
            first_seen_at: incident.first_seen_at, last_seen_at: incident.last_seen_at,
            sample: incident.sample, detail: incident.detail, ai_note: incident.ai_note,
            draft: { title: draft[:title], body: draft[:body], new_issue_url: IncidentDrafter.issue_url(incident) },
            decided_by: incident.decided_by&.email, decided_at: incident.decided_at,
            decision_note: incident.decision_note, issue_url: incident.issue_url
          }
        end
      end
    end
  end
end
