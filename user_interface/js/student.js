function refreshImage() {
    fetch("/latest")
        .then(res => res.json())
        .then(data => {
            if (data.filename) {
                document.getElementById("cameraFeed").src = "/images/" + data.filename + "?t=" + Date.now();
            }
        });
}

setInterval(refreshImage, 5000);
refreshImage();