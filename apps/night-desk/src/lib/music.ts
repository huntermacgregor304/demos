import type { Desk, Wave } from "@/lib/backtest";

const SCALE = [0, 3, 5, 7, 10];
export const ROLL_STEPS = 32;

export type Note = {
  step: number;
  midi: number;
  velocity: number;
};

export type Lane = {
  strategyId: string;
  strategyName: string;
  instrument: string;
  program: number;
  wave: Wave;
  pass: boolean;
  notes: Note[];
};

export type Score = {
  steps: number;
  lanes: Lane[];
};

export function buildScore(desk: Desk): Score {
  const earnDates = desk.bars.slice(desk.split).map((bar) => bar.date).slice(-ROLL_STEPS);
  const lanes = desk.strategies.map((strategy) => {
    const byDate = new Map(strategy.days.map((day) => [day.date, day]));
    const notes: Note[] = [];
    if (strategy.pass) {
      earnDates.forEach((date, step) => {
        const day = byDate.get(date);
        if (!day || day.position === 0) return;
        const clamped = Math.max(-0.04, Math.min(0.04, day.gross));
        const degree = Math.round(((clamped + 0.04) / 0.08) * (SCALE.length - 1));
        notes.push({
          step,
          midi: strategy.baseMidi + SCALE[degree],
          velocity: Math.max(48, Math.min(112, Math.round(64 + Math.abs(day.gross) * 900))),
        });
      });
    }
    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      instrument: strategy.instrument,
      program: strategy.program,
      wave: strategy.wave,
      pass: strategy.pass,
      notes,
    };
  });
  return { steps: ROLL_STEPS, lanes };
}
