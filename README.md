# RabbitMQ Pattern Navigator

Jump between the sender and the handler of a NestJS RabbitMQ message pattern.

- **Ctrl+click** (Cmd+click on macOS) the pattern in `client.send('x')` / `client.emit('x')` to go to its `@MessagePattern('x')` / `@EventPattern('x')` handler, or click the pattern in a handler to go to its senders. Several matches open a peek list.
- **Shift+F12** on a pattern lists every sender and handler.
- A **CodeLens** above each pattern shows how many handlers or senders it has; click it to peek them.

Patterns can be strings (`'order.created'`) or objects of strings (`{ cmd: 'sum' }`, matched regardless of key order), and calls may be wrapped over several lines. They can also be constants holding those:

```ts
export const ORDER_CREATED = 'order.created';             // send(ORDER_CREATED, ...)
export const PATTERNS = { GET_USER: 'get-user' } as const; // send(PATTERNS.GET_USER, ...)
export enum Patterns { GetUser = 'get-user' }               // @MessagePattern(Patterns.GetUser)
const pattern = { cmd: 'sum' };                            // send(pattern, ...) in the same file
```

A constant from another file must be exported. Imports are not followed, so the same name exported from two files with different values may resolve to either. Nested objects and static class members are not found.

All `.ts` files in the workspace are scanned except `*.spec.ts`, `node_modules` and `dist`. Unsaved edits show up after saving.

## Build and install locally

```sh
npm test
npm run package
```

Then in VS Code: Extensions → `…` → **Install from VSIX…**, pick the generated `.vsix`, and run **Developer: Reload Window**. Press F5 in this folder to try it without installing.
