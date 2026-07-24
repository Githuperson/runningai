async function sendPrompt() {
  const promptInput = document.getElementById("userInput");
  const outputDiv = document.getElementById("output");
  const prompt = promptInput.value.trim();

  if (!prompt) return;

  // Show loading state
  outputDiv.classList.remove("text-red-400");
  outputDiv.classList.add("text-slate-400");
  outputDiv.innerText = "Thinking...";

  try {
    const response = await fetch("http://localhost:1234/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "local-model",
        messages: [
          { role: "system", content: "You are a helpful local AI assistant." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

    const data = await response.json();
    outputDiv.classList.remove("text-slate-400");
    outputDiv.classList.add("text-slate-200");
    outputDiv.innerText = data.choices[0].message.content;

  } catch (error) {
    console.error(error);
    outputDiv.classList.remove("text-slate-400");
    outputDiv.classList.add("text-red-400");
    outputDiv.innerText = "Error: Could not connect to LM Studio.\n\nMake sure:\n1. LM Studio local server is turned ON (port 1234).\n2. CORS is enabled in LM Studio server settings.";
  }
}
