const statusEl = document.getElementById("status");
const feed = document.getElementById("cameraFeed");
const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const imageCount = document.getElementById("imageCount");

let images = [];
let currentIndex = -1;

function loadImageList() {
    return fetch("/images-list")
        .then(res => res.json())
        .then(data => {
            images = data.files;
        });
}

function showImage(index) {
    if (index < 0 || index >= images.length) return;
    currentIndex = index;
    feed.src = "/images/" + images[currentIndex] + "?t=" + Date.now();
    imageCount.textContent = (currentIndex + 1) + " / " + images.length;
    backBtn.disabled = currentIndex === 0;
    forwardBtn.disabled = currentIndex === images.length - 1;
}

document.getElementById("captureBtn").addEventListener("click", () => {
    statusEl.textContent = "Capturing...";
    statusEl.className = "";

    fetch("/capture", { method: "POST" })
        .then(res => {
            if (!res.ok) {
                statusEl.textContent = "Capture failed.";
                statusEl.className = "error";
                return;
            }
            return res.json();
        })
        .then(data => {
            if (!data) return;
            statusEl.textContent = "Photo taken!";
            statusEl.className = "success";
            loadImageList().then(() => showImage(images.length - 1));
        })
        .catch(err => {
            statusEl.textContent = "Error: " + err.message;
            statusEl.className = "error";
        });
});

backBtn.addEventListener("click", () => showImage(currentIndex - 1));
forwardBtn.addEventListener("click", () => showImage(currentIndex + 1));

loadImageList().then(() => {
    console.log("images after load:", images);
    if (images.length > 0) showImage(images.length - 1);
}).catch(err => console.error("load failed:", err));

document.getElementById("deleteBtn").addEventListener("click", () => {
    if (currentIndex === -1 || images.length === 0) return;

    const filename = images[currentIndex];
    if (!confirm("Delete " + filename + "?")) return;

    fetch("/images/" + filename, { method: "DELETE" })
        .then(res => {
            if (res.ok) {
                images.splice(currentIndex, 1);
                if (images.length === 0) {
                    document.getElementById("cameraFeed").src = "";
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
document.getElementById("downloadBtn").addEventListener("click", () => {
    if (currentIndex === -1 || images.length === 0) return;
    const link = document.createElement("a");
    link.href = "/images/" + images[currentIndex];
    link.download = images[currentIndex];
    link.click();
});

document.getElementById("downloadAllBtn").addEventListener("click", () => {
    if (images.length === 0) return;
    images.forEach((filename, i) => {
        setTimeout(() => {
            const link = document.createElement("a");
            link.href = "/images/" + filename;
            link.download = filename;
            link.click();
        }, i * 500);
    });
});

document.getElementById("uploadBtn").addEventListener("click", () => {
    document.getElementById("uploadInput").click();
});

document.getElementById("uploadInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    statusEl.textContent = "Uploading...";
    statusEl.className = "";

    fetch("/upload", {
        method: "POST",
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        statusEl.textContent = "Uploaded!";
        statusEl.className = "success";
        loadImageList().then(() => showImage(images.length - 1));
    })
    .catch(err => {
        statusEl.textContent = "Upload failed: " + err.message;
        statusEl.className = "error";
    });
});