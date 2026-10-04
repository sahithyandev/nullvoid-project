// Owner: M2. The passkey registration page. The script is public/js/passkey-register.js.
import { config } from "../config";
import { Layout } from "./layout";

export function PasskeyRegisterPage() {
  return (
    <Layout title="Add a passkey">
      <p>
        {config.rpName} ({config.rpID}) is asking to create a passkey on this device.
      </p>
      <p>
        When you press the button, your device will ask you to confirm it is you, with your fingerprint, face or screen lock. Your fingerprint or face
        never leaves your device. {config.rpName} only receives a public key.
      </p>
      <button id="create" type="button" disabled>
        Create passkey
      </button>
      <p id="result" hidden>
        <a id="continue" href="/second-factor">
          Continue to sign in with your new passkey
        </a>
      </p>
      <noscript>
        <p>
          This page needs JavaScript. You can <a href="/second-factor">go back and choose another method</a>.
        </p>
      </noscript>
      <script type="module" src="/static/js/passkey-register.js"></script>
    </Layout>
  );
}
