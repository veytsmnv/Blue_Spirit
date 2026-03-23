import cv2
import numpy as np
from pathlib import Path
import sys

def process_image(input_path, output_path):
    img = cv2.imread(str(input_path))

    # --- Step 1: Boost contrast gently ---
    # Works on brightness only, leaves colors alone
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2, tileGridSize=(8, 8))
    l = clahe.apply(l)

    lab = cv2.merge([l, a, b])
    enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # --- Step 2: Whiten the background ---
    # Detects low-saturation pixels (whiteboard) and forces them to white
    # Colored writing has high saturation so it's left alone
    hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1]

    background_mask = saturation < 5  # raise to whiten more, lower to preserve more color
    result = enhanced.copy()
    result[background_mask] = [255, 255, 255]

    # --- Step 3: Sharpen edges ---
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