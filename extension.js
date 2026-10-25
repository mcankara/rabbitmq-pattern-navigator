const vscode = require('vscode');

const { constantsInText, patternsInText } = require('./patterns');

const SOURCES = '**/*.ts';
const SKIPPED = '**/{node_modules,dist}/**';

/** File uri → `entries`: its pattern arguments, `constants`: the pattern constants it declares. */
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

	const entries = patternsInText(text).map(({ kind, pattern, ref, start, end }) => ({
		kind,
		pattern,
		ref,
		location: new vscode.Location(uri, new vscode.Range(positionAt(text, start), positionAt(text, end))),
	}));
	const constants = constantsInText(text);
	if (entries.length || constants.length) index.set(uri.toString(), { entries, constants });
	else index.delete(uri.toString());
}

function exportedConstants() {
	const exported = new Map();
	for (const { constants } of index.values()) {
		for (const constant of constants) if (constant.exported) exported.set(constant.name, constant.pattern);
	}
	return exported;
}

// shortcut: imports are not followed, so a name exported from several files resolves to any one of them;
// follow import paths if that mismatches in practice.
/** The pattern of a literal, or of a reference to a constant in its own file or exported from any file. */
function resolve(match, ownConstants, exported) {
	if (!match.ref) return match.pattern;
	return ownConstants.find(({ name }) => name === match.ref)?.pattern ?? exported.get(match.ref);
}

function patternAt(document, position) {
	const text = document.getText();
	const offset = document.offsetAt(position);
	const match = patternsInText(text).find(({ start, end }) => offset >= start && offset <= end);
	return match && { ...match, pattern: resolve(match, constantsInText(text), exportedConstants()) };
}

const counterpart = kind => (kind === 'sender' ? 'handler' : 'sender');

function locationsOf(pattern, kind) {
	const exported = exportedConstants();
	const locations = [];
	for (const { entries, constants } of index.values()) {
		for (const entry of entries) {
			if ((!kind || entry.kind === kind) && resolve(entry, constants, exported) === pattern) locations.push(entry.location);
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
				await ready;
				const match = patternAt(document, position);
				if (!match?.pattern) return undefined;
				return locationsOf(match.pattern, counterpart(match.kind));
			},
		}),
		// Shift+F12: every sender and handler of the pattern.
		vscode.languages.registerReferenceProvider(selector, {
			async provideReferences(document, position) {
				await ready;
				const match = patternAt(document, position);
				if (!match?.pattern) return undefined;
				return locationsOf(match.pattern);
			},
		}),
		// "2 handlers" / "1 sender" above each pattern, opening them in a peek.
		vscode.languages.registerCodeLensProvider(selector, {
			onDidChangeCodeLenses: changed.event,
			async provideCodeLenses(document) {
				await ready;
				const text = document.getText();
				const constants = constantsInText(text);
				const exported = exportedConstants();
				const lenses = [];
				for (const match of patternsInText(text)) {
					const pattern = resolve(match, constants, exported);
					const other = counterpart(match.kind);
					const locations = pattern ? locationsOf(pattern, other) : [];
					// No lens without a counterpart: those are mostly res.send(...) and EventEmitter calls.
					if (!locations.length) continue;
					const range = new vscode.Range(document.positionAt(match.start), document.positionAt(match.end));
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
