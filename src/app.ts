import { Hono } from "hono";
import { serveStatic } from "@hono/bun";
import type { AppEnv } from "./guards";
import pages from "./routes/pages";
import login from "./routes/login";
import passkey from "./routes/passkey";
import securityKey from "./routes/security-key";
import account from "./routes/account";
import recover from "./routes/recover";

const app = new Hono<AppEnv>();

app.use("/static/*", serveStatic({ root: "./public", rewriteRequestPath: (p) => p.replace(/^\/static/, "") }));

// One line per member. Prefixes are fixed by the contract in PLAN.md.
app.route("/", pages); //                  M4: /, /second-factor, /enrol, /account
app.route("/", login); //                  M1: /register, /login
app.route("/passkey", passkey); //         M2
app.route("/security-key", securityKey); // M3
app.route("/account", account); //         M5: /account/*
app.route("/recover", recover); //         M5

export default app;
