/**
 * Tests for the commit trailer rewriter.
 *
 * The rewriter runs on every `bash` tool call before the command executes, so
 * a mistake here either fails the agent's command or leaves a commit
 * unsigned. The cases below are the ones that produced real bugs:
 *
 *   - `git commit -m x && git push` — the old end-of-string regex appended
 *     `--trailer` to `git push`, which git rejects;
 *   - `git commit --amend --no-edit` — the old code skipped it, although git
 *     accepts `--trailer` there and that is exactly when the trailer is wanted.
 *
 * Run: node --experimental-strip-types --test test/commit-trailer.test.ts
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { addCoAuthorTrailer, coAuthorTrailer } from "../agent-name/commit-trailer.ts";

const NAME = "swift-koala-42";
const TRAILER = `--trailer "Co-authored-by: ${NAME} <${NAME}@pi-agent.local>"`;

describe("coAuthorTrailer", () => {
	it("builds the trailer git expects", () => {
		assert.equal(coAuthorTrailer(NAME), `Co-authored-by: ${NAME} <${NAME}@pi-agent.local>`);
	});
});

describe("addCoAuthorTrailer", () => {
	it("appends the trailer to a simple commit", () => {
		assert.equal(
			addCoAuthorTrailer(`git commit -m "work"`, NAME),
			`git commit -m "work" ${TRAILER}`,
		);
	});

	it("signs a commit that has no message flag", () => {
		assert.equal(addCoAuthorTrailer("git commit", NAME), `git commit ${TRAILER}`);
	});

	it("signs an amend that reuses its message", () => {
		// Regression: this used to be skipped, leaving the commit unsigned.
		assert.equal(
			addCoAuthorTrailer("git commit --amend --no-edit", NAME),
			`git commit --amend --no-edit ${TRAILER}`,
		);
	});

	it("keeps the trailer inside the commit when the command is chained", () => {
		// Regression: the trailer used to land on `git push`.
		assert.equal(
			addCoAuthorTrailer("git commit -m x && git push", NAME),
			`git commit -m x ${TRAILER} && git push`,
		);
		assert.equal(
			addCoAuthorTrailer("git commit -m z; ls", NAME),
			// The rewriter leaves one space before the separator; shell syntax does
			// not care, and it keeps the trailer readable next to the operator.
			`git commit -m z ${TRAILER} ; ls`,
		);
		assert.equal(
			addCoAuthorTrailer("git commit -m x || exit 1", NAME),
			`git commit -m x ${TRAILER} || exit 1`,
		);
		assert.equal(
			addCoAuthorTrailer("git commit -m x | tee out", NAME),
			`git commit -m x ${TRAILER} | tee out`,
		);
		assert.equal(
			addCoAuthorTrailer("git commit -m x > log", NAME),
			`git commit -m x ${TRAILER} > log`,
		);
	});

	it("finds the commit in a chain that starts with another command", () => {
		assert.equal(
			addCoAuthorTrailer("cd /repo && git commit -m y", NAME),
			`cd /repo && git commit -m y ${TRAILER}`,
		);
	});

	it("signs a commit that carries environment assignments", () => {
		assert.equal(
			addCoAuthorTrailer("GIT_AUTHOR_NAME=x git commit -m y", NAME),
			`GIT_AUTHOR_NAME=x git commit -m y ${TRAILER}`,
		);
	});

	it("signs every commit in a chain", () => {
		assert.equal(
			addCoAuthorTrailer("git commit -m a && git commit -m b", NAME),
			`git commit -m a ${TRAILER} && git commit -m b ${TRAILER}`,
		);
	});

	it("leaves a command that already names a co-author alone", () => {
		const command = `git commit -m "x" --trailer "Co-authored-by: someone <s@example.com>"`;
		assert.equal(addCoAuthorTrailer(command, NAME), command);
	});

	it("leaves a command that already has a trailer alone", () => {
		const command = `git commit -m "x" --trailer "Signed-off-by: me"`;
		assert.equal(addCoAuthorTrailer(command, NAME), command);
	});

	it("ignores commands that are not commits", () => {
		for (const command of [
			"git status",
			"git log --oneline",
			"git push origin main",
			"npm test",
			"",
		]) {
			assert.equal(addCoAuthorTrailer(command, NAME), command, command);
		}
	});

	it("does not touch a commit mentioned inside a quoted string", () => {
		const command = `echo "run git commit later" && git status`;
		assert.equal(addCoAuthorTrailer(command, NAME), command);
	});

	it("does not mistake a quoted word for the command", () => {
		const command = `printf '%s' "git commit -m x"`;
		assert.equal(addCoAuthorTrailer(command, NAME), command);
	});

	it("respects quotes around operators", () => {
		assert.equal(
			addCoAuthorTrailer(`git commit -m "a && b"`, NAME),
			`git commit -m "a && b" ${TRAILER}`,
		);
	});

	it("does nothing without a name", () => {
		assert.equal(addCoAuthorTrailer("git commit -m x", ""), "git commit -m x");
		assert.equal(addCoAuthorTrailer("git commit -m x", "   "), "git commit -m x");
	});
});
