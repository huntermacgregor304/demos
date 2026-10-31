// Specific-number and ISO-date rules adapted from
// vendor/karpathy-llm-wiki/scripts/check_evidence.py (MIT).
// Small plain integers are ignored. Suffixed, grouped, and dotted numbers count.

const DATE_RE = /\d{4}-\d{2}(?:-\d{2})?/g;
const NUMBER_TOKEN_RE =
  /(?:\d{1,3}(?:,\d{3})+(?:\.\d+)*(?:\s*[KMB%](?![A-Za-z]))?|\d+(?:\.\d+)*(?:\s*[KMB%](?![A-Za-z]))?)(?![A-Za-z])/g;
const SUFFIX_RE = /[KMB%]$/;

function keepNumber(token: string): boolean {
  if (SUFFIX_RE.test(token) || token.includes(",") || token.includes(".")) return true;
  return token.length >= 4;
}

export function literals(text: string): string[] {
  const dates = [...text.matchAll(DATE_RE)].map((match) => match[0]);
  let stripped = text;
  for (const date of dates) stripped = stripped.replace(date, " ".repeat(date.length));
  const numbers: string[] = [];
  for (const match of stripped.matchAll(NUMBER_TOKEN_RE)) {
    const value = match[0].trim();
    if (value && keepNumber(value)) numbers.push(value);
  }
  return [...dates, ...numbers];
}

export function missingLiteral(statement: string, corpus: string): string | null {
  for (const literal of literals(statement)) {
    if (!corpus.includes(literal)) return literal;
  }
  return null;
}
