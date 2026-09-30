// Owner: M1. The account creation form.
import { Layout } from "./layout";
import { ErrorScript } from "./login";

export function RegisterPage({ error, username = "" }: { error?: string; username?: string }) {
  return (
    <Layout title="Create account">
      {error && (
        <p id="error" role="alert">
          {error}
        </p>
      )}
      <form method="post" action="/register">
        <p>
          <label for="username">Username</label>
          <input id="username" name="username" value={username} autocomplete="username" required aria-describedby={error ? "error username-rule" : "username-rule"} aria-invalid={error ? "true" : undefined} />
          <span id="username-rule"> 3 to 32 letters, numbers, dots, dashes or underscores.</span>
        </p>
        <p>
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="new-password" required aria-describedby="password-rule" />
          <span id="password-rule"> At least 12 characters.</span>
        </p>
        <button type="submit">Create account</button>
      </form>
      <p>
        Already registered? <a href="/login">Sign in</a>.
      </p>
      {error && <ErrorScript message={error} />}
    </Layout>
  );
}
