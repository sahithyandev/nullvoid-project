// Guard contract. Put one of these on every route that reads or changes anything.
import type { Context, MiddlewareHandler } from "hono";
import { getSession, type SessionState } from "./session";

/** Type of the Hono context in every module: `new Hono<AppEnv>()`. */
export type AppEnv = { Variables: { userId: number; sessionId: string } };

function requireState(...allowed: SessionState[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const s = getSession(c);
    if (s.state === "anonymous" || !allowed.includes(s.state)) return deny(c);
    c.set("userId", s.userId);
    c.set("sessionId", s.id);
    await next();
  };
}

// Pages are sent to the sign-in page. API calls (POST) get a plain 401.
function deny(c: Context) {
  return c.req.method === "GET" ? c.redirect("/login", 303) : c.text("Not allowed in this session", 401);
}

export const requirePasswordOk = requireState("password_ok");
export const requireFull = requireState("full");
export const requireRecovery = requireState("recovery");
/** For registering a passkey or key: the first enrolment, or a replacement after recovery. */
export const requirePasswordOkOrRecovery = requireState("password_ok", "recovery");
/** For the device list: a signed-in user, or one who recovered and needs to revoke a lost credential. */
export const requireFullOrRecovery = requireState("full", "recovery");
