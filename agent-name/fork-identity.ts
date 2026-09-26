/**
 * Fork disambiguation.
 *
 * A forked subtask session is created by copying the parent's entries
 * verbatim — including the name entry — with a new header that records
 * `parentSession`. The child would therefore restore the parent's agent name
 * and both sessions would run at once under one name, splitting attribution.
 *
 * The child is re-identified with a deterministic suffix derived from its own
 * session id, so the same fork always presents the same name across reloads:
 *
 *   swift-koala-42            # parent (unchanged)
 *   swift-koala-42-a1b2c3d4   # child (suffix = session-id hash)
 *
 * The parent's identity stays stable; the child becomes attributable on its own.
 */

import { createHash } from "node:crypto";

/** Length of the hex suffix appended to a forked child's name. */
export const FORK_SUFFIX_LENGTH = 8;

/**
 * A complete name of the shape this module produces for a forked child:
 * `word-word-<1-2 digits>-<8 hex>`.
 *
 * Matching the whole name rather than a trailing `-<8 hex>` keeps the test
 * exact: a name that merely ends in eight hex characters — a pinned name, or a
 * word that happens to look like hex — is not treated as already suffixed, so
 * it is still re-identified. Kept in step with `FORK_SUFFIX_LENGTH`.
 */
const FORK_SUFFIX_PATTERN = /^[a-z]+-[a-z]+-\d{1,2}-[0-9a-f]{8}$/;

/** Minimal shape of a session header (`SessionManager.getHeader()`). */
export interface SessionHeaderLike {
	parentSession?: string;
}

/**
 * Deterministic short hash of a session id. The session id is unique per
 * session, so the suffix is unique per fork and stable across restarts.
 */
export function forkSuffixFor(sessionId: string): string {
	return createHash("sha256").update(sessionId).digest("hex").slice(0, FORK_SUFFIX_LENGTH);
}

/** True when the session header records a parent — i.e. this session is a fork. */
export function isForkedSession(header: SessionHeaderLike | null | undefined): boolean {
	return typeof header?.parentSession === "string" && header.parentSession.length > 0;
}

/** Compose a child identity: `<parentName>-<sessionIdHash>`. */
export function composeForkIdentity(parentName: string, sessionId: string): string {
	return `${parentName}-${forkSuffixFor(sessionId)}`;
}

/**
 * Re-identify a forked child session.
 *
 * Returns the suffixed name when the session is a fork and the restored name
 * is not already suffixed; otherwise returns the name unchanged. Idempotent:
 * the existing suffix is detected rather than recomputed from the session id,
 * so a reload cannot append a second one even if the id were to change.
 */
export function maybeSuffixForkIdentity(
	name: string,
	header: SessionHeaderLike | null | undefined,
	sessionId: string,
): string {
	if (!name) return name;
	if (!isForkedSession(header)) return name;
	if (FORK_SUFFIX_PATTERN.test(name)) return name;
	return composeForkIdentity(name, sessionId);
}
