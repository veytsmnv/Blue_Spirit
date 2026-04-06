# Blue Spirit
### Whiteboard Capture System — Senior Design Project

**Nikita Veytsman · Kyle Mares · Evan Noyes**

Blue Spirit is a Raspberry Pi-powered system that captures, enhances, and streams whiteboard images to students in real time through a web browser. A professor controls the camera from a dedicated interface; students connect by scanning a QR code and can view, annotate, flag, and download lecture notes from any device on the same network.

---

## Table of Contents

- [How It Works](#how-it-works)
- [System Architecture](#system-architecture)
- [Hardware Requirements](#hardware-requirements)
- [Software Requirements](#software-requirements)
- [Installation — Step by Step](#installation--step-by-step)
- [Running the System](#running-the-system)
- [Professor Guide](#professor-guide)
- [Student Guide](#student-guide)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Configuration Files](#configuration-files)
- [Troubleshooting](#troubleshooting)

---

## How It Works

1. The Raspberry Pi is mounted with a camera module aimed at the whiteboard.
2. The professor starts the Node.js server on the Pi and opens the professor view in a browser.
3. The professor creates a named session before taking any photos.
4. Students scan a QR code displayed on the professor's screen to open the student view on their own devices.
5. The professor captures images manually, on an automatic timer, or by uploading a photo from disk.
6. Every captured image is automatically processed by OpenCV — applying perspective correction (if calibrated), lighting normalisation, contrast, brightness, and sharpness adjustments — before being served to students.
7. Students see new images appear in real time, can browse previous captures, draw personal annotations on top of images, flag images they want to revisit, and download their notes.

---

## System Architecture

```
┌─────────────────────────────────────────┐
│              Raspberry Pi               │
│                                         │
│  ┌──────────┐     ┌───────────────────┐ │
│  │  Camera  │────▶│   capture.py      │ │
│  │  Module  │     │  (rpicam-jpeg)    │ │
│  └──────────┘     └────────┬──────────┘ │
│                            │            │
│                   ┌────────▼──────────┐ │
│                   │   process.py      │ │
│                   │   (OpenCV)        │ │
│                   │  1. Perspective   │ │
│                   │     warp          │ │
│                   │  2. CLAHE         │ │
│                   │  3. Brightness /  │ │
│                   │     Contrast      │ │
│                   │  4. Sharpening    │ │
│                   └────────┬──────────┘ │
│                            │            │
│                   ┌────────▼──────────┐ │
│                   │    server.js      │ │
│                   │   (Express 5)     │ │
│                   │   Port 3000       │ │
│                   └────────┬──────────┘ │
└────────────────────────────┼────────────┘
                             │ Local WiFi Network
               ┌─────────────┴──────────────┐
               │                            │
   ┌───────────▼──────────┐   ┌─────────────▼──────────┐
   │   Professor View     │   │     Student View        │
   │   professor.html     │   │     student.html        │
   │                      │   │                         │
   │  - Sessions          │   │  - Live image feed      │
   │  - Manual capture    │   │  - Draw annotations     │
   │  - Auto-capture      │   │  - Save annotations     │
   │  - Image enhancement │   │  - Flag images          │
   │  - Calibration       │   │  - Full-screen mode     │
   │  - QR code display   │   │  - Download images      │
   │  - Student flags     │   │                         │
   │  - Delete all        │   │                         │
   └──────────────────────┘   └─────────────────────────┘
```

---

## Hardware Requirements

- **Raspberry Pi 5** (recommended for processing speed)
- **Raspberry Pi Camera Module** (Camera Module 3 or HQ Camera recommended for image quality)
- **MicroSD card** — 16 GB minimum, Class 10 or better
- **Power supply** — official Raspberry Pi USB-C power supply recommended
- **Camera mount or stand** positioned to capture the full whiteboard
- **WiFi network** that both the Pi and all student devices can join simultaneously

---

## Software Requirements

### On the Raspberry Pi

| Software | Version | Notes |
|----------|---------|-------|
| Raspberry Pi OS | Bookworm (64-bit) or later | Earlier versions may work but are untested |
| Node.js | v18 or later | Install via NodeSource if not present |
| Python | 3.9 or later | Included with Raspberry Pi OS |
| rpicam-jpeg | Any | Included with Pi OS camera stack |
| opencv-python | Any recent | Installed via pip |
| numpy | Any recent | Installed via pip |

### On Student / Professor Devices

- Any modern web browser (Chrome, Firefox, Safari, Edge)
- Connected to the **same local WiFi network** as the Pi

---

## Installation — Step by Step

Follow these steps in order on the Raspberry Pi. Each step builds on the last.

---

### Step 1 — Update the system

Open a terminal and run:

```bash
sudo apt update && sudo apt upgrade -y
```

This ensures you have the latest OS packages and camera drivers before installing anything else.

---

### Step 2 — Enable the camera

```bash
sudo raspi-config
```

Navigate to **Interface Options → Camera → Enable**, then select **Finish** and reboot when prompted:

```bash
sudo reboot
```

After rebooting, verify the camera is working:

```bash
rpicam-jpeg -o test.jpg
```

If a file called `test.jpg` is created, the camera is working. If you get an error, check that the camera ribbon cable is firmly seated in both the camera module and the Pi.

---

### Step 3 — Install Node.js

Raspberry Pi OS does not always include a recent enough version of Node.js. Install v18 or later via NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

Confirm the version:

```bash
node --version   # should print v18.x.x or higher
npm --version
```

---

### Step 4 — Install Python dependencies

```bash
pip3 install opencv-python numpy --break-system-packages
```

The `--break-system-packages` flag is required on Raspberry Pi OS Bookworm, which uses a managed Python environment. Confirm OpenCV installed correctly:

```bash
python3 -c "import cv2; print('OpenCV version:', cv2.__version__)"
```

---

### Step 5 — Clone the repository

```bash
git clone https://github.com/veytsmnv/Blue_Spirit.git
cd Blue_Spirit
git checkout cropping-feature2
```

---

### Step 6 — Install Node.js dependencies

From inside the `Blue_Spirit` project folder:

```bash
npm install
```

This reads `package.json` and installs `express`, `multer`, and `qrcode` into the `node_modules` folder. If you see any errors, run `npm install` again — transient network issues sometimes cause partial downloads.

---

### Step 7 — Create the capture directory

```bash
mkdir -p capture
```

This folder is where all captured images are stored. Session subfolders are created inside it automatically when you start a session.

---

### Step 8 — Verify the full setup

Run a quick end-to-end check:

```bash
# Check Node.js can start the server
node server.js &
sleep 2

# Check the server responds
curl http://localhost:3000/test

# Stop the background server
kill %1
```

You should see `Server is working` printed. If you do, the installation is complete.

---

## Running the System

Start the server from the project root:

```bash
node server.js
```

Or using the npm start script:

```bash
npm start
```

On startup you will see:

```
Server running at http://localhost:3000
Students can connect at: http://192.168.X.X:3000/student.html
```

The second line shows the URL students use. Keep this terminal window open — closing it stops the server.

**To find the Pi's IP address at any time:**

```bash
hostname -I
```

**To run the server in the background so it keeps running after closing the terminal:**

```bash
nohup node server.js &
```

---

## Professor Guide

### Starting a Session

A session **must be started** before any photos can be taken. This is enforced — the Take Photo, Upload, and Auto-Capture buttons are all disabled until a session is active.

1. Open `http://<pi-ip>:3000` in a browser on any device connected to the same network.
2. Click **Professor Session** on the home page.
3. In the **Session** panel at the top, type a name for the session (e.g. `Lecture 12 — Derivatives`).
4. Click **Start Session**.

All photos taken during a session are stored together in a named subfolder inside `capture/`. The session name is also shown to students as the heading in their view.

**Resuming a session:** If you type the same session name as a previous session and click Start Session, the system will detect the existing folder and resume it, loading all previously captured images. A confirmation message will tell you how many existing images were loaded.

---

### Taking Photos

**Manual capture** — Click **📷 Take Photo**. The Pi camera fires, the image is processed, and it appears in your view and all connected student views within a few seconds.

**Upload from disk** — Click **⬆ Upload Image** to select a photo file from your device. This is useful for testing or for adding images that were taken elsewhere.

**Auto-capture timer** — In the Auto-Capture panel, enter an interval in seconds (minimum 5) and click **Start Timer**. The system captures immediately, then repeats at the specified interval. A live green countdown shows when the next capture is due. Click **Stop Timer** to cancel. The timer stops automatically when you end the session.

---

### Image Enhancement

The Image Enhancement panel controls how images are processed after capture. Adjust the sliders and click **Apply** — settings are saved and will apply to every subsequent capture until changed.

| Slider | Range | Default | Effect |
|--------|-------|---------|--------|
| Brightness | -100 to +100 | 0 | Adds or subtracts uniform lightness across all pixels |
| Contrast | 0.5× to 2.0× | 1.0 | Multiplies the difference between pixel values and mid-grey |
| Sharpness | 0.0 to 1.0 | 0.25 | Blends a sharpening kernel — higher values produce crisper edges |

Click **Reset** to return all sliders to their default values.

Enhancement settings are stored in `settings.json` at the project root and are applied by `process.py` on every capture. Changing them does not retroactively reprocess existing images.

---

### Whiteboard Calibration

Calibration corrects perspective distortion when the camera cannot be mounted directly overhead, which is the common case. Without calibration the full camera frame is shown; with calibration only the whiteboard region is cropped and corrected.

1. From the professor view, click **⚙ Calibrate**.
2. Click **📷 Capture Test Image** to take a photo, or **⬆ Upload Image** to use an existing one. The full camera frame will be shown.
3. Four orange corner handles will appear. Drag each one to exactly match the corresponding corner of your physical whiteboard. The order is: **Top-Left → Top-Right → Bottom-Right → Bottom-Left**.
4. The coordinate display below the image updates live as you drag.
5. When satisfied, click **✓ Save Calibration**.
6. Click **← Back to Professor View** to return.

Calibration is saved to `calibration.json` at the project root and applied to every subsequent capture automatically. To remove it, click **✕ Clear Saved** — images will revert to the full camera frame.

**Tips:**
- Calibrate with the whiteboard fully visible and at a consistent distance.
- Re-calibrate if the camera is moved or the angle changes.
- If captures look correct without calibration, there is no need to use it.

---

### Sharing with Students

Click **⬡ Student QR** in the professor view to open a full-screen QR code. Students scan this with their phone camera to open the student view directly. The URL encoded in the QR code points to the Pi's current local IP address and is regenerated each time the server starts — this means if the Pi's IP changes (e.g. after a reboot), the QR code will reflect the new address automatically.

---

### Managing Images

**Browse** — Use the **← Back** and **Forward →** buttons to browse through all images in the current session.

**Delete current** — Click **✕ Delete Current** to permanently delete the image currently shown. You will be asked to confirm.

**Delete all** — Inside the Session panel, click **🗑 Delete All Images in Session** to permanently delete every photo in the current session folder. You will be asked to confirm. This cannot be undone.

**Download current** — Click **Download Current** to download the image currently shown.

**Download all** — Click **Download All** to download every image in the current session, one file at a time with a short delay between each to avoid browser throttling.

---

### Ending a Session

Click **End Session** in the Session panel. You will be prompted about images:

- If there are images in the session: click **OK** to delete all images and end the session, or **Cancel** to end the session while keeping all images on disk.
- If there are no images: you will just be asked to confirm ending the session.

After the session ends, the session name field is cleared and capture controls are locked again until a new session is started.

---

### Student Flags

The **Student Flags** panel shows a live list of images that students have flagged using the 🖐 Flag button in their view. Each entry shows the image filename and how many students have flagged it, sorted by flag count.

Click any entry in the flag list to jump directly to that image in the professor view. Click **Clear All Flags** to reset the list. Flags are stored in memory on the server and reset automatically when a new session starts or the server restarts.

---

## Student Guide

Students access the system by scanning the QR code shown by the professor, or by navigating directly to `http://<pi-ip>:3000/student.html`.

---

### Viewing Images

The student view shows the latest captured image and polls for new ones every 2 seconds. When a new image arrives it jumps to it automatically, unless you are currently browsing an older image.

Use **← Back** and **Forward →** to browse all images in the current session. The counter in the middle shows your position (e.g. `3 / 7`).

---

### Annotations

Each student can draw personal annotations on any image. Annotations are private — they exist only in your browser and are never sent to the server or visible to other students or the professor.

**Annotations are cleared when you navigate to a different image**, unless you save them first.

| Tool | How to use |
|------|-----------|
| ✏ Draw | Click and drag to draw freehand strokes |
| ◻ Eraser | Click and drag to erase strokes. The eraser is automatically 3× wider than the draw size |
| T Text | Click anywhere on the image, type in the prompt that appears, and text is placed at that position |
| Colour picker | Click the colour swatch to choose any annotation colour |
| Size slider | Drag to adjust brush, eraser, and text size |
| 💾 Save | Saves the current annotations to your browser's local storage, keyed to this image |
| ↩ Undo | Steps back one drawing action. Supports up to 40 undo steps |
| ✕ Clear | Clears all annotations on the current image and removes the saved version |

**Saving annotations:** Click **💾 Save** to store annotations for the current image. Next time you navigate back to that image, your annotations will be restored automatically. A green "✓ Annotations saved" confirmation will appear briefly.

**Storage limit:** Annotations are stored as PNG data in `localStorage`. If you annotate many high-resolution images you may eventually hit the browser's storage limit (typically 5–10 MB). If this happens a warning will appear — you can clear old annotations with **✕ Clear**.

---

### Flagging Images

Click **🖐 Flag This Image** to flag the current image for the professor's attention — for example if you want them to hold on that board before erasing. The button changes to **✓ Flagged** to confirm. Click it again to un-flag. The professor can see all flagged images and their flag counts in the Student Flags panel.

---

### Full-Screen Mode

Click **⛶ Full Screen** to expand the image to fill the entire screen, hiding all interface elements. This is useful on tablets or when a student wants to cast the view to a second display. Click **✕ Exit Full Screen** or press `Esc` to return to the normal view.

---

### Downloading

**Download with Annotations** — Exports a JPEG of the current image with your annotations composited on top. The file is named `annotated_photo_N.jpg`.

**Download All (No Annotations)** — Downloads every image in the current session in its original form, one file at a time. Files are named `photo_1.jpg`, `photo_2.jpg`, etc.

---

## Project Structure

```
Blue_Spirit/
│
├── server.js                  # Express 5 server — all API routes
├── package.json               # Node.js dependencies (express, multer, qrcode)
├── calibration.json           # Saved perspective calibration (auto-generated)
├── settings.json              # Enhancement settings (auto-generated)
├── session.json               # Active session metadata (auto-generated)
│
├── capture/                   # All captured images
│   └── SessionName_timestamp/ # Per-session subfolder
│       ├── .session_name      # Hidden marker file used for session resume
│       ├── photo_1.jpg
│       ├── photo_2.jpg
│       └── ...
│
├── pi/
│   ├── capture.py             # Triggers rpicam-jpeg, calls process.py
│   └── process.py             # OpenCV pipeline: warp, CLAHE, enhance, sharpen
│
└── user_interface/
    ├── index.html             # Home / landing page
    ├── professor.html         # Professor control panel
    ├── student.html           # Student viewer
    ├── calibrate.html         # Perspective calibration tool
    ├── qr.html                # QR code display page
    ├── css/
    │   └── styles.css         # Shared stylesheet
    └── js/
        ├── professor.js       # Professor UI logic
        ├── student.js         # Student UI + annotation engine
        └── calibrate.js       # Calibration corner drag tool
```

---

## API Reference

All endpoints are served on port 3000.

### Images

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/images-list` | Returns `{ files: [...] }` — sorted list of photos in the active session |
| `GET` | `/latest` | Returns `{ filename }` — the most recent photo |
| `GET` | `/images/<path>` | Serves a photo file directly (used by the browser to display images) |
| `GET` | `/download/<path>` | Downloads a photo as a file attachment |
| `DELETE` | `/images/<path>` | Permanently deletes a photo |
| `POST` | `/capture` | Triggers the Pi camera and processing pipeline |
| `POST` | `/upload` | Accepts a multipart image upload (field name: `image`) |

### Session

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/session` | Returns the active session object, or `null` |
| `POST` | `/session` | Starts or resumes a session. Body: `{ "name": "..." }` |
| `DELETE` | `/session` | Ends the active session |
| `GET` | `/session-info` | Returns `{ name, startedAt }` — used by the student view to show the session name |
| `DELETE` | `/session/images` | Deletes all photos in the active session folder |

### Enhancement Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/settings` | Returns `{ brightness, contrast, sharpness }` |
| `POST` | `/settings` | Updates one or more settings. Body: `{ brightness?, contrast?, sharpness? }` |

### Student Flags

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/flags` | Returns `{ filename: count, ... }` — all flagged images and counts |
| `POST` | `/flag` | Increments flag count. Body: `{ "filename": "..." }` |
| `DELETE` | `/flag` | Decrements flag count. Body: `{ "filename": "..." }` |
| `DELETE` | `/flags` | Clears all flags |

### Calibration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/calibration` | Returns saved calibration corners, or `null` |
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
| `GET` | `/last-update` | Returns `{ lastUpdate }` — Unix timestamp of the last image change, used by the student view for polling |

---

## Configuration Files

These files are created automatically at the project root on first use. You can delete them to reset their respective feature.

### `calibration.json`

Stores the four whiteboard corner coordinates saved during calibration.

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
  "savedAt": "2026-04-05T14:00:00.000Z"
}
```

Coordinates are normalised fractions (0–1) of the original image dimensions, in order: top-left, top-right, bottom-right, bottom-left.

### `settings.json`

```json
{
  "brightness": 0,
  "contrast": 1.0,
  "sharpness": 0.25
}
```

### `session.json`

Written when a session starts, deleted when it ends.

```json
{
  "name": "Lecture 12 — Derivatives",
  "safeName": "Lecture_12_Derivatives",
  "folder": "Lecture_12_Derivatives_2026-04-05T14-00-00",
  "startedAt": "2026-04-05T14:00:00.000Z",
  "resumed": false
}
```

The `safeName` field is the filesystem-safe version of the session name. It is also written as a hidden `.session_name` marker file inside the session folder, which is how the server identifies the folder for resume on subsequent sessions with the same name.

---

## Troubleshooting

**`Cannot find module 'express'` / `'multer'` / `'qrcode'`**

Run `npm install` from the project root. If a specific package is still missing after that, install it directly:

```bash
npm install express multer qrcode
```

**Camera capture fails with `rpicam-jpeg: command not found`**

The camera stack is not installed. Run:

```bash
sudo apt install -y rpicam-apps
```

Then verify it works:

```bash
rpicam-jpeg -o test.jpg && echo "Camera OK"
```

**`import cv2` fails or OpenCV is not found**

Reinstall with the system packages flag:

```bash
pip3 install opencv-python numpy --break-system-packages --force-reinstall
```

**Images are not being perspective-corrected after calibration**

Check that `calibration.json` exists at the project root. If any stale copy exists inside the `pi/` folder from an older version of the code, delete it — the new code only reads from the project root:

```bash
ls calibration.json          # should exist
rm -f pi/calibration.json    # remove any stale copy
```

**Session is not resuming when the same name is used**

The session resume feature relies on a `.session_name` marker file inside each session folder. This file is only written by the current version of the server — session folders created by older versions of the code will not have it and cannot be auto-resumed.

To enable resume for an existing folder, manually create the marker:

```bash
# Replace "Lecture_12" with your actual safe session name (spaces → underscores, special chars removed)
echo "Lecture_12" > capture/Lecture_12_2026-04-05T14-00-00/.session_name
```

After that, typing `Lecture 12` in the session name field and clicking Start Session will resume it.

**Students can't connect / QR code doesn't work**

- Confirm the Pi and student devices are on the **same WiFi network**. Many routers have separate 2.4 GHz and 5 GHz networks with the same name — try connecting all devices to the same band.
- Check the IP address printed on server startup and try navigating to it directly: `http://<ip>:3000`
- The Pi's IP address can change after a reboot. Check `hostname -I` and share the new address or QR code if it has changed.
- Ensure no firewall on the Pi is blocking port 3000: `sudo ufw allow 3000` if ufw is active.

**`Failed to start session: Unexpected token '<'`**

The server is returning an HTML error page instead of JSON — usually means the server is not running or crashed. Check the server terminal for error output, restart with `node server.js`, and try again.

**Git merge conflicts on pull**

```bash
git stash          # save local changes temporarily
git pull           # pull remote changes
git stash pop      # reapply local changes
```

If there are conflicts after `stash pop`, open the conflicted files, resolve the `<<<<<<` markers manually, then:

```bash
git add .
git commit -m "resolve conflicts"
```

To discard all local changes and reset to the remote branch (destructive):

```bash
git fetch origin
git reset --hard origin/cropping-feature2
```

---

*Blue Spirit — Senior Design Project, 2026*
