/**
 * Agent Name Extension
 *
 * Gives every pi session a persistent, human-readable name such as
 * `swift-koala-42`, and puts that name where it does useful work: the session
 * name, the system prompt's identity rules, the `PI_AGENT_NAME` environment
 * variable, and the `Co-authored-by` trailer of every commit the agent makes.
 *
 * This extension is standalone. It has no daemon, no socket, and no dependency
 * on pi-intercom: a name is minted locally and persisted in the session file,
 * which is the only source of truth.
 *
 * Name collisions are possible in principle and are mitigated by the size of
 * the vocabulary rather than by a registry — see `agent-name/names.ts`.
 *
 * Interop: the name is recorded under both the extension's own entry type and
 * the shared `agent-identity-name` entry used by the larger pi-agent-identity
 * extension, so installing both converges on one name instead of minting two.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { applyAgentNameEnv } from "./env.ts";
import { buildIdentityPrompt } from "./identity-prompt.ts";
import { NAME_ENV, OWN_NAME_ENTRY, SHARED_NAME_ENTRY, restoreAgentName } from "./persisted-name.ts";
import { resolveAgentName } from "./resolve-name.ts";
import { composeSessionName, SESSION_RENAME_TOOL_DESCRIPTION } from "./session-name.ts";

let agentName = "";

/** Record the name in the session file under both entry types. */
function persistAgentName(pi: ExtensionAPI, name: string): void {
	pi.appendEntry(OWN_NAME_ENTRY, { name });
	pi.appendEntry(SHARED_NAME_ENTRY, { name });
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		agentName = "";

		// Resolve the name: an explicit pin wins, then the name the session file
		// remembers, then a fresh mint. A forked child is suffixed whichever
		// source named it, so a parent and its child never share one identity.
		const recorded = restoreAgentName(ctx.sessionManager.getEntries());
		const resolution = resolveAgentName({
			restored: recorded,
			pinned: process.env[NAME_ENV],
			header: ctx.sessionManager.getHeader(),
			sessionId: ctx.sessionManager.getSessionId(),
		});
		agentName = resolution.name;

		// Record the name unless the session simply resumed the one it had, so a
		// reload does not grow the session file on every start.
		if (resolution.source !== "restored" || resolution.name !== recorded) {
			persistAgentName(pi, agentName);
		}

		// Expose the name to every shell command the agent runs.
		applyAgentNameEnv(process.env, agentName);

		pi.setSessionName(agentName);

		if (ctx.hasUI) {
			ctx.ui.notify(`Agent name: ${agentName}`, "info");
		}
	});

	// Put the identity rules in the system prompt. The tag check keeps a second
	// extension (or a reload) from appending the block twice.
	pi.on("before_agent_start", async (event) => {
		if (!agentName) return;
		const currentPrompt = event.systemPrompt ?? "";
		if (currentPrompt.includes("<agent_identity>")) return;
		return { systemPrompt: `${currentPrompt}\n${buildIdentityPrompt(agentName)}` };
	});

	pi.registerTool({
		name: "session_rename",
		label: "Rename Session",
		description: SESSION_RENAME_TOOL_DESCRIPTION,
		promptSnippet:
			"Rename the current pi session; call it AS SOON AS the first user message conveys intent, before doing substantive work.",
		promptGuidelines: [
			"Call session_rename immediately after reading the user's first message — before any other tool use — so the session name reflects the task early.",
		],
		parameters: Type.Object({
			session_name: Type.String({
				description:
					"A short, kebab-case description of the task (e.g. 'fix-auth-bug', 'PRI-123-add-router-config'). The agent-name prefix is added automatically — provide the description only.",
			}),
		}),
		async execute(_toolCallId, params) {
			const desired = params.session_name ?? "";
			const fullName = composeSessionName(agentName, desired);
			try {
				pi.setSessionName(fullName);
			} catch (err) {
				return {
					content: [{
						type: "text" as const,
						text: `Failed to rename session: ${err instanceof Error ? err.message : String(err)}`,
					}],
					details: { ok: false, agentName, desired, fullName },
				};
			}
			return {
				content: [{ type: "text" as const, text: `Session renamed to: ${fullName}` }],
				details: { ok: true, agentName, desired, fullName },
			};
		},
	});

	pi.registerCommand("whoami", {
		description: "Show this session's agent name",
		handler: async (_args, ctx) => {
			ctx.ui.notify(
				agentName ? `You are: ${agentName}` : "No agent name assigned.",
				agentName ? "info" : "warning",
			);
		},
	});
}
