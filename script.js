// Global conversation history for multi-turn chat
let conversationHistory = [
  { 
    role: "system", 
    content: "You are a helpful local assistant running via RunningAI. You have access to a web search tool powered by DuckDuckGo. If the user asks about real-time facts, news, weather, or current events, call the web_search function." 
  }
];

// Tool declaration passed to the local model
const toolsDefinition = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search DuckDuckGo for current events, news, weather, or external information.",
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

// Key handling for text input
function handleKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendPrompt();
  }
}

// Auto-adjust textarea height dynamically
function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

// Quick Suggestion card click handler
function useSuggestion(text) {
  document.getElementById("userInput").value = text;
  sendPrompt();
}

// DuckDuckGo Search Execution Function
async function executeWebSearch(query) {
  try {
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error("DuckDuckGo search request failed");
    
    const data = await res.json();
    const results = [];

    // 1. Capture Direct Abstract / Instant Answer
    if (data.AbstractText) {
      results.push({
        title: data.Heading || "Instant Answer",
        url: data.AbstractURL || "https://duckduckgo.com",
        snippet: data.AbstractText
      });
    }

    // 2. Capture Related Topics
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      data.RelatedTopics.slice(0, 3).forEach(topic => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || "Related Result",
            url: topic.FirstURL,
            snippet: topic.Text
          });
        }
      });
    }

    if (results.length === 0) {
      return "No instant results found on DuckDuckGo for this query.";
    }

    return results;
  } catch (err) {
    console.error("DuckDuckGo Search Error:", err);
    return "Failed to execute DuckDuckGo search.";
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

  // Display User Message in UI
  appendMessage("user", prompt);
  conversationHistory.push({ role: "user", content: prompt });

  inputEl.value = "";
  inputEl.style.height = "auto";

  // Initial Thinking Indicator
  const assistantMsgId = appendMessage("assistant", "Thinking...");

  try {
    // SECURE CALL: Fetching through your backend proxy (/api/chat)
    let response = await fetch("/api/chat", {
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

    if (!response.ok) throw new Error("Proxy connection error");

    let data = await response.json();
    let choice = data.choices[0].message;

    // CHECK IF MODEL REQUESTED A DUCKDUCKGO TOOL CALL
    if (choice.tool_calls && choice.tool_calls.length > 0) {
      const toolCall = choice.tool_calls[0];
      const searchArgs = JSON.parse(toolCall.function.arguments);

      updateMessage(assistantMsgId, `🔍 Searching DuckDuckGo for: "${searchArgs.query}"...`);

      // 1. Run DuckDuckGo Search
      const searchResults = await executeWebSearch(searchArgs.query);

      // 2. Append Tool execution results to conversation history
      conversationHistory.push(choice);
      conversationHistory.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(searchResults)
      });

      // 3. Re-send updated history to local model via proxy
      response = await fetch("/api/chat", {
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

    // Save final assistant response and update UI
    conversationHistory.push({ role: "assistant", content: choice.content });
    updateMessage(assistantMsgId, choice.content);

  } catch (error) {
    console.error(error);
    updateMessage(
      assistantMsgId, 
      "Error: Unable to reach the backend proxy or local AI server.\n\nEnsure your proxy is deployed and your Cloudflare tunnel is running locally.", 
      true
    );
  }
}

function appendMessage(role, text) {
  const messagesContainer = document.getElementById("messages");
  const msgId = "msg-" + Date.now();

  const isUser = role === "user";
  const avatarBg = isUser ? "bg-indigo-600" : "bg-gradient-to-r from-blue-400 to-purple-400";
  const label = isUser ? "You" : "RunningAI";

  const msgHTML = `
    <div id="${msgId}" class="flex gap-4 items-start text-sm">
      <div class="w-7 h-7 rounded-full ${avatarBg} flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow">
        ${isUser ? "U" : "⚡"}
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
