const btn = document.getElementById("captureBtn");
const status = document.getElementById("status");
const img = document.getElementById("cameraFeed");

btn.addEventListener("click", async () => {
    status.textContent = "Capturing...";

    try {
        await fetch("/capture", { method: "POST" });

        // Force reload image (avoid caching)
        img.src = "/images/latest.jpg?t=" + new Date().getTime();

        status.textContent = "Photo updated!";
    } catch (err) {
        status.textContent = "Error capturing photo";
        console.error(err);
    }
});