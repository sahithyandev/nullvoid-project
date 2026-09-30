import { Hono } from "hono";
import { serveStatic } from "hono/bun";

const app = new Hono();

app.use("/static/*", serveStatic({ root: "./public", rewriteRequestPath: (p) => p.replace(/^\/static/, "") }));
app.get("/", (c) => c.text("NullVoid"));

export default app;
