const express = require("express");
const { exec } = require("child_process");
const path = require("path");

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

    console.log(stdout);
    res.send("Captured");
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});