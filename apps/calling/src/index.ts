// In Node 22+, globalThis.WebSocket exists but ignores custom headers in its constructor.
// The sarvamai SDK checks `if (typeof WebSocket !== "undefined")`, selecting Node's built-in
// WebSocket which drops the `Api-Subscription-Key` header.
// Deleting it forces the SDK to fall back to the `ws` package in Node runtime.
delete (globalThis as any).WebSocket;

import { startServer } from "./sarwar";

startServer();