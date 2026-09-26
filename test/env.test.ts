/**
 * Tests for the identity environment exposure.
 *
 * Run: node --experimental-strip-types --test test/env.test.ts
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { AGENT_NAME_ENV, applyAgentNameEnv } from "../agent-name/env.ts";

describe("applyAgentNameEnv", () => {
	it("exposes the name under PI_AGENT_NAME", () => {
		const env: Record<string, string | undefined> = {};
		applyAgentNameEnv(env, "swift-koala-42");
		assert.equal(env[AGENT_NAME_ENV], "swift-koala-42");
		assert.equal(env["PI_AGENT_NAME"], "swift-koala-42");
	});

	it("ignores a blank name instead of shadowing an inherited value", () => {
		const env: Record<string, string | undefined> = { PI_AGENT_NAME: "inherited-agent-1" };
		applyAgentNameEnv(env, "   ");
		assert.equal(env["PI_AGENT_NAME"], "inherited-agent-1");

		applyAgentNameEnv(env, "");
		assert.equal(env["PI_AGENT_NAME"], "inherited-agent-1");
	});

	it("trims the name", () => {
		const env: Record<string, string | undefined> = {};
		applyAgentNameEnv(env, "  swift-koala-42  ");
		assert.equal(env["PI_AGENT_NAME"], "swift-koala-42");
	});
});
