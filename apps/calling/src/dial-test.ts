import { dialTestCall } from "./providers/plivo/dial.js";

dialTestCall().catch((err) => {
  console.error("Dial failed:", err);
  process.exit(1);
});
