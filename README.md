# Quarterly

A Chrome extension for financial advisors that drafts personalized client review /
market-update summaries in seconds. Fill in a short form, hit **Generate Draft**, and
get a clean 3–4 paragraph letter you can copy into an email or client letter.

Powered by the Google Gemini API (`gemini-2.5-flash`), called directly from the popup
with your own API key — the free tier is enough for personal use.

## Install (load unpacked)

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select this repository's folder (the one containing
   `manifest.json`).
5. The **Quarterly** extension appears in your toolbar (pin it via the puzzle-piece
   icon if you like).

## Set your API key

1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) —
   sign in with a Google account and click **Create API key**. No billing setup is
   required for the free tier.
2. Right-click the Quarterly icon → **Options** (or click "Open settings" in the popup).
3. Paste the key (`AIza...`) and click **Save**.

The key is stored in `chrome.storage.local` on your machine and is only ever sent to
`generativelanguage.googleapis.com`.

## Use it

1. Click the Quarterly icon.
2. Fill in:
   - **Client first name** — e.g. `Margaret`
   - **Portfolio / account type** — e.g. `moderate-risk retirement portfolio`
   - **Notable holdings or context** (optional) — e.g. `heavy in dividend stocks`
   - **This quarter's market notes** — paste your bullet points about what happened
     in the markets
   - **Tone** — Formal, or Warm but professional
3. Click **Generate Draft**. The letter streams in live.
4. **Copy to clipboard**, or tweak the form and **Regenerate**.

The prompt is built to be compliance-aware: no return predictions, no guarantees, no
buy/sell recommendations, no invented market facts — and it never mentions AI or uses
placeholders. Always review the draft before sending; you're the advisor of record.

## Notes / limitations (v0)

- **API key handling:** the user-supplied-key approach is fine for personal use. For
  any public distribution this needs a backend proxy that holds the key server-side —
  that's deliberately out of scope for v0.
- No data is stored except your API key. Form inputs and drafts live only in the popup
  and are gone when it closes.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 config, host permission for `generativelanguage.googleapis.com` |
| `popup.html` / `popup.css` / `popup.js` | The form, streaming generation, copy/regenerate |
| `options.html` / `options.js` | API key settings page |
