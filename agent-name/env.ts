/**
 * `PI_AGENT_NAME` environment exposure for shell subprocesses.
 *
 * The identity is applied to `process.env` once, at session start. pi builds
 * the bash tool's child environment per execution by spreading `process.env`,
 * so the variable reaches every bash command by inheritance — no command
 * rewriting involved.
 */

/** The environment variable an agent name is exposed under. */
export const AGENT_NAME_ENV = "PI_AGENT_NAME";

/**
 * Apply the identity to an environment map.
 *
 * A blank name is ignored rather than written, so `PI_AGENT_NAME=""` never
 * shadows an inherited value.
 */
export function applyAgentNameEnv(
	env: Record<string, string | undefined>,
	name: string,
): void {
	const trimmed = name.trim();
	if (trimmed) {
		env[AGENT_NAME_ENV] = trimmed;
	}
}
