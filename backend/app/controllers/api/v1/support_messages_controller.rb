module Api
  module V1
    # The Help page's contact form: a signed-in person writes to the admins, and every active admin gets the message
    # as a notification. Rate limited per person (config/initializers/throttling.rb).
    class SupportMessagesController < ApplicationController
      TOPICS = %w[payment review account other].freeze
      MAX_SUBJECT = 120
      MAX_MESSAGE = 800

      before_action :authenticate_user!

      # POST /api/v1/support_messages  { topic: "payment", subject: "...", message: "..." }
      def create
        topic = params[:topic].to_s
        subject = params[:subject].to_s.squish
        message = params[:message].to_s.strip
        return render_error("Topic must be one of #{TOPICS.join(', ')}", :unprocessable_entity) unless TOPICS.include?(topic)
        return render_error("Subject is required (up to #{MAX_SUBJECT} characters)", :unprocessable_entity) unless subject.length.between?(1, MAX_SUBJECT)
        return render_error("Message is required (up to #{MAX_MESSAGE} characters)", :unprocessable_entity) unless message.length.between?(1, MAX_MESSAGE)

        admins = User.where(role: :admin, status: :active)
        sender = "#{current_user.first_name} #{current_user.last_name} (#{current_user.email}, #{current_user.role})"
        ActiveRecord::Base.transaction do
          admins.each do |admin|
            admin.notifications.create!(notification_type: "support", priority: "medium",
                                        title: "Support (#{topic}): #{subject}".first(255),
                                        message: "From #{sender}: #{message}".first(1000),
                                        data: { from_user_id: current_user.id, topic: topic })
          end
          AuditLog.record!(event_type: "SUPPORT_MESSAGE_SENT", entity_type: "User", entity_id: current_user.id,
                           description: "#{current_user.email} sent a #{topic} support message to #{admins.size} admin(s)",
                           actor: current_user)
        end
        render_success({ delivered_to: admins.size }, "Message sent to the admins", :created)
      end
    end
  end
end
