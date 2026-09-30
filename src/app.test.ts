import { expect, test } from "bun:test";
import app from "./app";

test("home page responds", async () => {
  const res = await app.request("/");
  expect(res.status).toBe(200);
});
