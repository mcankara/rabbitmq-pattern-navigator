// shortcut: only single-line string literal patterns are found (no consts, templates or wrapped calls),
// move to the TypeScript compiler API if those are needed.
const MATCHERS = [
	{ kind: 'sender', regex: /\.(?:send|emit)\(\s*(['"])([^'"]+)\1/g },
	{ kind: 'handler', regex: /@(?:MessagePattern|EventPattern)\(\s*(['"])([^'"]+)\1/g },
];

/** Pattern literals on a line; `start`/`end` is the column range of the text between the quotes. */
function patternsInLine(line) {
	const found = [];
	for (const { kind, regex } of MATCHERS) {
		for (const match of line.matchAll(regex)) {
			const end = match.index + match[0].length - 1;
			found.push({ kind, pattern: match[2], start: end - match[2].length, end });
		}
	}
	return found;
}

module.exports = { patternsInLine };
