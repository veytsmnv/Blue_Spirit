document.getElementById("captureBtn").addEventListener("click", () => {
    document.getElementById("status").textContent = "Capturing...";

    fetch("/capture", { method: "POST" })
        .then(res => {
            if (res.ok) {
                document.getElementById("status").textContent = "Photo taken!";
                document.getElementById("cameraFeed").src = "/images/latest.jpg?t=" + Date.now();
            } else {
                document.getElementById("status").textContent = "Capture failed.";
            }
        })
        .catch(err => {
            document.getElementById("status").textContent = "Error: " + err.message;
        });
});