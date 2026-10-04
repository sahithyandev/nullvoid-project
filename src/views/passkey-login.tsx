// Owner: M2. The passkey login page. The script is public/js/passkey-login.js.
import { config } from "../config";
import { Layout } from "./layout";

export function PasskeyLoginPage() {
  return (
    <Layout title="Sign in with your passkey">
      <p>
        {config.rpName} ({config.rpID}) is asking you to sign in with your passkey.
      </p>
      <p>
        When you press the button, your device will ask you to confirm it is you, with your fingerprint, face or screen lock. Your fingerprint or face
        never leaves your device.
      </p>
      <button id="signin" type="button" disabled>
        Sign in with passkey
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
      <script type="module" src="/static/js/passkey-login.js"></script>
    </Layout>
  );
}
