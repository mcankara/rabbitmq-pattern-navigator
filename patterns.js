// shortcut: only string literals and flat objects of string literals are found (no consts, templates or number values),
// move to the TypeScript compiler API if those are needed.
const ARGUMENT = String.raw`(?:<[^()]*?>)?\(\s*(?:(['"])([^'"\n]+)\1|\{([^{}]*)\})`;
const MATCHERS = [
	{ kind: 'sender', regex: new RegExp(String.raw`\.(?:send|emit)` + ARGUMENT, 'g') },
	{ kind: 'handler', regex: new RegExp(String.raw`@(?:MessagePattern|EventPattern)` + ARGUMENT, 'g') },
];
const PROPERTY = /(['"]?)(\w+)\1\s*:\s*(['"])([^'"\n]*)\3\s*,?/g;

/** NestJS matches object patterns by sorted keys, so `{ b, a }` and `{ a, b }` get the same key here too. */
function objectPattern(body) {
	if (body.replace(PROPERTY, '').trim()) return undefined; // some property is not a string literal
	const object = Object.fromEntries([...body.matchAll(PROPERTY)].map(property => [property[2], property[4]]));
	const keys = Object.keys(object);
	return keys.length ? JSON.stringify(object, keys.sort()) : undefined;
}

/** Patterns in text; `start`/`end` is the offset range of the string between the quotes, or of the whole object. */
function patternsInText(text) {
	const found = [];
	for (const { kind, regex } of MATCHERS) {
		for (const match of text.matchAll(regex)) {
			const [whole, , string, body] = match;
			const matchEnd = match.index + whole.length;
			if (string !== undefined) {
				found.push({ kind, pattern: string, start: matchEnd - 1 - string.length, end: matchEnd - 1 });
				continue;
			}
			const pattern = objectPattern(body);
			if (pattern) found.push({ kind, pattern, start: matchEnd - body.length - 2, end: matchEnd });
		}
	}
	return found;
}

module.exports = { patternsInText };
