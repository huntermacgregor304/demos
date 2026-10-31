export type Role = "analyst" | "bull" | "bear" | "risk";

export type Agent = {
  id: string;
  name: string;
  role: Role;
  color: string;
  seat: [number, number, number];
  facing: number;
};

export const agents: Agent[] = [
  { id: "nova", name: "NOVA", role: "analyst", color: "#3EF0FF", seat: [-1.4, 0, -1.2], facing: 0.25 },
  { id: "nyx", name: "NYX", role: "analyst", color: "#9AF6FF", seat: [1.4, 0, -1.2], facing: -0.25 },
  { id: "orion", name: "ORION", role: "bull", color: "#3EF0FF", seat: [-2.15, 0, 0.05], facing: 1.25 },
  { id: "vela", name: "VELA", role: "bear", color: "#FF2BD6", seat: [2.15, 0, 0.05], facing: -1.25 },
  { id: "kade", name: "KADE", role: "risk", color: "#FF7AD2", seat: [-0.95, 0, 1.28], facing: Math.PI },
  { id: "zara", name: "ZARA", role: "risk", color: "#FF2BD6", seat: [0.95, 0, 1.28], facing: Math.PI },
];

export function getAgent(id: string): Agent {
  const agent = agents.find((item) => item.id === id);
  if (!agent) throw new Error(`Unknown agent ${id}`);
  return agent;
}
