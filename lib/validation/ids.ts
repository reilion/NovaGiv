/**
 * Shape checks for the ids Server Actions receive. Every action is a public
 * POST endpoint, so an argument typed `string` can arrive as anything; these
 * turn a malformed one away before it costs a round trip to the database.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** An optional episode id: absent, or a uuid. */
export function isOptionalUuid(value: unknown): value is string | undefined {
  return value === undefined || value === null || isUuid(value);
}

/** "12" or "2x12" — how watch_later / watch_history name an episode. */
export function isEpisodeRef(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,6}(x\d{1,6})?$/.test(value);
}
