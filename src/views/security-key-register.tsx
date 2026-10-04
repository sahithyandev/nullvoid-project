// Owner: M3. The security key registration page.
// The script is public/js/security-key.js.

import { config } from "../config";
import { Layout } from "./layout";

export function SecurityKeyRegisterPage() {
  return (
    <Layout title="Add a security key">
      <p>
        {config.rpName} ({config.rpID}) is asking you to register a security key.
      </p>

      <p>
        When you press the button, tap your security key near the NFC area.
        Your security key may ask you to enter its PIN to confirm it is you.
        Your private key stays inside the security key. {config.rpName} only
        receives a public key.
      </p>

      <button id="create" type="button" disabled>
        Add security key
      </button>

      <p id="result" hidden>
        <a id="continue" href="/second-factor">
          Continue to sign in with your new security key
        </a>
      </p>

      <noscript>
        <p>
          This page needs JavaScript. You can{" "}
          <a href="/second-factor">go back and choose another method</a>.
        </p>
      </noscript>

      <script
        type="module"
        src="/static/js/security-key.js"
      ></script>
    </Layout>
  );
}