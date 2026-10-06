// The security-key login page. The script is public/js/security-key.js.
import { config } from "../config";
import { Layout } from "./layout";

export function SecurityKeyLoginPage() {
  return (
    <Layout title="Sign in with your security key">
      <p>
        {config.rpName} ({config.rpID}) is asking you to sign in with your registered physical security key as your second factor.
      </p>
      <p>
        You have already completed the password step. When prompted, tap your security key near the NFC area. The key may ask for its PIN; that PIN is
        handled by the key and your device, never by this application.
      </p>
      <p>Successful security-key authentication will continue to your account.</p>
      <button id="signin" type="button" disabled>
        Sign in with security key
      </button>
      <p id="result" hidden>
        <a id="continue" href="/account">
          Continue to your account
        </a>
      </p>
      <noscript>
        <p>
          This page needs JavaScript. You can <a href="/second-factor">go back and choose another method</a>.
        </p>
      </noscript>
      <script type="module" src="/static/js/security-key.js"></script>
    </Layout>
  );
}
