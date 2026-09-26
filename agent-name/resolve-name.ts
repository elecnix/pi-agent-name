/**
 * Agent-name resolution at session start.
 *
 * Three sources can supply a name, and the order is deliberate:
 *
 *   1. an explicit pin (`AGENT_IDENTITY_NAME`) — a deliberate act, for tests,
 *      scripting, and daemon revival, so it wins over what was recorded;
 *   2. the name recorded in the session file, so a resume keeps its identity;
 *   3. a fresh mint, for a session that has neither.
 *
 * A pin that is not well formed is ignored rather than trusted. A forked child
 * that *inherited* its parent's name is suffixed so the two cannot share one
 * identity; a freshly minted name is left alone, because a new random name
 * inherits nothing and a suffix there would only make it uglier.
 *
 * Kept free of pi imports so it is unit-testable with plain `node --test`.
 */

import { maybeSuffixForkIdentity, type SessionHeaderLike } from "./fork-identity.ts";
import { generateName } from "./names.ts";
import { isWellFormedAgentName } from "./persisted-name.ts";

/** Where the resolved name came from. */
export type NameSource = "pinned" | "restored" | "minted";

export interface ResolveNameInput {
	/** The name recorded in the session file, if any. */
	restored: string;
	/** Value of `AGENT_IDENTITY_NAME`, if set. */
	pinned?: string | undefined;
	/** Session header, consulted to detect a forked child. */
	header?: SessionHeaderLike | null | undefined;
	/** This session's id, used for the fork suffix. */
	sessionId: string;
	/** Name generator, injected so tests are deterministic. */
	mint?: (() => string) | undefined;
}

export interface ResolvedName {
	name: string;
	source: NameSource;
}

/**
 * Resolve the name this session should run under.
 *
 * A malformed recorded name is treated as absent: a hand-edited session file
 * must not be able to put arbitrary text into the prompt, the session title,
 * or a git trailer.
 *
 * The fork suffix is applied to a name that came from the pin or the session
 * file — the two paths that can carry a parent's identity into a child — and
 * not to a minted name, which is unique by construction.
 */
export function resolveAgentName(input: ResolveNameInput): ResolvedName {
	const pinned = input.pinned?.trim() ?? "";
	const hasPin = isWellFormedAgentName(pinned);
	const hasRestored = isWellFormedAgentName(input.restored);

	const base = hasPin ? pinned : hasRestored ? input.restored : "";
	if (!base) {
		// A fresh name inherits nothing, so the fork suffix does not apply.
		return { name: (input.mint ?? generateName)(), source: "minted" };
	}

	return {
		name: maybeSuffixForkIdentity(base, input.header, input.sessionId),
		source: hasPin ? "pinned" : "restored",
	};
}
