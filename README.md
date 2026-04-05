# Blue Spirit
### Whiteboard Capture System — Senior Design Project

**Nikita Veytsman · Kyle Mares · Evan Noyes**

Blue Spirit is a Raspberry Pi-powered system that automatically captures, enhances, and streams whiteboard images to students in real time through a web browser. Professors control the camera from a dedicated interface; students connect via QR code and view, annotate, and download lecture notes from any device on the same network.

---

## Table of Contents

- [How It Works](#how-it-works)
- [System Architecture](#system-architecture)
- [Hardware Requirements](#hardware-requirements)
- [Software Requirements](#software-requirements)
- [Installation](#installation)
- [Running the System](#running-the-system)
- [Professor Guide](#professor-guide)
- [Student Guide](#student-guide)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Configuration Files](#configuration-files)
- [Troubleshooting](#troubleshooting)

---

## How It Works

1. The professor mounts a Raspberry Pi with a camera module pointed at the whiteboard.
2. The Node.js server starts on the Pi and becomes accessible over the local network.
3. Students scan a QR code to open the student view in their browser.
4. The professor captures images manually, on a timer, or by uploading a photo.
5. Each image is automatically processed (perspective correction, brightness, contrast, sharpening) using OpenCV before being served to students.
6. Students see new images in real time, can browse previous captures, add personal annotations, and download their notes.

---

## System Architecture

```
┌─────────────────────────────────────┐
│         Raspberry Pi                │
│                                     │
│  ┌──────────┐    ┌───────────────┐  │
│  │ Camera   │───▶│  capture.py   │  │
│  │ Module   │    │  (rpicam-jpeg)│  │
│  └──────────┘    └──────┬────────┘  │
│                         │           │
│                  ┌──────▼────────┐  │
│                  │  process.py   │  │
│                  │  (OpenCV)     │  │
│                  │  - Warp       │  │
│                  │  - CLAHE      │  │
│                  │  - Brightness │  │
│                  │  - Contrast   │  │
│                  │  - Sharpness  │  │
│                  └──────┬────────┘  │
│                         │           │
│                  ┌──────▼────────┐  │
│                  │  server.js    │  │
│                  │  (Express)    │  │
│                  │  Port 3000    │  │
│                  └──────┬────────┘  │
└─────────────────────────┼───────────┘
                          │ Local Network
              ┌───────────┴───────────┐
              │                       │
    ┌─────────▼──────┐    ┌──────────▼──────┐
    │ Professor View │    │  Student View   │
    │ professor.html │    │  student.html   │
    │ - Capture      │    │  - Live feed    │
    │ - Sessions     │    │  - Annotations  │
    │ - Timer        │    │  - Download     │
    │ - Enhancement  │    │                 │
    │ - Calibration  │    │                 │
    └────────────────┘    └─────────────────┘
```

---

## Hardware Requirements

- **Raspberry Pi** (Pi 5 recommended for processing speed)
- **Raspberry Pi Camera Module** (Camera Module 3 or HQ Camera recommended)
- **MicroSD card** — 16GB or larger
- **Power supply** for the Pi
- **Mount or stand** to position the camera above or facing the whiteboard
- A local WiFi network that both the Pi and student devices can join

---

## Software Requirements

### On the Raspberry Pi

- Raspberry Pi OS (Bookworm or later)
- Node.js v18 or later
- Python 3
- `rpicam-jpeg` (included with Raspberry Pi OS camera stack)
- Python packages:
  ```
  opencv-python
  numpy
  ```

### Student / Professor Devices

- Any modern web browser (Chrome, Firefox, Safari)
- Connected to the same local network as the Pi

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/veytsmnv/Blue_Spirit.git
cd Blue_Spirit
git checkout cropping-feature2
```

### 2. Install Node.js dependencies

```bash
npm install
```

This installs `express`, `multer`, and `qrcode`.

### 3. Install Python dependencies

```bash
pip3 install opencv-python numpy --break-system-packages
```

### 4. Enable the camera

If the camera is not already enabled:

```bash
sudo raspi-config
# Interface Options → Camera → Enable
```

Then reboot:

```bash
sudo reboot
```

### 5. Create the capture directory

```bash
mkdir -p capture
```

---

## Running the System

Start the server from the project root:

```bash
node server.js
```

or using the npm script:

```bash
npm start
```

You will see output like:

```
Server running at http://localhost:3000
Students can connect at: http://192.168.1.XX:3000/student.html
```

The professor opens `http://<pi-ip>:3000` in a browser. Students scan the QR code from the professor view or navigate to the student URL directly.

To find the Pi's IP address if needed:

```bash
hostname -I
```

---

## Professor Guide

### Starting a Session

1. Open `http://<pi-ip>:3000` in a browser — this loads the home page.
2. Click **Professor Session**.
3. Enter a session name (e.g. "Lecture 12 — Derivatives") and click **Start Session**.

All photos taken during a session are stored together in a named subfolder under `capture/`. Ending a session does not delete any photos.

### Taking Photos

**Manual capture** — Click **📷 Take Photo** to trigger the camera immediately.

**Upload** — Click **⬆ Upload Image** to upload a photo from your device instead of using the camera.

**Auto-capture timer** — Enter an interval in seconds and click **Start Timer**. The system captures immediately and then on every interval. A live countdown shows when the next capture is due. Click **Stop Timer** to cancel.

### Image Enhancement

Adjust the three sliders before or during a session, then click **Apply**:

| Slider | Range | Effect |
|--------|-------|--------|
| Brightness | -100 to +100 | Adds or subtracts overall lightness |
| Contrast | 0.5× to 2.0× | Multiplies pixel intensity differences |
| Sharpness | 0.0 to 1.0 | Blends a sharpening kernel into the image |

Settings are saved to `settings.json` and applied to every subsequent capture until changed. Click **Reset** to return to defaults.

### Whiteboard Calibration

Calibration corrects perspective distortion when the camera is not mounted directly overhead.

1. Click **⚙ Calibrate** from the professor view.
2. Click **📷 Capture Test Image** or upload an existing photo of the full whiteboard.
3. Drag the four orange corner handles to match the exact corners of the physical whiteboard.
4. Click **✓ Save Calibration**.

The calibration is saved to `calibration.json` at the project root and applied automatically to all future captures. Click **✕ Clear Saved** to remove it and return to the full camera frame.

### Sharing with Students

Click **⬡ Student QR** to open a full-screen QR code page. Students scan the code with their phone camera to open the student view directly. The QR code encodes the Pi's current local IP and regenerates each time the server starts.

### Managing Images

- Use the **← Back** and **Forward →** buttons to browse captured images.
- Click **✕ Delete Current** to permanently delete the displayed image.
- Click **Download Current** to download the current image.
- Click **Download All** to download all images in the current session one by one.

---

## Student Guide

Students access the system by scanning the QR code displayed by the professor, or by navigating directly to `http://<pi-ip>:3000/student.html`.

### Viewing Images

The student view automatically shows the latest captured image and polls for new images every 2 seconds. When a new image arrives, the view jumps to it automatically unless you are manually browsing older images.

Use **← Back** and **Forward →** to browse all images in the current session.

### Annotations

Each student can draw personal annotations on top of any image. Annotations are private — they exist only in your browser and are never sent to the server or visible to other students.

**Annotations are cleared when you navigate to a different image.**

| Tool | Description |
|------|-------------|
| ✏ Draw | Freehand pen. Uses selected colour and size. |
| ◻ Eraser | Erases strokes. Automatically 3× wider than draw size. |
| T Text | Click anywhere on the image, type in the prompt, and text appears at that position. |
| Colour picker | Choose any annotation colour. |
| Size slider | Controls brush, eraser, and text size. |
| ↩ Undo | Steps back one action. Supports up to 40 undo steps. |
| ✕ Clear | Clears all annotations on the current image (undoable). |

### Downloading

- **Download with Annotations** — Exports the current image with your annotations composited on top as a JPEG.
- **Download All (No Annotations)** — Downloads all session images in their original form, one by one.

---

## Project Structure

```
Blue_Spirit/
│
├── server.js                  # Express server — API routes, session management
├── package.json               # Node.js dependencies
├── calibration.json           # Saved calibration corners (auto-generated)
├── settings.json              # Enhancement settings (auto-generated)
├── session.json               # Active session info (auto-generated)
│
├── capture/                   # All captured images
│   └── <SessionName_timestamp>/  # Per-session subfolders
│       ├── photo_1.jpg
│       ├── photo_2.jpg
│       └── ...
│
├── pi/
│   ├── capture.py             # Triggers rpicam-jpeg, calls process.py
│   ├── process.py             # OpenCV image pipeline (warp, CLAHE, enhance)
│   └── connectpic.py          # Legacy Flask QR server (replaced by server.js)
│
└── user_interface/
    ├── index.html             # Home / landing page
    ├── professor.html         # Professor control panel
    ├── student.html           # Student viewer
    ├── calibrate.html         # Perspective calibration tool
    ├── qr.html                # QR code display for students
    ├── css/
    │   └── styles.css         # Shared stylesheet
    └── js/
        ├── professor.js       # Professor UI logic
        ├── student.js         # Student UI + annotation engine
        └── calibrate.js       # Calibration corner drag tool
```

---

## API Reference

All endpoints are served by the Express server on port 3000.

### Images

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/images-list` | Returns `{ files: [...] }` — sorted list of photos in the active session |
| `GET` | `/latest` | Returns `{ filename }` — the most recent photo |
| `GET` | `/images/<path>` | Serves a photo file directly |
| `GET` | `/download/<path>` | Downloads a photo as an attachment |
| `DELETE` | `/images/<path>` | Permanently deletes a photo |
| `POST` | `/capture` | Triggers the Pi camera and processing pipeline |
| `POST` | `/upload` | Accepts a multipart image upload (`image` field) |

### Session

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/session` | Returns the active session object or `null` |
| `POST` | `/session` | Starts a session. Body: `{ "name": "Lecture 12" }` |
| `DELETE` | `/session` | Ends the active session |
| `GET` | `/session-info` | Returns `{ name, startedAt }` for the student view |

### Enhancement Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/settings` | Returns current `{ brightness, contrast, sharpness }` |
| `POST` | `/settings` | Updates settings. Body: `{ brightness, contrast, sharpness }` |

### Calibration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/calibration` | Returns saved calibration corners or `null` |
| `POST` | `/calibration` | Saves calibration. Body: `{ corners, imageWidth, imageHeight, savedAt }` |
| `DELETE` | `/calibration` | Clears saved calibration |

### QR Code

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/qr.png` | Returns a 400×400 PNG QR code pointing to the student URL |
| `GET` | `/qr-info` | Returns `{ url }` — the student URL as text |

### Utility

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/test` | Returns `"Server is working"` |
| `GET` | `/last-update` | Returns `{ lastUpdate }` — Unix timestamp of last image change |

---

## Configuration Files

These files are auto-generated at the project root on first use. You can delete them to reset their respective features.

### `calibration.json`
```json
{
  "corners": [
    { "x": 0.05, "y": 0.05 },
    { "x": 0.95, "y": 0.05 },
    { "x": 0.95, "y": 0.95 },
    { "x": 0.05, "y": 0.95 }
  ],
  "imageWidth": 4056,
  "imageHeight": 3040,
  "savedAt": "2026-03-25T14:00:00.000Z"
}
```
Corner coordinates are normalised fractions (0–1) of the original image dimensions, in order: top-left, top-right, bottom-right, bottom-left.

### `settings.json`
```json
{
  "brightness": 0,
  "contrast": 1.0,
  "sharpness": 0.25
}
```

### `session.json`
```json
{
  "name": "Lecture 12 — Derivatives",
  "folder": "Lecture_12_Derivatives_2026-03-25T14-00-00",
  "startedAt": "2026-03-25T14:00:00.000Z"
}
```

---

## Troubleshooting

**`Cannot find module 'express'` or similar**
Run `npm install` from the project root to install all dependencies.

**`Cannot find module 'qrcode'`**
Run `npm install qrcode` then restart the server.

**Camera capture fails**
Ensure the camera is enabled (`sudo raspi-config`) and that `rpicam-jpeg` works from the terminal:
```bash
rpicam-jpeg -o test.jpg
```
Also verify `process.py` uses `python3` and OpenCV is installed:
```bash
python3 -c "import cv2; print(cv2.__version__)"
```

**Images are not being perspective-corrected after calibration**
Check that `calibration.json` exists at the project root (not inside `pi/`). If a stale `pi/calibration.json` exists from an older version, delete it:
```bash
rm -f pi/calibration.json
```

**Students can't connect**
- Confirm the Pi and student devices are on the same WiFi network.
- Check the server console for the student URL and share it directly if the QR code is unavailable.
- Ensure port 3000 is not blocked by a firewall on the Pi.

**`Failed to start session: Unexpected token '<'`**
This indicates the server is returning an HTML error page instead of JSON. Restart the server and ensure you are running the latest `server.js`. This was caused by an Express 5 wildcard route syntax issue that has since been fixed.

**Git merge conflicts on pull**
If local changes conflict with incoming commits:
```bash
git stash
git pull
git stash pop
```
Or to reset to the remote completely (will discard local changes):
```bash
git fetch origin
git reset --hard origin/cropping-feature2
```

---

*Blue Spirit — Senior Design Project, 2026*
