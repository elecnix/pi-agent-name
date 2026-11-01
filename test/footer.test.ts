/**
 * Tests for the agent-name footer widget.
 *
 * Run: node --experimental-strip-types --test test/footer.test.ts
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
	AGENT_NAME_WIDGET_ID,
	type FooterBridgeLoader,
	type FooterWidgetBridge,
	agentNameWidgetText,
	loadFooterWidgetBridge,
	registerAgentNameWidget,
} from "../agent-name/footer.ts";

type Registered = {
	id: string;
	render: () => string;
	selfColorize?: boolean;
	layout?: { placement?: string; priority?: number };
};

/** A context that records every setStatus call, like the stock footer would. */
function makeContext(hasUI = true) {
	const statuses: Array<[string, string | undefined]> = [];
	return {
		ctx: {
			hasUI,
			ui: {
				setStatus(key: string, text: string | undefined) {
					statuses.push([key, text]);
				},
			},
		},
		statuses,
	};
}

/** A bridge that records the widget it was handed and returns a fake handle. */
function makeBridge(): {
	bridge: Partial<FooterWidgetBridge>;
	registered: Registered[];
	disposed: () => number;
} {
	const registered: Registered[] = [];
	let disposeCount = 0;
	const bridge: Partial<FooterWidgetBridge> = {
		registerFooterWidget(_ctx, widget) {
			registered.push(widget);
			return {
				update() {},
				dispose() {
					disposeCount += 1;
				},
			};
		},
	};
	return { bridge, registered, disposed: () => disposeCount };
}

const bridgeLoader =
	(bridge: Partial<FooterWidgetBridge> | undefined): FooterBridgeLoader =>
	async () =>
		bridge;

const NAME = "keen-gar-77";
const EXPECTED_TEXT = `agent ${NAME}`;

const failingLoader: FooterBridgeLoader = async () => {
	throw new Error("module not found");
};

const throwingBridge = {
	registerFooterWidget() {
		throw new Error("composer exploded");
	},
} as unknown as Partial<FooterWidgetBridge>;

/** Register against a fresh context and report what the footer was told. */
async function register(load: FooterBridgeLoader, hasUI = true, name = NAME) {
	const { ctx, statuses } = makeContext(hasUI);
	const handle = await registerAgentNameWidget(ctx, name, load);
	return { handle, statuses };
}

describe("agentNameWidgetText", () => {
	it("says what the value is, because pi renders values without their keys", () => {
		assert.equal(agentNameWidgetText("keen-gar-77"), "agent keen-gar-77");
	});

	it("trims the name", () => {
		assert.equal(agentNameWidgetText("  keen-gar-77  "), "agent keen-gar-77");
	});

	it("shows nothing for a blank name", () => {
		assert.equal(agentNameWidgetText(""), "");
		assert.equal(agentNameWidgetText("   "), "");
	});
});

describe("registerAgentNameWidget", () => {
	it("registers with pi-footer-widget when the bridge is available", async () => {
		const { ctx, statuses } = makeContext();
		const { bridge, registered } = makeBridge();

		const handle = await registerAgentNameWidget(ctx, NAME, bridgeLoader(bridge));

		assert.ok(handle);
		assert.equal(registered.length, 1);
		assert.equal(registered[0]?.id, AGENT_NAME_WIDGET_ID);
		// The text comes from the identity, never from the mutable session name,
		// so a user rename cannot change or hide it.
		assert.equal(registered[0]?.render(), EXPECTED_TEXT);
		// The bridge owns emission, so the extension does not also write a status.
		assert.deepEqual(statuses, []);
	});

	const degraded: Array<[string, FooterBridgeLoader]> = [
		["the bridge is not installed", bridgeLoader(undefined)],
		["the bridge fails to load", failingLoader],
		["the bridge throws while registering", bridgeLoader(throwingBridge)],
	];

	for (const [scenario, load] of degraded) {
		it(`falls back to setStatus when ${scenario}`, async () => {
			const { handle, statuses } = await register(load);

			assert.ok(handle);
			assert.deepEqual(statuses, [[AGENT_NAME_WIDGET_ID, EXPECTED_TEXT]]);
		});
	}

	const silent: Array<[string, boolean, string]> = [
		["without a UI", false, NAME],
		["for a blank name", true, "  "],
	];

	for (const [scenario, hasUI, name] of silent) {
		it(`does nothing ${scenario}`, async () => {
			const { bridge, registered } = makeBridge();
			const { handle, statuses } = await register(bridgeLoader(bridge), hasUI, name);

			assert.equal(handle, undefined);
			assert.deepEqual(statuses, []);
			assert.equal(registered.length, 0);
		});
	}

	it("clears the status when the fallback handle is disposed", async () => {
		const { handle, statuses } = await register(bridgeLoader(undefined));
		handle?.dispose();

		assert.deepEqual(statuses.at(-1), [AGENT_NAME_WIDGET_ID, undefined]);
	});

	it("delegates disposal to the bridge handle", async () => {
		const { ctx } = makeContext();
		const { bridge, disposed } = makeBridge();

		const handle = await registerAgentNameWidget(ctx, NAME, bridgeLoader(bridge));
		handle?.dispose();

		assert.equal(disposed(), 1);
	});
});

describe("loadFooterWidgetBridge", () => {
	it("never throws, whether or not the dependency is installed", async () => {
		const bridge = await loadFooterWidgetBridge();
		if (bridge !== undefined) {
			assert.equal(typeof bridge.registerFooterWidget, "function");
		}
	});
});
