export interface RequestObservation {
  readonly requestId: string;
  readonly traceId: string;
  readonly method: string;
  readonly route: string;
  readonly statusCode: number;
  readonly durationMilliseconds: number;
}

export type StructuredLogSink = (record: Readonly<Record<string, unknown>>) => void;

export class RequestTelemetry {
  readonly #requests = new Map<string, number>();
  #durationMilliseconds = 0;
  #durationSamples = 0;
  #inFlight = 0;

  public constructor(private readonly log: StructuredLogSink = () => undefined) {}

  public begin(): void {
    this.#inFlight += 1;
  }

  public complete(observation: RequestObservation): void {
    this.#inFlight = Math.max(0, this.#inFlight - 1);
    const method = normalizeMethod(observation.method);
    const statusClass = `${Math.floor(observation.statusCode / 100)}xx`;
    const key = `${method}|${statusClass}`;
    this.#requests.set(key, (this.#requests.get(key) ?? 0) + 1);
    this.#durationMilliseconds += observation.durationMilliseconds;
    this.#durationSamples += 1;
    this.log({
      event: "http_request_completed",
      request_id: observation.requestId,
      trace_id: observation.traceId,
      method,
      route: normalizeRoute(observation.route),
      status_code: observation.statusCode,
      duration_ms: Number(observation.durationMilliseconds.toFixed(3)),
    });
  }

  public prometheus(): string {
    const lines = [
      "# HELP skymenders_http_requests_total Completed HTTP requests.",
      "# TYPE skymenders_http_requests_total counter",
    ];
    for (const [key, value] of [...this.#requests.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const [method, statusClass] = key.split("|") as [string, string];
      lines.push(
        `skymenders_http_requests_total{method="${method}",status_class="${statusClass}"} ${value}`,
      );
    }
    lines.push(
      "# HELP skymenders_http_requests_in_flight Requests currently executing.",
      "# TYPE skymenders_http_requests_in_flight gauge",
      `skymenders_http_requests_in_flight ${this.#inFlight}`,
      "# HELP skymenders_http_request_duration_milliseconds_sum Total request duration.",
      "# TYPE skymenders_http_request_duration_milliseconds_sum counter",
      `skymenders_http_request_duration_milliseconds_sum ${this.#durationMilliseconds.toFixed(3)}`,
      "# HELP skymenders_http_request_duration_milliseconds_count Request duration observations.",
      "# TYPE skymenders_http_request_duration_milliseconds_count counter",
      `skymenders_http_request_duration_milliseconds_count ${this.#durationSamples}`,
      "",
    );
    return lines.join("\n");
  }
}

export function traceIdFromHeader(value: string | string[] | undefined, fallback: string): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  const match = candidate?.match(/^00-([a-f0-9]{32})-[a-f0-9]{16}-[0-9a-f]{2}$/i);
  return match?.[1]?.toLowerCase() ?? fallback;
}

function normalizeMethod(method: string): string {
  return /^[A-Z]+$/.test(method) ? method : "OTHER";
}

function normalizeRoute(route: string): string {
  const withoutQuery = route.split("?", 1)[0] ?? "/unknown";
  return withoutQuery.length <= 160 ? withoutQuery : "/oversized";
}
