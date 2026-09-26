/**
 * Commit trailer rewriting.
 *
 * Every commit an agent makes must carry its `Co-authored-by` trailer, so the
 * `bash` tool call is rewritten before it runs. The rewrite has to survive real
 * shell syntax: a commit is frequently chained (`git commit -m x && git push`),
 * may carry environment assignments or git's own global options
 * (`git -c user.name=x commit`), and the words `git commit` may appear inside a
 * quoted string that is not a command at all.
 *
 * Two rules keep the rewrite honest:
 *
 *   - the trailer belongs to the commit's own segment, so it is inserted there
 *     rather than at the end of the command;
 *   - the agent must be credited exactly once, so the trailer is skipped only
 *     when the commit itself already credits *this* agent. Crediting somebody
 *     else, or merely mentioning the words elsewhere in the command, does not
 *     suppress it — otherwise a stray string would leave the commit unsigned.
 *
 * Known limitation: a commit nested inside another shell — `bash -c "git commit
 * …"`, a subshell, backticks, or `$( )` — is not rewritten, because deciding
 * whether a nested string is a command would need a real shell parser rather
 * than a scanner. Such a commit is left alone, which loses the trailer; the
 * rewrite never guesses inside a nested string, so it cannot corrupt one.
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

/**
 * Git global options whose value may be attached (`-cuser.name=x`,
 * `--git-dir=/x`) or may follow as its own token (`-c user.name=x`,
 * `--git-dir /x`). Listing them is what lets the scan tell an option's value
 * apart from the subcommand: without it, `git -c commit` looks like a commit
 * when `commit` is really the value of `-c`.
 */
const VALUE_TAKING_OPTIONS = new Set([
	"-c",
	"-C",
	"--git-dir",
	"--work-tree",
	"--namespace",
	"--exec-path",
	"--config-env",
]);

/** Index just past the value starting at `index`, or -1 when it is unterminated. */
function afterValue(tokens: readonly string[], index: number): number {
	const first = tokens[index];
	if (first === undefined) return -1;
	const quote = first[0];
	if (quote !== '"' && quote !== "'") return index + 1;
	if (first.length > 1 && first.endsWith(quote)) return index + 1;
	let cursor = index + 1;
	while (cursor < tokens.length && !tokens[cursor]!.endsWith(quote)) cursor += 1;
	return cursor < tokens.length ? cursor + 1 : -1;
}

/**
 * True when `text` is a `git commit`, ignoring environment assignments and
 * git's own global options in front of the subcommand.
 *
 * Tokenising rather than pattern-matching is what keeps the option arity
 * straight: a `commit` that is an option's value is consumed as that value, so
 * only a real subcommand is signed.
 */
function isCommitSegment(text: string): boolean {
	const tokens = text.trim().split(/\s+/);
	let index = 0;

	while (index < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=\S*$/.test(tokens[index]!)) index += 1;
	if (tokens[index] !== "git") return false;
	index += 1;

	while (index < tokens.length) {
		const token = tokens[index]!;
		if (token === "commit") return true;
		if (!token.startsWith("-")) return false;

		const equals = token.indexOf("=");
		const name = equals === -1 ? token : token.slice(0, equals);
		const carriesValue = equals !== -1 || token.length > name.length;
		index += 1;

		if (!VALUE_TAKING_OPTIONS.has(name) || carriesValue) continue;
		index = afterValue(tokens, index);
		if (index < 0) return false;
	}

	return false;
}

/** The trailer git expects for an agent name. */
export function coAuthorTrailer(agentName: string): string {
	return `Co-authored-by: ${agentName} <${agentName}@${CO_AUTHOR_EMAIL_DOMAIN}>`;
}

/** True when `text` already credits `name` as a co-author. */
function alreadyCredits(text: string, name: string): boolean {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`co-authored-by:\\s*${escaped}(?:\\s|>|$)`, "i").test(text);
}

/**
 * Split a command into its top-level segments, keeping each separator so the
 * command can be rebuilt byte for byte when nothing is rewritten.
 *
 * Only operators that separate commands split here: `&&`, `||`, `;`, `|`, `&`,
 * a newline. Redirections (`>`, `2>&1`) deliberately do not, because they are
 * transparent to the command — splitting on them turns `git commit -m x 2>&1`
 * into an argument `2` and a mangled `>&1`.
 *
 * Quotes are tracked so an operator inside a quoted argument (`-m "a && b"`)
 * does not split the command, and a `git commit` inside a quoted string is
 * never mistaken for the command itself. Returns `null` when quoting is
 * unbalanced: the command is not valid shell, and rewriting it would risk
 * placing the trailer inside a string.
 */
function splitCommand(command: string): Segment[] | null {
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
				index = Math.min(index + 2, command.length);
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
			index = Math.min(index + 2, command.length);
			continue;
		}

		if (char === "&" || char === "|") {
			const previous = index > 0 ? command[index - 1] : "";
			const next = command[index + 1] ?? "";
			// `>&1`, `<&0`, and `&>` are redirections, not command separators:
			// their ampersand belongs to the operator that precedes it.
			if (char === "&" && (previous === ">" || previous === "<" || next === ">")) {
				index += 1;
				continue;
			}
			const length = next === char || (char === "|" && next === "&") ? 2 : 1;
			push(index, index + length);
			index += length;
			continue;
		}

		if (char === ";" || char === "\n") {
			push(index, index + 1);
			index += 1;
			continue;
		}

		index += 1;
	}

	if (quote) return null;

	push(command.length, command.length);
	return segments;
}

/**
 * Add the agent's co-author trailer to every `git commit` in `command`.
 *
 * Returns the command unchanged when there is nothing to do: no name, a name
 * that is not a well-formed identity, a commit that already credits this agent,
 * malformed shell, or a command that commits nothing.
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

	const segments = splitCommand(command);
	if (!segments) return command;

	const trailer = `--trailer "${coAuthorTrailer(name)}"`;

	return segments
		.map((segment) => {
			const isCommit = isCommitSegment(segment.text) && !alreadyCredits(segment.text, name);
			if (!isCommit) return segment.text + segment.separator;
			// Drop trailing blanks so the trailer sits next to the arguments and
			// one space is left before the separator that follows.
			const text = segment.text.replace(/\s+$/, "");
			const separator = segment.separator ? segment.separator.replace(/^\s*/, " ") : "";
			return `${text} ${trailer}${separator}`;
		})
		.join("");
}
