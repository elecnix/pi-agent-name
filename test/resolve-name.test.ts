/**
 * Tests for agent-name resolution at session start.
 *
 * Three sources can supply a name, and the order matters:
 *
 *   1. an explicit pin (`AGENT_IDENTITY_NAME`), which is a deliberate act and
 *      therefore wins over what the session file remembers;
 *   2. the name recorded in the session file, so a resume keeps its identity;
 *   3. a fresh mint, for a session that has neither.
 *
 * Run: node --experimental-strip-types --test test/resolve-name.test.ts
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { resolveAgentName } from "../agent-name/resolve-name.ts";
import { forkSuffixFor } from "../agent-name/fork-identity.ts";

const SESSION = "01a09c0d-bd34-72c5-9fea-cd1d9976ee84";
const MINTED = "swift-koala-42";

const mint = () => MINTED;

describe("resolveAgentName", () => {
	it("mints a name when the session has neither a record nor a pin", () => {
		const out = resolveAgentName({ restored: "", sessionId: SESSION, mint });
		assert.equal(out.name, MINTED);
		assert.equal(out.source, "minted");
	});

	it("resumes the recorded name", () => {
		const out = resolveAgentName({ restored: MINTED, sessionId: SESSION, mint });
		assert.equal(out.name, MINTED);
		assert.equal(out.source, "restored");
	});

	it("lets an explicit pin override the recorded name", () => {
		// Regression: the pin used to apply only when nothing was recorded, so
		// resuming a session ignored the requested identity.
		const out = resolveAgentName({
			restored: "amber-fox-31",
			pinned: "keen-gar-77",
			sessionId: SESSION,
			mint,
		});
		assert.equal(out.name, "keen-gar-77");
		assert.equal(out.source, "pinned");
	});

	it("trims a pin", () => {
		const out = resolveAgentName({ restored: "", pinned: "  keen-gar-77  ", sessionId: SESSION, mint });
		assert.equal(out.name, "keen-gar-77");
	});

	it("ignores a malformed pin and keeps the recorded name", () => {
		for (const pinned of ["", "   ", "not a name", "keen-gar-77; rm -rf /", "keen-gar-100"]) {
			const out = resolveAgentName({
				restored: MINTED,
				pinned,
				sessionId: SESSION,
				mint,
			});
			assert.equal(out.name, MINTED, `pin: ${JSON.stringify(pinned)}`);
			assert.equal(out.source, "restored", `pin: ${JSON.stringify(pinned)}`);
		}
	});

	it("trims a recorded name before using it", () => {
		const out = resolveAgentName({ restored: "  swift-koala-42  ", sessionId: SESSION, mint });
		assert.equal(out.name, "swift-koala-42");
		assert.equal(out.source, "restored");
	});

	it("ignores a malformed recorded name and mints a fresh one", () => {
		const out = resolveAgentName({ restored: "not a name", sessionId: SESSION, mint });
		assert.equal(out.name, MINTED);
		assert.equal(out.source, "minted");
	});

	it("does not suffix a freshly minted name, even on a fork", () => {
		// A minted name inherits nothing; the suffix exists to break inheritance.
		const out = resolveAgentName({
			restored: "",
			header: { parentSession: "parent.jsonl" },
			sessionId: SESSION,
			mint,
		});
		assert.equal(out.name, MINTED);
		assert.equal(out.source, "minted");
	});

	it("suffixes a forked child that inherited its parent's name", () => {
		const forked = resolveAgentName({
			restored: MINTED,
			header: { parentSession: "parent.jsonl" },
			sessionId: SESSION,
			mint,
		});
		assert.equal(forked.name, `${MINTED}-${forkSuffixFor(SESSION)}`);
		assert.equal(forked.source, "restored");
	});

	it("does not re-suffix an already-suffixed fork on reload", () => {
		const once = resolveAgentName({
			restored: MINTED,
			header: { parentSession: "parent.jsonl" },
			sessionId: SESSION,
			mint,
		});
		const twice = resolveAgentName({
			restored: once.name,
			header: { parentSession: "parent.jsonl" },
			sessionId: SESSION,
			mint,
		});
		assert.equal(twice.name, once.name);
	});
});
