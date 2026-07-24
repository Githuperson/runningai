// Function to handle Enter key submit (Shift + Enter for new line)
function handleKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendPrompt();
  }
}

// Auto-expand textarea height as you type
function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

// Handle Quick Suggestion clicks
function useSuggestion(text) {
  document.getElementById("userInput").value = text;
  sendPrompt();
}

async function sendPrompt() {
  const inputEl = document.getElementById("userInput");
  const prompt = inputEl.value.trim();
  if (!prompt) return;

  const welcomeHeader = document.getElementById("welcome-header");
  const messagesContainer = document.getElementById("messages");

  // Hide welcome graphic on first prompt
  welcomeHeader.classList.add("hidden");
  messagesContainer.classList.remove("hidden");

  // Append User Message
  appendMessage("user", prompt);
  
  // Clear input
  inputEl.value = "";
  inputEl.style.height = "auto";

  // Create loading element for assistant
  const loadingId = appendMessage("assistant", "Thinking...");

  try {
    const response = await fetch("http://localhost:1234/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "local-model",
        messages: [
          { role: "system", content: "You are a helpful, clear, and modern AI assistant." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) throw new Error("LM Studio offline");

    const data = await response.json();
    const reply = data.choices[0].message.content;

    // Update thinking bubble with actual response
    updateMessage(loadingId, reply);

  } catch (error) {
    updateMessage(loadingId, "Error: Could not connect to LM Studio. Make sure local server is running on port 1234 with CORS enabled.", true);
  }
}

function appendMessage(role, text) {
  const messagesContainer = document.getElementById("messages");
  const msgId = "msg-" + Date.now();

  const isUser = role === "user";
  const avatarBg = isUser ? "bg-indigo-600" : "bg-gradient-to-r from-blue-400 to-purple-400";
  const label = isUser ? "You" : "Gemini";

  const msgHTML = `
    <div id="${msgId}" class="flex gap-4 items-start text-sm">
      <div class="w-7 h-7 rounded-full ${avatarBg} flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow">
        ${isUser ? "U" : "✨"}
      </div>
      <div class="flex-1 space-y-1">
        <p class="font-medium text-xs text-zinc-400">${label}</p>
        <div class="message-content text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">
          ${text}
        </div>
      </div>
    </div>
  `;

  messagesContainer.insertAdjacentHTML("beforeend", msgHTML);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return msgId;
}

function updateMessage(msgId, text, isError = false) {
  const msgEl = document.getElementById(msgId);
  if (msgEl) {
    const contentDiv = msgEl.querySelector(".message-content");
    contentDiv.innerText = text;
    if (isError) {
      contentDiv.classList.add("text-red-400");
    }
  }
}
