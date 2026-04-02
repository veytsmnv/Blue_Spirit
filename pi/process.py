import cv2
import numpy as np
from pathlib import Path
import sys
import json

# ─── Canonical calibration path ───────────────────────────────────────────────
# Always stored at the project root (one level up from this script).
# server.js writes/deletes it there. Do NOT search pi/ to avoid stale copies.
REPO_ROOT = Path(__file__).resolve().parent.parent
CALIBRATION_PATH = REPO_ROOT / "calibration.json"


# ─── Optional perspective warp ────────────────────────────────────────────────

def perspective_warp(img, corners_norm):
    """
    Warp a 4-point region of `img` into a flat, top-down rectangle.

    corners_norm: list of 4 dicts [{"x": 0-1, "y": 0-1}, …]
                  in order: top-left, top-right, bottom-right, bottom-left
                  (fractions of the original image width/height)

    Returns the warped image.
    """
    h, w = img.shape[:2]

    src = np.array([
        [corners_norm[0]["x"] * w, corners_norm[0]["y"] * h],
        [corners_norm[1]["x"] * w, corners_norm[1]["y"] * h],
        [corners_norm[2]["x"] * w, corners_norm[2]["y"] * h],
        [corners_norm[3]["x"] * w, corners_norm[3]["y"] * h],
    ], dtype=np.float32)

    # Output size: bounding box of the source quad
    width  = int(max(
        np.linalg.norm(src[1] - src[0]),  # top edge
        np.linalg.norm(src[2] - src[3]),  # bottom edge
    ))
    height = int(max(
        np.linalg.norm(src[3] - src[0]),  # left edge
        np.linalg.norm(src[2] - src[1]),  # right edge
    ))

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


def load_calibration(calibration_path=None):
    """
    Load calibration from the canonical path (project root/calibration.json).
    An explicit path can be passed as an override (e.g. for testing).

    Returns a list of 4 normalised corner dicts, or None if not found.
    """
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
        else:
            print(f"Warning: calibration file {path} is malformed, ignoring.")
            return None
    except Exception as e:
        print(f"Error reading calibration file: {e}")
        return None


# ─── Enhancement pipeline ─────────────────────────────────────────────────────

def process_image(input_path, output_path, calibration_path=None):
    img = cv2.imread(str(input_path))
    if img is None:
        raise FileNotFoundError(f"Could not read image: {input_path}")

    # ── Step 0: Perspective warp (if calibration exists) ─────────────────────
    corners = load_calibration(calibration_path)
    if corners:
        img = perspective_warp(img, corners)
        print("Applied perspective warp.")
    else:
        print("No calibration — using full camera frame.")

    # ── Step 1: Very gentle lighting correction ───────────────────────────────
    corrected = np.zeros_like(img, dtype=np.float32)
    for i in range(3):
        channel = img[:, :, i].astype(np.float32)
        blur = cv2.GaussianBlur(channel, (51, 51), 0)
        divided = cv2.divide(channel, blur, scale=255)
        corrected[:, :, i] = 0.3 * divided + 0.7 * channel

    corrected = np.clip(corrected, 0, 255).astype(np.uint8)

    # ── Step 2: Very mild CLAHE ───────────────────────────────────────────────
    lab = cv2.cvtColor(corrected, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=0.5, tileGridSize=(16, 16))
    l = clahe.apply(l)

    lab = cv2.merge([l, a, b])
    enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # ── Step 3: Skip background whitening ────────────────────────────────────
    # Removed — too aggressive for light edits

    # ── Step 4: Very subtle sharpening ───────────────────────────────────────
    kernel = np.array([
        [ 0, -1,  0],
        [-1,  5, -1],
        [ 0, -1,  0]
    ])
    sharpened = cv2.filter2D(enhanced, -1, kernel)
    result = cv2.addWeighted(enhanced, 0.75, sharpened, 0.25, 0)

    cv2.imwrite(str(output_path), result)
    print("Saved:", output_path)


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    """
    Usage:
      python process.py input.jpg output.jpg [calibration.json]

    If calibration.json is not provided, uses the project root calibration.json.
    If that doesn't exist either, the full camera frame is used with no warp.
    """
    if len(sys.argv) < 3:
        print("Usage: python process.py input.jpg output.jpg [calibration.json]")
        sys.exit(1)

    cal_path = sys.argv[3] if len(sys.argv) > 3 else None
    process_image(Path(sys.argv[1]), Path(sys.argv[2]), calibration_path=cal_path)