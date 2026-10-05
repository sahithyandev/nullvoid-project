// Owner: M3. The security-key registration page. Browser interaction is added in a later M3 part.
import { config } from "../config";
import { Layout } from "./layout";

export function SecurityKeyRegisterPage() {
  return (
    <Layout title="Add a security key">
      <p>
        {config.rpName} ({config.rpID}) is asking to register a physical security key as your second factor.
      </p>
      <p>
        When you continue with setup, tap your security key near the NFC area. The key may ask for its PIN to confirm it is you.
      </p>
      <p>
        Registering a security key does not complete sign-in. After setup, you will return to choose a second-factor sign-in method.
      </p>
      <p>
        <a href="/second-factor">Go back and choose another method</a>
      </p>
    </Layout>
  );
}
