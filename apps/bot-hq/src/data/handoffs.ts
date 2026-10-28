export const stages = [
  { id: "scout", label: "Scout" },
  { id: "approval", label: "Approval" },
  { id: "builder", label: "Builder" },
  { id: "shipped", label: "Shipped" },
] as const;

export type StageId = (typeof stages)[number]["id"];

export type StageVisual = "done" | "current" | "upcoming" | "held";

export type HandoffEvent = {
  stage: StageId;
  actor: string;
  text: string;
  sources?: string[];
};

export type Handoff = {
  id: string;
  title: string;
  kicker: string;
  summary: string;
  app: string;
  stage: StageId;
  hold?: string;
  pr?: number;
  events: HandoffEvent[];
};

export const handoffs: Handoff[] = [
  {
    id: "talk-to-the-feed",
    title: "Talk to the Feed",
    kicker: "Grok Voice 3.0",
    summary: "Realtime voice demo. Ask what people are saying, and the posts it cites land on screen.",
    app: "apps/talk-to-the-feed",
    stage: "shipped",
    pr: 1,
    hold: "Waiting on live keys",
    events: [
      {
        stage: "scout",
        actor: "DemosX",
        text: "Bookmarked Grok Voice 3.0 and flagged it as the first library to demo.",
      },
      {
        stage: "approval",
        actor: "Hunter",
        text: "The owner approved the pick directly.",
      },
      {
        stage: "builder",
        actor: "Builder",
        text: "A cloud agent built the demo in apps/talk-to-the-feed.",
      },
      {
        stage: "shipped",
        actor: "Builder",
        text: "PR #1 is up. Live voice and YouTube calls stay parked until keys exist. Those keys do not ride with the agent, so the live test runs elsewhere.",
      },
    ],
  },
  {
    id: "bot-hq",
    title: "Bot HQ",
    kicker: "Command floor",
    summary: "This floor. A visual command center for the roster, on bundled sample data.",
    app: "apps/bot-hq",
    stage: "builder",
    events: [
      {
        stage: "scout",
        actor: "DemosX",
        text: "Flagged a livestream on running a company with one Grok bot per job, plus the setup notes that go with it.",
        sources: [
          "https://x.com/spectnfa/status/2113646397379469654",
          "https://x.com/i/status/2112574886421901822",
        ],
      },
      {
        stage: "approval",
        actor: "Hunter",
        text: "The owner approved a sample-data command center. No API keys.",
      },
      {
        stage: "builder",
        actor: "Builder",
        text: "Building Bot HQ now. Org chart, handoff timeline, lesson cards, and the missing-bot panel.",
      },
    ],
  },
];

const order = stages.map((stage) => stage.id);

export function stageIndex(id: StageId): number {
  return order.indexOf(id);
}

export function stageVisual(handoff: Handoff, stage: StageId): StageVisual {
  const current = stageIndex(handoff.stage);
  const index = stageIndex(stage);
  if (handoff.hold && handoff.stage === "shipped" && stage === "shipped") return "held";
  if (index < current) return "done";
  if (index === current) return "current";
  return "upcoming";
}
