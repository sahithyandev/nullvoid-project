// Owner: M3. The security-key login page. Browser interaction is added in a later M3 part.
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
      <p>
        <a href="/second-factor">Go back and choose another method</a>
      </p>
    </Layout>
  );
}
