# Be sure to restart your server when you modify this file.

# Avoid CORS issues when API is called from the frontend app.
# Handle Cross-Origin Resource Sharing (CORS) in order to accept cross-origin Ajax requests.

# Read more: https://github.com/cyu/rack-cors

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    allowed_origins = [
      'http://localhost:5173',
      'http://localhost:3001',
      'https://editor.swagger.io',
      'https://fintech-fraud-detection.vercel.app'
    ]
    
    # Add production frontend URL if configured (for flexibility)
    if ENV['FRONTEND_URL'].present?
      allowed_origins << ENV['FRONTEND_URL']
      Rails.logger.info "CORS: Added FRONTEND_URL: #{ENV['FRONTEND_URL']}"
    end
    
    Rails.logger.info "CORS: Allowed origins: #{allowed_origins.inspect}"
    
    origins allowed_origins.compact

    resource "*",
      headers: :any,
      methods: %i[get post put patch delete options head],
      expose: [ "Authorization", "Idempotency-Replayed" ],
      credentials: true
  end
end
