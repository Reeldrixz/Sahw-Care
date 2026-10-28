// Unit tests for lib/awaitingAddress. Run: npx tsx --test src/lib/awaitingAddress.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByMother } from "./awaitingAddress";

const it = (id: string, mother: string, updatedAt: string) => ({ id, updatedAt, register: { creator: { id: mother } } });

test("one group per mother, across her registers", () => {
  const g = groupByMother([
    it("a1", "m1", "2026-10-20T00:00:00Z"), it("b1", "m2", "2026-10-25T00:00:00Z"),
    it("a2", "m1", "2026-10-18T00:00:00Z"), it("a3", "m1", "2026-10-22T00:00:00Z"),
  ]);
  assert.equal(g.length, 2);
  assert.deepEqual(g.map((x) => x.map((i) => i.id)), [["a2", "a1", "a3"], ["b1"]]);
});

test("the mother waiting longest comes first", () => {
  const g = groupByMother([it("b1", "m2", "2026-10-25T00:00:00Z"), it("c1", "m3", "2026-10-01T00:00:00Z")]);
  assert.deepEqual(g.map((x) => x[0].id), ["c1", "b1"]);
});

test("empty input, no groups", () => {
  assert.deepEqual(groupByMother([]), []);
});
