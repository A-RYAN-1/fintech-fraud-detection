class CaseEmbedding < ApplicationRecord
  belongs_to :financial_transaction, class_name: "Transaction"

  has_neighbors :embedding
end
