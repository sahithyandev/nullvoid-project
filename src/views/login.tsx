// The password form, and the styling and scripts shared with the register page.
import { Layout } from "./layout";

export function ErrorBox({ error }: { error?: string }) {
  return error ? (
    <p id="error" role="alert" data-variant="error">
      {error}
    </p>
  ) : null;
}

/** "Show password" checkbox, hidden until the script runs so it never appears dead. */
export function ShowPassword() {
  const js = `const t = document.getElementById("show-password");
t.closest("div").hidden = false;
t.addEventListener("change", () => { document.getElementById("password").type = t.checked ? "text" : "password"; });`;
  return (
    <>
      <div hidden>
        <label>
          <input id="show-password" type="checkbox" />
          Show password
        </label>
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
      <ErrorBox error={error} />
      <form method="post" action="/login">
        <div data-field>
          <label for="username">Username</label>
          <input id="username" name="username" value={username} autocomplete="username" autocapitalize="none" spellcheck={false} required aria-invalid={error ? "true" : undefined} aria-describedby={error ? "error" : undefined} />
        </div>
        <div data-field>
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
          <ShowPassword />
        </div>
        <button type="submit">Sign in</button>
      </form>
      <p>
        No account? <a href="/register">Create one</a>
      </p>
      <p>
        Lost your phone or security key? <a href="/recover">Recover your account</a>
      </p>
      {error && <ErrorScript message={error} />}
    </Layout>
  );
}
