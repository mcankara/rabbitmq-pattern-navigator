# RabbitMQ Pattern Navigator

Jump between the sender and the handler of a NestJS RabbitMQ message pattern.

- **Ctrl+click** (Cmd+click on macOS) the pattern in `client.send('x')` / `client.emit('x')` to go to its `@MessagePattern('x')` / `@EventPattern('x')` handler, or click the pattern in a handler to go to its senders. Several matches open a peek list.
- **Shift+F12** on a pattern lists every sender and handler.

All `.ts` files in the workspace are scanned except `*.spec.ts`, `node_modules` and `dist`. Only single-line string literal patterns are found, and unsaved edits show up after saving.

## Build and install locally

```sh
npm test
npm run package
```

Then in VS Code: Extensions → `…` → **Install from VSIX…**, pick the generated `.vsix`, and run **Developer: Reload Window**. Press F5 in this folder to try it without installing.
