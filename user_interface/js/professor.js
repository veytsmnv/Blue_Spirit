const statusEl   = document.getElementById("status");
const feed       = document.getElementById("cameraFeed");
const backBtn    = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const imageCount = document.getElementById("imageCount");
const imageLabel = document.getElementById("imageLabel");
const BASE_URL   = `http://${window.location.hostname}:3000`;

let images       = [];
let currentIndex = -1;
let activeSession = null;  // tracks current session state in JS

// ── Session-gated controls ────────────────────────────────────────────────────
// These elements are disabled until a session is active
const SESSION_GATED = [
    document.getElementById("captureBtn"),
    document.getElementById("uploadBtn"),
    document.getElementById("startTimerBtn"),
];

function setSessionGatedEnabled(enabled) {
    SESSION_GATED.forEach(el => { el.disabled = !enabled; });
}

// ── Image list & display ──────────────────────────────────────────────────────
function loadImageList() {
    return fetch(`${BASE_URL}/images-list`)
        .then(res => res.json())
        .then(data => { images = data.files; });
}

function showImage(index) {
    if (index < 0 || index >= images.length) return;
    currentIndex = index;
    feed.src = `${BASE_URL}/images/${images[currentIndex]}?t=${Date.now()}`;
    imageCount.textContent = (currentIndex + 1) + " / " + images.length;
    backBtn.disabled    = currentIndex === 0;
    forwardBtn.disabled = currentIndex === images.length - 1;
}

function clearImageDisplay() {
    feed.src = "";
    imageCount.textContent = "";
    backBtn.disabled = true;
    forwardBtn.disabled = true;
    images = [];
    currentIndex = -1;
}

backBtn.addEventListener("click",    () => showImage(currentIndex - 1));
forwardBtn.addEventListener("click", () => showImage(currentIndex + 1));

// ── Capture ───────────────────────────────────────────────────────────────────
function doCapture() {
    statusEl.textContent = "Capturing…";
    statusEl.className   = "";

    return fetch(`${BASE_URL}/capture`, { method: "POST" })
        .then(res => {
            if (!res.ok) throw new Error("Capture failed");
            return res.json();
        })
        .then(() => {
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

// ── Delete single image ───────────────────────────────────────────────────────
document.getElementById("deleteBtn").addEventListener("click", () => {
    if (currentIndex === -1 || images.length === 0) return;
    const filename = images[currentIndex];
    if (!confirm("Delete " + filename.split("/").pop() + "?")) return;

    fetch(`${BASE_URL}/images/${filename}`, { method: "DELETE" })
        .then(res => {
            if (res.ok) {
                images.splice(currentIndex, 1);
                if (images.length === 0) {
                    clearImageDisplay();
                } else {
                    currentIndex = Math.min(currentIndex, images.length - 1);
                    showImage(currentIndex);
                }
            }
        });
});

// ── Delete all images in session ──────────────────────────────────────────────
function deleteAllImages() {
    return new Promise((resolve, reject) => {
        fetch(`${BASE_URL}/session/images`, { method: "DELETE" })
            .then(res => res.json())
            .then(data => {
                clearImageDisplay();
                statusEl.textContent = `Deleted ${data.deleted} image${data.deleted !== 1 ? "s" : ""}.`;
                statusEl.className   = "";
                resolve(data.deleted);
            })
            .catch(err => {
                statusEl.textContent = "Delete all failed: " + err.message;
                statusEl.className   = "error";
                reject(err);
            });
    });
}

document.getElementById("deleteAllBtn").addEventListener("click", () => {
    const count = images.length;
    if (count === 0) {
        statusEl.textContent = "No images to delete.";
        statusEl.className   = "";
        return;
    }
    if (!confirm(`Delete all ${count} image${count !== 1 ? "s" : ""} in this session? This cannot be undone.`)) return;
    deleteAllImages();
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
const sessionNameInput     = document.getElementById("sessionNameInput");
const startSessionBtn      = document.getElementById("startSessionBtn");
const endSessionBtn        = document.getElementById("endSessionBtn");
const sessionBadge         = document.getElementById("sessionBadge");
const deleteAllRow         = document.getElementById("deleteAllRow");
const sessionRequiredNotice= document.getElementById("sessionRequiredNotice");

function updateSessionUI(session) {
    activeSession = session;

    if (session) {
        // Session active — unlock everything
        sessionNameInput.value    = session.name;
        sessionNameInput.disabled = true;
        startSessionBtn.disabled  = true;
        endSessionBtn.disabled    = false;
        sessionBadge.textContent  = `● Active: ${session.name}`;
        sessionBadge.className    = "session-badge active";
        imageLabel.textContent    = session.name;
        deleteAllRow.style.display = "";
        sessionRequiredNotice.style.display = "none";
        setSessionGatedEnabled(true);
    } else {
        // No session — lock capture controls and show notice
        sessionNameInput.value    = "";
        sessionNameInput.disabled = false;
        startSessionBtn.disabled  = false;
        endSessionBtn.disabled    = true;
        sessionBadge.textContent  = "No active session";
        sessionBadge.className    = "session-badge";
        imageLabel.textContent    = "Start a session to begin capturing";
        deleteAllRow.style.display = "none";
        sessionRequiredNotice.style.display = "";
        setSessionGatedEnabled(false);
    }
}

// Load session state on page load
fetch(`${BASE_URL}/session`)
    .then(res => res.json())
    .then(session => {
        updateSessionUI(session);
        if (session) {
            loadImageList().then(() => {
                if (images.length > 0) showImage(images.length - 1);
            });
        }
    });

startSessionBtn.addEventListener("click", () => {
    const name = sessionNameInput.value.trim();
    if (!name) {
        sessionNameInput.focus();
        sessionNameInput.style.borderColor = "#dc2626";
        setTimeout(() => { sessionNameInput.style.borderColor = ""; }, 2000);
        return;
    }

    fetch(`${BASE_URL}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
    })
    .then(res => res.json())
    .then(session => {
        updateSessionUI(session);
        if (session.resumed) {
            // Load existing images from the resumed session
            loadImageList().then(() => {
                const count = images.length;
                statusEl.textContent = `Resumed session "${session.name}" — ${count} existing image${count !== 1 ? "s" : ""} loaded.`;
                statusEl.className   = "success";
                if (count > 0) showImage(count - 1);
            });
        } else {
            clearImageDisplay();
            statusEl.textContent = `Session "${session.name}" started.`;
            statusEl.className   = "success";
        }
    })
    .catch(err => {
        statusEl.textContent = "Failed to start session: " + err.message;
        statusEl.className   = "error";
    });
});

endSessionBtn.addEventListener("click", async () => {
    if (!activeSession) return;

    const count = images.length;

    // Step 1 — ask about deletion if there are images
    if (count > 0) {
        const choice = confirm(
            `End session "${activeSession.name}"?\n\n` +
            `Click OK to delete all ${count} image${count !== 1 ? "s" : ""} and end the session.\n` +
            `Click Cancel to end the session without deleting images.`
        );

        if (choice) {
            // Delete all then end session
            await deleteAllImages();
        }
    } else {
        if (!confirm(`End session "${activeSession.name}"?`)) return;
    }

    // Step 2 — end the session
    fetch(`${BASE_URL}/session`, { method: "DELETE" })
        .then(res => res.json())
        .then(() => {
            updateSessionUI(null);
            clearImageDisplay();
            // Stop timer if running
            if (timerHandle) {
                clearInterval(timerHandle);
                timerHandle = null;
                stopCountdownDisplay();
                startTimerBtn.disabled      = true;  // will be re-disabled by updateSessionUI
                stopTimerBtn.disabled       = true;
                timerIntervalInput.disabled = false;
            }
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
    }).then(() => {
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

let timerHandle      = null;
let countdownHandle  = null;
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
    startTimerBtn.disabled      = true;
    stopTimerBtn.disabled       = false;
    timerIntervalInput.disabled = true;
    doCapture();
    startCountdownDisplay(intervalSecs);
    timerHandle = setInterval(() => {
        doCapture();
        secondsRemaining = intervalSecs;
    }, intervalSecs * 1000);
});

stopTimerBtn.addEventListener("click", () => {
    clearInterval(timerHandle);
    timerHandle = null;
    stopCountdownDisplay();
    // Re-enable start only if session is still active
    startTimerBtn.disabled      = !activeSession;
    stopTimerBtn.disabled       = true;
    timerIntervalInput.disabled = false;
    statusEl.textContent = "Auto-capture stopped.";
    statusEl.className   = "";
});

// ── Student flags ─────────────────────────────────────────────────────────────
const flagList         = document.getElementById("flagList");
const noFlagsMsg       = document.getElementById("noFlagsMsg");
const totalFlagBadge   = document.getElementById("totalFlagBadge");
const clearAllFlagsBtn = document.getElementById("clearAllFlagsBtn");

function renderFlags(flags) {
    const entries = Object.entries(flags).filter(([, count]) => count > 0);

    if (entries.length === 0) {
        noFlagsMsg.style.display = "";
        flagList.innerHTML = "";
        flagList.appendChild(noFlagsMsg);
        totalFlagBadge.style.display = "none";
        return;
    }

    noFlagsMsg.style.display = "none";
    const totalFlags = entries.reduce((sum, [, c]) => sum + c, 0);
    totalFlagBadge.textContent   = totalFlags;
    totalFlagBadge.style.display = "";

    entries.sort((a, b) => b[1] - a[1]);
    flagList.innerHTML = "";

    entries.forEach(([filename, count]) => {
        const item = document.createElement("div");
        item.className = "flag-item";

        const nameSpan  = document.createElement("span");
        nameSpan.className   = "flag-filename";
        nameSpan.textContent = filename.split("/").pop();

        const countSpan = document.createElement("span");
        countSpan.className   = "flag-count";
        countSpan.textContent = count === 1 ? "1 student" : `${count} students`;

        item.appendChild(nameSpan);
        item.appendChild(countSpan);
        item.addEventListener("click", () => {
            const idx = images.indexOf(filename);
            if (idx !== -1) showImage(idx);
        });

        flagList.appendChild(item);
    });
}

function pollFlags() {
    fetch(`${BASE_URL}/flags`)
        .then(res => res.json())
        .then(flags => renderFlags(flags))
        .catch(() => {});
}

pollFlags();
setInterval(pollFlags, 5000);

clearAllFlagsBtn.addEventListener("click", () => {
    if (!confirm("Clear all student flags?")) return;
    fetch(`${BASE_URL}/flags`, { method: "DELETE" })
        .then(() => renderFlags({}));
});