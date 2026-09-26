/**
 * Commit trailer rewriting.
 *
 * Every commit an agent makes must carry its `Co-authored-by` trailer, so the
 * `bash` tool call is rewritten before it runs. The rewrite has to survive real
 * shell syntax: a commit is frequently chained (`git commit -m x && git push`),
 * may carry environment assignments, and the word `git commit` may appear
 * inside a quoted string that is not a command at all.
 *
 * Splitting the command into top-level segments first, and only then deciding
 * whether a segment *is* a commit, is what keeps the trailer attached to the
 * commit rather than to whatever follows it.
 *
 * Kept free of pi imports so it is unit-testable with plain `node --test`.
 */

import { isWellFormedAgentName } from "./persisted-name.ts";

/** Domain used for the agent's synthetic co-author address. */
export const CO_AUTHOR_EMAIL_DOMAIN = "pi-agent.local";

/** One top-level shell segment and the operator that followed it. */
interface Segment {
	text: string;
	separator: string;
}

/** `git` optionally preceded by `VAR=value` environment assignments. */
const COMMIT_SEGMENT = /^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\s+commit(?:\s|$)/;

/** The trailer git expects for an agent name. */
export function coAuthorTrailer(agentName: string): string {
	return `Co-authored-by: ${agentName} <${agentName}@${CO_AUTHOR_EMAIL_DOMAIN}>`;
}

/**
 * Split a command into its top-level segments, keeping each separator so the
 * command can be rebuilt byte for byte when nothing is rewritten.
 *
 * Quotes are tracked so an operator inside a quoted argument (`-m "a && b"`)
 * does not split the command, and a `git commit` inside a quoted string is
 * never mistaken for the command itself.
 */
function splitCommand(command: string): Segment[] {
	const segments: Segment[] = [];
	let start = 0;
	let index = 0;
	let quote: '"' | "'" | null = null;

	const push = (end: number, separatorEnd: number) => {
		segments.push({ text: command.slice(start, end), separator: command.slice(end, separatorEnd) });
		start = separatorEnd;
	};

	while (index < command.length) {
		const char = command[index]!;

		if (quote) {
			// Inside double quotes a backslash escapes the next character.
			if (char === "\\" && quote === '"') {
				index += 2;
				continue;
			}
			if (char === quote) quote = null;
			index += 1;
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			index += 1;
			continue;
		}

		if (char === "\\") {
			index += 2;
			continue;
		}

		if (char === "&" || char === "|") {
			const pair = command.slice(index, index + 2);
			const length = pair === "&&" || pair === "||" ? 2 : 1;
			push(index, index + length);
			index += length;
			continue;
		}

		if (char === ";" || char === "\n") {
			push(index, index + 1);
			index += 1;
			continue;
		}

		if (char === ">" || char === "<") {
			const length = command[index + 1] === ">" ? 2 : 1;
			push(index, index + length);
			index += length;
			continue;
		}

		index += 1;
	}

	push(command.length, command.length);
	return segments;
}

/**
 * Add the agent's co-author trailer to every `git commit` in `command`.
 *
 * Returns the command unchanged when there is nothing to do: no name, a name
 * that is not a well-formed identity, a commit that already names a co-author,
 * a commit that already passes `--trailer`, or a command that commits nothing.
 *
 * The name is validated rather than escaped: the trailer is appended to a shell
 * command, so a name carrying a quote, `$`, or a backtick would escape the
 * quoting and be executed. Only names this extension could have minted are
 * accepted, which keeps the rewrite safe by construction.
 */
export function addCoAuthorTrailer(command: string, agentName: string): string {
	const name = agentName.trim();
	if (!name) return command;
	if (!isWellFormedAgentName(name)) return command;
	if (/Co-authored-by:/.test(command)) return command;

	const trailer = `--trailer "${coAuthorTrailer(name)}"`;

	return splitCommand(command)
		.map((segment) => {
			const isCommit =
				COMMIT_SEGMENT.test(segment.text) && !/--trailer\b/.test(segment.text);
			if (!isCommit) return segment.text + segment.separator;
			// Drop trailing blanks so the trailer sits next to the arguments and
			// one space is left before the separator that follows.
			const text = segment.text.replace(/\s+$/, "");
			const separator = segment.separator ? segment.separator.replace(/^\s*/, " ") : "";
			return `${text} ${trailer}${separator}`;
		})
		.join("");
}
