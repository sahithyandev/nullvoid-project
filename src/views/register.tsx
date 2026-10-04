// Owner: M1. The account creation form.
import { Layout } from "./layout";
import { ErrorBox, ErrorScript, ShowPassword } from "./login";

export function RegisterPage({ error, username = "" }: { error?: string; username?: string }) {
  return (
    <Layout title="Create account">
      <ErrorBox error={error} />
      <form method="post" action="/register">
        <div data-field>
          <label for="username">Username</label>
          <input id="username" name="username" value={username} autocomplete="username" autocapitalize="none" spellcheck={false} required aria-describedby={error ? "error username-rule" : "username-rule"} aria-invalid={error ? "true" : undefined} />
          <span id="username-rule" data-hint>
            3 to 32 letters, numbers, dots, dashes or underscores.
          </span>
        </div>
        <div data-field>
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="new-password" required aria-describedby="password-rule" />
          <span id="password-rule" data-hint>
            At least 12 characters.
          </span>
          <ShowPassword />
        </div>
        <button type="submit">Create account</button>
      </form>
      <p>
        Already registered? <a href="/login">Sign in</a>
      </p>
      {error && <ErrorScript message={error} />}
    </Layout>
  );
}
