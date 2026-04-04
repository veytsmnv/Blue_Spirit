import cv2
import numpy as np
from pathlib import Path
import sys
import json

# ── Canonical paths ───────────────────────────────────────────────────────────
REPO_ROOT        = Path(__file__).resolve().parent.parent
CALIBRATION_PATH = REPO_ROOT / "calibration.json"
SETTINGS_PATH    = REPO_ROOT / "settings.json"

DEFAULT_SETTINGS = { "brightness": 0, "contrast": 1.0, "sharpness": 0.25 }


def load_calibration(calibration_path=None):
    path = Path(calibration_path) if calibration_path else CALIBRATION_PATH
    if not path.exists():
        print("No calibration file found — skipping warp.")
        return None
    try:
        with open(path) as f:
            data = json.load(f)
        corners = data.get("corners")
        if corners and len(corners) == 4:
            print(f"Loaded calibration from: {path}")
            return corners
        print(f"Warning: calibration file {path} is malformed, ignoring.")
        return None
    except Exception as e:
        print(f"Error reading calibration file: {e}")
        return None


def load_settings():
    try:
        if SETTINGS_PATH.exists():
            with open(SETTINGS_PATH) as f:
                data = json.load(f)
            return { **DEFAULT_SETTINGS, **data }
    except Exception as e:
        print(f"Could not read settings.json: {e}")
    return { **DEFAULT_SETTINGS }


def perspective_warp(img, corners_norm):
    h, w = img.shape[:2]
    src = np.array([
        [corners_norm[0]["x"] * w, corners_norm[0]["y"] * h],
        [corners_norm[1]["x"] * w, corners_norm[1]["y"] * h],
        [corners_norm[2]["x"] * w, corners_norm[2]["y"] * h],
        [corners_norm[3]["x"] * w, corners_norm[3]["y"] * h],
    ], dtype=np.float32)

    width  = int(max(np.linalg.norm(src[1] - src[0]), np.linalg.norm(src[2] - src[3])))
    height = int(max(np.linalg.norm(src[3] - src[0]), np.linalg.norm(src[2] - src[1])))

    dst = np.array([
        [0,         0],
        [width - 1, 0],
        [width - 1, height - 1],
        [0,         height - 1],
    ], dtype=np.float32)

    M = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(img, M, (width, height),
                               flags=cv2.INTER_LINEAR,
                               borderMode=cv2.BORDER_REPLICATE)


def process_image(input_path, output_path, calibration_path=None):
    img = cv2.imread(str(input_path))
    if img is None:
        raise FileNotFoundError(f"Could not read image: {input_path}")

    settings = load_settings()
    brightness = float(settings.get("brightness", 0))      # -100 to 100, added to pixels
    contrast   = float(settings.get("contrast",   1.0))    # 0.5 to 2.0 multiplier
    sharpness  = float(settings.get("sharpness",  0.25))   # 0.0 to 1.0 blend amount

    print(f"Settings — brightness: {brightness}, contrast: {contrast}, sharpness: {sharpness}")

    # ── Step 0: Perspective warp ──────────────────────────────────────────────
    corners = load_calibration(calibration_path)
    if corners:
        img = perspective_warp(img, corners)
        print("Applied perspective warp.")
    else:
        print("No calibration — using full camera frame.")

    # ── Step 1: Lighting correction (subtle) ──────────────────────────────────
    corrected = np.zeros_like(img, dtype=np.float32)
    for i in range(3):
        channel = img[:, :, i].astype(np.float32)
        blur    = cv2.GaussianBlur(channel, (51, 51), 0)
        divided = cv2.divide(channel, blur, scale=255)
        corrected[:, :, i] = 0.3 * divided + 0.7 * channel

    corrected = np.clip(corrected, 0, 255).astype(np.uint8)

    # ── Step 2: CLAHE ─────────────────────────────────────────────────────────
    lab = cv2.cvtColor(corrected, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=0.5, tileGridSize=(16, 16))
    l = clahe.apply(l)
    lab = cv2.merge([l, a, b])
    enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # ── Step 3: Brightness & contrast (professor-controlled) ──────────────────
    # Formula: output = contrast * input + brightness
    adjusted = cv2.convertScaleAbs(enhanced, alpha=contrast, beta=brightness)

    # ── Step 4: Sharpening (professor-controlled blend amount) ────────────────
    kernel   = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharpened = cv2.filter2D(adjusted, -1, kernel)
    result   = cv2.addWeighted(adjusted, 1.0 - sharpness, sharpened, sharpness, 0)

    cv2.imwrite(str(output_path), result)
    print("Saved:", output_path)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python process.py input.jpg output.jpg [calibration.json]")
        sys.exit(1)
    cal_path = sys.argv[3] if len(sys.argv) > 3 else None
    process_image(Path(sys.argv[1]), Path(sys.argv[2]), calibration_path=cal_path)