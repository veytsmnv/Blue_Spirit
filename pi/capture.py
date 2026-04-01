import subprocess
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
script_dir  = Path(__file__).resolve().parent       # .../pi/
repo_root   = script_dir.parent                     # .../Blue_Spirit/
capture_dir = repo_root / "capture"
process_py  = script_dir / "process.py"

capture_dir.mkdir(parents=True, exist_ok=True)

# ── Pick next photo number ────────────────────────────────────────────────────
existing = list(capture_dir.glob("photo_*.jpg"))
nums = [int(f.stem.replace("photo_", "")) for f in existing if f.stem.replace("photo_", "").isdigit()]
next_num = max(nums) + 1 if nums else 1
output = capture_dir / f"photo_{next_num}.jpg"

# ── Capture ───────────────────────────────────────────────────────────────────
subprocess.run(["rpicam-jpeg", "-o", str(output)], check=True)

# ── Process (lighting correction + perspective warp if calibrated) ────────────
# Fix: was calling "python" (wrong on Pi) and using a relative path for process.py
subprocess.run(["python3", str(process_py), str(output), str(output)], check=True)

print("Saved:", output)