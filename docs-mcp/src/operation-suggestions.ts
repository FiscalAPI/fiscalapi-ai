const MAX_SUGGESTIONS = 5;
const MIN_SHARED_PREFIX = 3;

export function suggestOperationIds(operationIds: readonly string[], input: string): string[] {
  const needle = input.trim().toLowerCase();
  if (needle === '') return [];
  const substringMatches = idsContaining(operationIds, needle);
  const suggestions = substringMatches.length > 0 ? substringMatches : idsSharingLongestPrefix(operationIds, needle);
  return suggestions.slice(0, MAX_SUGGESTIONS);
}

function idsContaining(operationIds: readonly string[], needle: string): string[] {
  const startsWithNeedle = (id: string): boolean => id.toLowerCase().startsWith(needle);
  return [
    ...operationIds.filter(startsWithNeedle),
    ...operationIds.filter((id) => !startsWithNeedle(id) && id.toLowerCase().includes(needle)),
  ];
}

function idsSharingLongestPrefix(operationIds: readonly string[], needle: string): string[] {
  const candidates = operationIds.map((id) => ({
    id,
    sharedPrefix: sharedPrefixLength(id.toLowerCase(), needle),
    lengthGap: Math.abs(id.length - needle.length),
  }));
  const longest = Math.max(0, ...candidates.map((candidate) => candidate.sharedPrefix));
  if (longest < MIN_SHARED_PREFIX) return [];
  return candidates
    .filter((candidate) => candidate.sharedPrefix === longest)
    .sort((a, b) => a.lengthGap - b.lengthGap)
    .map((candidate) => candidate.id);
}

function sharedPrefixLength(a: string, b: string): number {
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length]) length++;
  return length;
}
