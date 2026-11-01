module Api
  module V1
    # POST /api/v1/paypal/webhooks   PayPal's server calls this, not a browser: no session, the signature is the credential.
    # Always answers fast: 200 for a handled or replayed event, 401 when PayPal does not vouch for it, 503 when it
    # cannot be checked right now (PayPal then retries), 500 when handling failed (PayPal retries; the event id is kept).
    class PaypalWebhooksController < ApplicationController
      skip_before_action :check_session_timeout

      HEADERS = %w[PAYPAL-AUTH-ALGO PAYPAL-CERT-URL PAYPAL-TRANSMISSION-ID PAYPAL-TRANSMISSION-SIG PAYPAL-TRANSMISSION-TIME].freeze
      MAX_BODY = 64.kilobytes

      def create
        raw = request.raw_post.to_s
        return render_error("Payload too large", :content_too_large) if raw.bytesize > MAX_BODY

        result = PaypalWebhook.new.receive(headers: HEADERS.to_h { |name| [ name, request.headers[name].to_s ] }, raw_body: raw)
        case result.code
        when :ok then render_success({ outcome: result.outcome })
        when :bad_request then render_error("Not a PayPal event", :bad_request)
        when :unauthorized then render_error("Signature could not be verified", :unauthorized)
        when :not_configured then render_error("Webhooks are not configured", :service_unavailable)
        when :unavailable then render_error("Signature check unavailable", :service_unavailable)
        else render_error("Event could not be handled", :internal_server_error)
        end
      end
    end
  end
end
