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
import { buildIdentityPrompt, IDENTITY_EXTENSION_URL } from "../agent-name/identity-prompt.ts";

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

	it("specifies the commit co-author trailer without an emoji or a link", () => {
		const prompt = buildIdentityPrompt(NAME);
		assert.ok(prompt.includes(`Co-authored-by: ${NAME} <${NAME}@pi-agent.local>`));
		assert.ok(!/Co-authored-by:[^\n]*🤖/.test(prompt), "a trailer must not carry an emoji");
		assert.ok(!/Co-authored-by:[^\n]*\[/.test(prompt), "a trailer must not carry markdown link syntax");
	});

	describe("signing prose", () => {
		const prompt = buildIdentityPrompt(NAME);
		// Rules 2 (pull requests) and 3 (Linear tickets) each end with the agent
		// name as a markdown link to the extension that minted it, then the
		// robot emoji.
		const signature = `— [${NAME}](${IDENTITY_EXTENSION_URL}) 🤖`;
		const plain = `— ${NAME} 🤖`;

		/**
		 * Text of the numbered rule whose bold title matches, continuation lines
		 * included. Asserting per rule is what makes each signing rule
		 * independently covered: a whole-prompt count would still pass if one rule
		 * carried the signature twice and the other carried the plain form.
		 */
		const ruleBody = (title: string): string => {
			const block = prompt.split(/\n(?=\d+\. \*\*)/).find((b) => b.includes(`**${title}**`));
			if (!block) throw new Error(`identity rule "${title}" must exist in the prompt`);
			return block;
		};

		it("links the signature at this extension", () => {
			// The point of the hyperlink is that a reader can find the extension
			// that minted the agent, so the URL must not drift.
			assert.equal(IDENTITY_EXTENSION_URL, "https://github.com/elecnix/pi-agent-name");
		});

		it("signs pull-request descriptions with the hyperlink signature", () => {
			assert.ok(ruleBody("PR descriptions").includes(signature));
		});

		it("signs Linear comments with the hyperlink signature", () => {
			assert.ok(ruleBody("Linear tickets").includes(signature));
		});

		it("offers no unlinked signature in either signing rule", () => {
			for (const title of ["PR descriptions", "Linear tickets"]) {
				assert.ok(
					!ruleBody(title).includes(plain),
					`the ${title} rule must not offer an unlinked signature`,
				);
			}
			assert.ok(!prompt.includes(plain), "the prompt must not offer an unlinked signature");
		});
	});

	it("forbids the name in file content", () => {
		assert.match(buildIdentityPrompt(NAME), /NEVER include your agent name/);
	});

	it("mentions no intercom dependency", () => {
		assert.ok(!/intercom/i.test(buildIdentityPrompt(NAME)));
	});
});
