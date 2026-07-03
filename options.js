// Quarterly — options page. Stores the user's Anthropic API key in
// chrome.storage.local. See the API KEY NOTE in popup.js: this user-supplied
// key setup is a v0 choice; public distribution needs a backend proxy.

const input = document.getElementById("api-key");
const saveBtn = document.getElementById("save-btn");
const status = document.getElementById("status");

// Show the saved key (masked by the password input) so the user can tell one is set.
chrome.storage.local.get("anthropicApiKey", ({ anthropicApiKey }) => {
  if (anthropicApiKey) {
    input.value = anthropicApiKey;
    setStatus("A key is currently saved.", "ok");
  }
});

saveBtn.addEventListener("click", () => {
  const key = input.value.trim();

  if (!key) {
    chrome.storage.local.remove("anthropicApiKey", () => {
      setStatus("Key removed.", "ok");
    });
    return;
  }

  if (!key.startsWith("sk-ant-")) {
    setStatus('That doesn\'t look like an Anthropic API key (expected it to start with "sk-ant-").', "err");
    return;
  }

  chrome.storage.local.set({ anthropicApiKey: key }, () => {
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
