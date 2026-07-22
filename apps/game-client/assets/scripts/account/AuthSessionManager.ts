import { sessionResponseSchema } from "@skymenders/protocol";
import type { SessionResponse } from "@skymenders/protocol";

import type { PlatformAdapter } from "../platform/platform-adapter.js";

const REFRESH_TOKEN_KEY = "skymenders.session.refresh.v1";

export interface JsonRequest {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

export interface JsonResponse {
  readonly status: number;
  readonly body: unknown;
}

export interface JsonTransport {
  request(input: JsonRequest): Promise<JsonResponse>;
}

export class AuthSessionManager {
  #session: SessionResponse | null = null;

  public constructor(
    private readonly platform: PlatformAdapter,
    private readonly transport: JsonTransport,
  ) {}

  public accessToken(): string | null {
    return this.#session?.accessToken ?? null;
  }

  public accountId(): string | null {
    return this.#session?.accountId ?? null;
  }

  public async login(): Promise<SessionResponse> {
    const code = await this.platform.requestLoginCode();
    const response = await this.transport.request({
      method: "POST",
      path: "/v1/auth/wechat",
      body: {
        code,
        deviceKind: this.platform.capabilities.kind === "wechat" ? "wechat" : "unknown",
      },
    });
    return this.acceptSession(response);
  }

  public async restore(): Promise<SessionResponse | null> {
    const refreshToken = await this.platform.readStorage(REFRESH_TOKEN_KEY);
    if (refreshToken === null || refreshToken.length === 0) return null;
    try {
      const response = await this.transport.request({
        method: "POST",
        path: "/v1/auth/refresh",
        body: { refreshToken },
      });
      return await this.acceptSession(response);
    } catch {
      await this.platform.writeStorage(REFRESH_TOKEN_KEY, "");
      this.#session = null;
      return null;
    }
  }

  public async refresh(): Promise<SessionResponse> {
    const refreshToken = this.#session?.refreshToken;
    if (refreshToken === undefined) throw new Error("no active session can be refreshed");
    const response = await this.transport.request({
      method: "POST",
      path: "/v1/auth/refresh",
      body: { refreshToken },
    });
    return this.acceptSession(response);
  }

  public async logout(): Promise<void> {
    const refreshToken =
      this.#session?.refreshToken ?? (await this.platform.readStorage(REFRESH_TOKEN_KEY));
    try {
      if (refreshToken !== null && refreshToken.length > 0)
        await this.transport.request({
          method: "POST",
          path: "/v1/auth/logout",
          body: { refreshToken },
        });
    } finally {
      this.#session = null;
      await this.platform.writeStorage(REFRESH_TOKEN_KEY, "");
    }
  }

  public async authorizedRequest(input: JsonRequest): Promise<JsonResponse> {
    const token = this.#session?.accessToken;
    if (token === undefined) throw new Error("authentication is required");
    let response = await this.transport.request({
      ...input,
      headers: { ...input.headers, authorization: `Bearer ${token}` },
    });
    if (response.status !== 401) return response;
    const session = await this.refresh();
    response = await this.transport.request({
      ...input,
      headers: { ...input.headers, authorization: `Bearer ${session.accessToken}` },
    });
    return response;
  }

  private async acceptSession(response: JsonResponse): Promise<SessionResponse> {
    if (response.status < 200 || response.status >= 300)
      throw new Error(`session request failed with status ${response.status}`);
    const session = sessionResponseSchema.parse(response.body);
    await this.platform.writeStorage(REFRESH_TOKEN_KEY, session.refreshToken);
    this.#session = session;
    return session;
  }
}
