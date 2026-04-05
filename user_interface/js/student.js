const BASE_URL = `http://${window.location.hostname}:3000`;

// ── Image state ───────────────────────────────────────────────────────────────
let images         = [];
let currentIndex   = -1;
let isManuallyBrowsing = false;
let knownLastUpdate    = null;

// ── Canvas setup ──────────────────────────────────────────────────────────────
const imageCanvas      = document.getElementById("imageCanvas");
const annotationCanvas = document.getElementById("annotationCanvas");
const imgCtx           = imageCanvas.getContext("2d");
const annCtx           = annotationCanvas.getContext("2d");
const canvasWrapper    = document.getElementById("canvasWrapper");

// ── UI elements ───────────────────────────────────────────────────────────────
const toolDraw            = document.getElementById("toolDraw");
const toolEraser          = document.getElementById("toolEraser");
const toolText            = document.getElementById("toolText");
const colorPicker         = document.getElementById("colorPicker");
const brushSize           = document.getElementById("brushSize");
const undoBtn             = document.getElementById("undoBtn");
const clearAnnotations    = document.getElementById("clearAnnotations");
const saveAnnotationsBtn  = document.getElementById("saveAnnotationsBtn");
const annotationSavedBadge= document.getElementById("annotationSavedBadge");
const backBtn             = document.getElementById("backBtn");
const forwardBtn          = document.getElementById("forwardBtn");
const imageCount          = document.getElementById("imageCount");
const sessionHeader       = document.getElementById("sessionHeader");
const flagBtn             = document.getElementById("flagBtn");
const fullscreenBtn       = document.getElementById("fullscreenBtn");

// ── Annotation state ──────────────────────────────────────────────────────────
let activeTool = "draw";
let isDrawing  = false;
let undoStack  = [];

// ── localStorage key for annotations ─────────────────────────────────────────
function annotationKey(filename) {
    return `wbcs_ann_${filename}`;
}

// ── Save annotations for current image to localStorage ────────────────────────
function saveAnnotations() {
    if (currentIndex === -1 || images.length === 0) return;
    const key  = annotationKey(images[currentIndex]);
    const data = annotationCanvas.toDataURL("image/png");
    try {
        localStorage.setItem(key, data);
        annotationSavedBadge.textContent = "✓ Annotations saved";
        setTimeout(() => { annotationSavedBadge.textContent = ""; }, 2000);
    } catch (e) {
        // localStorage can run out of space with many large canvases
        annotationSavedBadge.textContent = "⚠ Could not save (storage full)";
    }
}

// ── Restore saved annotations for a given filename ────────────────────────────
function restoreAnnotations(filename) {
    const key  = annotationKey(filename);
    const data = localStorage.getItem(key);
    if (!data) return;
    const img  = new Image();
    img.onload = () => {
        annCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
        annCtx.drawImage(img, 0, 0);
    };
    img.src = data;
}

// ── Clear stored annotations for a filename ───────────────────────────────────
function clearStoredAnnotations(filename) {
    localStorage.removeItem(annotationKey(filename));
}

saveAnnotationsBtn.addEventListener("click", saveAnnotations);

// ── Session name ──────────────────────────────────────────────────────────────
fetch(`${BASE_URL}/session-info`)
    .then(res => res.json())
    .then(session => {
        sessionHeader.textContent = (session && session.name) ? session.name : "Live Whiteboard";
    })
    .catch(() => { sessionHeader.textContent = "Live Whiteboard"; });

// ── Tool switching ────────────────────────────────────────────────────────────
function setTool(tool) {
    activeTool = tool;
    [toolDraw, toolEraser, toolText].forEach(b => b.classList.remove("active"));
    annotationCanvas.className = "";
    if (tool === "draw")   { toolDraw.classList.add("active"); }
    if (tool === "eraser") { toolEraser.classList.add("active"); annotationCanvas.classList.add("erasing"); }
    if (tool === "text")   { toolText.classList.add("active");   annotationCanvas.classList.add("text"); }
}

toolDraw.addEventListener("click",   () => setTool("draw"));
toolEraser.addEventListener("click", () => setTool("eraser"));
toolText.addEventListener("click",   () => setTool("text"));

// ── Undo / Clear ──────────────────────────────────────────────────────────────
function saveUndo() {
    undoStack.push(annCtx.getImageData(0, 0, annotationCanvas.width, annotationCanvas.height));
    if (undoStack.length > 40) undoStack.shift();
}

undoBtn.addEventListener("click", () => {
    if (undoStack.length === 0) return;
    annCtx.putImageData(undoStack.pop(), 0, 0);
});

clearAnnotations.addEventListener("click", () => {
    saveUndo();
    annCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
    // Also clear from localStorage so the cleared state persists
    if (currentIndex !== -1) clearStoredAnnotations(images[currentIndex]);
    annotationSavedBadge.textContent = "";
});

// ── Canvas coordinate helper ──────────────────────────────────────────────────
function getCanvasPos(e) {
    const rect   = annotationCanvas.getBoundingClientRect();
    const scaleX = annotationCanvas.width  / rect.width;
    const scaleY = annotationCanvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top)  * scaleY
    };
}

// ── Drawing ───────────────────────────────────────────────────────────────────
annotationCanvas.addEventListener("pointerdown", e => {
    if (activeTool === "text") { handleTextTool(e); return; }
    saveUndo();
    isDrawing = true;
    const pos = getCanvasPos(e);
    annCtx.beginPath();
    annCtx.arc(pos.x, pos.y, getLineWidth() / 2, 0, Math.PI * 2);
    annCtx.fill();
    annCtx.beginPath();
    annCtx.moveTo(pos.x, pos.y);
});

annotationCanvas.addEventListener("pointermove", e => {
    if (!isDrawing) return;
    applyBrush(getCanvasPos(e));
});

annotationCanvas.addEventListener("pointerup",    () => { isDrawing = false; });
annotationCanvas.addEventListener("pointerleave", () => { isDrawing = false; });
annotationCanvas.addEventListener("touchstart", e => { e.preventDefault(); }, { passive: false });
annotationCanvas.addEventListener("touchmove",  e => { e.preventDefault(); }, { passive: false });

function getLineWidth() { return parseInt(brushSize.value); }

function applyBrush(pos) {
    annCtx.lineWidth  = getLineWidth();
    annCtx.lineCap    = "round";
    annCtx.lineJoin   = "round";

    if (activeTool === "eraser") {
        annCtx.globalCompositeOperation = "destination-out";
        annCtx.strokeStyle = "rgba(0,0,0,1)";
        annCtx.lineWidth   = getLineWidth() * 3;
    } else {
        annCtx.globalCompositeOperation = "source-over";
        annCtx.strokeStyle = colorPicker.value;
        annCtx.fillStyle   = colorPicker.value;
    }

    annCtx.lineTo(pos.x, pos.y);
    annCtx.stroke();
    annCtx.beginPath();
    annCtx.moveTo(pos.x, pos.y);
}

function handleTextTool(e) {
    const pos  = getCanvasPos(e);
    const text = prompt("Enter annotation text:");
    if (!text) return;
    saveUndo();
    const size = Math.max(14, getLineWidth() * 5);
    annCtx.globalCompositeOperation = "source-over";
    annCtx.font      = `${size}px DM Sans, sans-serif`;
    annCtx.fillStyle = colorPicker.value;
    annCtx.fillText(text, pos.x, pos.y);
}

// ── Load image onto canvas ────────────────────────────────────────────────────
function loadImageToCanvas(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            imageCanvas.width       = img.naturalWidth;
            imageCanvas.height      = img.naturalHeight;
            annotationCanvas.width  = img.naturalWidth;
            annotationCanvas.height = img.naturalHeight;
            imgCtx.drawImage(img, 0, 0);
            resolve();
        };
        img.src = src;
    });
}

// ── Show image — restore saved annotations, reset undo stack ──────────────────
function showImage(index) {
    if (index < 0 || index >= images.length) return;
    currentIndex = index;

    // Reset drawing state for new image
    undoStack = [];
    isDrawing = false;
    annotationSavedBadge.textContent = "";

    const filename = images[currentIndex];

    loadImageToCanvas(`${BASE_URL}/images/${filename}?t=${Date.now()}`)
        .then(() => {
            // Restore any saved annotations for this image
            restoreAnnotations(filename);
        });

    imageCount.textContent = (currentIndex + 1) + " / " + images.length;
    backBtn.disabled    = currentIndex === 0;
    forwardBtn.disabled = currentIndex === images.length - 1;

    updateFlagBtn(filename);
}

// ── Image list ────────────────────────────────────────────────────────────────
function loadImageList() {
    return fetch(`${BASE_URL}/images-list`)
        .then(res => res.json())
        .then(data => { images = data.files; });
}

// ── Navigation ────────────────────────────────────────────────────────────────
backBtn.addEventListener("click", () => {
    isManuallyBrowsing = true;
    showImage(currentIndex - 1);
});

forwardBtn.addEventListener("click", () => {
    showImage(currentIndex + 1);
    if (currentIndex === images.length - 1) isManuallyBrowsing = false;
});

// ── Polling ───────────────────────────────────────────────────────────────────
setInterval(() => {
    fetch(`${BASE_URL}/last-update`)
        .then(res => res.json())
        .then(data => {
            if (knownLastUpdate === null) { knownLastUpdate = data.lastUpdate; return; }
            if (data.lastUpdate !== knownLastUpdate) {
                knownLastUpdate = data.lastUpdate;
                loadImageList().then(() => {
                    if (!isManuallyBrowsing) {
                        showImage(images.length - 1);
                    } else {
                        imageCount.textContent = (currentIndex + 1) + " / " + images.length;
                        forwardBtn.disabled = currentIndex === images.length - 1;
                        backBtn.disabled    = currentIndex === 0;
                    }
                });
            }
        });
}, 2000);

// ── Startup ───────────────────────────────────────────────────────────────────
loadImageList().then(() => {
    if (images.length > 0) {
        showImage(images.length - 1);
    }
});

// ── Flagging — state persists per image in localStorage across page reloads ────
function flagKey(filename) {
    return `wbcs_flag_${filename}`;
}

function isFlagged(filename) {
    return localStorage.getItem(flagKey(filename)) === "1";
}

function updateFlagBtn(filename) {
    if (isFlagged(filename)) {
        flagBtn.textContent = "✓ Flagged";
        flagBtn.classList.add("flagged");
    } else {
        flagBtn.textContent = "🖐 Flag This Image";
        flagBtn.classList.remove("flagged");
    }
}

flagBtn.addEventListener("click", () => {
    if (currentIndex === -1 || images.length === 0) return;
    const filename = images[currentIndex];

    if (isFlagged(filename)) {
        // Un-flag
        localStorage.removeItem(flagKey(filename));
        fetch(`${BASE_URL}/flag`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename })
        }).catch(() => {});
    } else {
        // Flag
        localStorage.setItem(flagKey(filename), "1");
        fetch(`${BASE_URL}/flag`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename })
        }).catch(() => {});
    }

    updateFlagBtn(filename);
});

// ── Fullscreen ────────────────────────────────────────────────────────────────
fullscreenBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
        canvasWrapper.requestFullscreen().catch(err => {
            console.warn("Fullscreen not available:", err);
        });
    } else {
        document.exitFullscreen();
    }
});

document.addEventListener("fullscreenchange", () => {
    fullscreenBtn.textContent = document.fullscreenElement ? "✕ Exit Full Screen" : "⛶ Full Screen";
});

// ── Download with annotations ─────────────────────────────────────────────────
document.getElementById("downloadBtn").addEventListener("click", () => {
    if (currentIndex === -1 || images.length === 0) return;
    const composite = document.createElement("canvas");
    composite.width  = imageCanvas.width;
    composite.height = imageCanvas.height;
    const ctx = composite.getContext("2d");
    ctx.drawImage(imageCanvas, 0, 0);
    ctx.drawImage(annotationCanvas, 0, 0);
    const link = document.createElement("a");
    link.href     = composite.toDataURL("image/jpeg", 0.95);
    link.download = "annotated_" + images[currentIndex].split("/").pop();
    link.click();
});

// ── Download all (no annotations) ────────────────────────────────────────────
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