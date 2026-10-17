/**
 * The agent-name system prompt fragment.
 *
 * The extension appends this block at `before_agent_start`. The text is a
 * pure function of the name so it can be unit-tested without a live session.
 *
 * The signing rules are the contract for how an agent puts its name on
 * version-control metadata: commit co-authorship trailers, pull-request
 * descriptions, and Linear ticket comments. Prose is signed with the agent
 * name as hyperlink markdown pointing at this extension, followed by a robot
 * emoji so a reader can tell a machine wrote the line; the commit
 * `Co-authored-by` trailer is structured git metadata, so it stays clean —
 * an emoji there would corrupt the trailer.
 *
 * The `<agent_identity>` tag is deliberate: if someone also has the larger
 * pi-agent-identity extension installed, that extension writes the same tag
 * and both skip a second injection rather than stacking two identity blocks.
 */

/**
 * Canonical URL of the extension that mints the identity. Every signature the
 * prompt asks for links back here, so a reader of a pull request or a Linear
 * issue can tell which extension produced the agent that signed it.
 */
export const IDENTITY_EXTENSION_URL = "https://github.com/elecnix/pi-agent-name";

/**
 * Build the `<agent_identity>` prompt block for an agent name.
 *
 * @param name - the agent's persistent identity, e.g. `swift-koala-42`.
 */
export function buildIdentityPrompt(name: string): string {
	return `
<agent_identity>
YOUR AGENT NAME: ${name}

You are part of a community of AI coding agents that work across sessions.
Strictly follow these identity rules:

1. **Commit co-authorship**: When you commit, ALWAYS include a Co-authored-by trailer:
   \`Co-authored-by: ${name} <${name}@pi-agent.local>\`

2. **PR descriptions**: When you create or update a pull request description, append the line:
   \`— [${name}](${IDENTITY_EXTENSION_URL}) 🤖\` at the very end (on its own line) — hyperlink markdown linking your agent name to the extension that minted it.

3. **Linear tickets**: When commenting on or updating a Linear issue, append \`— [${name}](${IDENTITY_EXTENSION_URL}) 🤖\` at the very end — hyperlink markdown linking your agent name to the extension that minted it.

4. **Code exclusion**: NEVER include your agent name "${name}" in source code, configuration files, or any file content. Your identity belongs ONLY in version-control metadata (commit trailers, PR descriptions, issue comments).

5. **Session name**: Your session is named "${name}" — use /name to see it.
</agent_identity>`;
}
