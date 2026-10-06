// The security-key registration page. The script is public/js/security-key.js.
import { config } from "../config";
import { Layout } from "./layout";

export function SecurityKeyRegisterPage() {
  return (
    <Layout title="Add a security key">
      <p>
        {config.rpName} ({config.rpID}) is asking to register a physical security key as your second factor.
      </p>
      <p>
        When you press the button, tap your security key near the NFC area when prompted. The key may ask for its PIN; that PIN is handled by the key and
        your device, never by this application.
      </p>
      <p>
        Registering a security key does not complete sign-in. After setup, you will return to choose a second-factor sign-in method.
      </p>
      <button id="create" type="button" disabled>
        Register security key
      </button>
      <p id="result" hidden>
        <a id="continue" href="/second-factor">
          Go back and choose another method
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
