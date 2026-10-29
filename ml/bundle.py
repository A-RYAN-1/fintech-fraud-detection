"""Concatenate the ml modules into the single script a Kaggle script kernel accepts.

python ml/bundle.py          -> kaggle/main.py          (train.py: the original comparison)
python ml/bundle.py retrain  -> kaggle-retrain/main.py  (retrain.py: labels vs the shipped model)
"""
import pathlib
import re
import sys

here = pathlib.Path(__file__).parent
target = sys.argv[1] if len(sys.argv) > 1 else "train"
modules = {
    "train": (("features.py", "rules.py", "synthetic.py", "train.py"), "kaggle"),
    "retrain": (("features.py", "rules.py", "synthetic.py", "train.py", "retrain.py"), "kaggle-retrain"),
}
names, folder = modules[target]
parts = []
for name in names:
    text = (here / name).read_text()
    text = re.sub(r"^from (features|rules|synthetic|train) import .*\n", "", text, flags=re.M)
    if target == "retrain" and name == "train.py":
        # train.py is a library here: its main() must not run before retrain.main().
        text = re.sub(r'\nif __name__ == "__main__":\n    main\(\)\n', "\n", text)
    parts.append(f"# ---- {name}\n{text}")
out = here / folder / "main.py"
out.parent.mkdir(exist_ok=True)
out.write_text("\n".join(parts))
print("wrote", out)
