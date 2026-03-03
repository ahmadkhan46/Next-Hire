export type QueueMode = "memory" | "redis";

let warnedInvalidMode = false;

export function getQueueMode(): QueueMode {
  const raw = (process.env.QUEUE_MODE ?? "memory").trim().toLowerCase();
  if (raw === "redis") return "redis";
  if (raw === "memory" || raw === "") return "memory";

  if (!warnedInvalidMode) {
    warnedInvalidMode = true;
    console.warn(
      `Invalid QUEUE_MODE="${process.env.QUEUE_MODE}". Falling back to "memory".`
    );
  }
  return "memory";
}

export function getQueueModeWarnings() {
  const warnings: string[] = [];
  if (process.env.NODE_ENV === "production" && getQueueMode() === "memory") {
    warnings.push(
      "QUEUE_MODE=memory in production. Background jobs are process-local; use redis mode for horizontal scaling."
    );
  }
  return warnings;
}
