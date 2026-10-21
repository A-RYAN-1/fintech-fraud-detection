"""Concatenate the ml modules into the single script a Kaggle script kernel accepts."""
import pathlib
import re

here = pathlib.Path(__file__).parent
parts = []
for name in ("features.py", "rules.py", "synthetic.py", "train.py"):
    text = (here / name).read_text()
    text = re.sub(r"^from (features|rules|synthetic) import .*\n", "", text, flags=re.M)
    parts.append(f"# ---- {name}\n{text}")
out = here / "kaggle" / "main.py"
out.write_text("\n".join(parts))
print("wrote", out)
