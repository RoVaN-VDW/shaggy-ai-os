import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSanitizedAuthCallbackUrl } from "../../src/lib/auth/auth-callback.ts";

test("Supabase credential fragments are removed while path and query are preserved", () => {
  assert.equal(
    buildSanitizedAuthCallbackUrl(
      "/projects",
      "?view=active",
      "#access_token=fixture-access&expires_in=3600&refresh_token=fixture-refresh&type=magiclink",
    ),
    "/projects?view=active",
  );
});

test("ordinary application anchors are never sanitized", () => {
  assert.equal(buildSanitizedAuthCallbackUrl("/", "", "#command"), null);
  assert.equal(buildSanitizedAuthCallbackUrl("/knowledge", "?room=canon", ""), null);
});
