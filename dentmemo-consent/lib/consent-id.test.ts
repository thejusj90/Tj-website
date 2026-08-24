import { test } from "node:test";
import assert from "node:assert/strict";
import { createConsentRef } from "./consent-id.ts";

test("createConsentRef matches DC-YYYY-XXXXXXXX format", () => {
  const ref = createConsentRef(new Date("2026-01-01T00:00:00Z"));
  assert.match(ref, /^DC-2026-[0-9A-F]{8}$/);
});

test("createConsentRef uses the UTC year of the given date", () => {
  const ref = createConsentRef(new Date("2030-06-15T12:00:00Z"));
  assert.ok(ref.startsWith("DC-2030-"));
});

test("createConsentRef produces distinct references across calls", () => {
  const refs = new Set(Array.from({ length: 200 }, () => createConsentRef()));
  assert.equal(refs.size, 200);
});
