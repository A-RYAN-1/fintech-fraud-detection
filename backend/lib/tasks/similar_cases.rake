namespace :similar_cases do
  desc "Embed every decided case that has no vector yet (insert only; one Gemini embedding call per case)"
  task backfill: :environment do
    done = 0
    skipped = 0
    FraudEvaluation.where.not(human_label: nil).includes(:financial_transaction).find_each do |evaluation|
      next if CaseEmbedding.exists?(financial_transaction_id: evaluation.transaction_id)

      SimilarCases.new(evaluation.financial_transaction).index! ? done += 1 : skipped += 1
      sleep 0.7
    end
    puts "embedded #{done} cases, skipped #{skipped}, total vectors #{CaseEmbedding.count}"
  end

  desc "Leave-one-out check on the stored vectors (no Gemini calls)"
  task check: :environment do
    result = SimilarCasesCheck.run
    puts result.to_json
    puts "sample #{result[:sample]}: too small to claim any accuracy (needs #{SimilarCasesCheck::MIN_SAMPLE})" unless result[:enough]
  end
end
