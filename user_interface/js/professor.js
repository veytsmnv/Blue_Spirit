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