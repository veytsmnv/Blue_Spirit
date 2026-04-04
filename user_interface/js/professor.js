const statusEl   = document.getElementById("status");
const feed       = document.getElementById("cameraFeed");
const backBtn    = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const imageCount = document.getElementById("imageCount");
const imageLabel = document.getElementById("imageLabel");
const BASE_URL   = `http://${window.location.hostname}:3000`;

let images       = [];
let currentIndex = -1;

// ── Image list & display ──────────────────────────────────────────────────────
function loadImageList() {
    return fetch(`${BASE_URL}/images-list`)
        .then(res => res.json())
        .then(data => { images = data.files; });
}

function showImage(index) {
    if (index < 0 || index >= images.length) return;
    currentIndex = index;
    // images[index] may be "SessionFolder/photo_1.jpg" — /images/ static serves the full capture dir
    feed.src = `${BASE_URL}/images/${images[currentIndex]}?t=${Date.now()}`;
    imageCount.textContent = (currentIndex + 1) + " / " + images.length;
    backBtn.disabled    = currentIndex === 0;
    forwardBtn.disabled = currentIndex === images.length - 1;
}

backBtn.addEventListener("click",    () => showImage(currentIndex - 1));
forwardBtn.addEventListener("click", () => showImage(currentIndex + 1));

loadImageList().then(() => {
    if (images.length > 0) showImage(images.length - 1);
}).catch(err => console.error("load failed:", err));

// ── Capture ───────────────────────────────────────────────────────────────────
function doCapture() {
    statusEl.textContent = "Capturing…";
    statusEl.className   = "";

    return fetch(`${BASE_URL}/capture`, { method: "POST" })
        .then(res => {
            if (!res.ok) throw new Error("Capture failed");
            return res.json();
        })
        .then(data => {
            statusEl.textContent = "Photo taken!";
            statusEl.className   = "success";
            return loadImageList().then(() => showImage(images.length - 1));
        })
        .catch(err => {
            statusEl.textContent = "Error: " + err.message;
            statusEl.className   = "error";
        });
}

document.getElementById("captureBtn").addEventListener("click", doCapture);

// ── Upload ────────────────────────────────────────────────────────────────────
document.getElementById("uploadBtn").addEventListener("click", () => {
    document.getElementById("uploadInput").click();
});

document.getElementById("uploadInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);
    statusEl.textContent = "Uploading…";
    statusEl.className   = "";

    fetch(`${BASE_URL}/upload`, { method: "POST", body: formData })
        .then(res => res.json())
        .then(() => {
            statusEl.textContent = "Uploaded!";
            statusEl.className   = "success";
            loadImageList().then(() => showImage(images.length - 1));
        })
        .catch(err => {
            statusEl.textContent = "Upload failed: " + err.message;
            statusEl.className   = "error";
        });
});

// ── Delete ────────────────────────────────────────────────────────────────────
document.getElementById("deleteBtn").addEventListener("click", () => {
    if (currentIndex === -1 || images.length === 0) return;
    const filename = images[currentIndex];
    if (!confirm("Delete " + filename + "?")) return;

    fetch(`${BASE_URL}/images/${filename}`, { method: "DELETE" })
        .then(res => {
            if (res.ok) {
                images.splice(currentIndex, 1);
                if (images.length === 0) {
                    feed.src = "";
                    imageCount.textContent = "";
                    backBtn.disabled = true;
                    forwardBtn.disabled = true;
                } else {
                    currentIndex = Math.min(currentIndex, images.length - 1);
                    showImage(currentIndex);
                }
            }
        });
});

// ── Download ──────────────────────────────────────────────────────────────────
document.getElementById("downloadBtn").addEventListener("click", () => {
    if (currentIndex === -1 || images.length === 0) return;
    const link = document.createElement("a");
    link.href     = `${BASE_URL}/download/${images[currentIndex]}`;
    link.download = images[currentIndex].split("/").pop();
    link.click();
});

document.getElementById("downloadAllBtn").addEventListener("click", () => {
    if (images.length === 0) return;
    images.forEach((filename, i) => {
        setTimeout(() => {
            const link = document.createElement("a");
            link.href     = `${BASE_URL}/download/${filename}`;
            link.download = filename.split("/").pop();
            link.click();
        }, i * 500);
    });
});

// ── Session management ────────────────────────────────────────────────────────
const sessionNameInput = document.getElementById("sessionNameInput");
const startSessionBtn  = document.getElementById("startSessionBtn");
const endSessionBtn    = document.getElementById("endSessionBtn");
const sessionBadge     = document.getElementById("sessionBadge");

function updateSessionUI(session) {
    if (session) {
        sessionNameInput.value    = session.name;
        sessionNameInput.disabled = true;
        startSessionBtn.disabled  = true;
        endSessionBtn.disabled    = false;
        sessionBadge.textContent  = `● Active: ${session.name}`;
        sessionBadge.className    = "session-badge active";
        imageLabel.textContent    = session.name;
    } else {
        sessionNameInput.value    = "";
        sessionNameInput.disabled = false;
        startSessionBtn.disabled  = false;
        endSessionBtn.disabled    = true;
        sessionBadge.textContent  = "No active session";
        sessionBadge.className    = "session-badge";
        imageLabel.textContent    = "Latest Capture";
    }
}

// Load existing session on page load
fetch(`${BASE_URL}/session`)
    .then(res => res.json())
    .then(session => {
        updateSessionUI(session);
        if (session) loadImageList().then(() => { if (images.length > 0) showImage(images.length - 1); });
    });

startSessionBtn.addEventListener("click", () => {
    const name = sessionNameInput.value.trim();
    if (!name) { alert("Please enter a session name."); return; }

    fetch(`${BASE_URL}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
    })
    .then(res => res.json())
    .then(session => {
        updateSessionUI(session);
        images = [];
        feed.src = "";
        imageCount.textContent = "";
        statusEl.textContent = `Session "${session.name}" started.`;
        statusEl.className = "success";
    })
    .catch(err => {
        statusEl.textContent = "Failed to start session: " + err.message;
        statusEl.className = "error";
    });
});

endSessionBtn.addEventListener("click", () => {
    if (!confirm("End the current session?")) return;
    fetch(`${BASE_URL}/session`, { method: "DELETE" })
        .then(res => res.json())
        .then(() => {
            updateSessionUI(null);
            statusEl.textContent = "Session ended.";
            statusEl.className   = "";
        });
});

// ── Enhancement settings ──────────────────────────────────────────────────────
const brightnessSlider = document.getElementById("brightnessSlider");
const contrastSlider   = document.getElementById("contrastSlider");
const sharpnessSlider  = document.getElementById("sharpnessSlider");
const brightnessVal    = document.getElementById("brightnessVal");
const contrastVal      = document.getElementById("contrastVal");
const sharpnessVal     = document.getElementById("sharpnessVal");

function updateSliderDisplays() {
    brightnessVal.textContent = brightnessSlider.value;
    contrastVal.textContent   = parseFloat(contrastSlider.value).toFixed(2);
    sharpnessVal.textContent  = parseFloat(sharpnessSlider.value).toFixed(2);
}

brightnessSlider.addEventListener("input", updateSliderDisplays);
contrastSlider.addEventListener("input",   updateSliderDisplays);
sharpnessSlider.addEventListener("input",  updateSliderDisplays);

// Load saved settings on startup
fetch(`${BASE_URL}/settings`)
    .then(res => res.json())
    .then(s => {
        brightnessSlider.value = s.brightness;
        contrastSlider.value   = s.contrast;
        sharpnessSlider.value  = s.sharpness;
        updateSliderDisplays();
    });

document.getElementById("saveSettingsBtn").addEventListener("click", () => {
    fetch(`${BASE_URL}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            brightness: parseFloat(brightnessSlider.value),
            contrast:   parseFloat(contrastSlider.value),
            sharpness:  parseFloat(sharpnessSlider.value),
        })
    })
    .then(res => res.json())
    .then(() => {
        statusEl.textContent = "Enhancement settings saved. Will apply to next capture.";
        statusEl.className   = "success";
    });
});

document.getElementById("resetSettingsBtn").addEventListener("click", () => {
    brightnessSlider.value = 0;
    contrastSlider.value   = 1.0;
    sharpnessSlider.value  = 0.25;
    updateSliderDisplays();

    fetch(`${BASE_URL}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brightness: 0, contrast: 1.0, sharpness: 0.25 })
    }).then(() => {
        statusEl.textContent = "Settings reset to defaults.";
        statusEl.className   = "";
    });
});

// ── Auto-capture timer ────────────────────────────────────────────────────────
const timerIntervalInput = document.getElementById("timerInterval");
const startTimerBtn      = document.getElementById("startTimerBtn");
const stopTimerBtn       = document.getElementById("stopTimerBtn");
const timerCountdown     = document.getElementById("timerCountdown");

let timerHandle      = null;  // setInterval handle
let countdownHandle  = null;  // setInterval handle for countdown display
let secondsRemaining = 0;

function startCountdownDisplay(intervalSecs) {
    secondsRemaining = intervalSecs;
    timerCountdown.textContent = `Next capture in ${secondsRemaining}s`;
    timerCountdown.className   = "running";

    countdownHandle = setInterval(() => {
        secondsRemaining--;
        if (secondsRemaining <= 0) secondsRemaining = intervalSecs;
        timerCountdown.textContent = `Next capture in ${secondsRemaining}s`;
    }, 1000);
}

function stopCountdownDisplay() {
    clearInterval(countdownHandle);
    countdownHandle = null;
    timerCountdown.textContent = "Timer off";
    timerCountdown.className   = "";
}

startTimerBtn.addEventListener("click", () => {
    const intervalSecs = parseInt(timerIntervalInput.value);
    if (isNaN(intervalSecs) || intervalSecs < 5) {
        alert("Please set an interval of at least 5 seconds.");
        return;
    }

    startTimerBtn.disabled        = true;
    stopTimerBtn.disabled         = false;
    timerIntervalInput.disabled   = true;

    // Capture immediately, then on interval
    doCapture();
    startCountdownDisplay(intervalSecs);

    timerHandle = setInterval(() => {
        doCapture();
        secondsRemaining = intervalSecs; // reset countdown after each capture
    }, intervalSecs * 1000);
});

stopTimerBtn.addEventListener("click", () => {
    clearInterval(timerHandle);
    timerHandle = null;
    stopCountdownDisplay();

    startTimerBtn.disabled      = false;
    stopTimerBtn.disabled       = true;
    timerIntervalInput.disabled = false;
    statusEl.textContent = "Auto-capture stopped.";
    statusEl.className   = "";
});