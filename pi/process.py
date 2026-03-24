import cv2
import numpy as np
from pathlib import Path
import sys
import json

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
    Load calibration from:
      1. An explicit JSON file path (passed as argument), or
      2. The default location: <repo-root>/calibration.json

    Returns a list of 4 normalised corner dicts, or None if not found.
    """
    search_paths = []
    if calibration_path:
        search_paths.append(Path(calibration_path))

    # Default: look next to this script and one level up
    script_dir = Path(__file__).resolve().parent
    search_paths += [
        script_dir / "calibration.json",
        script_dir.parent / "calibration.json",
    ]

    for p in search_paths:
        if p.exists():
            with open(p) as f:
                data = json.load(f)
            corners = data.get("corners")
            if corners and len(corners) == 4:
                print(f"Loaded calibration from: {p}")
                return corners
            else:
                print(f"Warning: calibration file {p} is malformed, ignoring.")

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
        print("No calibration found — skipping warp.")

    # ── Step 1: Very gentle lighting correction ───────────────────────────────
    # Blend only 30% of the division result with the original
    corrected = np.zeros_like(img, dtype=np.float32)
    for i in range(3):
        channel = img[:, :, i].astype(np.float32)
        blur = cv2.GaussianBlur(channel, (51, 51), 0)
        divided = cv2.divide(channel, blur, scale=255)
        corrected[:, :, i] = 0.3 * divided + 0.7 * channel  # subtle blend

    corrected = np.clip(corrected, 0, 255).astype(np.uint8)

    # ── Step 2: Very mild CLAHE ───────────────────────────────────────────────
    lab = cv2.cvtColor(corrected, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=0.5, tileGridSize=(16, 16))  # was 1.5 / (8,8)
    l = clahe.apply(l)

    lab = cv2.merge([l, a, b])
    enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # ── Step 3: Skip background whitening ────────────────────────────────────
    # Removed — too aggressive for light edits

    # ── Step 4: Very subtle sharpening ───────────────────────────────────────
    # Blend only 25% sharpened with 75% original
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

    If calibration.json is not provided, the script searches for it automatically.
    """
    if len(sys.argv) < 3:
        print("Usage: python process.py input.jpg output.jpg [calibration.json]")
        sys.exit(1)

    cal_path = sys.argv[3] if len(sys.argv) > 3 else None
    process_image(Path(sys.argv[1]), Path(sys.argv[2]), calibration_path=cal_path)