import { useEffect, useState } from "react";
import { WikiGraph } from "@/graph/WikiGraph";
import type { GraphData } from "@/types";

export function App() {
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/graph")
      .then(async (response) => {
        if (!response.ok) throw new Error("The vault graph is not ready.");
        return (await response.json()) as GraphData;
      })
      .then(setData)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "The vault graph is not ready.");
      });
  }, []);

  if (error) {
    return (
      <div className="brain-shell grid h-full place-items-center p-8 text-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan">Memory</p>
          <h1 className="mt-2 font-mono text-2xl text-foreground">Bot Brain</h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">{error} Run `bun run brain` in apps/bot-brain.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="brain-shell grid h-full place-items-center">
        <p className="font-mono text-sm tracking-[0.2em] text-cyan">Loading the vault…</p>
      </div>
    );
  }

  return (
    <WikiGraph
      nodes={data.nodes}
      edges={data.edges}
      notes={data.notes}
      summary={data.summary}
      title="Bot Brain"
    />
  );
}
