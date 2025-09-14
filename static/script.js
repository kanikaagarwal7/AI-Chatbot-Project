const BASE_URL = "http://127.0.0.1:5000";
let currentSessionId = null;

// Utility to add messages
function addMessage(role, text) {
  const chatWindow = document.getElementById("chatWindow");
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.innerText = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 📌 Create Session
async function createSession() {
  const desc = prompt("Enter session description:", "My Chat Session");
  if (!desc) return; // user cancelled

  const res = await fetch(`${BASE_URL}/session/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: desc })
  });

  const data = await res.json();
  currentSessionId = data.session_id;

  // Auto-open session box after creating new session
  document.getElementById("sessionBox").classList.remove("hidden");

  await listSessions();
}

// 📌 Toggle Session List
function toggleSessionList() {
  const box = document.getElementById("sessionBox");
  box.classList.toggle("hidden");
}

// 📌 List Sessions
async function listSessions() {
  const res = await fetch(`${BASE_URL}/session/list`);
  const data = await res.json();
  const list = document.getElementById("sessionList");
  list.innerHTML = "";

  // Header row
  const header = document.createElement("li");
  header.className = "session-header";
  header.innerHTML = `<span>Description</span><span>Mode</span><span>Delete</span>`;
  list.appendChild(header);

  for (const s of data) {
    const li = document.createElement("li");
    li.className = "session-item";
    if (s._id === currentSessionId) li.classList.add("active");

    // Description
    const desc = document.createElement("span");
    desc.innerText = s.description;
    desc.onclick = () => {
      currentSessionId = s._id;
      loadChatHistory();
      listSessions();
    };

    // Mode toggle button
    const modeBtn = document.createElement("button");
    modeBtn.innerText = s.mode || "local";
    modeBtn.className = "mode-btn";
    modeBtn.onclick = () => {
      s.mode = (s.mode === "local") ? "global" : "local";
      modeBtn.innerText = s.mode;
    };

    // Delete session button
    const delBtn = document.createElement("button");
    delBtn.innerText = "🗑";
    delBtn.className = "delete-btn";
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Delete this session?")) return;
      const res = await fetch(`${BASE_URL}/session/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: s._id })
      });
      const result = await res.json();
      alert(result.message);
      if (s._id === currentSessionId) {
        currentSessionId = null;
        document.getElementById("chatWindow").innerHTML = "";
      }
      listSessions();
    };

    li.appendChild(desc);
    li.appendChild(modeBtn);
    li.appendChild(delBtn);

    // 🔹 Documents section under each session
    const docList = document.createElement("ul");
    docList.className = "doc-list";
    li.appendChild(docList);

    // Fetch docs for this session
    try {
      const docsRes = await fetch(`${BASE_URL}/document/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: s._id })
      });
      const docsData = await docsRes.json();

      docsData.documents.forEach(doc => {
        const docItem = document.createElement("li");
        docItem.className = "doc-item";
        docItem.innerText = doc.filename;

        // ✅ Fixed delete button (uses filename instead of file_id)
        const docDelBtn = document.createElement("button");
        docDelBtn.innerText = "❌";
        docDelBtn.onclick = async () => {
          const res = await fetch(`${BASE_URL}/document/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: s._id, filename: doc.filename })
          });
          const result = await res.json();
          alert(result.message);
          listSessions(); // reload after delete
        };

        docItem.appendChild(docDelBtn);
        docList.appendChild(docItem);
      });
    } catch (err) {
      console.error("Error fetching documents:", err);
    }

    list.appendChild(li);
  }
}

// 📌 Upload Document
async function uploadDocument() {
  if (!currentSessionId) return alert("Select a session first");
  const file = document.getElementById("uploadFile").files[0];
  if (!file) return alert("Choose a file");

  let formData = new FormData();
  formData.append("session_id", currentSessionId);
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/document/upload`, { 
    method: "POST", 
    body: formData 
  });
  const data = await res.json();
  alert(data.message);

  // ✅ Auto-refresh session list so the new document appears
  await listSessions();
}

// 📌 Ask Question
async function askQuestion() {
  if (!currentSessionId) return alert("Select a session first");
  const question = document.getElementById("chatInput").value;
  if (!question) return;

  addMessage("user", question);
  document.getElementById("chatInput").value = "";

  // Get the current mode from the session list
  const sessionItem = document.querySelector(`.session-item.active`);
  const mode = sessionItem ? sessionItem.querySelector(".mode-btn").innerText : "local";

  const res = await fetch(`${BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: currentSessionId, question, mode })
  });
  const data = await res.json();
  addMessage("bot", data.answer);
}

// 📌 Load Chat History
async function loadChatHistory() {
  const res = await fetch(`${BASE_URL}/chat/history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: currentSessionId })
  });
  const data = await res.json();
  const chatWindow = document.getElementById("chatWindow");
  chatWindow.innerHTML = "";
  data.chat_history.forEach(c => {
    addMessage("user", c.question);
    addMessage("bot", c.answer);
  });
}

// 📌 Search Documents
async function searchDocuments() {
  if (!currentSessionId) return alert("Select a session first");
  const query = document.getElementById("docQuery").value;
  const res = await fetch(`${BASE_URL}/search/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: currentSessionId, q: query })
  });
  const data = await res.json();
  addMessage("bot", "Doc Search Results:\n" + data.matches.join("\n"));
}

// 📌 Search Chat
async function searchChat() {
  if (!currentSessionId) return alert("Select a session first");
  const query = document.getElementById("chatQuery").value;
  const res = await fetch(`${BASE_URL}/search/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: currentSessionId, q: query })
  });
  const data = await res.json();
  addMessage("bot", "Chat Search Results:\n" + JSON.stringify(data.matches, null, 2));
}

// Load sessions on startup
listSessions();

let recognition;
let isListening = false;

if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    document.getElementById("chatInput").value = transcript;
    askQuestion(); // auto-send when speech captured
  };

  recognition.onerror = function(event) {
    console.error("Speech recognition error:", event.error);
    stopMic();
  };

  recognition.onend = function() {
    stopMic(); // reset button when finished
  };
}

function toggleMic() {
  if (!recognition) {
    alert("Speech recognition not supported in this browser.");
    return;
  }
  if (!isListening) {
    startMic();
  } else {
    stopMic();
  }
}

function startMic() {
  recognition.start();
  isListening = true;
  document.getElementById("micBtn").classList.add("listening");
}

function stopMic() {
  recognition.stop();
  isListening = false;
  document.getElementById("micBtn").classList.remove("listening");
}

// 📌 Send message when pressing Enter
document.getElementById("chatInput").addEventListener("keydown", function(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault(); // prevents newline
    askQuestion();
  }
});

// 📌 Auto-expand textarea
const textarea = document.getElementById("chatInput");

textarea.addEventListener("input", function () {
  this.style.height = "auto"; // reset
  this.style.height = (this.scrollHeight) + "px"; // expand
});

// 📌 Enter key = Send, Shift+Enter = new line
textarea.addEventListener("keydown", function(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    askQuestion();
  }
});
