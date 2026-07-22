import { createServer } from "node:http";
import type { Server } from "node:http";

export class WorkerHealthServer {
  readonly #server: Server;
  #ready = false;

  public constructor() {
    this.#server = createServer((request, response) => {
      response.setHeader("content-type", "application/json; charset=utf-8");
      if (request.method === "GET" && request.url === "/health/live") {
        response.statusCode = 200;
        response.end(JSON.stringify({ status: "ok" }));
        return;
      }
      if (request.method === "GET" && request.url === "/health/ready") {
        response.statusCode = this.#ready ? 200 : 503;
        response.end(JSON.stringify({ status: this.#ready ? "ready" : "starting" }));
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ error: "not_found" }));
    });
  }

  public listen(host: string, port: number): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      const onError = (error: Error): void => {
        reject(error);
      };
      this.#server.once("error", onError);
      this.#server.listen(port, host, () => {
        this.#server.off("error", onError);
        resolvePromise();
      });
    });
  }

  public markReady(): void {
    this.#ready = true;
  }

  public port(): number {
    const address = this.#server.address();
    if (address === null || typeof address === "string") throw new Error("health server is closed");
    return address.port;
  }

  public close(): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      this.#server.close((error) => {
        if (error === undefined) resolvePromise();
        else reject(error);
      });
    });
  }
}
