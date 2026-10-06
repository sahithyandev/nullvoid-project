// Routes: /account/* (devices, revoke). Mounted in src/app.ts. Put every route in this file.
import { Hono } from "hono";
import type { AppEnv } from "../guards";
import recoveryCodes from "./recovery-codes";
import devices from "./devices";

const app = new Hono<AppEnv>();

app.route("/", recoveryCodes);
app.route("/", devices);

export default app;
