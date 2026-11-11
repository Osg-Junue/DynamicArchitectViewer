/** Returns the closest candidate within an edit distance of 2 (or 1 for <=3-char names), if any. */
export function closestMatch(input: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = 3;
  const normalized = input.toLowerCase();
  for (const candidate of candidates) {
    const maxDistance = candidate.length <= 3 ? 1 : 2;
    const d = levenshtein(normalized, candidate);
    if (d <= maxDistance && d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] ?? 0;
    let left = i;
    prev[0] = left;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      left = Math.min(up + 1, left + 1, diag + cost);
      prev[j] = left;
      diag = up;
    }
  }
  return prev[b.length] ?? 0;
}
