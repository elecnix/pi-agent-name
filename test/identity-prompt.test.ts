/**
 * Tests for the identity prompt block.
 *
 * The prompt is the contract for how an agent signs its work, so the exact
 * rules are asserted rather than the block's length or shape.
 *
 * Run: node --experimental-strip-types --test test/identity-prompt.test.ts
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { buildIdentityPrompt } from "../agent-name/identity-prompt.ts";

const NAME = "swift-koala-42";

describe("buildIdentityPrompt", () => {
	it("wraps the rules in the shared agent_identity tag", () => {
		const prompt = buildIdentityPrompt(NAME);
		assert.ok(prompt.includes("<agent_identity>"));
		assert.ok(prompt.includes("</agent_identity>"));
	});

	it("names the agent", () => {
		assert.ok(buildIdentityPrompt(NAME).includes(`YOUR AGENT NAME: ${NAME}`));
	});

	it("specifies the commit co-author trailer without an emoji", () => {
		const prompt = buildIdentityPrompt(NAME);
		assert.ok(prompt.includes(`Co-authored-by: ${NAME} <${NAME}@pi-agent.local>`));
		assert.ok(!/Co-authored-by:[^\n]*🤖/.test(prompt), "a trailer must not carry an emoji");
	});

	it("signs prose with a robot emoji", () => {
		assert.ok(buildIdentityPrompt(NAME).includes(`— ${NAME} 🤖`));
	});

	it("forbids the name in file content", () => {
		assert.match(buildIdentityPrompt(NAME), /NEVER include your agent name/);
	});

	it("mentions no intercom dependency", () => {
		assert.ok(!/intercom/i.test(buildIdentityPrompt(NAME)));
	});
});
