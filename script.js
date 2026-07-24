// Global conversation history for multi-turn chat
let conversationHistory = [
  { 
    role: "system", 
    content: "You are a helpful local assistant. You have access to a web search tool. If the user asks about real-time facts, news, weather, or current events, call the web_search function." 
  }
];

// Tool declaration passed to LM Studio
const toolsDefinition = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current events, news, weather, or external information.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search keywords"
          }
        },
        required: ["query"]
      }
    }
  }
];

// Key handling
function handleKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendPrompt();
  }
}

// Auto-adjust textarea height
function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

// Quick Suggestion click helper
function useSuggestion(text) {
  document.getElementById("userInput").value = text;
  sendPrompt();
}

// Real keyless search fetcher (using public SearXNG API)
async function executeWebSearch(query) {
  try {
    const searchUrl = `https://searx.be/search?q=${encodeURIComponent(query)}&format=json`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error("Search network failure");
    
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      return "No web results found for this query.";
    }

    // Extract top 3 results
    return data.results.slice(0, 3).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.content || r.snippet
    }));
  } catch (err) {
    console.error("Search Tool Error:", err);
    return "Failed to execute web search.";
  }
}

async function sendPrompt() {
  const inputEl = document.getElementById("userInput");
  const prompt = inputEl.value.trim();
  if (!prompt) return;

  const welcomeHeader = document.getElementById("welcome-header");
  const messagesContainer = document.getElementById("messages");

  welcomeHeader.classList.add("hidden");
  messagesContainer.classList.remove("hidden");

  // Display User Message
  appendMessage("user", prompt);
  conversationHistory.push({ role: "user", content: prompt });

  inputEl.value = "";
  inputEl.style.height = "auto";

  // Initial Thinking State
  const assistantMsgId = appendMessage("assistant", "Thinking...");

  try {
    // First Call to LM Studio
    let response = await fetch("http://localhost:1234/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "local-model",
        messages: conversationHistory,
        tools: toolsDefinition,
        tool_choice: "auto",
        temperature: 0.3
      })
    });

    if (!response.ok) throw new Error("Could not connect to LM Studio");

    let data = await response.json();
    let choice = data.choices[0].message;

    // CHECK IF MODEL DECIDED TO CALL SEARCH TOOL
    if (choice.tool_calls && choice.tool_calls.length > 0) {
      const toolCall = choice.tool_calls[0];
      const searchArgs = JSON.parse(toolCall.function.arguments);

      updateMessage(assistantMsgId, `🔍 Searching the web for: "${searchArgs.query}"...`);

      // 1. Run actual search
      const searchResults = await executeWebSearch(searchArgs.query);

      // 2. Append Tool interactions to history
      conversationHistory.push(choice); // Push assistant's tool execution request
      conversationHistory.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(searchResults)
      });

      // 3. Re-call LM Studio with the search results
      response = await fetch("http://localhost:1234/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "local-model",
          messages: conversationHistory,
          temperature: 0.3
        })
      });

      data = await response.json();
      choice = data.choices[0].message;
    }

    // Save final response and update UI
    conversationHistory.push({ role: "assistant", content: choice.content });
    updateMessage(assistantMsgId, choice.content);

  } catch (error) {
    console.error(error);
    updateMessage(
      assistantMsgId, 
      "Error: Unable to complete request.\n\nVerify:\n1. LM Studio Server is running at http://localhost:1234\n2. CORS is enabled under LM Studio Server Settings", 
      true
    );
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
