// Owner: M5. The recovery form: username, password and one recovery code.
import { Layout } from "./layout";
import { ErrorBox, ErrorScript, ShowPassword } from "./login";

export function RecoverPage({ error, username = "" }: { error?: string; username?: string }) {
  return (
    <Layout title="Recover your account">
      <p>Lost your phone or security key? Enter your password and one unused recovery code. Then you can set up a new passkey or security key.</p>
      <ErrorBox error={error} />
      <form method="post" action="/recover">
        <div data-field>
          <label for="username">Username</label>
          <input id="username" name="username" value={username} autocomplete="username" autocapitalize="none" spellcheck={false} required aria-invalid={error ? "true" : undefined} aria-describedby={error ? "error" : undefined} />
        </div>
        <div data-field>
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
          <ShowPassword />
        </div>
        <div data-field>
          <label for="code">Recovery code</label>
          <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck={false} required />
        </div>
        <button type="submit">Recover account</button>
      </form>
      <p>
        <a href="/login">Back to sign in</a>
      </p>
      {error && <ErrorScript message={error} />}
    </Layout>
  );
}
