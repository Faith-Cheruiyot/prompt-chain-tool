import test from "node:test";
import assert from "node:assert/strict";
import { authOrigin } from "../src/lib/auth-origin";

const app = "https://prompt-chain-tool-ruddy.vercel.app";

test("every Vercel alias uses the stable Chain Studio sign-in origin", () => {
  for (const origin of [
    app,
    "https://prompt-chain-tool-faith-24b4.vercel.app",
    "https://prompt-chain-tool-git-codex-prompt-chain-studio-faith-24b4.vercel.app",
    "https://prompt-chain-tool-3aog34ckr-faith-24b4.vercel.app",
  ]) {
    const result = authOrigin(`${origin}/auth/login`, app);
    assert.equal(result, app);
    assert.equal(
      new URL("/auth/callback", result).href,
      `${app}/auth/callback`,
    );
  }
});

test("local development keeps its incoming origin when APP_URL is unset", () => {
  assert.equal(
    authOrigin("http://localhost:3000/auth/login"),
    "http://localhost:3000",
  );
  assert.equal(
    authOrigin("http://127.0.0.1:3000/auth/login", " "),
    "http://127.0.0.1:3000",
  );
});

test("normalizes whitespace and the optional trailing slash", () => {
  assert.equal(authOrigin(`${app}/auth/login`, ` ${app}/ `), app);
});

test("rejects nonsecure or ambiguous configured callback origins", () => {
  for (const invalid of [
    "http://example.com",
    "javascript:alert(1)",
    `${app}/other`,
    `${app}?next=other`,
    `${app}#other`,
    "https://user:password@example.com",
  ]) {
    assert.throws(() => authOrigin(`${app}/auth/login`, invalid));
  }
  assert.equal(
    authOrigin(`${app}/auth/login`, "http://localhost:3000"),
    "http://localhost:3000",
  );
});
