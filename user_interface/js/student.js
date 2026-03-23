const feed = document.getElementById("cameraFeed");
const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const imageCount = document.getElementById("imageCount");

let images = [];
let currentIndex = -1;
let isManuallyBrowsing = false;
let knownLastUpdate = null;

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

backBtn.addEventListener("click", () => {
    isManuallyBrowsing = true;
    showImage(currentIndex - 1);
});

forwardBtn.addEventListener("click", () => {
    showImage(currentIndex + 1);
    if (currentIndex === images.length - 1) isManuallyBrowsing = false;
});

// Poll for changes every 2 seconds
setInterval(() => {
    fetch("/last-update")
        .then(res => res.json())
        .then(data => {
            if (knownLastUpdate === null) {
                knownLastUpdate = data.lastUpdate;
                return;
            }
            if (data.lastUpdate !== knownLastUpdate) {
                knownLastUpdate = data.lastUpdate;
                loadImageList().then(() => {
                    if (!isManuallyBrowsing) {
                        showImage(images.length - 1);
                    } else {
                        // Update count and button states without jumping
                        imageCount.textContent = (currentIndex + 1) + " / " + images.length;
                        forwardBtn.disabled = currentIndex === images.length - 1;
                        backBtn.disabled = currentIndex === 0;
                    }
                });
            }
        });
}, 2000);

// Load on startup
loadImageList().then(() => {
    if (images.length > 0) {
        knownLastUpdate = Date.now();
        showImage(images.length - 1);
    }
});