import { afterEach, beforeEach, expect, mock, test } from "bun:test";

const calls: Array<[string, string]> = [];
mock.module("/static/js/a11y.js", () => ({
  announce: (text: string) => calls.push(["announce", text]),
  speak: (text: string) => calls.push(["speak", text]),
  feedback: (kind: string) => calls.push(["feedback", kind]),
}));

const moduleUrl = new URL("../public/js/nfc-guidance.js", import.meta.url).href;
const { runWithNfcGuidance } = await import(moduleUrl);

const prompt = "Please tap your security key near the NFC area";
const originalWindow = globalThis.window;
const originalNavigator = globalThis.navigator;
const originalDocument = globalThis.document;

let link: { href: string; textContent: string; focus: () => void };
let result: { hidden: boolean };

function installBrowser({ supported = true } = {}) {
  link = { href: "/account", textContent: "Continue", focus: () => {} };
  result = { hidden: true };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      PublicKeyCredential: supported ? class PublicKeyCredential {} : undefined,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { credentials: supported ? {} : undefined },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      getElementById: (id: string) => (id === "continue" ? link : id === "result" ? result : null),
    },
  });
}

beforeEach(() => {
  calls.length = 0;
  installBrowser();
});

afterEach(() => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator });
  Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
});

function reported(text: string) {
  return calls.filter(([helper]) => helper !== "feedback").map(([, value]) => value).filter((value) => value === text);
}

test("announces the exact NFC prompt and returns a successful WebAuthn action result", async () => {
  const credential = { id: "credential" };
  const action = mock(async () => credential);

  await expect(runWithNfcGuidance(action)).resolves.toBe(credential);
  expect(action).toHaveBeenCalledTimes(1);
  expect(reported(prompt)).toEqual([prompt, prompt]);
  expect(calls).toContainEqual(["announce", "Security key interaction completed."]);
  expect(calls).not.toContainEqual(["announce", "Security key interaction failed. Please try again or choose another method."]);
  expect(calls).toContainEqual(["feedback", "success"]);
});

test("reports cancellation accessibly and does not treat it as successful authentication", async () => {
  const error = Object.assign(new Error("cancelled"), { name: "AbortError" });

  await expect(runWithNfcGuidance(() => Promise.reject(error))).rejects.toBe(error);
  expect(reported("Security key authentication was cancelled. Go back and choose another method.")).toHaveLength(2);
  expect(calls).toContainEqual(["feedback", "failure"]);
  expect(link).toMatchObject({ href: "/second-factor", textContent: "Go back and choose another method" });
  expect(result.hidden).toBe(false);
  expect(calls).not.toContainEqual(["announce", "Security key interaction completed."]);
});

test("reports timeout accessibly and exposes the second-factor fallback", async () => {
  const error = Object.assign(new Error("timed out"), { name: "TimeoutError" });

  await expect(runWithNfcGuidance(() => Promise.reject(error))).rejects.toBe(error);
  expect(reported("Security key interaction timed out. Please try again or choose another method.")).toHaveLength(2);
  expect(calls).toContainEqual(["feedback", "failure"]);
  expect(link.href).toBe("/second-factor");
  expect(result.hidden).toBe(false);
});

test("handles an unsupported browser environment with an accessible fallback", async () => {
  installBrowser({ supported: false });
  const action = mock(() => Promise.resolve("unreachable"));

  await expect(runWithNfcGuidance(action)).rejects.toMatchObject({ name: "NotSupportedError", nfcGuidanceReported: true });
  expect(action).not.toHaveBeenCalled();
  expect(reported("Security key NFC is unavailable in this environment. Go back and choose another method.")).toHaveLength(2);
  expect(calls).toContainEqual(["feedback", "failure"]);
  expect(link.href).toBe("/second-factor");
  expect(result.hidden).toBe(false);
});

test("propagates unexpected action errors after reporting accessible failure guidance", async () => {
  const error = new Error("WebAuthn failed");

  await expect(runWithNfcGuidance(() => Promise.reject(error))).rejects.toBe(error);
  expect(error).toMatchObject({ nfcGuidanceReported: true });
  expect(reported("Security key interaction failed. Please try again or choose another method.")).toHaveLength(2);
  expect(calls).toContainEqual(["feedback", "failure"]);
  expect(link.href).toBe("/second-factor");
});
