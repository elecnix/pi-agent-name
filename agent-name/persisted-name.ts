/**
 * Persisted-name handling.
 *
 * The name lives in the session file as a custom entry. Two entry types are
 * read: this extension's own, and the shared one written by the larger
 * pi-agent-identity extension. Reading both means a session that was named by
 * either extension resumes with the name it already had, instead of minting a
 * second identity for the same session.
 *
 * Kept free of pi imports so it is unit-testable with plain `node --test`.
 */

/** Custom session entry written by this extension. */
export const OWN_NAME_ENTRY = "pi-agent-name";

/**
 * Custom session entry written by pi-agent-identity. Recorded as well as the
 * own entry so both extensions converge on one name instead of racing to mint
 * two.
 */
export const SHARED_NAME_ENTRY = "agent-identity-name";

/** Environment variable used to pin a name before launch (tests, scripting). */
export const NAME_ENV = "AGENT_IDENTITY_NAME";

/** Minimal shape of the session entries this module reads. */
export interface NameEntryLike {
	type?: string;
	customType?: string;
	data?: { name?: unknown };
}

/**
 * Read the most recent recorded name from session entries.
 *
 * Entries are scanned in order and the last valid one wins, matching how a
 * session reload appends a corrected name rather than rewriting history.
 * Returns an empty string when no name was ever recorded.
 */
export function restoreAgentName(entries: readonly unknown[]): string {
	let found = "";
	for (const raw of entries) {
		const entry = raw as NameEntryLike | null | undefined;
		if (entry?.type !== "custom") continue;
		if (entry.customType !== OWN_NAME_ENTRY && entry.customType !== SHARED_NAME_ENTRY) continue;
		const name = entry.data?.name;
		if (typeof name === "string" && name.trim()) found = name.trim();
	}
	return found;
}

/**
 * True when `name` is a safe agent identifier.
 *
 * The accepted forms are the minted `word-word-number` and the suffixed
 * `word-word-number-<8 hex>` a forked child carries. The guard matters because
 * the name reaches prompt text, git trailers, and a session title from places
 * the extension does not control (an environment variable, a hand-edited
 * session file), so whitespace, punctuation, and unexpected extra segments are
 * rejected rather than trusted.
 */
export function isWellFormedAgentName(name: string): boolean {
	return /^[a-z]+-[a-z]+-\d{1,2}(?:-[0-9a-f]{8})?$/.test(name);
}
