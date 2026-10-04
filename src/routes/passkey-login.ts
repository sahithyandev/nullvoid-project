// Owner: M2. Routes: /passkey/login*. Mounted by src/routes/passkey.ts.
import { Hono } from "hono";
import type { AppEnv } from "../guards";

const app = new Hono<AppEnv>();

export default app;
