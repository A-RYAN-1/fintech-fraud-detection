Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      get "health", to: "health#check"

      namespace :auth do
        post "register", to: "registrations#create"
        post "login", to: "sessions#create"
        delete "logout", to: "sessions#destroy"
        get "me", to: "sessions#show"
      end

      get "analytics", to: "analytics#show"

      namespace :admin do
        resources :users, only: [ :index ] do
          member do
            patch :status, action: :update_status
            patch :role, action: :update_role
          end
        end
        resources :audit_logs, only: [ :index ]
        resources :risk_rules, only: [ :index ], param: :key do
          collection { post :reset }
        end
        patch "risk_rules/:key", to: "risk_rules#update", as: :risk_rule
      end

      post "paypal/orders", to: "paypal_orders#create"
      post "paypal/orders/:order_id/authorize", to: "paypal_orders#authorize"

      resources :transactions, only: [ :index, :create ] do
        post "feedback", to: "fraud_feedbacks#create"
      end

      resources :notifications, only: [ :index, :destroy ] do
        member do
          patch :mark_read
        end
        collection do
          post :mark_all_read
          delete :destroy_all
        end
      end
    end
  end
end
