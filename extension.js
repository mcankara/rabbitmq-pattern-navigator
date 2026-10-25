const vscode = require('vscode');

const { patternsInText } = require('./patterns');

const SOURCES = '**/*.ts';
const SKIPPED = '**/{node_modules,dist}/**';

/** File uri → patterns found in it. */
const index = new Map();

function positionAt(text, offset) {
	const before = text.slice(0, offset);
	return new vscode.Position(before.split('\n').length - 1, offset - before.lastIndexOf('\n') - 1);
}

async function indexFile(uri) {
	if (uri.path.endsWith('.spec.ts') || /\/(node_modules|dist)\//.test(uri.path)) return;

	let text;
	try {
		text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
	} catch {
		index.delete(uri.toString());
		return;
	}

	const entries = patternsInText(text).map(({ kind, pattern, start, end }) => ({
		kind,
		pattern,
		location: new vscode.Location(uri, new vscode.Range(positionAt(text, start), positionAt(text, end))),
	}));
	if (entries.length) index.set(uri.toString(), entries);
	else index.delete(uri.toString());
}

function patternAt(document, position) {
	const offset = document.offsetAt(position);
	return patternsInText(document.getText()).find(({ start, end }) => offset >= start && offset <= end);
}

const counterpart = kind => (kind === 'sender' ? 'handler' : 'sender');

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
	const changed = new vscode.EventEmitter();
	const ready = vscode.workspace
		.findFiles(SOURCES, SKIPPED)
		.then(uris => Promise.all(uris.map(indexFile)))
		.then(() => changed.fire());

	// Picks up saved changes only; unsaved edits are indexed on save.
	const watcher = vscode.workspace.createFileSystemWatcher(SOURCES);
	const reindex = uri => indexFile(uri).then(() => changed.fire());
	watcher.onDidCreate(reindex);
	watcher.onDidChange(reindex);
	watcher.onDidDelete(uri => {
		index.delete(uri.toString());
		changed.fire();
	});

	const selector = { language: 'typescript', scheme: 'file' };
	context.subscriptions.push(
		watcher,
		changed,
		// Ctrl+click: sender → its handlers, handler → its senders.
		vscode.languages.registerDefinitionProvider(selector, {
			async provideDefinition(document, position) {
				const match = patternAt(document, position);
				if (!match) return undefined;
				await ready;
				return locationsOf(match.pattern, counterpart(match.kind));
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
		}),
		// "2 handlers" / "1 sender" above each pattern, opening them in a peek.
		vscode.languages.registerCodeLensProvider(selector, {
			onDidChangeCodeLenses: changed.event,
			async provideCodeLenses(document) {
				await ready;
				const lenses = [];
				for (const { kind, pattern, start, end } of patternsInText(document.getText())) {
					const other = counterpart(kind);
					const locations = locationsOf(pattern, other);
					// No lens without a counterpart: those are mostly res.send(...) and EventEmitter calls.
					if (!locations.length) continue;
					const range = new vscode.Range(document.positionAt(start), document.positionAt(end));
					lenses.push(
						new vscode.CodeLens(range, {
							title: `${locations.length} ${other}${locations.length === 1 ? '' : 's'}`,
							command: 'editor.action.showReferences',
							arguments: [document.uri, range.start, locations],
						})
					);
				}
				return lenses;
			},
		})
	);
}

module.exports = { activate };
