// Owner: M2. Routes: /passkey/*. Mounted in src/app.ts. Each issue's routes live in their own file.
import { Hono } from "hono";
import type { AppEnv } from "../guards";
import register from "./passkey-register";
import login from "./passkey-login";

const app = new Hono<AppEnv>();

app.route("/", register);
app.route("/", login);

export default app;
