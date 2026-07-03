// Quarterly — popup logic.
//
// API KEY NOTE: For this v0 the Gemini API key is user-supplied and stored in
// chrome.storage.local (set via the options page). For public distribution this
// must be replaced with a backend proxy that holds the key server-side — a
// browser extension cannot keep a bundled key secret. That's a later step;
// don't build it now.

const MODEL = "gemini-2.5-flash";
// alt=sse makes the endpoint stream Server-Sent Events instead of a JSON array.
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;

const SYSTEM_PROMPT = `You are ghostwriting a quarterly client letter on behalf of a financial advisor. You write AS the advisor, in the first person, addressing their client directly.

Hard rules:
- Never mention AI, assistants, drafts, or that this was generated. The letter must read as if the advisor wrote it personally.
- Never use placeholders like [Client Name], [Advisor], or [Firm]. Fill in everything from the details provided. Sign off generically (e.g. "Warm regards," on its own line with no name after it) so the advisor can add their own signature.
- Compliance: no specific return predictions or price targets, no guarantees of any outcome, no recommendations to buy or sell any specific security, no promises that losses will be recovered. Frame the future in terms of plan, process, and long-term perspective only.
- Be factual about what happened in the markets — use only the market notes provided; do not invent events, numbers, or statistics.

Structure (3-4 short paragraphs, no subject line, no headers):
1. A brief personal greeting to the client by first name.
2. A plain-English recap of this quarter's markets, connected to what it means for their specific portfolio and holdings.
3. A reassuring, forward-looking note grounded in their long-term plan — calm and confident, never salesy.
4. A short sign-off inviting them to reach out with questions.

Match the requested tone exactly. Output only the letter body — no preamble, no commentary, no markdown formatting.`;

// ---------- Elements ----------
const form = document.getElementById("draft-form");
const generateBtn = document.getElementById("generate-btn");
const noKeyNotice = document.getElementById("no-key-notice");
const openOptionsBtn = document.getElementById("open-options");
const errorBox = document.getElementById("error-box");
const outputSection = document.getElementById("output-section");
const outputEl = document.getElementById("output");
const copyBtn = document.getElementById("copy-btn");
const regenerateBtn = document.getElementById("regenerate-btn");

let apiKey = null;
let lastFormData = null;

// ---------- Init ----------
chrome.storage.local.get("geminiApiKey", ({ geminiApiKey }) => {
  if (geminiApiKey) {
    apiKey = geminiApiKey;
  } else {
    noKeyNotice.classList.remove("hidden");
    generateBtn.disabled = true;
  }
});

openOptionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());

// ---------- Prompt building ----------
function buildUserPrompt({ clientName, portfolio, holdings, marketNotes, tone }) {
  const toneLine =
    tone === "warm"
      ? "Warm but professional — friendly and personal while staying credible."
      : "Formal — polished, respectful, traditional business correspondence.";

  let prompt = `Write this quarter's client letter using these details:

Client first name: ${clientName}
Portfolio / account type: ${portfolio}`;

  if (holdings.trim()) {
    prompt += `\nNotable holdings or context: ${holdings}`;
  }

  prompt += `

What happened in the markets this quarter (advisor's notes):
${marketNotes}

Tone: ${toneLine}`;

  return prompt;
}

// ---------- Generation ----------
function readFormData() {
  return {
    clientName: document.getElementById("client-name").value.trim(),
    portfolio: document.getElementById("portfolio").value.trim(),
    holdings: document.getElementById("holdings").value,
    marketNotes: document.getElementById("market-notes").value.trim(),
    tone: form.querySelector('input[name="tone"]:checked').value,
  };
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  lastFormData = readFormData();
  generateDraft(lastFormData);
});

regenerateBtn.addEventListener("click", () => {
  // Regenerate from the current form values so tweaks are picked up.
  lastFormData = readFormData();
  generateDraft(lastFormData);
});

async function generateDraft(formData) {
  setBusy(true);
  errorBox.classList.add("hidden");
  outputSection.classList.remove("hidden");
  outputEl.textContent = "";
  outputEl.classList.add("streaming");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: buildUserPrompt(formData) }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          // Thinking off: the full token budget goes to the letter and the
          // first words appear immediately.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(await formatApiError(response));
    }

    await streamResponse(response);
  } catch (err) {
    showError(err.message || String(err));
    if (!outputEl.textContent) outputSection.classList.add("hidden");
  } finally {
    outputEl.classList.remove("streaming");
    setBusy(false);
  }
}

// Parse the SSE stream and append text chunks to the output as they arrive.
// Each `data:` line is a GenerateContentResponse with the next slice of text at
// candidates[0].content.parts[].text.
async function streamResponse(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep any partial line for the next chunk

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, "");
      if (!line.startsWith("data: ")) continue;
      let chunk;
      try {
        chunk = JSON.parse(line.slice(6));
      } catch {
        continue; // ignore malformed keep-alive fragments
      }

      if (chunk.error) {
        throw new Error(chunk.error.message || "The API returned an error mid-stream.");
      }

      // Prompt blocked by safety filters before any text was generated.
      if (chunk.promptFeedback?.blockReason) {
        throw new Error(
          `The model declined to write this draft (${chunk.promptFeedback.blockReason}). Try rewording your market notes.`
        );
      }

      const candidate = chunk.candidates?.[0];
      if (!candidate) continue;

      for (const part of candidate.content?.parts || []) {
        if (part.text) {
          outputEl.textContent += part.text;
          outputEl.scrollTop = outputEl.scrollHeight;
        }
      }

      if (candidate.finishReason === "MAX_TOKENS") {
        outputEl.textContent +=
          "\n\n[Draft was cut off at the length limit — hit Regenerate for a fresh attempt.]";
      } else if (candidate.finishReason === "SAFETY" || candidate.finishReason === "PROHIBITED_CONTENT") {
        throw new Error("The model declined to write this draft. Try rewording your market notes.");
      }
    }
  }
}

async function formatApiError(response) {
  let detail = "";
  try {
    const body = await response.json();
    detail = body?.error?.message || "";
  } catch {
    /* non-JSON error body */
  }

  // Gemini reports an invalid key as 400 "API key not valid..." (403 for key restrictions).
  if (response.status === 400 && /api key/i.test(detail)) {
    return "Your API key was rejected. Check it in settings.";
  }
  if (response.status === 403) {
    return `Access denied (403)${detail ? `: ${detail}` : ""}. Check your API key in settings.`;
  }
  if (response.status === 429) {
    return "Rate limited (429). Wait a moment and try again — the free tier allows a limited number of requests per minute.";
  }
  return `API error ${response.status}${detail ? `: ${detail}` : ""}`;
}

// ---------- UI helpers ----------
function setBusy(busy) {
  generateBtn.disabled = busy || !apiKey;
  regenerateBtn.disabled = busy;
  copyBtn.disabled = busy;
  generateBtn.textContent = busy ? "Generating…" : "Generate Draft";
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(outputEl.textContent);
    copyBtn.textContent = "Copied ✓";
    setTimeout(() => (copyBtn.textContent = "Copy to clipboard"), 1500);
  } catch {
    showError("Couldn't access the clipboard. Select the text and copy manually.");
  }
});
