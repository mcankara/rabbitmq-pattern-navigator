// shortcut: only string literals, flat objects of string literals and constants holding them are found
// (no templates, number values, nested objects or class statics), move to the TypeScript compiler API if those are needed.
const NAME = String.raw`[A-Za-z_$][\w$]*`;
const LITERAL = String.raw`(?<quote>['"])(?<string>[^'"\n]+)\k<quote>|(?<object>\{[^{}]*\})`;
const REFERENCE = String.raw`(?<ref>${NAME}(?:\.${NAME})*)(?=\s*[,)])`;
const ARGUMENT = String.raw`(?:<[^()]*?>)?\(\s*(?:${LITERAL}|${REFERENCE})`;
const MATCHERS = [
	{ kind: 'sender', regex: new RegExp(String.raw`\.(?:send|emit)` + ARGUMENT, 'gd') },
	{ kind: 'handler', regex: new RegExp(String.raw`@(?:MessagePattern|EventPattern)` + ARGUMENT, 'gd') },
];
const CONSTANT = new RegExp(String.raw`(?<exported>export\s+)?const\s+(?<name>${NAME})\s*(?::[^=\n]*)?=\s*(?:${LITERAL})`, 'g');
const ENUM = new RegExp(String.raw`(?<exported>export\s+)?(?:const\s+)?enum\s+(?<name>${NAME})\s*\{(?<body>[^{}]*)\}`, 'g');
const MEMBER = new RegExp(String.raw`(?<name>${NAME})\s*=\s*(?<quote>['"])(?<value>[^'"\n]*)\k<quote>`, 'g');
const PROPERTY = /(?<keyQuote>['"]?)(?<key>[\w$]+)\k<keyQuote>\s*:\s*(?<quote>['"])(?<value>[^'"\n]*)\k<quote>\s*,?/g;

const propertiesOf = object => [...object.matchAll(PROPERTY)].map(({ groups }) => [groups.key, groups.value]);

/** NestJS matches object patterns by sorted keys, so `{ b, a }` and `{ a, b }` get the same key here too. */
function objectPattern(object) {
	if (object.slice(1, -1).replace(PROPERTY, '').trim()) return undefined; // some property is not a string literal
	const properties = Object.fromEntries(propertiesOf(object));
	const keys = Object.keys(properties);
	return keys.length ? JSON.stringify(properties, keys.sort()) : undefined;
}

/**
 * Pattern arguments in text: a literal `pattern`, or a `ref` to a constant for the caller to resolve.
 * `start`/`end` is the offset range of the string between the quotes, the whole object, or the reference.
 */
function patternsInText(text) {
	const found = [];
	for (const { kind, regex } of MATCHERS) {
		for (const { groups, indices } of text.matchAll(regex)) {
			const [start, end] = indices.groups.string ?? indices.groups.object ?? indices.groups.ref;
			if (groups.ref) {
				found.push({ kind, ref: groups.ref, start, end });
				continue;
			}
			const pattern = groups.string ?? objectPattern(groups.object);
			if (pattern) found.push({ kind, pattern, start, end });
		}
	}
	return found;
}

/** Constants a pattern can be referenced by: `X` for a string or object, `X.key` for its keys, `Enum.Member`. */
function constantsInText(text) {
	const found = [];
	const add = (name, pattern, exported) => {
		if (pattern) found.push({ name, pattern, exported: Boolean(exported) });
	};
	for (const { groups } of text.matchAll(CONSTANT)) {
		const { exported, name, string, object } = groups;
		add(name, string ?? objectPattern(object), exported);
		if (object) for (const [key, value] of propertiesOf(object)) add(`${name}.${key}`, value, exported);
	}
	for (const { groups } of text.matchAll(ENUM)) {
		for (const member of groups.body.matchAll(MEMBER)) add(`${groups.name}.${member.groups.name}`, member.groups.value, groups.exported);
	}
	return found;
}

module.exports = { constantsInText, patternsInText };
