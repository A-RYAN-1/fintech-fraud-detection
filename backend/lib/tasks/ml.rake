namespace :ml do
  desc "Write labelled evaluations (features, label, current score) as JSON for ml/retrain.py. OUT=path (default tmp/ml_training.json)"
  task export: :environment do
    path = ENV.fetch("OUT", Rails.root.join("tmp/ml_training.json").to_s)
    rows = MlTrainingExport.rows
    File.write(path, JSON.pretty_generate(rows))
    blocks = rows.count { |row| row[:label] == 1 }
    puts "wrote #{rows.size} rows (#{blocks} block, #{rows.size - blocks} approve) to #{path}"
  end
end
