require "test_helper"

class AgentActionPolicyTest < ActiveSupport::TestCase
  AI_APPROVE = { "action" => "approve", "confidence" => 0.9, "explanation" => "ok" }.freeze
  AI_REVIEW = AI_APPROVE.merge("action" => "review").freeze
  AI_BLOCK = AI_APPROVE.merge("action" => "block").freeze
  BREACH = "Amount is above the auto-capture limit".freeze

  def decide(status, ai, breach = nil)
    AgentActionPolicy.decide(rules_status: status, ai: ai, limit_breach: breach)
  end

  # rules x AI x limits: [rules status, ai verdict, limit breach, expected action]
  MATRIX = [
    [ "SUCCESS", nil, nil, :capture ],
    [ "SUCCESS", AI_APPROVE, nil, :capture ],
    [ "SUCCESS", AI_REVIEW, nil, :hold ],
    [ "SUCCESS", AI_BLOCK, nil, :hold ],
    [ "SUCCESS", nil, BREACH, :hold ],
    [ "SUCCESS", AI_APPROVE, BREACH, :hold ],
    [ "SUCCESS", AI_REVIEW, BREACH, :hold ],
    [ "SUCCESS", AI_BLOCK, BREACH, :hold ],
    [ "FLAGGED", nil, nil, :hold ],
    [ "FLAGGED", AI_APPROVE, nil, :hold ],
    [ "FLAGGED", AI_REVIEW, nil, :hold ],
    [ "FLAGGED", AI_BLOCK, nil, :hold ],
    [ "FLAGGED", AI_APPROVE, BREACH, :hold ],
    [ "BLOCKED", nil, nil, :void ],
    [ "BLOCKED", AI_APPROVE, nil, :void ],
    [ "BLOCKED", AI_REVIEW, nil, :void ],
    [ "BLOCKED", AI_BLOCK, nil, :void ]
  ].freeze

  MATRIX.each_with_index do |(status, ai, breach, expected), i|
    test "matrix #{i}: rules #{status}, AI #{ai ? ai['action'] : 'none'}, #{breach ? 'over limit' : 'inside limits'} -> #{expected}" do
      assert_equal expected, decide(status, ai, breach).action
    end
  end

  test "the AI never voids a payment the rules did not block" do
    %w[SUCCESS FLAGGED].each do |status|
      [ nil, AI_APPROVE, AI_REVIEW, AI_BLOCK ].each do |ai|
        [ nil, BREACH ].each do |breach|
          assert_not_equal :void, decide(status, ai, breach).action
        end
      end
    end
  end

  test "a capture is only possible when the rules approved" do
    [ "FLAGGED", "BLOCKED", "WHATEVER" ].each { |s| assert_not_equal :capture, decide(s, AI_APPROVE).action }
  end

  test "an unknown status is held for a human" do
    assert_equal :hold, decide("PENDING", AI_APPROVE).action
  end

  test "the reason names why" do
    assert_match(/AI analyst escalated to review/, decide("SUCCESS", AI_REVIEW).reason)
    assert_match(/block recommendation/, decide("SUCCESS", AI_BLOCK).reason)
    assert_equal BREACH, decide("SUCCESS", AI_APPROVE, BREACH).reason
  end
end
