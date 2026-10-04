// Owner: M3. The security key login page.
// The script is public/js/security-key.js.

import { config } from "../config";
import { Layout } from "./layout";

export function SecurityKeyLoginPage() {
  return (
    <Layout title="Sign in with your security key">
      <p>
        {config.rpName} ({config.rpID}) is asking you to sign in with your
        security key.
      </p>

      <p>
        When you press the button, tap your security key near the NFC area.
        Your security key may ask you to enter its PIN to confirm it is you.
      </p>

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