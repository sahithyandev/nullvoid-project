// Owner: M1. The password form.
import { Layout } from "./layout";

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
      {error && (
        <p id="error" role="alert">
          {error}
        </p>
      )}
      <form method="post" action="/login">
        <p>
          <label for="username">Username</label>
          <input id="username" name="username" value={username} autocomplete="username" required aria-invalid={error ? "true" : undefined} aria-describedby={error ? "error" : undefined} />
        </p>
        <p>
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
        </p>
        <button type="submit">Sign in</button>
      </form>
      <p>
        No account? <a href="/register">Create one</a>.
      </p>
      {error && <ErrorScript message={error} />}
    </Layout>
  );
}
