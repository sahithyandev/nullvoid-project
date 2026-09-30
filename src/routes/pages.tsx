// Owner: M4. Routes: /, /second-factor, /enrol, /account (the landing page). Mounted in src/app.ts.
import { Hono } from "hono";
import type { AppEnv } from "../guards";
import { Layout } from "../views/layout";

const app = new Hono<AppEnv>();

app.get("/", (c) =>
  c.html(
    <Layout title="NullVoid">
      <p>Multi-factor authentication for visually impaired users.</p>
    </Layout>,
  ),
);

export default app;
