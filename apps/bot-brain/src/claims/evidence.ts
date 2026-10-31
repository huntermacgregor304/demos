import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { literals } from "@/claims/literals";
import { packageRoot } from "@/ingest/resolve";

export type EvidenceHit = { article: string; values: string[] };

export type EvidenceReport = {
  engine: "karpathy-llm-wiki" | "local-fallback";
  suspects: EvidenceHit[];
  errors: EvidenceHit[];
  unreferenced: string[];
  summary: string;
};

export function evidenceScriptPath(): string {
  return path.join(packageRoot(), "vendor", "karpathy-llm-wiki", "scripts", "check_evidence.py");
}

export function runEvidenceCheck(vaultDir: string, articles: string[]): EvidenceReport {
  const script = evidenceScriptPath();
  const result = spawnSync("python3", [script, vaultDir, ...articles], {
    encoding: "utf8",
    cwd: vaultDir,
  });
  if (result.error || result.status !== 0 || !result.stdout?.includes("## Summary")) {
    return localFallback(vaultDir, articles, result.stderr || result.error?.message || "evidence script failed");
  }
  return { engine: "karpathy-llm-wiki", ...parseEvidence(result.stdout) };
}

export function parseEvidence(stdout: string): Omit<EvidenceReport, "engine"> {
  const sections = splitSections(stdout);
  return {
    suspects: parseHits(sections.fidelity ?? ""),
    errors: parseHits(sections.errors ?? ""),
    unreferenced: parseBullets(sections.unreferenced ?? ""),
    summary: (sections.summary ?? "").trim().split("\n")[0] ?? "",
  };
}

function splitSections(stdout: string): Record<string, string> {
  const chunks = stdout.split(/^## /m).slice(1);
  const out: Record<string, string> = {};
  for (const chunk of chunks) {
    const newline = chunk.indexOf("\n");
    const title = (newline === -1 ? chunk : chunk.slice(0, newline)).trim().toLowerCase();
    const body = newline === -1 ? "" : chunk.slice(newline + 1);
    if (title.startsWith("fidelity")) out.fidelity = body;
    else if (title.startsWith("evidence")) out.errors = body;
    else if (title.startsWith("unreferenced")) out.unreferenced = body;
    else if (title.startsWith("summary")) out.summary = body;
  }
  return out;
}

function parseHits(body: string): EvidenceHit[] {
  const hits: EvidenceHit[] = [];
  let current: EvidenceHit | null = null;
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "(none)") continue;
    if (trimmed.startsWith("- ")) {
      if (!current) continue;
      current.values.push(trimmed.slice(2).trim());
      continue;
    }
    current = { article: trimmed, values: [] };
    hits.push(current);
  }
  return hits.filter((hit) => hit.values.length > 0);
}

function parseBullets(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") && line !== "- (none)")
    .map((line) => line.slice(2).trim());
}

function localFallback(vaultDir: string, articles: string[], reason: string): EvidenceReport {
  const suspects: EvidenceHit[] = [];
  for (const article of articles) {
    const file = path.resolve(vaultDir, article);
    const text = readFileSync(file, "utf8");
    const rawTargets = [...text.matchAll(/^>\s*Raw:\s*\[[^\]]*\]\(([^)]+\.md)[^)]*\)/gm)].map((match) => match[1] ?? "");
    if (rawTargets.length === 0) {
      suspects.push({ article, values: ["article has no Raw field"] });
      continue;
    }
    const corpus = rawTargets
      .map((link) => {
        const target = path.resolve(path.dirname(file), link);
        try {
          return readFileSync(target, "utf8");
        } catch {
          return "";
        }
      })
      .join("\n");
    const missing = literals(text).filter((literal) => !corpus.includes(literal));
    if (missing.length) suspects.push({ article, values: missing });
  }
  return {
    engine: "local-fallback",
    suspects,
    errors: [],
    unreferenced: [],
    summary: `local fallback (${reason})`,
  };
}
