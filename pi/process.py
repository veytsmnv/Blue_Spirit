import cv2
import numpy as np
from pathlib import Path
import sys

def process_image(input_path, output_path):
    img = cv2.imread(str(input_path))

    # --- Step 1: Fix uneven lighting in each color channel separately ---
    # This removes shadows without destroying color
    corrected = np.zeros_like(img, dtype=np.float32)
    for i in range(3):
        channel = img[:, :, i].astype(np.float32)
        blur = cv2.GaussianBlur(channel, (51, 51), 0)
        corrected[:, :, i] = cv2.divide(channel, blur, scale=255)

    corrected = np.clip(corrected, 0, 255).astype(np.uint8)

    # --- Step 2: Brighten the background without blowing it out ---
    # Convert to LAB color space — L channel is brightness only
    lab = cv2.cvtColor(corrected, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    # CLAHE on just the brightness channel — gentler than before
    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
    l = clahe.apply(l)

    lab = cv2.merge([l, a, b])
    enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # --- Step 3: Whiten the background softly ---
    # Instead of hard threshold, we detect near-white pixels and push them to white
    # This preserves colored writing while cleaning the background
    hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1]

    # Pixels with very low saturation = background (whiteboard)
    # Pixels with higher saturation = colored marker writing
    background_mask = saturation < 30  # tune this if needed (0-255)

    result = enhanced.copy()
    result[background_mask] = [255, 255, 255]  # push background to white

    # --- Step 4: Mild sharpening to crisp up writing edges ---
    kernel = np.array([
        [ 0, -1,  0],
        [-1,  5, -1],
        [ 0, -1,  0]
    ])
    result = cv2.filter2D(result, -1, kernel)

    cv2.imwrite(str(output_path), result)
    print("Saved:", output_path)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python process.py input.jpg output.jpg")
        sys.exit(1)
    process_image(Path(sys.argv[1]), Path(sys.argv[2]))