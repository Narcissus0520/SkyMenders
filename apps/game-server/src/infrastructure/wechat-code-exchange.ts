import { ApiError } from "../http/api-error.js";
import type { WechatCodeExchange } from "../core/contracts.js";

export class HttpWechatCodeExchange implements WechatCodeExchange {
  public constructor(
    private readonly appId: string,
    private readonly appSecret: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  public async exchange(code: string): Promise<{ readonly openId: string }> {
    const query = new URLSearchParams({
      appid: this.appId,
      secret: this.appSecret,
      js_code: code,
      grant_type: "authorization_code",
    });
    let response: Response;
    try {
      response = await this.request(
        `https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`,
        {
          signal: AbortSignal.timeout(5_000),
        },
      );
    } catch {
      throw new ApiError(503, "WECHAT_UNAVAILABLE", "WeChat login is temporarily unavailable");
    }
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok || typeof body.openid !== "string" || body.openid.length === 0)
      throw new ApiError(401, "WECHAT_CODE_INVALID", "The WeChat login code was rejected");
    return { openId: body.openid };
  }
}
