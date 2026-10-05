import { announce, speak, feedback } from "/static/js/a11y.js";

const TIMEOUT_MS = 60_000;
const FALLBACK_TEXT = "Go back and choose another method";

function report(text, kind) {
  announce(text);
  speak(text);
  feedback(kind);
}

function showFallback() {
  const result = document.getElementById("result");
  const link = document.getElementById("continue");
  if (link) {
    link.href = "/second-factor";
    link.textContent = FALLBACK_TEXT;
  }
  if (result) result.hidden = false;
}

function markReported(error) {
  try {
    Object.defineProperty(error, "nfcGuidanceReported", { value: true });
  } catch {
    // Some browser errors cannot be extended; the original error is still rethrown.
  }
  return error;
}

/** Announces accessible NFC guidance while the supplied WebAuthn ceremony runs. */
export async function runWithNfcGuidance(action) {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    const error = new Error("Security key NFC is unavailable in this environment.");
    error.name = "NotSupportedError";
    report("Security key NFC is unavailable in this environment. Go back and choose another method.", "failure");
    showFallback();
    throw markReported(error);
  }

  report("Please tap your security key near the NFC area", "success");
  let timeout;
  try {
    const actionPromise = Promise.resolve().then(action);
    const timeoutPromise = new Promise((_, reject) => {
      timeout = window.setTimeout(() => {
        const error = new Error("Security key interaction timed out. Please try again.");
        error.name = "TimeoutError";
        reject(error);
      }, TIMEOUT_MS);
    });
    const credential = await Promise.race([actionPromise, timeoutPromise]);
    report("Security key interaction completed.", "success");
    return credential;
  } catch (error) {
    const cancelled = error?.name === "NotAllowedError" || error?.name === "AbortError";
    const message = cancelled
      ? "Security key authentication was cancelled. Go back and choose another method."
      : error?.name === "TimeoutError"
        ? "Security key interaction timed out. Please try again or choose another method."
        : "Security key interaction failed. Please try again or choose another method.";
    report(message, "failure");
    showFallback();
    throw markReported(error);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}
