import { test } from "node:test";
import assert from "node:assert/strict";
import { consentTemplates, getTemplate } from "./templates.ts";

test("ships all eight default procedures", () => {
  assert.equal(consentTemplates.length, 8);
});

test("every template has a unique slug and non-empty body/acknowledgements", () => {
  const slugs = new Set(consentTemplates.map((t) => t.slug));
  assert.equal(slugs.size, consentTemplates.length);
  for (const t of consentTemplates) {
    assert.ok(t.title.trim().length > 0, `${t.slug} missing title`);
    assert.ok(t.body.trim().length > 0, `${t.slug} missing body`);
    assert.ok(t.acknowledgements.length > 0, `${t.slug} missing acknowledgements`);
  }
});

test("getTemplate resolves a known slug", () => {
  const t = getTemplate("root-canal");
  assert.equal(t.procedure, "Root Canal Treatment");
});

test("getTemplate falls back to the first template for an unknown slug", () => {
  const t = getTemplate("does-not-exist");
  assert.equal(t.slug, consentTemplates[0].slug);
});
