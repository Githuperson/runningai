async function sendPrompt() {
  const prompt = document.getElementById("userInput").value;
  const outputDiv = document.getElementById("output");

  if (!prompt) return;
  outputDiv.innerText = "Thinking...";

  try {
    const response = await fetch("http://localhost:1234/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "local-model", // LM Studio automatically routes to whichever model is loaded
        messages: [
          { role: "system", content: "You are a helpful local AI assistant." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        stream: false
      })
    });

    const data = await response.json();
    outputDiv.innerText = data.choices[0].message.content;

  } catch (error) {
    console.error(error);
    outputDiv.innerText = "Error connecting to LM Studio. Make sure the local server is running on port 1234 and CORS is enabled!";
  }
}