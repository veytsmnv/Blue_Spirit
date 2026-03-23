const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const app = express();
const PORT = 3000;
app.use(express.static(path.join(__dirname, "user_interface")));
// Serve the frontend files
app.use(express.static(path.join(__dirname, "user_interface")));

// Serve captured images
app.use("/images", express.static(path.join(__dirname, "capture")));

// Test route
app.get("/test", (req, res) => {
  res.send("Server is working");
});

// Capture route
app.post("/capture", (req, res) => {
  exec("python pi/capture.py", { cwd: __dirname }, (err, stdout, stderr) => {
    if (err) {
      console.error("Capture error:", err);
      console.error(stderr);
      return res.status(500).send("Capture failed");
    }

    console.log("stdout:", JSON.stringify(stdout)); // add this line
    const filename = stdout.trim().split("/").pop();
    res.json({ filename });
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
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
app.delete("/images/:filename", (req, res) => {
    const filepath = path.join(__dirname, "capture", req.params.filename);
    fs.unlink(filepath, (err) => {
        if (err) {
            console.error("Delete error:", err);
            return res.status(500).send("Delete failed");
        }
        res.send("Deleted");
    });
});
app.get("/images/:filename", (req, res) => {
  const filepath = path.join(__dirname, "capture", req.params.filename);
  res.download(filepath);
});