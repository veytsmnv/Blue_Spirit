/**
 * server-calibration-endpoints.js
 *
 * Add these routes to your existing Express server.
 * They handle saving/deleting the calibration.json file
 * that process.py reads automatically.
 *
 * Assumes your server already has:
 *   - express, fs, path imported
 *   - app = express()
 *   - app.use(express.json())
 */

const CALIBRATION_PATH = path.join(__dirname, "calibration.json");

// Save calibration sent from the browser
app.post("/calibration", (req, res) => {
  const { corners, imageWidth, imageHeight, savedAt } = req.body;

  if (!corners || corners.length !== 4) {
    return res.status(400).json({ error: "Expected 4 corners" });
  }

  const data = { corners, imageWidth, imageHeight, savedAt };

  fs.writeFileSync(CALIBRATION_PATH, JSON.stringify(data, null, 2));
  console.log("Calibration saved:", CALIBRATION_PATH);
  res.json({ ok: true });
});

// Clear calibration
app.delete("/calibration", (req, res) => {
  if (fs.existsSync(CALIBRATION_PATH)) {
    fs.unlinkSync(CALIBRATION_PATH);
    console.log("Calibration deleted.");
  }
  res.json({ ok: true });
});

// (Optional) Read current calibration
app.get("/calibration", (req, res) => {
  if (!fs.existsSync(CALIBRATION_PATH)) {
    return res.json(null);
  }
  const data = JSON.parse(fs.readFileSync(CALIBRATION_PATH, "utf8"));
  res.json(data);
});

/**
 * Your existing /capture endpoint should already call process.py.
 * process.py will auto-detect calibration.json in the same directory,
 * so no changes to the capture endpoint are needed.
 *
 * If you want to be explicit, you can pass the path as a 3rd argument:
 *
 *   subprocess.run([
 *     "python", "pi/process.py",
 *     str(output), str(output),
 *     str(calibration_path)   // <-- optional 3rd arg
 *   ], check=True)
 */
