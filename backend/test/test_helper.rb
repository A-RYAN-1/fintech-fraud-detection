ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # Add more helper methods to be used by all tests here...

    # minitest 6 no longer ships minitest/mock: swap a class method for the block, then put it back.
    def replace_class_method(klass, name, callable)
      original = klass.method(name)
      klass.singleton_class.send(:define_method, name) { |*args, **kwargs, &blk| callable.call(*args, **kwargs, &blk) }
      yield
    ensure
      klass.singleton_class.send(:define_method, name, original)
    end
  end
end
