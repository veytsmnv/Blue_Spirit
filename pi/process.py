import cv2
import numpy as np
from pathlib import Path
import sys

def process_image(input_path, output_path):
    img = cv2.imread(str(input_path))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Remove shadows / normalize lighting
    blur = cv2.GaussianBlur(gray, (51, 51), 0)
    normalized = cv2.divide(gray, blur, scale=255)

    # Increase contrast
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(normalized)

    # Threshold to make writing crisp black on white
    _, cleaned = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    cv2.imwrite(str(output_path), cleaned)
    print("Saved:", output_path)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python process.py input.jpg output.jpg")
        sys.exit(1)
    process_image(Path(sys.argv[1]), Path(sys.argv[2]))