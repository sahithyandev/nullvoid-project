// Owner: M5. Make recovery codes, and show a new set once.
import { Layout } from "./layout";

export function RecoveryCodesPage({ codes }: { codes?: string[] }) {
  return (
    <Layout title="Recovery codes">
      {codes ? (
        <>
          <p>Your new recovery codes are below. They are shown only once. Each code works once. Store them somewhere safe.</p>
          <ol aria-label="Recovery codes">
            {codes.map((c) => (
              <li>
                <code>{c}</code>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <p>A recovery code lets you back in if you lose your phone or security key. Making a new set stops every older code from working.</p>
          <form method="post" action="/account/recovery-codes">
            <button type="submit">Make new recovery codes</button>
          </form>
        </>
      )}
      <p>
        <a href="/account">Back to your account</a>
      </p>
    </Layout>
  );
}
