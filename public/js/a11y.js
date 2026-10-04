// Accessibility utilities for NullVoid.
//
// Other modules should import only these three functions:
//   import { announce, speak, feedback } from "/static/js/a11y.js";

/**
 * Announce a message through the screen reader.
 *
 * The #status element is provided by the shared Layout.
 */
export function announce(text) {
  const el = document.getElementById("status");

  if (!el) return;

  // Clear first so the same message can be announced twice.
  el.textContent = "";
  el.textContent = text;
}

/**
 * Optional text-to-speech.
 *
 * TTS is OFF by default.
 * The user can enable it by setting the "tts" preference to "on".
 */
export function speak(text) {
  if (
    !("speechSynthesis" in window) ||
    localStorage.getItem("tts") !== "on"
  ) {
    return;
  }

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(utterance);
}

/**
 * Give the user an audio cue for the result of an action.
 *
 * Uses the Web Audio API, so no audio files are required.
 *
 * @param {"success" | "failure"} kind
 */
export function feedback(kind) {
  if (kind !== "success" && kind !== "failure") {
    return;
  }

  const AudioContext =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    return;
  }

  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.connect(gain);
  gain.connect(context.destination);

  const now = context.currentTime;

  if (kind === "success") {
    // Short rising tone for success.
    oscillator.frequency.setValueAtTime(520, now);
    oscillator.frequency.setValueAtTime(720, now + 0.12);
  } else {
    // Lower falling tone for failure.
    oscillator.frequency.setValueAtTime(320, now);
    oscillator.frequency.setValueAtTime(180, now + 0.15);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

  oscillator.start(now);
  oscillator.stop(now + 0.2);

  oscillator.addEventListener("ended", () => {
    context.close();
  });
}