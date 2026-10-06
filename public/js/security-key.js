import { announce, speak, feedback } from "/static/js/a11y.js";
import { runWithNfcGuidance } from "/static/js/nfc-guidance.js";

const createButton = document.getElementById("create");
const signInButton = document.getElementById("signin");
const result = document.getElementById("result");

function report(text, kind) {
  announce(text);
  speak(text);
  feedback(kind);
}

const post = (ceremony, path, body) =>
  fetch(`/security-key/${ceremony}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body && JSON.stringify(body),
  });

function showFallback() {
  const link = document.getElementById("continue");
  if (link) {
    link.href = "/second-factor";
    link.textContent = "Go back and choose another method";
  }
  if (result) result.hidden = false;
  link?.focus();
}

async function register() {
  createButton.disabled = true;
  try {
    const optionsResponse = await post("register", "options");
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

    const verified = await post("register", "verify", credential.toJSON());
    const body = await verified.json().catch(() => ({}));
    if (verified.ok && body.ok) {
      report("Security key registered. Returning to second-factor sign-in.", "success");
      window.location.assign(body.redirect);
      return;
    }
    report(body.reason ?? "The security key could not be saved. Please try again.", "failure");
  } catch (e) {
    if (!e?.nfcGuidanceReported) {
      const reasons = {
        NotAllowedError: "Security-key registration was not completed. Please try again.",
        InvalidStateError: "This security key is already registered to this account.",
        NotSupportedError: "This browser cannot register this security key.",
      };
      report(reasons[e?.name] ?? "Security-key setup could not finish. Please try again.", "failure");
    }
  } finally {
    createButton.disabled = false;
  }
}

async function signIn() {
  signInButton.disabled = true;
  try {
    const optionsResponse = await post("login", "options");
    const optionsJSON = await optionsResponse.json().catch(() => null);
    if (!optionsResponse.ok || !optionsJSON || typeof optionsJSON.challenge !== "string") {
      report(optionsJSON?.reason ?? (optionsResponse.status === 401 ? "Your sign-in has expired. Please sign in again." : "Could not start security-key sign-in. Please try again."), "failure");
      return;
    }

    const credential = await runWithNfcGuidance(() =>
      navigator.credentials.get({
        publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(optionsJSON),
      }),
    );
    if (!credential) throw new Error("No credential returned");

    const verified = await post("login", "verify", credential.toJSON());
    const body = await verified.json().catch(() => ({}));
    if (verified.ok && body.ok && typeof body.redirect === "string") {
      report("Security-key sign-in succeeded. Returning to your account.", "success");
      window.location.assign(body.redirect);
      return;
    }
    report(body.reason ?? "Security-key sign-in failed. Please try again.", "failure");
  } catch (e) {
    if (!e?.nfcGuidanceReported) {
      const reasons = {
        NotAllowedError: "Security-key sign-in was not completed. Please try again.",
        NotSupportedError: "This browser cannot sign in with this security key.",
      };
      report(reasons[e?.name] ?? "Security-key sign-in could not finish. Please try again.", "failure");
    }
  } finally {
    signInButton.disabled = false;
  }
}

if (createButton) {
  if (window.PublicKeyCredential && PublicKeyCredential.parseCreationOptionsFromJSON) {
    createButton.disabled = false;
    createButton.addEventListener("click", register);
  } else {
    report("This browser does not support security keys. Go back and choose another method.", "failure");
    showFallback();
  }
}

if (signInButton) {
  if (window.PublicKeyCredential && PublicKeyCredential.parseRequestOptionsFromJSON) {
    signInButton.disabled = false;
    signInButton.addEventListener("click", signIn);
  } else {
    report("This browser does not support security keys. Go back and choose another method.", "failure");
    showFallback();
  }
}
