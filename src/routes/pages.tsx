// Routes: /, /second-factor, /enrol, /account (the landing page). Mounted in src/app.ts.
import { Hono } from "hono";
import { requireFull, requirePasswordOk, requirePasswordOkOrRecovery, type AppEnv } from "../guards";
import { endSession } from "../session";
import { AccountPage, HomePage, EnrolPage, SecondFactorPage } from "../views/pages";

const app = new Hono<AppEnv>();

app.get("/", (c) => c.html(<HomePage />));

app.get("/second-factor", requirePasswordOk, (c) => c.html(<SecondFactorPage />));
app.get("/enrol", requirePasswordOkOrRecovery, (c) => c.html(<EnrolPage />));
app.get("/account", requireFull, (c) => c.html(<AccountPage />));

// Any state may sign out, so a user stuck at the second factor can leave too.
app.post("/logout", (c) => (endSession(c), c.redirect("/login", 303)));

export default app;
