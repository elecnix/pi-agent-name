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
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { applyAgentNameEnv } from "./env.ts";
import { addCoAuthorTrailer } from "./commit-trailer.ts";
import { maybeSuffixForkIdentity } from "./fork-identity.ts";
import { buildIdentityPrompt } from "./identity-prompt.ts";
import { NAME_ENV, OWN_NAME_ENTRY, SHARED_NAME_ENTRY, isWellFormedAgentName, restoreAgentName } from "./persisted-name.ts";
import { composeSessionName, SESSION_RENAME_TOOL_DESCRIPTION } from "./session-name.ts";
import { generateName } from "./names.ts";

let agentName = "";

/** Record the name in the session file under both entry types. */
function persistAgentName(pi: ExtensionAPI, name: string): void {
	pi.appendEntry(OWN_NAME_ENTRY, { name });
	pi.appendEntry(SHARED_NAME_ENTRY, { name });
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		agentName = "";

		// 1. Resume the name this session already has. A hand-edited or foreign
		//    entry that is not a well-formed name is ignored rather than trusted.
		const restored = restoreAgentName(ctx.sessionManager.getEntries());
		agentName = isWellFormedAgentName(restored) ? restored : "";

		// 2. Re-identify a forked child so parent and child do not run as one name.
		if (agentName) {
			const beforeFork = agentName;
			agentName = maybeSuffixForkIdentity(
				agentName,
				ctx.sessionManager.getHeader(),
				ctx.sessionManager.getSessionId(),
			);
			if (agentName !== beforeFork) persistAgentName(pi, agentName);
		}

		// 3. Otherwise take an explicit name, or mint one.
		if (!agentName) {
			const pinned = process.env[NAME_ENV]?.trim() ?? "";
			agentName = isWellFormedAgentName(pinned) ? pinned : generateName();
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

	// Sign commits automatically; the prompt rule asks for the trailer, this
	// makes it true even when the agent forgets. The rewrite understands shell
	// chains, so the trailer stays on the commit rather than the command after it.
	pi.on("tool_call", async (event) => {
		if (event.toolName !== "bash") return;
		if (!isToolCallEventType("bash", event)) return;
		event.input.command = addCoAuthorTrailer(event.input.command ?? "", agentName);
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
