import subprocess
from pathlib import Path

output = Path(__file__).resolve().parent.parent / "capture" / "latest.jpg"

output.parent.mkdir(parents=True, exist_ok=True)

subprocess.run(["rpicam-jpeg", "-o", str(output)], check=True)

print("Saved:", output)