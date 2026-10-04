// Owner: M4. Routes: /, /second-factor, /enrol, /account (the landing page). Mounted in src/app.ts.
import { Hono } from "hono";
import { requireFull, requirePasswordOk, requirePasswordOkOrRecovery, type AppEnv } from "../guards";
import { Layout } from "../views/layout";
import { endSession } from "../session";
import { AccountPage, EnrolPage, SecondFactorPage } from "../views/pages";

const app = new Hono<AppEnv>();

app.get("/", (c) =>
  c.html(
    <Layout title="NullVoid">
      <p>Multi-factor authentication for visually impaired users.</p>
    </Layout>,
  ),
);

app.get("/second-factor", requirePasswordOk, (c) => c.html(<SecondFactorPage />));
app.get("/enrol", requirePasswordOkOrRecovery, (c) => c.html(<EnrolPage />));
app.get("/account", requireFull, (c) => c.html(<AccountPage />));

// Any state may sign out, so a user stuck at the second factor can leave too.
app.post("/logout", (c) => (endSession(c), c.redirect("/login", 303)));

export default app;
