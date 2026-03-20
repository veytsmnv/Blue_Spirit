import shutil
import subprocess
from pathlib import Path

capture_dir = Path(__file__).resolve().parent.parent / "capture"
capture_dir.mkdir(parents=True, exist_ok=True)

# Find the next number
existing = list(capture_dir.glob("photo_*.jpg"))
next_num = len(existing) + 1
output = capture_dir / f"photo_{next_num}.jpg"

subprocess.run(["rpicam-jpeg", "-o", str(output)], check=True)

# Also save as latest.jpg for fallback
shutil.copy(output, capture_dir / "latest.jpg")

print("Saved:", output)