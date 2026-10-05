import { announce, speak, feedback } from "/static/js/a11y.js";
import { runWithNfcGuidance } from "/static/js/nfc-guidance.js";

const button = document.getElementById("create");
const result = document.getElementById("result");

function report(text, kind) {
  announce(text);
  speak(text);
  feedback(kind);
}

const post = (path, body) =>
  fetch(`/security-key/register/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body && JSON.stringify(body),
  });

function showFallback() {
  result.hidden = false;
  document.getElementById("continue").focus();
}

async function register() {
  button.disabled = true;
  try {
    const optionsResponse = await post("options");
    const optionsJSON = await optionsResponse.json().catch(() => null);
    if (!optionsResponse.ok || !optionsJSON) {
      report(optionsJSON?.reason ?? (optionsResponse.status === 401 ? "Your sign-in has expired. Please sign in again." : "Could not start security-key setup. Please try again."), "failure");
      return;
    }

    report("Your security key will now ask you to continue.", "success");
    const credential = await runWithNfcGuidance(() =>
      navigator.credentials.create({
        publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(optionsJSON),
      }),
    );
    if (!credential) throw new Error("No credential returned");

    const verified = await post("verify", credential.toJSON());
    const body = await verified.json().catch(() => ({}));
    if (verified.ok && body.ok) {
      report("Security key registered. Returning to second-factor sign-in.", "success");
      window.location.assign(body.redirect);
      return;
    }
    report(body.reason ?? "The security key could not be saved. Please try again.", "failure");
  } catch (e) {
    const reasons = {
      NotAllowedError: "Security-key registration was not completed. Please try again.",
      InvalidStateError: "This security key is already registered to this account.",
      NotSupportedError: "This browser cannot register this security key.",
    };
    report(reasons[e?.name] ?? "Security-key setup could not finish. Please try again.", "failure");
  } finally {
    button.disabled = false;
  }
}

if (window.PublicKeyCredential && PublicKeyCredential.parseCreationOptionsFromJSON) {
  button.disabled = false;
  button.addEventListener("click", register);
} else {
  report("This browser does not support security keys. Go back and choose another method.", "failure");
  showFallback();
}
