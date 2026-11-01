# Leave-one-out check of the similar-cases idea on the stored vectors, with no Gemini calls: for each decided case, take
# its 3 nearest other decided cases and ask whether their majority outcome equals the person's outcome. Reported with
# the sample size and the always-guess-the-majority baseline, because with few cases a hit rate means little.
class SimilarCasesCheck
  MIN_SAMPLE = 30

  def self.run
    labels = CaseEmbedding.joins(financial_transaction: :fraud_evaluation).where.not(fraud_evaluations: { human_label: nil })
                          .pluck("case_embeddings.financial_transaction_id", "fraud_evaluations.human_label").to_h
    hits = 0
    labels.each do |id, label|
      neighbours = nearest_labels(id)
      next if neighbours.empty?

      majority = neighbours.tally.max_by { |_, count| count }.first
      hits += 1 if majority == label
    end
    n = labels.size
    baseline = n.zero? ? nil : labels.values.tally.values.max.fdiv(n)
    { sample: n, agreed: hits, agreement: n.zero? ? nil : hits.fdiv(n).round(3), baseline: baseline&.round(3),
      block: labels.values.count("block"), approve: labels.values.count("approve"), enough: n >= MIN_SAMPLE }
  end

  def self.nearest_labels(id)
    sql = ActiveRecord::Base.sanitize_sql_array([ <<~SQL.squish, id, id, SimilarCases::LIMIT ])
      SELECT fe.human_label FROM case_embeddings other
      JOIN fraud_evaluations fe ON fe.transaction_id = other.financial_transaction_id AND fe.human_label IS NOT NULL
      WHERE other.financial_transaction_id <> ?
      ORDER BY other.embedding <=> (SELECT embedding FROM case_embeddings WHERE financial_transaction_id = ?)
      LIMIT ?
    SQL
    ActiveRecord::Base.connection.select_values(sql)
  end
end
