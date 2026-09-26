/**
 * Tests for fork disambiguation.
 *
 * Run: node --experimental-strip-types --test test/fork-identity.test.ts
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
	FORK_SUFFIX_LENGTH,
	composeForkIdentity,
	forkSuffixFor,
	isForkedSession,
	maybeSuffixForkIdentity,
} from "../agent-name/fork-identity.ts";

const SESSION = "01a09c0d-bd34-72c5-9fea-cd1d9976ee84";
const OTHER_SESSION = "01a09c10-094e-7144-9d54-2c3a7a282ee0";

describe("isForkedSession", () => {
	it("is true only when a parent session is recorded", () => {
		assert.ok(isForkedSession({ parentSession: "../../parent.jsonl" }));
		assert.ok(!isForkedSession({}));
		assert.ok(!isForkedSession({ parentSession: "" }));
		assert.ok(!isForkedSession(null));
		assert.ok(!isForkedSession(undefined));
	});
});

describe("forkSuffixFor", () => {
	it("is deterministic and the advertised length", () => {
		assert.equal(forkSuffixFor(SESSION), forkSuffixFor(SESSION));
		assert.equal(forkSuffixFor(SESSION).length, FORK_SUFFIX_LENGTH);
		assert.match(forkSuffixFor(SESSION), /^[0-9a-f]{8}$/);
	});

	it("differs between sessions", () => {
		assert.notEqual(forkSuffixFor(SESSION), forkSuffixFor(OTHER_SESSION));
	});
});

describe("maybeSuffixForkIdentity", () => {
	it("leaves a normal (non-forked) session untouched", () => {
		assert.equal(maybeSuffixForkIdentity("swift-koala-42", {}, SESSION), "swift-koala-42");
	});

	it("suffixes a forked child", () => {
		assert.equal(
			maybeSuffixForkIdentity("swift-koala-42", { parentSession: "parent.jsonl" }, SESSION),
			composeForkIdentity("swift-koala-42", SESSION),
		);
	});

	it("keeps the parent name stable across calls", () => {
		const once = maybeSuffixForkIdentity("swift-koala-42", { parentSession: "parent.jsonl" }, SESSION);
		const twice = maybeSuffixForkIdentity(once, { parentSession: "parent.jsonl" }, SESSION);
		assert.equal(once, twice, "reload must not add a second suffix");
	});

	it("detects an existing suffix without recomputing it", () => {
		// The suffix identifies "this name is already a child's". Detecting it
		// rather than comparing against a hash of the current session id keeps a
		// reload idempotent even if the session id were ever to change.
		const suffixed = composeForkIdentity("swift-koala-42", SESSION);
		assert.equal(
			maybeSuffixForkIdentity(suffixed, { parentSession: "parent.jsonl" }, OTHER_SESSION),
			suffixed,
		);
	});

	it("returns an empty name unchanged", () => {
		assert.equal(maybeSuffixForkIdentity("", { parentSession: "parent.jsonl" }, SESSION), "");
	});
});
