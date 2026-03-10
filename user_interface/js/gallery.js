const galleryGrid = document.getElementById("galleryGrid");
const refreshGalleryBtn = document.getElementById("refreshGalleryBtn");
const gallerySessionInfo = document.getElementById("gallerySessionInfo");

function formatGalleryDate(dateString) {
  return new Date(dateString).toLocaleString();
}

function renderGallery(captures) {
  const session = getCurrentSession();

  if (session) {
    gallerySessionInfo.textContent = `Current live lecture: ${session.lectureTitle} | ${session.professorName}`;
  } else {
    gallerySessionInfo.textContent = "Waiting for an active lecture session.";
  }

  if (!captures.length) {
    galleryGrid.innerHTML = `<p class="muted">No images available yet.</p>`;
    return;
  }

  galleryGrid.innerHTML = captures
    .map(
      capture => `
        <article class="gallery-card">
          <img src="${capture.imageUrl}" alt="${capture.lectureTitle}" />
          <div class="gallery-card-body">
            <h4>${capture.lectureTitle}</h4>
            <p><strong>Professor:</strong> ${capture.professorName}</p>
            <p><strong>Uploaded:</strong> ${formatGalleryDate(capture.timestamp)}</p>
            <a class="download-link" href="${capture.imageUrl}" download>Download Image</a>
          </div>
        </article>
      `
    )
    .join("");
}

async function loadGallery() {
  try {
    const captures = await appFetchCaptures();
    renderGallery(captures);
  } catch (error) {
    console.error(error);
    galleryGrid.innerHTML = `<p class="muted">Failed to load gallery.</p>`;
  }
}

refreshGalleryBtn.addEventListener("click", loadGallery);

loadGallery();