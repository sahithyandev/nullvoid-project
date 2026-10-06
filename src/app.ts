import { Hono } from "hono";
import { serveStatic } from "@hono/bun";
import type { AppEnv } from "./guards";
import pages from "./routes/pages";
import login from "./routes/login";
import passkey from "./routes/passkey";
import securityKey from "./routes/security-key";
import account from "./routes/account";
import recover from "./routes/recover";
import { getSession } from "./session";
import { signedIn } from "./views/layout";

const app = new Hono<AppEnv>();

app.use("/static/oat/*", serveStatic({ root: "./node_modules/@knadh/oat", rewriteRequestPath: (p) => p.replace(/^\/static\/oat/, "") }));
app.use("/static/*", serveStatic({ root: "./public", rewriteRequestPath: (p) => p.replace(/^\/static/, "") }));

app.use((c, next) => signedIn.run(getSession(c).state === "full", next));

app.route("/", pages);
app.route("/", login);
app.route("/passkey", passkey);
app.route("/security-key", securityKey);
app.route("/account", account);
app.route("/recover", recover);

export default app;
