export function businessDateAt(instant: Date, timeZone: string): string {
  const parts = zonedParts(instant, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function nextBusinessReset(instant: Date, timeZone: string): Date {
  const current = zonedParts(instant, timeZone);
  const nextLocalDay = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
  const targetUtc = Date.UTC(
    nextLocalDay.getUTCFullYear(),
    nextLocalDay.getUTCMonth(),
    nextLocalDay.getUTCDate(),
  );
  let candidate = targetUtc - zoneOffsetMilliseconds(instant, timeZone);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    candidate = targetUtc - zoneOffsetMilliseconds(new Date(candidate), timeZone);
  }
  return new Date(candidate);
}

function zoneOffsetMilliseconds(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - Math.trunc(instant.getTime() / 1_000) * 1_000;
}

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  if (!Number.isFinite(instant.getTime())) throw new RangeError("business instant is invalid");
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const { year, month, day, hour, minute, second } = values;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    throw new Error("business time zone could not be resolved");
  }
  return { year, month, day, hour, minute, second };
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}
