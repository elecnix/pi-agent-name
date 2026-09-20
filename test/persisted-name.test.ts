/**
 * Tests for persisted-name handling.
 *
 * Run: node --experimental-strip-types --test test/persisted-name.test.ts
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
	NAME_ENV,
	OWN_NAME_ENTRY,
	SHARED_NAME_ENTRY,
	isWellFormedAgentName,
	restoreAgentName,
} from "../agent-name/persisted-name.ts";

const custom = (customType: string, name: unknown) => ({
	type: "custom",
	customType,
	data: { name },
});

describe("restoreAgentName", () => {
	it("reads a name recorded by this extension", () => {
		assert.equal(restoreAgentName([custom(OWN_NAME_ENTRY, "swift-koala-42")]), "swift-koala-42");
	});

	it("reads a name recorded by pi-agent-identity, so both extensions agree", () => {
		assert.equal(restoreAgentName([custom(SHARED_NAME_ENTRY, "keen-gar-77")]), "keen-gar-77");
	});

	it("lets the most recent entry win", () => {
		const entries = [
			custom(OWN_NAME_ENTRY, "swift-koala-42"),
			custom(SHARED_NAME_ENTRY, "swift-koala-42"),
		];
		assert.equal(restoreAgentName(entries), "swift-koala-42");
	});

	it("ignores unrelated custom entries and non-custom entries", () => {
		assert.equal(
			restoreAgentName([
				{ type: "message", customType: OWN_NAME_ENTRY, data: { name: "bold-fox-1" } },
				custom("some-other-extension", "swift-koala-42"),
				custom("agent-identity-seen", { ids: [1] }),
				{ type: "custom", customType: OWN_NAME_ENTRY, data: {} },
			]),
			"",
		);
	});

	it("ignores blank and non-string names", () => {
		assert.equal(restoreAgentName([custom(OWN_NAME_ENTRY, "   ")]), "");
		assert.equal(restoreAgentName([custom(OWN_NAME_ENTRY, 42)]), "");
		assert.equal(restoreAgentName([custom(OWN_NAME_ENTRY, null)]), "");
	});

	it("trims a padded name", () => {
		assert.equal(restoreAgentName([custom(OWN_NAME_ENTRY, " swift-koala-42 ")]), "swift-koala-42");
	});

	it("returns an empty string for an empty session", () => {
		assert.equal(restoreAgentName([]), "");
	});
});

describe("isWellFormedAgentName", () => {
	it("accepts a minted name", () => {
		assert.ok(isWellFormedAgentName("swift-koala-42"));
		assert.ok(isWellFormedAgentName("swift-koala-0"));
		assert.ok(isWellFormedAgentName("swift-koala-99"));
	});

	it("accepts a forked child's suffixed name", () => {
		assert.ok(isWellFormedAgentName("swift-koala-42-a1b2c3d4"));
	});

	it("rejects malformed names", () => {
		for (const bad of [
			"",
			"swift-koala",
			"swift-koala-100",
			"swift-koala-42-",
			"Crimson-Wren-20",
			"swift koala 42",
			"swift-koala-42; rm -rf /",
			"swift-koala-42-a1b2c3d",
			"swift-koala-42-a1b2c3d4e5",
			"swift-koala-2x",
			"a-b-c-20",
		]) {
			assert.ok(!isWellFormedAgentName(bad), `should reject: ${bad}`);
		}
	});
});

describe("shared constants", () => {
	it("keeps the shared entry type and env var names stable", () => {
		assert.equal(OWN_NAME_ENTRY, "pi-agent-name");
		assert.equal(SHARED_NAME_ENTRY, "agent-identity-name");
		assert.equal(NAME_ENV, "AGENT_IDENTITY_NAME");
	});
});
