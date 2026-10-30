export type Coverage = "covered" | "partial" | "open";

export type PlaybookRole = {
  id: string;
  label: string;
  coverage: Coverage;
  by: string[];
  note?: string;
};

export type Hire = {
  roleId: string;
  name: string;
  job: string;
  reason: string;
};

export const playbookRoles: PlaybookRole[] = [
  {
    id: "planner",
    label: "Planner",
    coverage: "covered",
    by: ["Tanner"],
  },
  {
    id: "builder",
    label: "Builder",
    coverage: "covered",
    by: ["Builder", "Dude"],
  },
  {
    id: "critic",
    label: "Critic / QA",
    coverage: "covered",
    by: ["Kyle"],
  },
  {
    id: "ops",
    label: "Ops / monitoring",
    coverage: "open",
    by: [],
    note: "Nobody watches a demo after it leaves Builder.",
  },
  {
    id: "finance",
    label: "Finance",
    coverage: "covered",
    by: ["King Jr"],
    note: "Advises on bankroll and risk. Does not move the money.",
  },
  {
    id: "marketing",
    label: "Marketing / social",
    coverage: "partial",
    by: ["YT Master", "Clip Editor", "AurixEcho"],
    note: "Three channels and the band. No bot owns the company's outbound voice.",
  },
  {
    id: "support",
    label: "Support",
    coverage: "open",
    by: [],
    note: "Cosmic Sage counsels the floor. That is not support.",
  },
  {
    id: "research",
    label: "Research",
    coverage: "covered",
    by: ["DemosX", "Satoshi Scout", "The Scout", "The Wire", "Kal"],
    note: "Domain scouts. Not one general research desk.",
  },
  {
    id: "scheduler",
    label: "Scheduler",
    coverage: "partial",
    by: ["Queen"],
    note: "Queen runs the president's queue. Nobody owns the floor calendar.",
  },
];

const candidates: Hire[] = [
  {
    roleId: "ops",
    name: "Sentinel",
    job: "Ops and monitoring. Watches holds, routines, and pull requests. Does not hold keys.",
    reason:
      "The floor can scout a bookmark, take a yes from the owner, and ship a pull request. Nobody watches it after that. Talk to the Feed is already on PR #1, waiting on live keys. Secrets cannot be forwarded to the cloud agent, so the live test runs somewhere else. Sentinel would watch that hold, the routines, and the PR state, and would not carry the keys. Support is the other empty seat, and nothing on this sample tape is waiting on it. Marketing and the calendar are only partly covered.",
  },
  {
    roleId: "support",
    name: "Liaison",
    job: "Support. Answers people who are waiting on the floor. Does not counsel the roster.",
    reason:
      "Support is open. Cosmic Sage counsels the people on the floor and does not answer outside requests. Liaison would take that seat once something on the tape is actually waiting on a reply.",
  },
];

const rank: Record<Coverage, number> = {
  open: 0,
  partial: 1,
  covered: 2,
};

export function suggestNextBot(roles: readonly PlaybookRole[] = playbookRoles): Hire {
  const ranked = candidates
    .map((candidate, index) => {
      const role = roles.find((item) => item.id === candidate.roleId);
      if (!role) throw new Error(`missing playbook role ${candidate.roleId}`);
      return { candidate, index, score: rank[role.coverage] };
    })
    .sort((a, b) => a.score - b.score || a.index - b.index);

  const next = ranked[0];
  if (!next || next.score === rank.covered) {
    throw new Error("every candidate role is already covered");
  }
  return next.candidate;
}
