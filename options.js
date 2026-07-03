// Quarterly — options page. Stores the user's Gemini API key in
// chrome.storage.local. See the API KEY NOTE in popup.js: this user-supplied
// key setup is a v0 choice; public distribution needs a backend proxy.

const input = document.getElementById("api-key");
const saveBtn = document.getElementById("save-btn");
const status = document.getElementById("status");

// Show the saved key (masked by the password input) so the user can tell one is set.
chrome.storage.local.get("geminiApiKey", ({ geminiApiKey }) => {
  if (geminiApiKey) {
    input.value = geminiApiKey;
    setStatus("A key is currently saved.", "ok");
  }
});

saveBtn.addEventListener("click", () => {
  const key = input.value.trim();

  if (!key) {
    chrome.storage.local.remove("geminiApiKey", () => {
      setStatus("Key removed.", "ok");
    });
    return;
  }

  if (!key.startsWith("AIza")) {
    setStatus('That doesn\'t look like a Gemini API key (expected it to start with "AIza").', "err");
    return;
  }

  chrome.storage.local.set({ geminiApiKey: key }, () => {
    setStatus("Saved ✓ — you can close this tab and open the popup.", "ok");
  });
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveBtn.click();
});

function setStatus(message, kind) {
  status.textContent = message;
  status.className = kind;
}
