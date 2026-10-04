// Owner: M4. The chooser pages (/second-factor, /enrol) and the signed-in landing page (/account).
import { Layout } from "./layout";

function Chooser({ title, intro, passkey, secKey }: { title: string; intro: string; passkey: string; secKey: string }) {
  return (
    <Layout title={title}>
      <p>{intro}</p>
      <h2>Select an authentication method</h2>
      <ul>
        <li>
          <a href={passkey}>Passkey</a>: use the fingerprint, face or screen lock on this device.
        </li>
        <li>
          <a href={secKey}>NFC security key</a>: hold a FIDO2 security key against your device.
        </li>
      </ul>
    </Layout>
  );
}

export const SecondFactorPage = () => (
  <Chooser title="Choose how to sign in" intro="Your password was accepted. One more step to finish signing in." passkey="/passkey/login" secKey="/security-key/login" />
);

export const EnrolPage = () => (
  <Chooser title="Set up a second factor" intro="Your account needs a passkey or a security key before you can sign in." passkey="/passkey/register" secKey="/security-key/register" />
);

export const AccountPage = () => (
  <Layout title="Your account">
    <p>You are signed in.</p>
    <ul>
      <li>
        <a href="/account/devices">Your devices</a>
      </li>
      <li>
        <a href="/account/recovery-codes">Recovery codes</a>
      </li>
    </ul>
  </Layout>
);
