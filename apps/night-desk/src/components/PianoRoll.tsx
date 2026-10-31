import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { encodeMidi } from "@/lib/midi";
import type { Score } from "@/lib/music";

const STEP_SEC = 0.5;

export function PianoRoll({ score, active }: { score: Score; active: boolean }) {
  const [playhead, setPlayhead] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const sounding = score.lanes.filter((lane) => lane.notes.length > 0).length;

  useEffect(() => {
    if (active) return;
    stopRef.current?.();
  }, [active]);

  useEffect(() => () => stopRef.current?.(), []);

  async function play() {
    stopRef.current?.();
    const Tone = await import("tone");
    await Tone.start();
    const synths = score.lanes.map((lane) => {
      const synth = new Tone.Synth({
        oscillator: { type: lane.wave },
        envelope:
          lane.instrument === "Timpani"
            ? { attack: 0.001, decay: 0.28, sustain: 0, release: 0.08 }
            : { attack: 0.02, decay: 0.12, sustain: 0.3, release: 0.22 },
      }).toDestination();
      synth.volume.value = -16;
      return synth;
    });
    const now = Tone.now() + 0.05;
    for (const [index, lane] of score.lanes.entries()) {
      for (const note of lane.notes) {
        const pitch = Tone.Frequency(note.midi, "midi").toNote();
        synths[index].triggerAttackRelease(pitch, 0.32, now + note.step * STEP_SEC, note.velocity / 127);
      }
    }
    const started = performance.now();
    let frame = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const step = (performance.now() - started) / (STEP_SEC * 1000);
      setPlayhead(step);
      if (step < score.steps) frame = requestAnimationFrame(tick);
      else finish();
    };
    const finish = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      for (const synth of synths) {
        synth.triggerRelease();
        synth.dispose();
      }
      setPlaying(false);
      setPlayhead(-1);
    };
    stopRef.current = finish;
    setPlaying(true);
    frame = requestAnimationFrame(tick);
  }

  function download() {
    const bytes = encodeMidi(score.lanes);
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    const blob = new Blob([copy], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "night-desk.mid";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Thirteen lanes. {sounding} {sounding === 1 ? "rule" : "rules"} cleared the gate and {sounding === 1 ? "plays" : "play"}. Silent lanes failed it. Demo orchestration of historical days.
        </p>
        <div className="flex gap-2">
          <Button type="button" onClick={() => void play()} disabled={playing}>
            {playing ? "Playing" : "Play piano roll"}
          </Button>
          <Button type="button" variant="outline" onClick={() => stopRef.current?.()} disabled={!playing}>
            Stop
          </Button>
          <Button type="button" variant="secondary" onClick={download}>
            Export .mid
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {score.lanes.map((lane) => (
            <div key={lane.strategyId} className="grid grid-cols-[11rem_1fr] items-center gap-2 border-b border-white/5 py-1">
              <div className={lane.pass ? "text-cyan" : "text-muted-foreground"}>
                <div className="font-display text-[10px] tracking-[0.12em]">{lane.instrument}</div>
                <div className="truncate font-mono text-[10px]">{lane.strategyName}</div>
              </div>
              <div className="relative h-7 rounded bg-white/[0.03]">
                {Array.from({ length: score.steps }, (_, step) => (
                  <div
                    key={step}
                    className="absolute top-0 h-full border-l border-white/5"
                    style={{ left: `${(step / score.steps) * 100}%` }}
                  />
                ))}
                {lane.notes.map((note) => {
                  const on = playhead >= note.step && playhead < note.step + 1;
                  return (
                    <div
                      key={note.step}
                      className="absolute top-1 h-5 rounded-sm"
                      style={{
                        left: `${(note.step / score.steps) * 100}%`,
                        width: `${(0.82 / score.steps) * 100}%`,
                        background: on ? "#FF2BD6" : "#3EF0FF",
                        boxShadow: on ? "0 0 12px #FF2BD6" : "0 0 8px rgb(62 240 255 / 0.45)",
                        opacity: lane.pass ? 1 : 0.25,
                      }}
                    />
                  );
                })}
                {playing ? (
                  <div
                    className="absolute top-0 h-full w-px bg-magenta"
                    style={{ left: `${Math.min(Math.max(playhead, 0) / score.steps, 1) * 100}%` }}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
