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

const post = (path, body) =>
  fetch(`/security-key/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body && JSON.stringify(body),
  });

function showContinue(href, text) {
  const link = document.getElementById("continue");
  link.href = href;
  link.textContent = text;
  result.hidden = false;
  link.focus();
}

async function register() {
  createButton.disabled = true;

  try {
    const res = await post("register/options");

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));

      report(
        res.status === 401
          ? "Your sign-in has expired. Please sign in again."
          : body.reason ??
              "Could not start security key setup. Please try again.",
        "failure",
      );
      return;
    }

    report(
      "Your security key will now ask you to confirm it is you.",
      "success",
    );

    const options = await res.json();

    const credential = await runWithNfcGuidance(() =>
      navigator.credentials.create({
        publicKey:
          PublicKeyCredential.parseCreationOptionsFromJSON(options),
      }),
    );

    const verified = await post(
      "register/verify",
      credential.toJSON(),
    );

    const body = await verified.json().catch(() => ({}));

    if (verified.ok && body.ok) {
      report(
        "Security key added. Continue to sign in with it.",
        "success",
      );

      showContinue(
        body.redirect,
        "Continue to sign in with your new security key",
      );

      return;
    }

    report(
      body.reason ??
        "The security key could not be saved. Please try again.",
      "failure",
    );
  } catch (e) {
    const reasons = {
      NotAllowedError:
        "Security key setup was cancelled or timed out. Press the button to try again.",

      InvalidStateError:
        "This security key is already registered for this account.",

      NotSupportedError:
        "This device cannot create a security key that confirms it is you.",
    };

    report(
      reasons[e?.name] ??
        "Something went wrong while adding the security key. Please try again.",
      "failure",
    );
  }

  createButton.disabled = false;
}

async function signIn() {
  signInButton.disabled = true;

  try {
    const res = await post("login/options");

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));

      report(
        res.status === 401
          ? "Your sign-in has expired. Please sign in again."
          : body.reason ??
              "Could not start security key sign-in. Please try again.",
        "failure",
      );
      return;
    }

    report(
      "Your security key will now ask you to confirm it is you.",
      "success",
    );

    const options = await res.json();

    const credential = await runWithNfcGuidance(() =>
      navigator.credentials.get({
        publicKey:
          PublicKeyCredential.parseRequestOptionsFromJSON(options),
      }),
    );

    const verified = await post(
      "login/verify",
      credential.toJSON(),
    );

    const body = await verified.json().catch(() => ({}));

    if (verified.ok && body.ok) {
      report(
        "Signed in. Continue to your account.",
        "success",
      );

      showContinue(body.redirect, "Continue to your account");

      return;
    }

    report(
      body.reason ?? "Sign-in failed. Please try again.",
      "failure",
    );
  } catch (e) {
    const reasons = {
      NotAllowedError:
        "Security key sign-in was cancelled or timed out. Press the button to try again.",

      NotSupportedError:
        "This device cannot sign in with a security key that confirms it is you.",
    };

    report(
      reasons[e?.name] ??
        "Something went wrong while signing in. Please try again.",
      "failure",
    );
  }

  signInButton.disabled = false;
}

if (
  window.PublicKeyCredential &&
  PublicKeyCredential.parseCreationOptionsFromJSON &&
  createButton
) {
  createButton.disabled = false;
  createButton.addEventListener("click", register);
}

if (
  window.PublicKeyCredential &&
  PublicKeyCredential.parseRequestOptionsFromJSON &&
  signInButton
) {
  signInButton.disabled = false;
  signInButton.addEventListener("click", signIn);
}

if (
  (!createButton && !signInButton) ||
  !window.PublicKeyCredential
) {
  report(
    "This browser does not support security keys. Go back and choose another method.",
    "failure",
  );

  if (result) {
    result.hidden = false;

    const link = document.getElementById("continue");

    if (link) {
      link.href = "/second-factor";
      link.textContent = "Go back and choose another method";
    }
  }
}