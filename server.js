const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json()); // Fix: was missing — needed for /calibration POST body
app.use(express.static(path.join(__dirname, "user_interface")));
app.use("/images", express.static(path.join(__dirname, "capture")));

// ── Paths ─────────────────────────────────────────────────────────────────────
const CAPTURE_DIR = path.join(__dirname, "capture");
const CALIBRATION_PATH = path.join(__dirname, "calibration.json");

let lastUpdate = Date.now();

// ── Multer storage ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, CAPTURE_DIR),
    filename: (req, file, cb) => {
        const existing = fs.readdirSync(CAPTURE_DIR)
            .filter(f => f.startsWith("photo_") && f.endsWith(".jpg"))
            .map(f => parseInt(f.replace("photo_", "").replace(".jpg", "")))
            .filter(n => !isNaN(n));
        const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
        cb(null, `photo_${nextNum}.jpg`);
    }
});

const upload = multer({ storage });

// ── Helper: get sorted photo list ─────────────────────────────────────────────
function getSortedPhotos(descending = false) {
    return fs.readdirSync(CAPTURE_DIR)
        .filter(f => f.startsWith("photo_") && f.endsWith(".jpg"))
        .sort((a, b) => {
            const numA = parseInt(a.replace("photo_", "").replace(".jpg", ""));
            const numB = parseInt(b.replace("photo_", "").replace(".jpg", ""));
            return descending ? numB - numA : numA - numB;
        });
}

// ── Test route ────────────────────────────────────────────────────────────────
app.get("/test", (req, res) => {
    res.send("Server is working");
});

// ── Last update route ─────────────────────────────────────────────────────────
app.get("/last-update", (req, res) => {
    res.json({ lastUpdate });
});

// ── Image list route ──────────────────────────────────────────────────────────
app.get("/images-list", (req, res) => {
    res.json({ files: getSortedPhotos() });
});

// ── Latest image route ────────────────────────────────────────────────────────
app.get("/latest", (req, res) => {
    const files = getSortedPhotos(true);
    res.json({ filename: files.length > 0 ? files[0] : null });
});

// ── Capture route ─────────────────────────────────────────────────────────────
app.post("/capture", (req, res) => {
    exec("python3 pi/capture.py", { cwd: __dirname }, (err, stdout, stderr) => {
        if (err) {
            console.error("Capture error:", err);
            console.error(stderr);
            return res.status(500).json({ error: "Capture failed", detail: stderr });
        }
        lastUpdate = Date.now();
        const filename = stdout.trim().split("/").pop();
        res.json({ filename });
    });
});

// ── Upload route ──────────────────────────────────────────────────────────────
app.post("/upload", upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    lastUpdate = Date.now();
    res.json({ filename: req.file.filename });
});

// ── Download route ────────────────────────────────────────────────────────────
app.get("/download/:filename", (req, res) => {
    const filename = path.basename(req.params.filename); // prevent path traversal
    const filepath = path.join(CAPTURE_DIR, filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "File not found" });
    res.download(filepath);
});

// ── Delete route ──────────────────────────────────────────────────────────────
app.delete("/images/:filename", (req, res) => {
    const filename = path.basename(req.params.filename); // prevent path traversal
    const filepath = path.join(CAPTURE_DIR, filename);
    fs.unlink(filepath, (err) => {
        if (err) {
            console.error("Delete error:", err);
            return res.status(500).json({ error: "Delete failed" });
        }
        lastUpdate = Date.now();
        res.json({ ok: true });
    });
});

// ── Calibration routes ────────────────────────────────────────────────────────
// Fix: these were defined in server-calibration-endpoints.js but never added here

app.get("/calibration", (req, res) => {
    if (!fs.existsSync(CALIBRATION_PATH)) return res.json(null);
    try {
        const data = JSON.parse(fs.readFileSync(CALIBRATION_PATH, "utf8"));
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: "Failed to read calibration file" });
    }
});

app.post("/calibration", (req, res) => {
    const { corners, imageWidth, imageHeight, savedAt } = req.body;
    if (!corners || corners.length !== 4) {
        return res.status(400).json({ error: "Expected 4 corners" });
    }
    try {
        fs.writeFileSync(CALIBRATION_PATH, JSON.stringify({ corners, imageWidth, imageHeight, savedAt }, null, 2));
        console.log("Calibration saved:", CALIBRATION_PATH);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to save calibration file" });
    }
});

app.delete("/calibration", (req, res) => {
    try {
        if (fs.existsSync(CALIBRATION_PATH)) fs.unlinkSync(CALIBRATION_PATH);
        console.log("Calibration deleted.");
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete calibration file" });
    }
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
});