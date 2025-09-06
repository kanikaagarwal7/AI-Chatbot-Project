const BASE_URL = "http://127.0.0.1:5000";
let currentSessionId = null;

// -- Utility helpers ----------------------------------------------------
function escapeHtml(str = "") {
  return str.replace(/[&<>"'`=\/]/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;', '/':'&#x2F;','`':'&#x60;','=':'&#x3D;'
  })[s]);
}

function showAlert(msg) {
  // simple alert; replace with fancier toast in future
  alert(msg);
  console.error(msg);
}

// Add message bubble
function addMessage(role, text) {
  const chatWindow = document.getElementById("chatWindow");
  if (!chatWindow) return;
  const div = document.createElement("div");
  div.className = `message ${role}`;
  // preserve newlines
  div.innerText = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Typing indicator
let typingEl = null;
function showTyping() {
  if (typingEl) return;
  typingEl = document.createElement("div");
  typingEl.className = "message bot typing";
  typingEl.innerText = "• • •";
  document.getElementById("chatWindow").appendChild(typingEl);
  typingEl.scrollIntoView({ behavior: "smooth" });
}
function hideTyping() {
  if (!typingEl) return;
  typingEl.remove();
  typingEl = null;
}

// -- Sessions & UI state ------------------------------------------------
async function createSession() {
  // ask user for a description
  const desc = prompt("Enter session description (optional):", "New session");
  if (desc === null) return; // user cancelled
  try {
    const res = await fetch(`${BASE_URL}/session/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: desc || "New session" })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Create session failed: ${res.status} ${t}`);
    }
    const data = await res.json();
    currentSessionId = data.session_id;
    await listSessions();        // refresh list
    await loadChatHistory();     // load (empty) history
  } catch (err) {
    showAlert(err.message || "Failed to create session");
  }
}

async function listSessions() {
  try {
    const res = await fetch(`${BASE_URL}/session/list`);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`List sessions failed: ${res.status} ${t}`);
    }
    const data = await res.json();
    renderSessionList(data);
  } catch (err) {
    showAlert(err.message || "Failed to list sessions");
  }
}

function renderSessionList(sessions) {
  const list = document.getElementById("sessionList");
  list.innerHTML = "";
  sessions.forEach(s => {
    const li = document.createElement("li");
    li.className = "session-item";
    li.dataset.id = s._id;

    // Description and mode badge
    const desc = document.createElement("span");
    desc.className = "session-desc";
    desc.innerHTML = escapeHtml(s.description || "(no description)");

    const modeBadge = document.createElement("span");
    modeBadge.className = "session-mode-badge";
    modeBadge.innerText = s.current_mode ? s.current_mode.toUpperCase() : "LOCAL";

    li.appendChild(desc);
    li.appendChild(modeBadge);

    li.onclick = () => {
      setActiveSession(s._id, s.current_mode || "local");
      loadChatHistory();
    };

    // highlight active session
    if (s._id === currentSessionId) {
      li.classList.add("active");
    }

    list.appendChild(li);
  });
}

function setActiveSession(sessionId, mode = "local") {
  currentSessionId = sessionId;
  // update UI highlight
  document.querySelectorAll("#sessionList .session-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === sessionId);
  });
  // set mode dropdown if exists
  const modeSelect = document.getElementById("modeSelect");
  if (modeSelect) modeSelect.value = mode;
}

// -- Chat history / ask -------------------------------------------------
async function loadChatHistory() {
  if (!currentSessionId) return showAlert("Select a session first");
  try {
    const res = await fetch(`${BASE_URL}/chat/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: currentSessionId })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Load history failed: ${res.status} ${t}`);
    }
    const data = await res.json();
    const chatWindow = document.getElementById("chatWindow");
    chatWindow.innerHTML = "";
    if (!data.chat_history || data.chat_history.length === 0) {
      addMessage("bot", "(No chat history)");
      return;
    }
    data.chat_history.forEach(c => {
      addMessage("user", c.question);
      addMessage("bot", c.answer);
    });
  } catch (err) {
    showAlert(err.message || "Failed to load chat history");
  }
}

async function askQuestion() {
  if (!currentSessionId) return showAlert("Select a session first");
  const questionEl = document.getElementById("questionInput");
  const question = (questionEl.value || "").trim();
  if (!question) return;

  // show user message and clear input
  addMessage("user", question);
  questionEl.value = "";

  try {
    showTyping();
    const res = await fetch(`${BASE_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: currentSessionId, question })
    });
    hideTyping();

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Ask failed: ${res.status} ${t}`);
    }
    const data = await res.json();
    // backend returns { answer: ... } normally
    const answer = data.answer || data;
    addMessage("bot", String(answer));
    // update session list (maybe current_mode changed)
    await listSessions();
  } catch (err) {
    hideTyping();
    addMessage("bot", `⚠️ Error: ${err.message || "Failed to get answer"}`);
  }
}

// -- Upload file --------------------------------------------------------
async function uploadDocument() {
  if (!currentSessionId) return showAlert("Select a session first");
  const file = document.getElementById("uploadFile").files[0];
  if (!file) return showAlert("Choose a file to upload");

  try {
    let formData = new FormData();
    formData.append("session_id", currentSessionId);
    formData.append("file", file);

    const res = await fetch(`${BASE_URL}/document/upload`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Upload failed: ${res.status} ${t}`);
    }
    const data = await res.json();
    showAlert(data.message || "Upload successful");
    // Optionally reload sessions or history
    await listSessions();
  } catch (err) {
    showAlert(err.message || "Failed to upload document");
  }
}

// -- Switch Mode (UI) ---------------------------------------------------
async function switchModeFromUI() {
  if (!currentSessionId) return showAlert("Select a session first");
  const mode = document.getElementById("modeSelect").value;
  try {
    const res = await fetch(`${BASE_URL}/chat/switch_mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: currentSessionId, mode })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Switch mode failed: ${res.status} ${t}`);
    }
    const data = await res.json();
    showAlert(data.message || `Mode changed to ${mode}`);
    await listSessions();
  } catch (err) {
    showAlert(err.message || "Failed to switch mode");
  }
}

// -- Search docs / chat -------------------------------------------------
async function searchDocuments() {
  if (!currentSessionId) return showAlert("Select a session first");
  const query = (document.getElementById("docQuery").value || "").trim();
  if (!query) return showAlert("Enter a keyword to search in documents");
  try {
    const res = await fetch(`${BASE_URL}/search/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: currentSessionId, q: query })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Doc search failed: ${res.status} ${t}`);
    }
    const data = await res.json();
    const matches = data.matches || [];
    if (matches.length === 0) addMessage("bot", "No document matches found.");
    else addMessage("bot", `Document matches:\n${matches.join("\n\n")}`);
  } catch (err) {
    showAlert(err.message || "Failed to search documents");
  }
}

async function searchChat() {
  if (!currentSessionId) return showAlert("Select a session first");
  const query = (document.getElementById("chatQuery").value || "").trim();
  if (!query) return showAlert("Enter a keyword to search in chat");
  try {
    const res = await fetch(`${BASE_URL}/search/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: currentSessionId, q: query })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Chat search failed: ${res.status} ${t}`);
    }
    const data = await res.json();
    const matches = data.matches || [];
    if (matches.length === 0) addMessage("bot", "No chat matches found.");
    else {
      const pretty = matches.map(m => `Q: ${m.question}\nA: ${m.answer}`).join("\n\n");
      addMessage("bot", `Chat search results:\n${pretty}`);
    }
  } catch (err) {
    showAlert(err.message || "Failed to search chat");
  }
}

// -- Init on load -------------------------------------------------------
window.addEventListener("load", () => {
  // Wire modeSelect change to switchMode function (if not wired in HTML)
  const modeSelect = document.getElementById("modeSelect");
  if (modeSelect) modeSelect.addEventListener("change", switchModeFromUI);

  listSessions().catch(e => console.warn("Initial listSessions error:", e));
});
