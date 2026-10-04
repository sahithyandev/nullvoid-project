import { announce, speak, feedback } from "/static/js/a11y.js";

const button = document.getElementById("signin");
const result = document.getElementById("result");

/** Every outcome is shown, spoken and given an audio cue. */
function report(text, kind) {
  announce(text);
  speak(text);
  feedback(kind);
}

const post = (path, body) =>
  fetch(`/passkey/login/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body && JSON.stringify(body),
  });

function showContinue(href) {
  const link = document.getElementById("continue");
  link.href = href;
  result.hidden = false;
  link.focus();
}

async function signIn() {
  button.disabled = true;
  try {
    const res = await post("options");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      report(res.status === 401 ? "Your sign-in has expired. Please sign in again." : body.reason ?? "Could not start passkey sign-in. Please try again.", "failure");
      return;
    }
    report("Your device will now ask you to confirm it is you.", "success");
    const credential = await navigator.credentials.get({
      publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(await res.json()),
    });
    const verified = await post("verify", credential.toJSON());
    const body = await verified.json().catch(() => ({}));
    if (verified.ok && body.ok) {
      report("Signed in. Continue to your account.", "success");
      showContinue(body.redirect);
      return;
    }
    report(body.reason ?? "Sign-in failed. Please try again.", "failure");
  } catch (e) {
    const reasons = {
      NotAllowedError: "Passkey sign-in was cancelled or timed out. Press the button to try again.",
      NotSupportedError: "This device cannot sign in with a passkey that confirms it is you.",
    };
    report(reasons[e?.name] ?? "Something went wrong while signing in. Please try again.", "failure");
  }
  button.disabled = false;
}

if (window.PublicKeyCredential && PublicKeyCredential.parseRequestOptionsFromJSON) {
  button.disabled = false;
  button.addEventListener("click", signIn);
} else {
  report("This browser does not support passkeys. Go back and choose another method.", "failure");
  result.hidden = false;
  const link = document.getElementById("continue");
  link.href = "/second-factor";
  link.textContent = "Go back and choose another method";
}
