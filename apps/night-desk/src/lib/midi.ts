import type { Lane } from "@/lib/music";

const PPQ = 480;

function vlq(value: number): number[] {
  if (value < 0 || !Number.isInteger(value)) throw new Error(`Bad MIDI delta ${value}`);
  const bytes = [value & 0x7f];
  let rest = value >> 7;
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80);
    rest >>= 7;
  }
  return bytes;
}

function channelFor(index: number): number {
  return index < 9 ? index : index + 1;
}

type Event = { tick: number; data: number[] };

function trackBytes(lane: Lane, index: number): number[] {
  const channel = channelFor(index);
  const events: Event[] = [];
  const name = [...lane.instrument].map((char) => char.charCodeAt(0));
  events.push({ tick: 0, data: [0xff, 0x03, name.length, ...name] });
  if (index === 0) events.push({ tick: 0, data: [0xff, 0x51, 0x03, 0x07, 0xa1, 0x20] });
  events.push({ tick: 0, data: [0xc0 | channel, lane.program & 0x7f] });
  for (const note of lane.notes) {
    const start = note.step * PPQ;
    events.push({ tick: start, data: [0x90 | channel, note.midi & 0x7f, note.velocity & 0x7f] });
    events.push({ tick: start + 400, data: [0x80 | channel, note.midi & 0x7f, 0] });
  }
  const endTick = lane.notes.reduce((max, note) => Math.max(max, note.step * PPQ + 400), 0);
  events.sort((a, b) => a.tick - b.tick);
  events.push({ tick: endTick, data: [0xff, 0x2f, 0x00] });
  const bytes: number[] = [];
  let previous = 0;
  for (const event of events) {
    bytes.push(...vlq(event.tick - previous), ...event.data);
    previous = event.tick;
  }
  return bytes;
}

function chunk(type: string, data: number[]): number[] {
  const length = data.length;
  return [
    type.charCodeAt(0),
    type.charCodeAt(1),
    type.charCodeAt(2),
    type.charCodeAt(3),
    (length >> 24) & 0xff,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff,
    ...data,
  ];
}

export function encodeMidi(lanes: Lane[]): Uint8Array {
  const header = chunk("MThd", [0x00, 0x01, (lanes.length >> 8) & 0xff, lanes.length & 0xff, (PPQ >> 8) & 0xff, PPQ & 0xff]);
  const tracks = lanes.flatMap((lane, index) => chunk("MTrk", trackBytes(lane, index)));
  return Uint8Array.from([...header, ...tracks]);
}
