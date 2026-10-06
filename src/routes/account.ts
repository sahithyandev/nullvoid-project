// Owner: M5. Routes: /account/* (devices, revoke). Mounted in src/app.ts. Put every route in this file.
import { Hono } from "hono";
import type { AppEnv } from "../guards";
import recoveryCodes from "./recovery-codes";

const app = new Hono<AppEnv>();

app.route("/", recoveryCodes);

export default app;
