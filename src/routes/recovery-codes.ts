// Owner: M5. Routes: /account/recovery-codes. Mounted by src/routes/account.ts.
import { Hono } from "hono";
import { requireFull, type AppEnv } from "../guards";
import { generateCodes } from "../recovery-codes";
import { RecoveryCodesPage } from "../views/recovery-codes";

const app = new Hono<AppEnv>();

app.use("/recovery-codes", requireFull);

app.get("/recovery-codes", (c) => c.html(RecoveryCodesPage({})));

app.post("/recovery-codes", (c) => {
  const codes = generateCodes(c.get("userId"));
  c.header("Cache-Control", "no-store");
  return c.html(RecoveryCodesPage({ codes }));
});

export default app;
