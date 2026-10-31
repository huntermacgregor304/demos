export type ClaimStatus = "sourced" | "unverified" | "mixed" | "none";

export type GraphNode = {
  id: string;
  title: string;
  group: string;
  claimStatus: ClaimStatus;
  path: string;
};

export type GraphEdge = {
  source: string;
  target: string;
};

export type GraphSummary = {
  notes: number;
  sourced: number;
  unverified: number;
  links: number;
  fixtures: boolean;
};

export type GraphData = {
  generatedAt: string;
  summary: GraphSummary;
  nodes: GraphNode[];
  edges: GraphEdge[];
  notes: Record<string, string>;
};

export type Claim = {
  id: string;
  noteId: string;
  text: string;
  status: "sourced" | "unverified";
  sourceLabel: string;
  reason: string;
};
