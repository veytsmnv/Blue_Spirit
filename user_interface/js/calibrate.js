/**
 * calibrate.js
 * Lets the professor take a test image, drag 4 corner handles to mark the
 * whiteboard boundary, then saves the calibration to the server + localStorage.
 *
 * Saved format (key: "wbcs_calibration"):
 * {
 *   imageWidth:  <natural px>,
 *   imageHeight: <natural px>,
 *   corners: [
 *     { x, y },   // top-left     (normalised 0-1)
 *     { x, y },   // top-right
 *     { x, y },   // bottom-right
 *     { x, y }    // bottom-left
 *   ]
 * }
 * x/y are fractions of the ORIGINAL image dimensions so they stay valid
 * regardless of display scaling.
 */

// ─── Elements ────────────────────────────────────────────────────────────────
const calCaptureBtn      = document.getElementById("calCaptureBtn");
const calUploadBtn       = document.getElementById("calUploadBtn");
const calUploadInput     = document.getElementById("calUploadInput");
const calibrateStatus    = document.getElementById("calibrateStatus");

const step2Panel         = document.getElementById("step2Panel");
const calibrateContainer = document.getElementById("calibrateContainer");
const calibrateImg       = document.getElementById("calibrateImg");
const calibrateSvg       = document.getElementById("calibrateSvg");
const quadPolygon        = document.getElementById("quadPolygon");
const coordsRow          = document.getElementById("coordsRow");

const resetCornersBtn    = document.getElementById("resetCornersBtn");
const saveCalibrationBtn = document.getElementById("saveCalibrationBtn");
const clearCalibrationBtn= document.getElementById("clearCalibrationBtn");
const saveStatus         = document.getElementById("saveStatus");

const savedInfoPanel     = document.getElementById("savedInfoPanel");
const savedCoordsRow     = document.getElementById("savedCoordsRow");

const BASE_URL = `http://${window.location.hostname}:3000`;

// ─── State ────────────────────────────────────────────────────────────────────
const LABELS = ["TL", "TR", "BR", "BL"];

let corners = [];
let handles  = [];
let dragging = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function displayRect() {
  return calibrateImg.getBoundingClientRect();
}

function toSvgPx(corner) {
  const r = displayRect();
  return { x: corner.x * r.width, y: corner.y * r.height };
}

function defaultCorners() {
  const inset = 0.05;
  return [
    { x: inset,       y: inset },
    { x: 1 - inset,   y: inset },
    { x: 1 - inset,   y: 1 - inset },
    { x: inset,       y: 1 - inset }
  ];
}

function updatePolygon() {
  const pts = corners.map(c => {
    const p = toSvgPx(c);
    return `${p.x},${p.y}`;
  }).join(" ");
  quadPolygon.setAttribute("points", pts);
}

function updateHandles() {
  handles.forEach((h, i) => {
    const p = toSvgPx(corners[i]);
    h.setAttribute("cx", p.x);
    h.setAttribute("cy", p.y);
  });
}

function updateLabels() {
  calibrateSvg.querySelectorAll(".corner-label").forEach((lbl, i) => {
    const p = toSvgPx(corners[i]);
    lbl.setAttribute("x", p.x);
    lbl.setAttribute("y", p.y);
  });
}

function updateCoordsRow() {
  const img = calibrateImg;
  const w = img.naturalWidth  || 1;
  const h = img.naturalHeight || 1;
  coordsRow.innerHTML = corners.map((c, i) => {
    const px = Math.round(c.x * w);
    const py = Math.round(c.y * h);
    return `<span class="coord-chip">${LABELS[i]}: (${px}, ${py})</span>`;
  }).join("");
}

function refreshAll() {
  updatePolygon();
  updateHandles();
  updateLabels();
  updateCoordsRow();
  saveCalibrationBtn.disabled = false;
}

// ─── Build SVG handles ───────────────────────────────────────────────────────
function buildHandles() {
  calibrateSvg.querySelectorAll(".corner-handle, .corner-label").forEach(el => el.remove());
  handles = [];

  corners.forEach((_, i) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "corner-handle");
    circle.setAttribute("r", "10");
    calibrateSvg.appendChild(circle);
    handles.push(circle);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("class", "corner-label");
    label.textContent = LABELS[i];
    calibrateSvg.appendChild(label);

    circle.addEventListener("pointerdown", e => {
      e.preventDefault();
      circle.setPointerCapture(e.pointerId);
      dragging = { index: i };
    });

    circle.addEventListener("pointermove", e => {
      if (dragging === null || dragging.index !== i) return;
      const r = displayRect();
      const svgRect = calibrateSvg.getBoundingClientRect();
      const rawX = (e.clientX - svgRect.left) / r.width;
      const rawY = (e.clientY - svgRect.top)  / r.height;
      corners[i] = {
        x: Math.max(0, Math.min(1, rawX)),
        y: Math.max(0, Math.min(1, rawY))
      };
      refreshAll();
    });

    circle.addEventListener("pointerup", () => { dragging = null; });
  });

  refreshAll();
}

// ─── Load image into calibrator ──────────────────────────────────────────────
function loadCalibrationImage(src) {
  calibrateImg.onload = () => {
    step2Panel.style.display = "";
    corners = defaultCorners();
    buildHandles();
    saveStatus.textContent = "";
  };
  calibrateImg.src = src;
}

// ─── Capture from Pi ─────────────────────────────────────────────────────────
calCaptureBtn.addEventListener("click", () => {
  calibrateStatus.textContent = "Capturing…";

  fetch(`${BASE_URL}/capture`, { method: "POST" })
    .then(res => {
      if (!res.ok) throw new Error("Capture failed");
      return res.json();
    })
    .then(data => {
      calibrateStatus.textContent = "✓ Image captured.";
      const filename = data.filename || data.file || data.name;
      if (!filename) throw new Error("No filename returned");
      loadCalibrationImage(`${BASE_URL}/images/${filename}?t=${Date.now()}`);
    })
    .catch(err => {
      calibrateStatus.textContent = "⚠ " + err.message + " — try uploading instead.";
    });
});

// ─── Upload a local file ─────────────────────────────────────────────────────
calUploadBtn.addEventListener("click", () => calUploadInput.click());

calUploadInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  calibrateStatus.textContent = "✓ Image loaded from file.";
  loadCalibrationImage(url);
});

// ─── Reset corners ───────────────────────────────────────────────────────────
resetCornersBtn.addEventListener("click", () => {
  corners = defaultCorners();
  refreshAll();
  saveStatus.textContent = "";
});

// ─── Save calibration ────────────────────────────────────────────────────────
saveCalibrationBtn.addEventListener("click", () => {
  const img = calibrateImg;
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const calibration = {
    imageWidth:  w,
    imageHeight: h,
    corners: corners.map(c => ({ x: c.x, y: c.y })),
    savedAt: new Date().toISOString()
  };

  localStorage.setItem("wbcs_calibration", JSON.stringify(calibration));

  fetch(`${BASE_URL}/calibration`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(calibration)
  })
  .then(() => {
    saveStatus.textContent = "✅ Calibration saved! All future captures will be cropped to this region.";
    renderSavedInfo();
  })
  .catch(() => {
    saveStatus.textContent = "✅ Calibration saved locally (could not reach server).";
    renderSavedInfo();
  });
});

// ─── Clear calibration ───────────────────────────────────────────────────────
clearCalibrationBtn.addEventListener("click", () => {
  if (!confirm("Clear the saved calibration? Images will no longer be cropped.")) return;

  // Clear localStorage
  localStorage.removeItem("wbcs_calibration");

  // Clear on server
  fetch(`${BASE_URL}/calibration`, { method: "DELETE" })
    .catch(() => console.warn("Could not reach server to clear calibration."));

  // Fix: update UI — was missing this call so the panel stayed visible
  saveStatus.textContent = "Calibration cleared.";
  renderSavedInfo();
});

// ─── Show saved calibration info panel ───────────────────────────────────────
function renderSavedInfo() {
  const raw = localStorage.getItem("wbcs_calibration");
  if (!raw) {
    savedInfoPanel.style.display = "none";
    return;
  }

  const cal = JSON.parse(raw);
  savedInfoPanel.style.display = "";
  savedCoordsRow.innerHTML = cal.corners.map((c, i) => {
    const px = Math.round(c.x * cal.imageWidth);
    const py = Math.round(c.y * cal.imageHeight);
    return `<span class="coord-chip">${LABELS[i]}: (${px}, ${py})</span>`;
  }).join("") + `<span class="coord-chip" style="color:#888">saved ${new Date(cal.savedAt).toLocaleString()}</span>`;
}

renderSavedInfo();

// ─── Keep handles correct after window resize ─────────────────────────────────
window.addEventListener("resize", () => {
  if (handles.length) refreshAll();
});

// ─── Expose calibration getter for other scripts ──────────────────────────────
window.getCalibration = function() {
  const raw = localStorage.getItem("wbcs_calibration");
  return raw ? JSON.parse(raw) : null;
};