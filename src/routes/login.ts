// Owner: M1. Routes: /register and /login. Mounted in src/app.ts. Put every route in this file.
import { Hono } from "hono";
import type { AppEnv } from "../guards";

const app = new Hono<AppEnv>();

export default app;
