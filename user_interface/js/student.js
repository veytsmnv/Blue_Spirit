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

backBtn.addEventListener("click", () => showImage(currentIndex - 1));
forwardBtn.addEventListener("click", () => showImage(currentIndex + 1));

// Load images on startup
loadImageList().then(() => {
    if (images.length > 0) showImage(images.length - 1);
});