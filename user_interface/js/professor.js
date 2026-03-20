const statusEl = document.getElementById("status");

document.getElementById("captureBtn").addEventListener("click", () => {
    statusEl.textContent = "Capturing...";
    statusEl.className = "";

    fetch("/capture", { method: "POST" })
        .then(res => res.json())
        .then(data => {
            statusEl.textContent = "Photo taken!";
            statusEl.className = "success";
            document.getElementById("cameraFeed").src = "/images/" + data.filename + "?t=" + Date.now();
        })
        .catch(err => {
            statusEl.textContent = "Error: " + err.message;
            statusEl.className = "error";
        });
});