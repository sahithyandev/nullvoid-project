// Owner: M5. The device list: rename and revoke credentials.
import { Layout } from "./layout";

export type Device = { id: number; kind: "passkey" | "security_key"; label: string; created_at: number; revoked_at: number | null };

export function DevicesPage({ devices, error }: { devices: Device[]; error?: string }) {
  return (
    <Layout title="Your devices">
      {error && <p role="alert">{error}</p>}
      {devices.length === 0 && <p>You have no passkeys or security keys.</p>}
      <div class="vstack">
        {devices.map((d) => {
          const name = d.label || "Unnamed";
          return (
            <article class="card vstack">
              <h2>{name}</h2>
              <p>
                {d.kind === "passkey" ? "Passkey" : "Security key"}, added {new Date(d.created_at).toISOString().slice(0, 10)}
                {d.revoked_at ? ". Revoked." : "."}
              </p>
              {!d.revoked_at && (
                <>
                  <form class="vstack" method="post" action={`/account/devices/${d.id}/rename`}>
                    <label>
                      New name for {name}
                      <input type="text" name="label" maxlength={64} required />
                    </label>
                    <button type="submit">Rename</button>
                  </form>
                  <form method="post" action={`/account/devices/${d.id}/revoke`}>
                    <button type="submit" data-variant="danger">Revoke {name}</button>
                  </form>
                </>
              )}
            </article>
          );
        })}
      </div>
      <p>
        <a href="/account">Back to your account</a>
      </p>
    </Layout>
  );
}
