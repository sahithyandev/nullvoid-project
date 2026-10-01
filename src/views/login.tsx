// Owner: M1. The password form, and the styling and scripts shared with the register page.
import { Layout } from "./layout";

// Scoped to pages that contain .auth, so it does not touch M4's global stylesheet.
const CSS = `
:root { color-scheme: light dark; --bg:#f1f5f9; --card:#fff; --text:#0f172a; --muted:#475569; --line:#64748b;
  --accent:#1d4ed8; --on-accent:#fff; --accent-hover:#1e40af; --focus:#005fcc;
  --err-bg:#fef2f2; --err-line:#b91c1c; --err-text:#7f1d1d; }
@media (prefers-color-scheme: dark) { :root { --bg:#0b1120; --card:#1e293b; --text:#f1f5f9; --muted:#cbd5e1; --line:#94a3b8;
  --accent:#93c5fd; --on-accent:#0b1120; --accent-hover:#bfdbfe; --focus:#93c5fd;
  --err-bg:#3b1212; --err-line:#f87171; --err-text:#fecaca; } }
body:has(.auth) { background: var(--bg); color: var(--text); max-width: 28rem; padding: 2rem 1rem 3rem; }
body:has(.auth) header { font-weight: 700; letter-spacing: .02em; color: var(--muted); margin-bottom: 1.5rem; }
body:has(.auth) h1 { font-size: 1.75rem; line-height: 1.2; margin: 0 0 1rem; }
body:has(.auth) :focus-visible { outline-color: var(--focus); }
body:has(.auth) a { color: var(--accent); text-underline-offset: .2em; }
.auth { background: var(--card); border-radius: 1rem; padding: 1.5rem; box-shadow: 0 1px 3px rgb(0 0 0 / .12), 0 8px 24px rgb(0 0 0 / .06); }
.auth form { display: grid; gap: 1.25rem; }
.auth label { display: block; font-weight: 600; margin-bottom: .375rem; }
.auth input:not([type=checkbox]) { box-sizing: border-box; width: 100%; min-height: 3rem; padding: .5rem .75rem; font: inherit;
  color: var(--text); background: transparent; border: 2px solid var(--line); border-radius: .5rem; }
.auth input[aria-invalid=true] { border-color: var(--err-line); }
.auth .hint { display: block; margin-top: .375rem; font-size: .95rem; color: var(--muted); }
.auth .show { display: flex; align-items: center; gap: .625rem; margin-top: .75rem; min-height: 2.75rem; }
.auth .show input { width: 1.5rem; height: 1.5rem; margin: 0; accent-color: var(--accent); }
.auth .show label { margin: 0; font-weight: 400; }
.auth button { min-height: 3rem; padding: .5rem 1rem; font: inherit; font-weight: 700; color: var(--on-accent);
  background: var(--accent); border: 2px solid transparent; border-radius: .5rem; cursor: pointer; transition: background-color .15s; }
.auth button:hover { background: var(--accent-hover); }
.auth .alt { margin: 1.25rem 0 0; text-align: center; }
.auth .error { margin: 0 0 1.25rem; padding: .75rem 1rem .75rem 2.75rem; position: relative; font-weight: 600;
  color: var(--err-text); background: var(--err-bg); border-left: .375rem solid var(--err-line); border-radius: .5rem; }
.auth .error::before { content: "!" / ""; position: absolute; left: .75rem; top: .75rem; width: 1.5rem; height: 1.5rem;
  display: grid; place-items: center; font-weight: 800; color: var(--err-bg); background: var(--err-line); border-radius: 50%; }
@media (prefers-reduced-motion: reduce) { .auth button { transition: none; } }
`;

export const AuthStyle = () => <style dangerouslySetInnerHTML={{ __html: CSS }} />;

export function ErrorBox({ error }: { error?: string }) {
  return error ? (
    <p id="error" class="error" role="alert">
      {error}
    </p>
  ) : null;
}

/** "Show password" checkbox, hidden until the script runs so it never appears dead. */
export function ShowPassword() {
  const js = `const t = document.getElementById("show-password");
t.parentElement.hidden = false;
t.addEventListener("change", () => { document.getElementById("password").type = t.checked ? "text" : "password"; });`;
  return (
    <>
      <div class="show" hidden>
        <input id="show-password" type="checkbox" />
        <label for="show-password">Show password</label>
      </div>
      <script type="module" dangerouslySetInnerHTML={{ __html: js }} />
    </>
  );
}

// Reports a server-side error through the shared accessibility helpers. Never touches the password.
export function ErrorScript({ message }: { message: string }) {
  const js = `import { announce, speak, feedback } from "/static/js/a11y.js";
const m = ${JSON.stringify(message).replace(/</g, "\\u003c")};
announce(m); speak(m); feedback("failure");
document.getElementById("username").focus();`;
  return <script type="module" dangerouslySetInnerHTML={{ __html: js }} />;
}

export function LoginPage({ error, username = "" }: { error?: string; username?: string }) {
  return (
    <Layout title="Sign in">
      <AuthStyle />
      <div class="auth">
        <ErrorBox error={error} />
        <form method="post" action="/login">
          <div>
            <label for="username">Username</label>
            <input id="username" name="username" value={username} autocomplete="username" autocapitalize="none" spellcheck={false} required aria-invalid={error ? "true" : undefined} aria-describedby={error ? "error" : undefined} />
          </div>
          <div>
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required />
            <ShowPassword />
          </div>
          <button type="submit">Sign in</button>
        </form>
        <p class="alt">
          No account? <a href="/register">Create one</a>
        </p>
      </div>
      {error && <ErrorScript message={error} />}
    </Layout>
  );
}
