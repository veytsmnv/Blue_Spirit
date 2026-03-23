const startSessionBtn = document.getElementById("startSessionBtn");
const captureBtn = document.getElementById("captureBtn");
const endSessionBtn = document.getElementById("endSessionBtn");
const uploadManualBtn = document.getElementById("uploadManualBtn");

const sessionTitleInput = document.getElementById("sessionTitle");
const professorNameInput = document.getElementById("professorName");
const manualImageInput = document.getElementById("manualImageInput");

const sessionStatus = document.getElementById("sessionStatus");
const latestCaptureContainer = document.getElementById("latestCaptureContainer");
const captureHistory = document.getElementById("captureHistory");

let activeSession = getCurrentSession();

function renderSessionState() {
  if (activeSession) {
    sessionTitleInput.value = activeSession.lectureTitle;
    professorNameInput.value = activeSession.professorName;
    sessionTitleInput.disabled = true;
    professorNameInput.disabled = true;
    captureBtn.disabled = false;
    endSessionBtn.disabled = false;
    uploadManualBtn.disabled = false;
    startSessionBtn.disabled = true;

    sessionStatus.textContent = `Active session: ${activeSession.lectureTitle} | ${activeSession.professorName}`;
  } else {
    sessionTitleInput.disabled = false;
    professorNameInput.disabled = false;
    captureBtn.disabled = true;
    endSessionBtn.disabled = true;
    uploadManualBtn.disabled = true;
    startSessionBtn.disabled = false;

    sessionStatus.textContent = "No active session.";
  }
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

function renderLatestCapture(capture) {
  if (!capture) {
    latestCaptureContainer.className = "latest-capture empty-state";
    latestCaptureContainer.innerHTML = "<p>No captures yet.</p>";
    return;
  }

  latestCaptureContainer.className = "latest-capture";
  latestCaptureContainer.innerHTML = `
    <div>
      <img src="${capture.imageUrl}" alt="Latest whiteboard capture" />
      <p class="muted">Uploaded: ${formatDate(capture.timestamp)}</p>
    </div>
  `;
}

function renderCaptureHistory(captures) {
  if (!captures.length) {
    captureHistory.innerHTML = `<p class="muted">Captured images will appear here.</p>`;
    return;
  }

  captureHistory.innerHTML = captures
    .map(
      (capture, index) => `
        <article class="capture-item">
          <img src="${capture.imageUrl}" alt="Capture ${index + 1}" />
          <div class="capture-meta">
            <h4>${capture.lectureTitle}</h4>
            <p><strong>Professor:</strong> ${capture.professorName}</p>
            <p><strong>Uploaded:</strong> ${formatDate(capture.timestamp)}</p>
            <p><strong>Session ID:</strong> ${capture.sessionId}</p>
          </div>
        </article>
      `
    )
    .join("");
}

async function refreshSessionCaptures() {
  const captures = await appFetchCaptures();
  const relevantCaptures = activeSession
    ? captures.filter(c => c.sessionId === activeSession.id)
    : [];

  renderLatestCapture(relevantCaptures[0] || null);
  renderCaptureHistory(relevantCaptures);
}

startSessionBtn.addEventListener("click", () => {
  const lectureTitle = sessionTitleInput.value.trim();
  const professorName = professorNameInput.value.trim();

  if (!lectureTitle || !professorName) {
    alert("Please enter both lecture title and professor name.");
    return;
  }

  activeSession = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    lectureTitle,
    professorName,
    startedAt: new Date().toISOString()
  };

  saveCurrentSession(activeSession);
  renderSessionState();
  refreshSessionCaptures();
});

captureBtn.addEventListener("click", async () => {
  if (!activeSession) return;

  captureBtn.disabled = true;
  sessionStatus.textContent = "Capturing and uploading image...";

  try {
    await appTriggerCapture(activeSession);
    sessionStatus.textContent = `Capture uploaded successfully for ${activeSession.lectureTitle}.`;
    await refreshSessionCaptures();
  } catch (error) {
    console.error(error);
    sessionStatus.textContent = "Capture failed.";
    alert("Failed to capture/upload image.");
  } finally {
    captureBtn.disabled = false;
  }
});

uploadManualBtn.addEventListener("click", async () => {
  if (!activeSession) return;

  const file = manualImageInput.files[0];
  if (!file) {
    alert("Please select an image file first.");
    return;
  }

  uploadManualBtn.disabled = true;
  sessionStatus.textContent = "Uploading selected image...";

  try {
    await appUploadCapture(file, activeSession);
    manualImageInput.value = "";
    sessionStatus.textContent = "Manual image upload successful.";
    await refreshSessionCaptures();
  } catch (error) {
    console.error(error);
    sessionStatus.textContent = "Manual upload failed.";
    alert("Failed to upload selected image.");
  } finally {
    uploadManualBtn.disabled = false;
  }
});

endSessionBtn.addEventListener("click", () => {
  clearCurrentSession();
  activeSession = null;
  renderSessionState();
  renderLatestCapture(null);
  renderCaptureHistory([]);
});

renderSessionState();
refreshSessionCaptures();

document.getElementById("downloadBtn").addEventListener("click", () => {
    if (currentIndex === -1 || images.length === 0) return;
    const link = document.createElement("a");
    link.href = "/download/" + images[currentIndex];
    link.download = images[currentIndex];
    link.click();
});

document.getElementById("downloadAllBtn").addEventListener("click", () => {
    if (images.length === 0) return;
    images.forEach((filename, i) => {
        setTimeout(() => {
            const link = document.createElement("a");
            link.href = "/download/" + filename;
            link.download = filename;
            link.click();
        }, i * 500);
    });
});