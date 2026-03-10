const API = {
  baseUrl: "http://localhost:3000/api"
};

function getCurrentSession() {
  const session = localStorage.getItem("wbcs_current_session");
  return session ? JSON.parse(session) : null;
}

function saveCurrentSession(session) {
  localStorage.setItem("wbcs_current_session", JSON.stringify(session));
}

function clearCurrentSession() {
  localStorage.removeItem("wbcs_current_session");
}

function getStoredCaptures() {
  const captures = localStorage.getItem("wbcs_captures");
  return captures ? JSON.parse(captures) : [];
}

function saveStoredCaptures(captures) {
  localStorage.setItem("wbcs_captures", JSON.stringify(captures));
}

function createCaptureRecord({ sessionId, lectureTitle, professorName, imageUrl }) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    sessionId,
    lectureTitle,
    professorName,
    imageUrl,
    timestamp: new Date().toISOString()
  };
}

/*
  MOCK FUNCTIONS
  These let you build/test the frontend before your backend exists.
*/

async function mockUploadCapture(file, session) {
  const objectUrl = URL.createObjectURL(file);
  const capture = createCaptureRecord({
    sessionId: session.id,
    lectureTitle: session.lectureTitle,
    professorName: session.professorName,
    imageUrl: objectUrl
  });

  const captures = getStoredCaptures();
  captures.unshift(capture);
  saveStoredCaptures(captures);

  return capture;
}

async function mockCaptureFromDevice(session) {
  const fallbackImages = [
    "assets/placeholder1.jpg",
    "assets/placeholder2.jpg"
  ];

  const chosen = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];

  const capture = createCaptureRecord({
    sessionId: session.id,
    lectureTitle: session.lectureTitle,
    professorName: session.professorName,
    imageUrl: chosen
  });

  const captures = getStoredCaptures();
  captures.unshift(capture);
  saveStoredCaptures(captures);

  return capture;
}

async function mockFetchCaptures() {
  return getStoredCaptures();
}

/*
  REAL BACKEND STUBS
  Replace these later when your Pi/backend API is ready.
*/

async function uploadCaptureToBackend(file, session) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("sessionId", session.id);
  formData.append("lectureTitle", session.lectureTitle);
  formData.append("professorName", session.professorName);

  const response = await fetch(`${API.baseUrl}/uploads`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Failed to upload image.");
  }

  return response.json();
}

async function triggerPiCapture(session) {
  const response = await fetch(`${API.baseUrl}/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sessionId: session.id,
      lectureTitle: session.lectureTitle,
      professorName: session.professorName
    })
  });

  if (!response.ok) {
    throw new Error("Failed to trigger Pi camera capture.");
  }

  return response.json();
}

async function fetchCapturesFromBackend() {
  const response = await fetch(`${API.baseUrl}/captures`);

  if (!response.ok) {
    throw new Error("Failed to fetch captures.");
  }

  return response.json();
}

/*
  CURRENT MODE
  Switch this to false when your backend is ready.
*/
const USE_MOCK_DATA = true;

async function appUploadCapture(file, session) {
  return USE_MOCK_DATA
    ? mockUploadCapture(file, session)
    : uploadCaptureToBackend(file, session);
}

async function appTriggerCapture(session) {
  return USE_MOCK_DATA
    ? mockCaptureFromDevice(session)
    : triggerPiCapture(session);
}

async function appFetchCaptures() {
  return USE_MOCK_DATA
    ? mockFetchCaptures()
    : fetchCapturesFromBackend();
}