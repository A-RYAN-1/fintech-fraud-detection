# One embedding per decided case, for the "Similar past cases" panel. Needs the pgvector extension (Neon free has it;
# local Docker and CI use the pgvector/pgvector image). The vector is made from the facts-only payload text, never ids.
class CreateCaseEmbeddings < ActiveRecord::Migration[8.1]
  def change
    enable_extension "vector"

    create_table :case_embeddings do |t|
      t.references :financial_transaction, type: :uuid, null: false, foreign_key: { to_table: :transactions, on_delete: :cascade }, index: { unique: true }
      t.vector :embedding, limit: 768, null: false
      t.text :facts_text, null: false
      t.string :model, null: false
      t.timestamps
    end

    add_index :case_embeddings, :embedding, using: :hnsw, opclass: :vector_cosine_ops
  end
end
