/**
 * Tests for session-name composition.
 *
 * Run: node --experimental-strip-types --test test/session-name.test.ts
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { SESSION_RENAME_TOOL_DESCRIPTION, composeSessionName } from "../agent-name/session-name.ts";

describe("composeSessionName", () => {
	it("prefixes the description with the agent name", () => {
		assert.equal(composeSessionName("keen-gar-77", "fix auth bug"), "keen-gar-77: fix auth bug");
	});

	it("does not double-prefix an already-prefixed name", () => {
		assert.equal(
			composeSessionName("keen-gar-77", "keen-gar-77: fix auth bug"),
			"keen-gar-77: fix auth bug",
		);
	});

	it("keeps the bare name when no description is given", () => {
		assert.equal(composeSessionName("keen-gar-77", ""), "keen-gar-77");
		assert.equal(composeSessionName("keen-gar-77", "   "), "keen-gar-77");
	});

	it("omits the separator when there is no agent name", () => {
		assert.equal(composeSessionName("", "fix auth bug"), "fix auth bug");
	});

	it("trims the provided description", () => {
		assert.equal(composeSessionName("keen-gar-77", "  fix auth bug  "), "keen-gar-77: fix auth bug");
	});

	it("keeps a suffixed fork name as the prefix", () => {
		assert.equal(
			composeSessionName("keen-gar-77-a1b2c3d4", "review"),
			"keen-gar-77-a1b2c3d4: review",
		);
	});

	it("describes the tool without mentioning intercom", () => {
		assert.ok(!/intercom/i.test(SESSION_RENAME_TOOL_DESCRIPTION));
		assert.match(SESSION_RENAME_TOOL_DESCRIPTION, /AS SOON AS the first user message/);
	});
});
