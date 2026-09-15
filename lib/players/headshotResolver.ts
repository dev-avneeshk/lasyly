/**
 * Normalize a player name for provider matching.
 *
 * ESPN commonly omits the diacritics used by Basketball Reference, so names
 * such as "Nikola Jokić" and "Nikola Jokic" must resolve to the same identity.
 */
export function normalizeHeadshotName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Compare a canonical player name with a provider name without accepting
 * lookalike players. Exact normalized names are preferred; a meaningful
 * multi-token provider name may also match a canonical name with a suffix.
 */
export function isHeadshotNameMatch(requestedName: string, providerName: string): boolean {
  const requested = normalizeHeadshotName(requestedName)
  const provider = normalizeHeadshotName(providerName)

  if (!requested || !provider) return false
  if (requested === provider) return true

  const [shorter, longer] = requested.length <= provider.length
    ? [requested, provider]
    : [provider, requested]
  const shorterTokens = shorter.split(" ")

  return shorter.length >= 8
    && shorterTokens.length >= 2
    && ` ${longer} `.includes(` ${shorter} `)
}

/** Use the normalized surname as a broad DB candidate query. */
export function getHeadshotLookupTerm(playerName: string): string {
  const normalized = normalizeHeadshotName(playerName)
  const tokens = normalized.split(" ").filter(Boolean)
  return tokens.at(-1) ?? normalized
}
