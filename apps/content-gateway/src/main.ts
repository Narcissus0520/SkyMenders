import { resolve } from "node:path";

import { createContentGateway, assertLoopbackHost } from "./server.js";
import { ContentWorkspace } from "./workspace.js";

const host = process.env.CONTENT_GATEWAY_HOST ?? "127.0.0.1";
const port = Number(process.env.CONTENT_GATEWAY_PORT ?? "4310");
assertLoopbackHost(host);
if (!Number.isInteger(port) || port < 1024 || port > 65_535)
  throw new Error("invalid CONTENT_GATEWAY_PORT");
const rootDirectory = resolve(process.env.CONTENT_WORKSPACE_ROOT ?? process.cwd());
const app = createContentGateway({
  workspace: new ContentWorkspace({ rootDirectory }),
  ...(process.env.CONTENT_GATEWAY_SESSION === undefined
    ? {}
    : { sessionToken: process.env.CONTENT_GATEWAY_SESSION }),
  ...(process.env.CONTENT_SIGNING_SECRET === undefined
    ? {}
    : { signingSecret: process.env.CONTENT_SIGNING_SECRET }),
});
await app.listen({ host, port });
