const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const multer = require("multer");
const QRCode = require("qrcode");

const app = express();
const PORT = 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, "user_interface")));
app.use("/images", express.static(path.join(__dirname, "capture")));

// ── Paths ─────────────────────────────────────────────────────────────────────
const CAPTURE_DIR      = path.join(__dirname, "capture");
const CALIBRATION_PATH = path.join(__dirname, "calibration.json");
const SETTINGS_PATH    = path.join(__dirname, "settings.json");
const SESSION_PATH     = path.join(__dirname, "session.json");

let lastUpdate = Date.now();

// ── In-memory flag store ──────────────────────────────────────────────────────
let flags = {};

// ── Default enhancement settings ──────────────────────────────────────────────
const DEFAULT_SETTINGS = { brightness: 0, contrast: 1.0, sharpness: 0.25 };

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_PATH))
            return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) };
    } catch (e) {}
    return { ...DEFAULT_SETTINGS };
}

function loadSession() {
    try {
        if (fs.existsSync(SESSION_PATH))
            return JSON.parse(fs.readFileSync(SESSION_PATH, "utf8"));
    } catch (e) {}
    return null;
}

function activeCaptureDir() {
    const session = loadSession();
    return session ? path.join(CAPTURE_DIR, session.folder) : CAPTURE_DIR;
}

function prefixFile(filename) {
    const session = loadSession();
    return session ? `${session.folder}/${filename}` : filename;
}

// ── Get local IP ──────────────────────────────────────────────────────────────
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) return iface.address;
        }
    }
    return "127.0.0.1";
}

const LOCAL_IP    = getLocalIP();
const STUDENT_URL = `http://${LOCAL_IP}:${PORT}/student.html`;
console.log(`Student URL: ${STUDENT_URL}`);

// ── Multer ────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = activeCaptureDir();
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const dir = activeCaptureDir();
        const existing = fs.readdirSync(dir)
            .filter(f => f.startsWith("photo_") && f.endsWith(".jpg"))
            .map(f => parseInt(f.replace("photo_", "").replace(".jpg", "")))
            .filter(n => !isNaN(n));
        const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
        cb(null, `photo_${nextNum}.jpg`);
    }
});

const upload = multer({ storage });

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSortedPhotos(dir, descending = false) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.startsWith("photo_") && f.endsWith(".jpg"))
        .sort((a, b) => {
            const numA = parseInt(a.replace("photo_", "").replace(".jpg", ""));
            const numB = parseInt(b.replace("photo_", "").replace(".jpg", ""));
            return descending ? numB - numA : numA - numB;
        });
}

// ── Test ──────────────────────────────────────────────────────────────────────
app.get("/test", (req, res) => res.send("Server is working"));

// ── QR ────────────────────────────────────────────────────────────────────────
app.get("/qr.png", async (req, res) => {
    try {
        const buffer = await QRCode.toBuffer(STUDENT_URL, {
            type: "png", width: 400, margin: 2,
            color: { dark: "#000000", light: "#ffffff" }
        });
        res.setHeader("Content-Type", "image/png");
        res.send(buffer);
    } catch (err) {
        res.status(500).send("QR generation failed");
    }
});

app.get("/qr-info", (req, res) => res.json({ url: STUDENT_URL }));

// ── Session ───────────────────────────────────────────────────────────────────
app.get("/session", (req, res) => res.json(loadSession()));

app.post("/session", (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Session name required" });

    const safeName = name.trim().replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_");

    // Look for an existing folder that matches this session name.
    // Folders are named <safeName>_<timestamp>, so we match on the prefix.
    let folder   = null;
    let resumed  = false;

    if (fs.existsSync(CAPTURE_DIR)) {
        const existing = fs.readdirSync(CAPTURE_DIR).find(entry => {
            const fullPath = path.join(CAPTURE_DIR, entry);
            return fs.statSync(fullPath).isDirectory() && entry.startsWith(safeName + "_");
        });
        if (existing) {
            folder  = existing;
            resumed = true;
        }
    }

    // No matching folder found — create a new one
    if (!folder) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        folder = `${safeName}_${timestamp}`;
    }

    const session = {
        name: name.trim(),
        folder,
        startedAt: new Date().toISOString(),
        resumed
    };

    fs.mkdirSync(path.join(CAPTURE_DIR, folder), { recursive: true });
    fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2));
    flags = {};

    console.log(resumed ? "Session resumed:" : "Session started:", session.name, "→", folder);
    res.json(session);
});

app.delete("/session", (req, res) => {
    try {
        if (fs.existsSync(SESSION_PATH)) fs.unlinkSync(SESSION_PATH);
        flags = {};
        console.log("Session ended.");
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to end session" });
    }
});

app.get("/session-info", (req, res) => {
    const session = loadSession();
    res.json(session ? { name: session.name, startedAt: session.startedAt } : null);
});

// ── Delete all images in the active session folder ────────────────────────────
app.delete("/session/images", (req, res) => {
    const session = loadSession();
    if (!session) return res.status(400).json({ error: "No active session" });

    const dir = path.join(CAPTURE_DIR, session.folder);
    if (!fs.existsSync(dir)) return res.json({ deleted: 0 });

    const files = fs.readdirSync(dir)
        .filter(f => f.startsWith("photo_") && f.endsWith(".jpg"));

    let deleted = 0;
    const errors = [];

    files.forEach(f => {
        try {
            fs.unlinkSync(path.join(dir, f));
            deleted++;
        } catch (e) {
            errors.push(f);
        }
    });

    lastUpdate = Date.now();
    console.log(`Deleted ${deleted} images from session "${session.name}"`);

    if (errors.length > 0) {
        return res.status(207).json({ deleted, errors });
    }
    res.json({ deleted });
});

// ── Enhancement settings ──────────────────────────────────────────────────────
app.get("/settings", (req, res) => res.json(loadSettings()));

app.post("/settings", (req, res) => {
    const current = loadSettings();
    const updated = {
        brightness: req.body.brightness !== undefined ? parseFloat(req.body.brightness) : current.brightness,
        contrast:   req.body.contrast   !== undefined ? parseFloat(req.body.contrast)   : current.contrast,
        sharpness:  req.body.sharpness  !== undefined ? parseFloat(req.body.sharpness)  : current.sharpness,
    };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2));
    res.json(updated);
});

// ── Student flags ─────────────────────────────────────────────────────────────
app.get("/flags", (req, res) => res.json(flags));

app.post("/flag", (req, res) => {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: "filename required" });
    flags[filename] = (flags[filename] || 0) + 1;
    res.json({ ok: true, count: flags[filename] });
});

app.delete("/flag", (req, res) => {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: "filename required" });
    if (flags[filename] && flags[filename] > 0) {
        flags[filename]--;
        if (flags[filename] === 0) delete flags[filename];
    }
    res.json({ ok: true });
});

app.delete("/flags", (req, res) => {
    flags = {};
    res.json({ ok: true });
});

// ── Last update ───────────────────────────────────────────────────────────────
app.get("/last-update", (req, res) => res.json({ lastUpdate }));

// ── Image list ────────────────────────────────────────────────────────────────
app.get("/images-list", (req, res) => {
    const dir   = activeCaptureDir();
    const files = getSortedPhotos(dir).map(f => prefixFile(f));
    res.json({ files });
});

// ── Latest image ──────────────────────────────────────────────────────────────
app.get("/latest", (req, res) => {
    const files = getSortedPhotos(activeCaptureDir(), true);
    res.json({ filename: files.length > 0 ? prefixFile(files[0]) : null });
});

// ── Capture ───────────────────────────────────────────────────────────────────
app.post("/capture", (req, res) => {
    const dir = activeCaptureDir();
    fs.mkdirSync(dir, { recursive: true });
    const env = { ...process.env, CAPTURE_DIR: dir };

    exec("python3 pi/capture.py", { cwd: __dirname, env }, (err, stdout, stderr) => {
        if (err) {
            console.error("Capture error:", err);
            console.error(stderr);
            return res.status(500).json({ error: "Capture failed", detail: stderr });
        }
        lastUpdate = Date.now();
        const rawFilename = stdout.trim().split("/").pop();
        res.json({ filename: prefixFile(rawFilename) });
    });
});

// ── Upload ────────────────────────────────────────────────────────────────────
app.post("/upload", upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    lastUpdate = Date.now();
    res.json({ filename: prefixFile(req.file.filename) });
});

// ── Download ──────────────────────────────────────────────────────────────────
app.get("/download/:folder/:filename", (req, res) => {
    const filepath = path.join(CAPTURE_DIR, req.params.folder, req.params.filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "File not found" });
    res.download(filepath);
});

app.get("/download/:filename", (req, res) => {
    const filepath = path.join(CAPTURE_DIR, path.basename(req.params.filename));
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "File not found" });
    res.download(filepath);
});

// ── Delete single image ───────────────────────────────────────────────────────
app.delete("/images/:folder/:filename", (req, res) => {
    const filepath = path.join(CAPTURE_DIR, req.params.folder, req.params.filename);
    fs.unlink(filepath, (err) => {
        if (err) return res.status(500).json({ error: "Delete failed" });
        lastUpdate = Date.now();
        res.json({ ok: true });
    });
});

app.delete("/images/:filename", (req, res) => {
    const filepath = path.join(CAPTURE_DIR, path.basename(req.params.filename));
    fs.unlink(filepath, (err) => {
        if (err) return res.status(500).json({ error: "Delete failed" });
        lastUpdate = Date.now();
        res.json({ ok: true });
    });
});

// ── Calibration ───────────────────────────────────────────────────────────────
app.get("/calibration", (req, res) => {
    if (!fs.existsSync(CALIBRATION_PATH)) return res.json(null);
    try { res.json(JSON.parse(fs.readFileSync(CALIBRATION_PATH, "utf8"))); }
    catch (e) { res.status(500).json({ error: "Failed to read calibration file" }); }
});

app.post("/calibration", (req, res) => {
    const { corners, imageWidth, imageHeight, savedAt } = req.body;
    if (!corners || corners.length !== 4) return res.status(400).json({ error: "Expected 4 corners" });
    try {
        fs.writeFileSync(CALIBRATION_PATH, JSON.stringify({ corners, imageWidth, imageHeight, savedAt }, null, 2));
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Failed to save calibration file" }); }
});

app.delete("/calibration", (req, res) => {
    try {
        if (fs.existsSync(CALIBRATION_PATH)) fs.unlinkSync(CALIBRATION_PATH);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Failed to delete calibration file" }); }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Students can connect at: ${STUDENT_URL}`);
});