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

		const handle = await registerAgentNameWidget(ctx, "keen-gar-77", bridgeLoader(bridge));

		assert.ok(handle);
		assert.equal(registered.length, 1);
		assert.equal(registered[0]?.id, AGENT_NAME_WIDGET_ID);
		// The text comes from the identity, never from the mutable session name,
		// so a user rename cannot change or hide it.
		assert.equal(registered[0]?.render(), "agent keen-gar-77");
		// The bridge owns emission, so the extension does not also write a status.
		assert.deepEqual(statuses, []);
	});

	it("falls back to setStatus when the bridge is not installed", async () => {
		const { ctx, statuses } = makeContext();

		const handle = await registerAgentNameWidget(ctx, "keen-gar-77", bridgeLoader(undefined));

		assert.ok(handle);
		assert.deepEqual(statuses, [[AGENT_NAME_WIDGET_ID, "agent keen-gar-77"]]);
	});

	it("falls back to setStatus when the bridge fails to load", async () => {
		const { ctx, statuses } = makeContext();
		const failing: FooterBridgeLoader = async () => {
			throw new Error("module not found");
		};

		await registerAgentNameWidget(ctx, "keen-gar-77", failing);

		assert.deepEqual(statuses, [[AGENT_NAME_WIDGET_ID, "agent keen-gar-77"]]);
	});

	it("falls back to setStatus when the bridge throws while registering", async () => {
		const { ctx, statuses } = makeContext();
		const broken = {
			registerFooterWidget() {
				throw new Error("composer exploded");
			},
		} as unknown as Partial<FooterWidgetBridge>;

		const handle = await registerAgentNameWidget(ctx, "keen-gar-77", bridgeLoader(broken));

		assert.ok(handle);
		assert.deepEqual(statuses, [[AGENT_NAME_WIDGET_ID, "agent keen-gar-77"]]);
	});

	it("does nothing without a UI", async () => {
		const { ctx, statuses } = makeContext(false);
		const { bridge, registered } = makeBridge();

		const handle = await registerAgentNameWidget(ctx, "keen-gar-77", bridgeLoader(bridge));

		assert.equal(handle, undefined);
		assert.deepEqual(statuses, []);
		assert.equal(registered.length, 0);
	});

	it("does nothing for a blank name", async () => {
		const { ctx, statuses } = makeContext();
		const { bridge, registered } = makeBridge();

		const handle = await registerAgentNameWidget(ctx, "  ", bridgeLoader(bridge));

		assert.equal(handle, undefined);
		assert.deepEqual(statuses, []);
		assert.equal(registered.length, 0);
	});

	it("clears the status when the fallback handle is disposed", async () => {
		const { ctx, statuses } = makeContext();

		const handle = await registerAgentNameWidget(ctx, "keen-gar-77", bridgeLoader(undefined));
		handle?.dispose();

		assert.deepEqual(statuses.at(-1), [AGENT_NAME_WIDGET_ID, undefined]);
	});

	it("delegates disposal to the bridge handle", async () => {
		const { ctx } = makeContext();
		const { bridge, disposed } = makeBridge();

		const handle = await registerAgentNameWidget(ctx, "keen-gar-77", bridgeLoader(bridge));
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
