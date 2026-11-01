/**
 * The agent name as a footer widget.
 *
 * A session's display name is mutable. `/name` replaces it wholesale, and so
 * does any tool that renames the session, so the `<agent-name>: ` prefix that
 * `session_rename` composes can disappear at any moment. The footer widget is
 * the copy that cannot: it is derived from the identity the session was minted
 * with, never from the name the session currently displays.
 *
 * Registration goes through `pi-footer-widget`, a composer-agnostic bridge over
 * pi-statusbar, pi-powerline-footer, and the stock footer, so the name lands
 * wherever the user's footer keeps extension statuses.
 *
 * The widget is additive or absent, never a substitute. Composers show a widget
 * next to what they already display; the bridge clears only the key it owns;
 * and when the bridge is missing or fails, this extension writes nothing at
 * all rather than putting a line of its own where something else used to be.
 */

/** The widget id, and the status key the bridge owns on this extension's behalf. */
export const AGENT_NAME_WIDGET_ID = "agent-name";

/**
 * The footer text.
 *
 * pi renders extension statuses as their value alone, joined on one line and
 * sorted by key, so the value has to say what it is: `agent keen-gar-77`.
 */
export function agentNameWidgetText(name: string): string {
	const trimmed = name.trim();
	return trimmed ? `agent ${trimmed}` : "";
}

/** The slice of `pi-footer-widget` this extension relies on. */
export interface FooterWidgetBridge {
	registerFooterWidget(
		ctx: unknown,
		widget: {
			id: string;
			render: () => string;
			selfColorize?: boolean;
			layout?: { placement?: string; priority?: number };
		},
	): FooterWidgetHandle;
}

/** The slice of a registered widget this extension uses. */
export interface FooterWidgetHandle {
	update(text: string): void;
	dispose(): void;
}

/** The slice of the pi extension context the widget needs. */
export interface FooterWidgetContext {
	hasUI: boolean;
}

/** Resolves the bridge, or `undefined` when it is not available. */
export type FooterBridgeLoader = () => Promise<Partial<FooterWidgetBridge> | undefined>;

/**
 * Load `pi-footer-widget`, treating any failure as "not installed".
 *
 * The specifier is a variable so the import neither forces the dependency to
 * exist at build time nor fails when it is absent at run time: a footer widget
 * is a nicety and must never be the reason a session fails to start.
 */
export const loadFooterWidgetBridge: FooterBridgeLoader = async () => {
	const specifier = "pi-footer-widget";
	try {
		return (await import(specifier)) as Partial<FooterWidgetBridge>;
	} catch {
		return undefined;
	}
};

/**
 * Show the agent name in the footer.
 *
 * Returns a handle so the caller can dispose the widget at shutdown, or
 * `undefined` when there is nothing to show it in and nothing was written. A
 * bridge that is missing, fails to load, or throws leaves the footer exactly as
 * it was: this extension adds a name, never a footer.
 */
export async function registerAgentNameWidget(
	ctx: FooterWidgetContext,
	name: string,
	load: FooterBridgeLoader = loadFooterWidgetBridge,
): Promise<FooterWidgetHandle | undefined> {
	const text = agentNameWidgetText(name);
	if (!ctx.hasUI || !text) return undefined;

	const bridge = await load().catch(() => undefined);
	const register = bridge?.registerFooterWidget;
	if (typeof register !== "function") return undefined;

	try {
		return register(ctx, {
			id: AGENT_NAME_WIDGET_ID,
			render: () => text,
			selfColorize: false,
			layout: { placement: "line3", priority: 50 },
		});
	} catch {
		return undefined;
	}
}
