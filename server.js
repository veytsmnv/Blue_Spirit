const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = 3000;

app.use(express.json()); // ← must be before any routes

let lastUpdate = Date.now();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, "capture")),
    filename: (req, file, cb) => {
        const existing = fs.readdirSync(path.join(__dirname, "capture"))
            .filter(f => f.startsWith("photo_") && f.endsWith(".jpg"))
            .map(f => parseInt(f.replace("photo_", "").replace(".jpg", "")))
            .filter(n => !isNaN(n));
        const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
        cb(null, `photo_${nextNum}.jpg`);
    }
});

const upload = multer({ storage });

// Serve the frontend files
app.use(express.static(path.join(__dirname, "user_interface")));

// Serve captured images
app.use("/images", express.static(path.join(__dirname, "capture")));

// Test route
app.get("/test", (req, res) => {
    res.send("Server is working");
});

// Last update route
app.get("/last-update", (req, res) => {
    res.json({ lastUpdate });
});

// Image list route
app.get("/images-list", (req, res) => {
    const captureDir = path.join(__dirname, "capture");
    const files = fs.readdirSync(captureDir)
        .filter(f => f.startsWith("photo_") && f.endsWith(".jpg"))
        .sort((a, b) => {
            const numA = parseInt(a.replace("photo_", "").replace(".jpg", ""));
            const numB = parseInt(b.replace("photo_", "").replace(".jpg", ""));
            return numA - numB;
        });
    res.json({ files });
});

// Latest image route
app.get("/latest", (req, res) => {
    const captureDir = path.join(__dirname, "capture");
    const files = fs.readdirSync(captureDir)
        .filter(f => f.startsWith("photo_") && f.endsWith(".jpg"))
        .sort((a, b) => {
            const numA = parseInt(a.replace("photo_", "").replace(".jpg", ""));
            const numB = parseInt(b.replace("photo_", "").replace(".jpg", ""));
            return numB - numA;
        });
    if (files.length === 0) return res.json({ filename: null });
    res.json({ filename: files[0] });
});

// Capture route
app.post("/capture", (req, res) => {
    exec("python pi/capture.py", { cwd: __dirname }, (err, stdout, stderr) => {
        if (err) {
            console.error("Capture error:", err);
            console.error(stderr);
            return res.status(500).send("Capture failed");
        }
        lastUpdate = Date.now();
        const filename = stdout.trim().split("/").pop();
        res.json({ filename });
    });
});

// Upload route
app.post("/upload", upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).send("No file uploaded");
    lastUpdate = Date.now();
    res.json({ filename: req.file.filename });
});

// Download route
app.get("/download/:filename", (req, res) => {
    const filepath = path.join(__dirname, "capture", req.params.filename);
    res.download(filepath);
});

// Delete route
app.delete("/images/:filename", (req, res) => {
    const filepath = path.join(__dirname, "capture", req.params.filename);
    fs.unlink(filepath, (err) => {
        if (err) {
            console.error("Delete error:", err);
            return res.status(500).send("Delete failed");
        }
        lastUpdate = Date.now();
        res.send("Deleted");
    });
});

// Calibration routes
const CALIBRATION_PATH = path.join(__dirname, "calibration.json");

app.post("/calibration", (req, res) => {
    const { corners, imageWidth, imageHeight, savedAt } = req.body;
    if (!corners || corners.length !== 4) {
        return res.status(400).json({ error: "Expected 4 corners" });
    }
    fs.writeFileSync(CALIBRATION_PATH, JSON.stringify({ corners, imageWidth, imageHeight, savedAt }, null, 2));
    console.log("Calibration saved:", CALIBRATION_PATH);
    res.json({ ok: true });
});

app.delete("/calibration", (req, res) => {
    if (fs.existsSync(CALIBRATION_PATH)) fs.unlinkSync(CALIBRATION_PATH);
    res.json({ ok: true });
});

app.get("/calibration", (req, res) => {
    if (!fs.existsSync(CALIBRATION_PATH)) return res.json(null);
    res.json(JSON.parse(fs.readFileSync(CALIBRATION_PATH, "utf8")));
});

// ← app.listen must be last
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});