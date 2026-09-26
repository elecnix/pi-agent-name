/**
 * Tests for the name vocabulary and minting.
 *
 * These tests carry the extension's actual uniqueness contract: with no
 * registry and no daemon, the size of the name space is the whole guarantee.
 *
 * Run: node --experimental-strip-types --test test/names.test.ts
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
	ADJECTIVES,
	ANIMALS,
	MAX_MINT_ATTEMPTS,
	NAME_SPACE_SIZE,
	SUFFIX_COUNT,
	generateName,
	pickFreshAgentName,
	type RandomSource,
} from "../agent-name/names.ts";

/** A deterministic source that walks a fixed list of draws. */
function scriptedRandom(draws: number[]): RandomSource {
	let i = 0;
	return () => {
		const value = draws[i % draws.length]!;
		i += 1;
		return value;
	};
}

describe("vocabulary", () => {
	it("has no duplicate adjectives or animals", () => {
		assert.equal(new Set(ADJECTIVES).size, ADJECTIVES.length, "duplicate adjective");
		assert.equal(new Set(ANIMALS).size, ANIMALS.length, "duplicate animal");
	});

	it("uses only lowercase single words, so a name is always well formed", () => {
		for (const word of [...ADJECTIVES, ...ANIMALS]) {
			assert.match(word, /^[a-z]+$/, `bad word: ${word}`);
		}
	});

	it("keeps the 0-99 suffix", () => {
		assert.equal(SUFFIX_COUNT, 100);
	});

	it("has a name space large enough that a collision is rarer than one in a million", () => {
		// The requirement: a fresh draw hits any single existing name with
		// probability < 1e-6.
		assert.ok(NAME_SPACE_SIZE >= 1_000_000, `name space too small: ${NAME_SPACE_SIZE}`);
		assert.ok(1 / NAME_SPACE_SIZE < 1e-6, `collision probability too high: ${1 / NAME_SPACE_SIZE}`);
	});
});

describe("generateName", () => {
	it("composes adjective-animal-suffix", () => {
		const random = scriptedRandom([0, 0, 0]);
		assert.equal(generateName(random), `${ADJECTIVES[0]}-${ANIMALS[0]}-0`);
	});

	it("uses the last suffix value when the draw lands on the top of the range", () => {
		const random = scriptedRandom([0, 0, SUFFIX_COUNT - 1]);
		assert.equal(generateName(random), `${ADJECTIVES[0]}-${ANIMALS[0]}-99`);
	});

	it("is a pure function of the random source", () => {
		const a = generateName(scriptedRandom([3, 5, 42]));
		const b = generateName(scriptedRandom([3, 5, 42]));
		assert.equal(a, b);
	});

	it("always produces a well-formed name with the real crypto source", () => {
		for (let i = 0; i < 500; i++) {
			assert.match(generateName(), /^[a-z]+-[a-z]+-\d{1,2}$/);
		}
	});

	it("stays well formed whatever a broken source returns", () => {
		// The source is injectable, so it must not be able to produce a name the
		// rest of the extension would reject. `max` is the exclusive bound, and
		// anything negative, fractional, or non-numeric is equally nonsense.
		for (const draw of [0, 1, -1, 999, 1.5, -0.5, NaN, Infinity]) {
			const broken: RandomSource = () => draw;
			const name = generateName(broken);
			assert.match(name, /^[a-z]+-[a-z]+-\d{1,2}$/, `draw ${draw} produced ${name}`);
			assert.ok(ADJECTIVES.includes(name.split("-")[0] as never));
			assert.ok(ANIMALS.includes(name.split("-")[1] as never));
		}
	});
});

describe("pickFreshAgentName", () => {
	it("returns the first draw when nothing is taken", () => {
		const name = pickFreshAgentName(new Set(), scriptedRandom([0, 0, 7]));
		assert.equal(name, `${ADJECTIVES[0]}-${ANIMALS[0]}-7`);
	});

	it("re-rolls while the drawn name is taken", () => {
		const first = `${ADJECTIVES[0]}-${ANIMALS[0]}-0`;
		const second = `${ADJECTIVES[1]}-${ANIMALS[1]}-1`;
		const random = scriptedRandom([0, 0, 0, 1, 1, 1]);
		assert.equal(pickFreshAgentName(new Set([first]), random), second);
	});

	it("returns the last draw rather than failing when every attempt collides", () => {
		// Every draw lands on a taken name, so the attempts are exhausted. The
		// contract is to return the FINAL draw — not the first one, and not a
		// throw — because a duplicate name still beats starting without one.
		// Asserting the last draw (not the first) is what distinguishes the
		// deliberate fallback from a bug that returns the first collision.
		const first = `${ADJECTIVES[0]}-${ANIMALS[0]}-0`;
		const last = `${ADJECTIVES[1]}-${ANIMALS[1]}-1`;
		const random = scriptedRandom([0, 0, 0, 1, 1, 1]);
		const drawn = pickFreshAgentName(new Set([first, last]), random);
		assert.equal(drawn, last);
		assert.match(drawn, /^[a-z]+-[a-z]+-\d{1,2}$/);
	});

	it("draws at most maxAttempts times", () => {
		let calls = 0;
		const counting: RandomSource = () => {
			calls += 1;
			return 0;
		};
		pickFreshAgentName(new Set([`${ADJECTIVES[0]}-${ANIMALS[0]}-0`]), counting);
		assert.equal(calls, MAX_MINT_ATTEMPTS * 3);
	});

	it("works with no arguments (standalone default)", () => {
		assert.match(pickFreshAgentName(), /^[a-z]+-[a-z]+-\d{1,2}$/);
	});
});
