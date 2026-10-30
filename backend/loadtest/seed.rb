# Users and history for the local load test: bin/rails runner - < loadtest/seed.rb   (USERS=40 by default)
# Local stack only. Customers load1..N@loadtest.test sign in with the shared test password and get a few simulated
# payments each, so the list endpoints have something to read.
count = Integer(ENV.fetch("USERS", 40))
count.times do |index|
  user = User.find_or_initialize_by(email: "load#{index + 1}@loadtest.test")
  user.assign_attributes(first_name: "Load", last_name: "Test#{index + 1}", role: :customer, status: :active, password: "password123")
  user.save!
  DemoTraffic.seed_customer!(user) if user.transactions.none?
end
puts "load users=#{count} payments=#{Transaction.count}"
