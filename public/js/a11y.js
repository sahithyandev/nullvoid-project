// Stub by Day 0, owned by M4. Other modules import only these three functions:
//   import { announce, speak, feedback } from "/static/js/a11y.js";

/** Writes to the aria-live status region, so screen readers say it. */
export function announce(text) {
  const el = document.getElementById("status");
  if (el) el.textContent = text;
}

/** Text-to-speech. Off unless the user turned it on. */
export function speak(text) {
  if (!("speechSynthesis" in window) || localStorage.getItem("tts") !== "on") return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

/** Audio cue for the outcome: 'success' or 'failure'. */
export function feedback(kind) {
  // M4: play a tone with the Web Audio API.
}
