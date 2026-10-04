import { announce, speak, feedback } from "/static/js/a11y.js";

const button = document.getElementById("create");
const result = document.getElementById("result");

/** Every outcome is shown, spoken and given an audio cue. */
function report(text, kind) {
  announce(text);
  speak(text);
  feedback(kind);
}

const post = (path, body) =>
  fetch(`/passkey/register/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body && JSON.stringify(body),
  });

function showContinue() {
  result.hidden = false;
  document.getElementById("continue").focus();
}

async function register() {
  button.disabled = true;
  try {
    const res = await post("options");
    if (!res.ok) {
      report(res.status === 401 ? "Your sign-in has expired. Please sign in again." : "Could not start passkey setup. Please try again.", "failure");
      return;
    }
    report("Your device will now ask you to confirm it is you.", "success");
    const credential = await navigator.credentials.create({
      publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(await res.json()),
    });
    const verified = await post("verify", credential.toJSON());
    const body = await verified.json().catch(() => ({}));
    if (verified.ok && body.ok) {
      report("Passkey created. Continue to sign in with it.", "success");
      showContinue();
      return;
    }
    report(body.reason ?? "The passkey could not be saved. Please try again.", "failure");
  } catch (e) {
    const reasons = {
      NotAllowedError: "Passkey setup was cancelled or timed out. Press the button to try again.",
      InvalidStateError: "This device already has a passkey for this account.",
      NotSupportedError: "This device cannot create a passkey that confirms it is you.",
    };
    report(reasons[e?.name] ?? "Something went wrong while creating the passkey. Please try again.", "failure");
  }
  button.disabled = false;
}

if (window.PublicKeyCredential && PublicKeyCredential.parseCreationOptionsFromJSON) {
  button.disabled = false;
  button.addEventListener("click", register);
} else {
  report("This browser does not support passkeys. Go back and choose another method.", "failure");
  result.hidden = false;
  document.getElementById("continue").textContent = "Go back and choose another method";
}
