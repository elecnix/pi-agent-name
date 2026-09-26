/**
 * Agent-name vocabulary and minting.
 *
 * A name is `<adjective>-<animal>-<suffix>`, e.g. `swift-koala-42`. The
 * suffix is always a number in [0, 99], so names stay short and readable.
 *
 * This extension has **no registry and no daemon**: uniqueness rests entirely
 * on the size of the name space. The pools below are therefore deliberately
 * large — see `NAME_SPACE_SIZE` and the collision math in the README.
 */

import { randomInt } from "node:crypto";

/** First segment of a minted name. Lowercase, single words, no hyphens. */
export const ADJECTIVES = [
	"swift", "brave", "crimson", "gentle", "mighty", "silent", "lunar", "solar",
	"rapid", "steady", "bright", "shadow", "frost", "ember", "crystal", "ancient",
	"vivid", "cosmic", "rusty", "golden", "silver", "azure", "amber", "jade",
	"violet", "scarlet", "copper", "iron", "polar", "tidal", "stormy", "zenith",
	"hollow", "lucid", "feral", "noble", "quiet", "bold", "keen", "sage",
	"agile", "alert", "arctic", "bearded", "bitter", "blazing", "blunt", "bronze",
	"burly", "calm", "candid", "careful", "cerulean", "chalky", "cheerful", "chilly",
	"civil", "clever", "cloudy", "cobalt", "cold", "coral", "cozy", "crafty",
	"creamy", "curious", "dainty", "daring", "deft", "dewy", "diligent", "doughty",
	"dreamy", "drifting", "dusky", "eager", "early", "earnest", "earthy", "easy",
	"elder", "elegant", "even", "expert", "fair", "fancy", "fearless", "fine",
	"firm", "fleet", "floral", "foggy", "fond", "frank", "free", "fresh",
	"friendly", "frosted", "frugal", "furry", "fuzzy", "gilded", "glassy", "gleaming",
	"glossy", "grand", "grateful", "gray", "great", "green", "hardy", "hasty",
	"hazy", "hearty", "heavenly", "helpful", "hidden", "honest", "honeyed", "humble",
	"icy", "idle", "indigo", "inland", "ivory", "jagged", "jolly", "jovial",
	"joyful", "just", "kind", "kindly", "lanky", "lavish", "lean", "light",
	"lilac", "limber", "lively", "lofty", "lonely", "lucky", "lustrous", "mellow",
	"merry", "mild", "misty", "modest", "mottled", "nimble", "northern", "oaken",
	"ochre", "olive", "opal", "orange", "ornate", "placid", "plain", "playful",
	"pleasant", "plucky", "polished", "precise", "pretty", "prim", "proud", "puffy",
	"quick", "rainy", "regal", "restful", "rich", "ripe", "roaming", "robust",
	"rosy", "royal", "rugged", "russet", "sandy", "sapphire", "scenic", "serene",
	"shaded", "shiny", "shrewd", "silken", "silvery", "sleek", "slender", "smooth",
	"snowy", "soft", "solemn", "spry", "sturdy", "sunny", "supple", "tame",
	"tawny", "tender", "thick", "thin", "tidy", "timely", "tiny", "tolerant",
	"tranquil", "trusty", "twilight", "umber", "velvet", "verdant", "vintage", "warm",
	"wavy", "weathered", "western", "whispering", "wild", "windy", "wintry", "wiry",
	"witty", "woven", "youthful", "zealous", "zesty",
] as const;

/** Second segment of a minted name. Lowercase, single words, no hyphens. */
export const ANIMALS = [
	"koala", "shark", "eagle", "panda", "dragon", "falcon", "otter", "wolf",
	"raven", "bear", "tiger", "lynx", "fox", "hawk", "orca", "crane",
	"viper", "badger", "heron", "lemur", "gecko", "ibis", "cobra", "sloth",
	"bison", "zebra", "civet", "tapir", "quail", "wren", "newt", "tahr",
	"okapi", "serval", "grouse", "condor", "marlin", "gar", "skua", "tern",
	"adder", "alpaca", "antelope", "armadillo", "baboon", "beetle", "beluga", "beaver",
	"boa", "bobcat", "buffalo", "bullfrog", "bumblebee", "camel", "caribou", "caracal",
	"cassowary", "cheetah", "chimp", "chinchilla", "chipmunk", "clam", "cougar", "coyote",
	"crab", "cricket", "crow", "cuckoo", "deer", "dingo", "dodo", "dolphin",
	"donkey", "dove", "dragonfly", "duck", "dunnart", "eel", "egret", "elk",
	"emu", "ermine", "ferret", "finch", "firefly", "flamingo", "flounder", "gazelle",
	"gibbon", "giraffe", "goat", "goose", "gopher", "gorilla", "grebe", "gull",
	"hamster", "hare", "harrier", "hedgehog", "hippo", "hornet", "hound", "hummingbird",
	"hyena", "ibex", "iguana", "impala", "jackal", "jackdaw", "jaguar", "jay",
	"jellyfish", "kangaroo", "kestrel", "kingfisher", "kiwi", "kudu", "ladybug", "lamprey",
	"lark", "leopard", "lion", "lizard", "llama", "lobster", "locust", "loon",
	"macaw", "mackerel", "magpie", "mallard", "mammoth", "manatee", "mandrill", "mantis",
	"marmot", "marten", "mastiff", "meerkat", "mink", "minnow", "mole", "mongoose",
	"monkey", "moose", "mosquito", "moth", "mouse", "mule", "muskrat", "narwhal",
	"nightingale", "ocelot", "octopus", "opossum", "orangutan", "oriole", "osprey", "ostrich",
	"owl", "ox", "oyster", "panther", "parrot", "peacock", "pelican", "penguin",
	"pheasant", "piglet", "pigeon", "pike", "piranha", "platypus", "porcupine", "porpoise",
	"puma", "python", "quokka", "rabbit", "raccoon", "ram", "rat", "rattlesnake",
	"reindeer", "rhino", "robin", "rooster", "salamander", "salmon", "sardine", "scorpion",
	"seahorse", "seal", "sheep", "shrew", "shrimp", "skunk", "snail", "snake",
	"sparrow", "spider", "sponge", "squid", "squirrel", "starfish", "stoat", "stork",
	"swan", "tadpole", "termite", "toad", "toucan", "trout", "tuna", "turkey",
	"turtle", "urchin", "vulture", "wallaby", "walrus", "warthog", "wasp", "weasel",
	"whale", "wombat", "woodpecker", "worm", "yak",
] as const;

/**
 * Number of suffix values: `0` through `99`.
 *
 * The random suffix is what keeps two draws from the same adjective/animal pair
 * apart, so it is part of the name-space size rather than decoration.
 */
export const SUFFIX_COUNT = 100;

/** How many distinct names the vocabulary can produce. */
export const NAME_SPACE_SIZE = ADJECTIVES.length * ANIMALS.length * SUFFIX_COUNT;

/** Draws an integer in `[0, max)`. Injected in tests for deterministic names. */
export type RandomSource = (max: number) => number;

/** Default source: crypto-backed, so names are not guessable or seeded. */
const cryptoRandomSource: RandomSource = (max) => randomInt(0, max);

export const MAX_MINT_ATTEMPTS = 10;

/**
 * Draw an index in `[0, max)`.
 *
 * The source is injectable, so it must not be able to produce a name the rest
 * of the extension would reject. A draw that is negative, fractional, past the
 * bound, or not a number at all falls back to `0`, rather than indexing to
 * `undefined` (which renders as the literal text `undefined`) or producing a
 * suffix such as `--1`.
 */
function drawIndex(random: RandomSource, max: number): number {
	const value = random(max);
	return Number.isInteger(value) && value >= 0 && value < max ? value : 0;
}

/**
 * Mint a name, e.g. `swift-koala-42`.
 *
 * Always returns a vocabulary name in `word-word-number` form, whatever the
 * source returns.
 *
 * @param random - integer source in `[0, max)`; defaults to `crypto.randomInt`.
 */
export function generateName(random: RandomSource = cryptoRandomSource): string {
	const adjective = ADJECTIVES[drawIndex(random, ADJECTIVES.length)]!;
	const animal = ANIMALS[drawIndex(random, ANIMALS.length)]!;
	const suffix = drawIndex(random, SUFFIX_COUNT);
	return `${adjective}-${animal}-${suffix}`;
}

/**
 * Mint a name that is not in `taken`.
 *
 * `taken` is a caller-supplied set — for example the names already recorded in
 * the current session file. This extension keeps no process-wide registry, so
 * the set is usually empty and re-rolling is a courtesy rather than a
 * guarantee. The last draw is returned even when every attempt collided: a
 * duplicate name is better than starting without one.
 *
 * @param taken - names to avoid; may be empty.
 * @param random - integer source in `[0, max)`.
 * @param maxAttempts - draw limit (default 10).
 */
export function pickFreshAgentName(
	taken: ReadonlySet<string> = new Set(),
	random: RandomSource = cryptoRandomSource,
	maxAttempts: number = MAX_MINT_ATTEMPTS,
): string {
	let name = generateName(random);
	for (let attempt = 1; attempt < maxAttempts && taken.has(name); attempt++) {
		name = generateName(random);
	}
	return name;
}
