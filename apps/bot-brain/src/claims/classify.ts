import { missingLiteral } from "@/claims/literals";
import { grounded, stripSourceClause, type Citation } from "@/lib/text";
import type { Claim } from "@/types";

export type CorpusLookup = {
  note: (title: string) => string | null;
  url: (url: string) => string | null;
};

export function classifyStatement(
  noteId: string,
  block: string,
  extra: Citation[],
  lookup: CorpusLookup,
): Claim {
  const parsed = stripSourceClause(block);
  const citations = merge(extra, parsed.citations);
  const statement = parsed.statement;
  const base = { id: `${noteId}:${statement.slice(0, 80)}`, noteId, text: statement };

  if (citations.length === 0) {
    return { ...base, status: "unverified", sourceLabel: "", reason: "no source link" };
  }

  let externalLabel = "";
  let failure = "cited source does not support this claim";
  let failureLabel = labelOf(citations[0]);

  for (const citation of citations) {
    const label = labelOf(citation);
    if (citation.kind === "url") {
      const corpus = lookup.url(citation.url);
      if (corpus === null) {
        externalLabel = citation.url;
        continue;
      }
      const missing = missingLiteral(statement, corpus);
      if (missing) {
        failure = `literal not in the linked source: ${missing}`;
        failureLabel = label;
        continue;
      }
      if (grounded(statement, corpus)) {
        return { ...base, status: "sourced", sourceLabel: label, reason: "supported by the linked source" };
      }
      failureLabel = label;
      continue;
    }

    const corpus = lookup.note(citation.note);
    if (corpus === null) {
      return { ...base, status: "unverified", sourceLabel: label, reason: `broken source link [[${citation.note}]]` };
    }
    const missing = missingLiteral(statement, corpus);
    if (missing) {
      failure = `literal not in the linked source: ${missing}`;
      failureLabel = label;
      continue;
    }
    if (grounded(statement, corpus)) {
      return { ...base, status: "sourced", sourceLabel: label, reason: "supported by the linked source" };
    }
    failureLabel = label;
  }

  if (externalLabel && failure === "cited source does not support this claim") {
    return {
      ...base,
      status: "sourced",
      sourceLabel: externalLabel,
      reason: "external URL was not fetched; the link is the source pointer",
    };
  }

  return { ...base, status: "unverified", sourceLabel: failureLabel, reason: failure };
}

function labelOf(citation: Citation | undefined): string {
  if (!citation) return "";
  return citation.kind === "url" ? citation.url : `[[${citation.note}]]`;
}

function merge(extra: Citation[], parsed: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const citation of [...extra, ...parsed]) {
    const key = citation.kind === "url" ? `u:${citation.url}` : `n:${citation.note}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(citation);
  }
  return out;
}
