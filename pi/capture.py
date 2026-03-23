import shutil
import subprocess
from pathlib import Path

capture_dir = Path(__file__).resolve().parent.parent / "capture"
capture_dir.mkdir(parents=True, exist_ok=True)
existing = list(capture_dir.glob("photo_*.jpg"))
nums = [int(f.stem.replace("photo_", "")) for f in existing if f.stem.replace("photo_", "").isdigit()]
next_num = max(nums) + 1 if nums else 1
output = capture_dir / f"photo_{next_num}.jpg"

subprocess.run(["rpicam-jpeg", "-o", str(output)], check=True)

# Process the image
subprocess.run(["python", "pi/process.py", str(output), str(output)], check=True)


print("Saved:", output)