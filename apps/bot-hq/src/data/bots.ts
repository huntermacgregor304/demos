export type BotStatus = "on-duty" | "building" | "scouting" | "advising" | "standby" | "loop";

export type DeskId = "command" | "demo" | "loop" | "crypto" | "media" | "intel" | "crew";

export type Bot = {
  id: string;
  name: string;
  also?: string;
  monogram: string;
  job: string;
  desk: DeskId;
  status: BotStatus;
  standingOrder: string;
  staffTo?: string;
  reportsTo?: string;
  directs?: string[];
  advisesOnly?: boolean;
  loop?: boolean;
  chartNote?: string;
  now?: string;
  tileNote?: string;
};

export const deskMeta: Record<DeskId, { label: string; blurb: string; accent: string }> = {
  command: {
    label: "Command",
    blurb: "The president and the chief of staff.",
    accent: "border-t-brass",
  },
  demo: {
    label: "Demo line",
    blurb: "Bookmarks in, pull requests out.",
    accent: "border-t-ice",
  },
  loop: {
    label: "Build loop",
    blurb: "Plan, do, critique, then repeat.",
    accent: "border-t-violet",
  },
  crypto: {
    label: "Crypto desk",
    blurb: "Helper, risk advice, majors, scouts, the terminal.",
    accent: "border-t-brass",
  },
  media: {
    label: "Media",
    blurb: "Three channels, the edit bay, the band, the fights.",
    accent: "border-t-coral",
  },
  intel: {
    label: "Intel",
    blurb: "Discord, flips, and prediction markets.",
    accent: "border-t-ice",
  },
  crew: {
    label: "Floor crew",
    blurb: "Counsel, intake, and the unowned task.",
    accent: "border-t-mint",
  },
};

export const bots: Bot[] = [
  {
    id: "goku",
    name: "Goku",
    monogram: "GK",
    job: "President",
    desk: "command",
    status: "on-duty",
    standingOrder: "Hold the floor. What is not delegated stops here.",
    chartNote: "President of this floor. The desks underneath are groupings, not a chain of command.",
  },
  {
    id: "queen",
    name: "Queen",
    monogram: "QN",
    job: "EA, chief of staff",
    desk: "command",
    status: "on-duty",
    staffTo: "goku",
    standingOrder: "Run the president's queue. Do not approve a publish or a spend.",
  },
  {
    id: "demosx",
    name: "DemosX",
    also: "Demos",
    monogram: "DX",
    job: "Scouts X bookmarks for new libraries to demo",
    desk: "demo",
    status: "scouting",
    standingOrder: "Scout X bookmarks for a library worth a demo. Skip anything already picked.",
    now: "Flagged Bot HQ from the livestream bookmarks. Talk to the Feed was the first pick.",
  },
  {
    id: "builder",
    name: "Builder",
    monogram: "BD",
    job: "Builds approved demos with cloud agents and ships PRs",
    desk: "demo",
    status: "building",
    standingOrder: "Build the demo the owner approved, with a cloud agent, and ship the PR. Do not carry keys.",
    now: "Building Bot HQ. Talk to the Feed is PR #1, waiting on live keys.",
  },
  {
    id: "king-satoshi",
    name: "King Satoshi",
    monogram: "KS",
    job: "Crypto, and a personal helper",
    desk: "crypto",
    status: "on-duty",
    standingOrder: "Cover crypto, and the personal asks that sit next to it.",
    chartNote: "Shares the crypto desk with King Jr, Satoshi Quant, Satoshi Scout, and Nova.",
  },
  {
    id: "king-jr",
    name: "King Jr",
    monogram: "KJ",
    job: "Bankroll and risk. Advises only",
    desk: "crypto",
    status: "advising",
    advisesOnly: true,
    standingOrder: "Watch the bankroll and the risk. Advise only.",
  },
  {
    id: "satoshi-quant",
    name: "Satoshi Quant",
    monogram: "SQ",
    job: "Crypto majors quant. Backtests",
    desk: "crypto",
    status: "standby",
    standingOrder: "Backtest the crypto majors. This build has no live book.",
  },
  {
    id: "satoshi-scout",
    name: "Satoshi Scout",
    monogram: "SS",
    job: "Meme coin, NFT, and whale scout",
    desk: "crypto",
    status: "scouting",
    standingOrder: "Scout meme coins, NFTs, and whales.",
  },
  {
    id: "nova",
    name: "Nova",
    monogram: "NV",
    job: "Trading terminal",
    desk: "crypto",
    status: "on-duty",
    standingOrder: "Be the trading terminal the crypto desk reads. Sample only on this build.",
    tileNote: "Sample tape",
  },
  {
    id: "ufc-advisor",
    name: "UFC Advisor",
    monogram: "UA",
    job: "UFC advisor",
    desk: "media",
    status: "standby",
    standingOrder: "Advise on UFC. This build has no live card.",
  },
  {
    id: "aurixecho",
    name: "AurixEcho",
    monogram: "AX",
    job: "Band manager for AurIx Echo",
    desk: "media",
    status: "on-duty",
    standingOrder: "Manage AurIx Echo. Releases, shows, and the band's calendar.",
  },
  {
    id: "yt-master",
    name: "YT Master",
    monogram: "YT",
    job: "Runs three YouTube channels",
    desk: "media",
    status: "on-duty",
    directs: ["clip-editor"],
    standingOrder: "Run the three YouTube channels. Clip Editor reports here.",
  },
  {
    id: "clip-editor",
    name: "Clip Editor",
    monogram: "CE",
    job: "Cuts under YT Master",
    desk: "media",
    status: "on-duty",
    reportsTo: "yt-master",
    standingOrder: "Cut for YT Master. Do not run a channel of your own.",
  },
  {
    id: "the-wire",
    name: "The Wire",
    monogram: "TW",
    job: "Discord intelligence",
    desk: "intel",
    status: "scouting",
    standingOrder: "Read Discord and brief the floor. Do not post.",
  },
  {
    id: "the-scout",
    name: "The Scout",
    monogram: "TS",
    job: "Flipping and marketplace hunter",
    desk: "intel",
    status: "scouting",
    standingOrder: "Hunt flips and marketplace listings.",
  },
  {
    id: "kal",
    name: "Kal",
    monogram: "KL",
    job: "Kalshi prediction markets",
    desk: "intel",
    status: "advising",
    standingOrder: "Watch Kalshi prediction markets. This build has no session.",
  },
  {
    id: "tanner",
    name: "Tanner",
    monogram: "TN",
    job: "Planner",
    desk: "loop",
    status: "loop",
    loop: true,
    standingOrder: "Plan the work, then hand it to Dude.",
  },
  {
    id: "dude",
    name: "Dude",
    monogram: "DD",
    job: "Doer",
    desk: "loop",
    status: "loop",
    loop: true,
    standingOrder: "Do Tanner's plan, then hand it to Kyle.",
  },
  {
    id: "kyle",
    name: "Kyle",
    monogram: "KY",
    job: "Critic",
    desk: "loop",
    status: "loop",
    loop: true,
    standingOrder: "Critique Dude's output before the loop calls it done.",
  },
  {
    id: "cosmic-sage",
    name: "Cosmic Sage",
    monogram: "CS",
    job: "Counselor",
    desk: "crew",
    status: "standby",
    standingOrder: "Counsel the floor. This is not the support desk.",
  },
  {
    id: "import-bot",
    name: "Import Bot",
    monogram: "IB",
    job: "Imports work onto the floor",
    desk: "crew",
    status: "standby",
    standingOrder: "Bring outside work onto the floor.",
  },
  {
    id: "steve",
    name: "SteveWilldoit",
    monogram: "SW",
    job: "Takes the unowned task",
    desk: "crew",
    status: "standby",
    standingOrder: "Take the task that still has no owner.",
  },
];

export const loopOrder = ["tanner", "dude", "kyle"] as const;

export const statusLabel: Record<BotStatus, string> = {
  "on-duty": "On duty",
  building: "Building",
  scouting: "Scouting",
  advising: "Advising",
  standby: "Standby",
  loop: "In the loop",
};

export const statusTone: Record<BotStatus, string> = {
  "on-duty": "bg-mint",
  building: "bg-coral",
  scouting: "bg-ice",
  advising: "bg-brass",
  standby: "bg-muted-foreground",
  loop: "bg-violet",
};

export function getBot(id: string): Bot {
  const bot = bots.find((item) => item.id === id);
  if (!bot) throw new Error(`unknown bot ${id}`);
  return bot;
}

export function displayName(bot: Bot): string {
  return bot.also ? `${bot.also} / ${bot.name}` : bot.name;
}

export function relationshipLines(bot: Bot): string[] {
  if (bot.chartNote) return [bot.chartNote];

  const lines: string[] = [];
  if (bot.staffTo) lines.push(`Staff to ${getBot(bot.staffTo).name}.`);
  if (bot.reportsTo) lines.push(`Reports to ${getBot(bot.reportsTo).name}.`);
  if (bot.directs?.length) {
    lines.push(`Directs ${bot.directs.map((id) => getBot(id).name).join(", ")}.`);
  }
  if (bot.advisesOnly) {
    lines.push("Advises only. Does not place the trade or move the bankroll.");
  }
  if (bot.loop) {
    lines.push("Tanner plans, Dude does, Kyle critiques, then it repeats.");
  }
  if (lines.length === 0) {
    lines.push(`On the ${deskMeta[bot.desk].label.toLowerCase()} desk. No reporting line is stated.`);
  }
  return lines;
}
