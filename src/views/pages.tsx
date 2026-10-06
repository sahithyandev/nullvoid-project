// Owner: M4. The chooser pages (/second-factor, /enrol) and the signed-in landing page (/account).
import { Layout } from "./layout";

const SignOut = () => (
  <form method="post" action="/logout">
    <button type="submit">Sign out</button>
  </form>
);

type CardItem = { title: string; text: string; href: string; label: string };

const Cards = ({ items, heading: H }: { items: CardItem[]; heading: "h2" | "h3" }) => (
  <div class="row">
    {items.map((i) => (
      <article class="card vstack col-6">
        <H>{i.title}</H>
        <p>{i.text}</p>
        <a href={i.href} class="button w-100">{i.label}</a>
      </article>
    ))}
  </div>
);

function Chooser({ title, intro, passkey, secKey }: { title: string; intro: string; passkey: string; secKey: string }) {
  return (
    <Layout title={title}>
      <p>{intro}</p>
      <h2>Select an authentication method</h2>
      <Cards
        heading="h3"
        items={[
          { title: "Passkey", text: "Use the fingerprint, face or screen lock on this device.", href: passkey, label: "Use a passkey" },
          { title: "NFC security key", text: "Hold a FIDO2 security key against your device.", href: secKey, label: "Use a security key" },
        ]}
      />
      <SignOut />
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
    <section class="card vstack">
      <h2>Sign-in methods</h2>
      <p>See the passkeys and security keys on your account. Rename or revoke them.</p>
      <p>
        <a href="/account/devices" class="button">Manage devices</a>
      </p>
    </section>
    <section class="card vstack">
      <h2>Recovery</h2>
      <p>Create codes to get back in if you lose all your devices. Keep them somewhere safe.</p>
      <p>
        <a href="/account/recovery-codes" class="button outline">Manage recovery codes</a>
      </p>
    </section>
    <SignOut />
  </Layout>
);

export const HomePage = () => (
  <Layout title="Welcome to NullVoid">
    <p>NullVoid is a secure sign-in for people who are blind or have low vision. You never need to read or type a code. It works with a screen reader and a keyboard.</p>

    <h2>New here?</h2>
    <p>
      <a href="/register" class="button">Create an account</a>
    </p>
    <ol>
      <li>Choose a username and password.</li>
      <li>Set up a second factor: a passkey on this device, or an NFC security key.</li>
      <li>From your account page, create recovery codes and keep them somewhere safe.</li>
    </ol>

    <h2>Already have an account?</h2>
    <p>
      <a href="/login" class="button">Sign in</a>
    </p>
    <ol>
      <li>Enter your username and password.</li>
      <li>Confirm it is you. With a passkey, use your fingerprint, face or screen lock. With a security key, hold it against your device.</li>
    </ol>

    <h2>Lost your passkey or security key?</h2>
    <p>
      <a href="/recover">Use a recovery code</a> together with your username and password, then set up a new second factor.
    </p>
  </Layout>
);
