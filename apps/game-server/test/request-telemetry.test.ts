import { describe, expect, it } from "vitest";

import { RequestTelemetry, traceIdFromHeader } from "../src/observability/request-telemetry.js";

describe("request telemetry", () => {
  it("emits structured privacy-safe records and low-cardinality metrics", () => {
    const logs: Readonly<Record<string, unknown>>[] = [];
    const telemetry = new RequestTelemetry((record) => logs.push(record));
    telemetry.begin();
    telemetry.complete({
      requestId: "req-1",
      traceId: "trace-1",
      method: "GET",
      route: "/v1/profile?secret=no",
      statusCode: 200,
      durationMilliseconds: 12.3456,
    });
    telemetry.begin();
    telemetry.complete({
      requestId: "req-2",
      traceId: "trace-2",
      method: "invalid method",
      route: `/${"x".repeat(200)}`,
      statusCode: 503,
      durationMilliseconds: 7,
    });

    expect(logs).toEqual([
      expect.objectContaining({ method: "GET", route: "/v1/profile", duration_ms: 12.346 }),
      expect.objectContaining({ method: "OTHER", route: "/oversized", status_code: 503 }),
    ]);
    const metrics = telemetry.prometheus();
    expect(metrics).toContain('skymenders_http_requests_total{method="GET",status_class="2xx"} 1');
    expect(metrics).toContain(
      'skymenders_http_requests_total{method="OTHER",status_class="5xx"} 1',
    );
    expect(metrics).toContain("skymenders_http_requests_in_flight 0");
    expect(metrics).toContain("skymenders_http_request_duration_milliseconds_count 2");
  });

  it("accepts only a valid W3C trace identifier", () => {
    const valid = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    expect(traceIdFromHeader(valid, "fallback")).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(traceIdFromHeader([valid], "fallback")).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(traceIdFromHeader("invalid", "fallback")).toBe("fallback");
    expect(traceIdFromHeader(undefined, "fallback")).toBe("fallback");
  });
});
