const vscode = require('vscode');

const { patternsInLine } = require('./patterns');

const SOURCES = '**/*.ts';
const SKIPPED = '**/{node_modules,dist}/**';

/** File uri → pattern literals found in it. */
const index = new Map();

async function indexFile(uri) {
	if (uri.path.endsWith('.spec.ts') || /\/(node_modules|dist)\//.test(uri.path)) return;

	let text;
	try {
		text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
	} catch {
		index.delete(uri.toString());
		return;
	}

	const entries = [];
	text.split('\n').forEach((line, lineNumber) => {
		for (const { kind, pattern, start, end } of patternsInLine(line)) {
			const range = new vscode.Range(lineNumber, start, lineNumber, end);
			entries.push({ kind, pattern, location: new vscode.Location(uri, range) });
		}
	});
	if (entries.length) index.set(uri.toString(), entries);
	else index.delete(uri.toString());
}

function patternAt(document, position) {
	return patternsInLine(document.lineAt(position.line).text).find(
		({ start, end }) => position.character >= start && position.character <= end
	);
}

function locationsOf(pattern, kind) {
	const locations = [];
	for (const entries of index.values()) {
		for (const entry of entries) {
			if (entry.pattern === pattern && (!kind || entry.kind === kind)) locations.push(entry.location);
		}
	}
	return locations;
}

function activate(context) {
	const ready = vscode.workspace.findFiles(SOURCES, SKIPPED).then(uris => Promise.all(uris.map(indexFile)));

	// Picks up saved changes only; unsaved edits are indexed on save.
	const watcher = vscode.workspace.createFileSystemWatcher(SOURCES);
	watcher.onDidCreate(indexFile);
	watcher.onDidChange(indexFile);
	watcher.onDidDelete(uri => index.delete(uri.toString()));

	const selector = { language: 'typescript', scheme: 'file' };
	context.subscriptions.push(
		watcher,
		// Ctrl+click: sender → its handlers, handler → its senders.
		vscode.languages.registerDefinitionProvider(selector, {
			async provideDefinition(document, position) {
				const match = patternAt(document, position);
				if (!match) return undefined;
				await ready;
				return locationsOf(match.pattern, match.kind === 'sender' ? 'handler' : 'sender');
			},
		}),
		// Shift+F12: every sender and handler of the pattern.
		vscode.languages.registerReferenceProvider(selector, {
			async provideReferences(document, position) {
				const match = patternAt(document, position);
				if (!match) return undefined;
				await ready;
				return locationsOf(match.pattern);
			},
		})
	);
}

module.exports = { activate };
