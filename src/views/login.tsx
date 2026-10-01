// Owner: M1. The password form, and the styling and scripts shared with the register page.
import { Layout } from "./layout";

// Scoped to .auth, so it does not touch M4's global stylesheet.
const CSS = `
:root { color-scheme: light dark; }
.auth { max-width: 24rem; }
.auth form { display: grid; gap: 1rem; }
.auth label { display: block; font-weight: 600; margin-bottom: .25rem; }
.auth input:not([type=checkbox]) { box-sizing: border-box; width: 100%; min-height: 2.75rem; padding: .25rem .5rem; font: inherit; }
.auth .hint { display: block; margin-top: .25rem; font-size: .95rem; opacity: .8; }
.auth .show { display: flex; align-items: center; gap: .5rem; margin-top: .5rem; }
.auth .show input { width: 1.25rem; height: 1.25rem; margin: 0; }
.auth button { min-height: 2.75rem; padding: .25rem 1rem; font: inherit; font-weight: 600; cursor: pointer; }
.auth .error { margin: 0 0 1rem; padding-left: .75rem; border-left: .25rem solid currentColor; font-weight: 600; }
.auth input[aria-invalid=true] { border: 2px solid currentColor; }
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
