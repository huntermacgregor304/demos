import { describe, expect, test } from "bun:test";
import { base64ToPcm16, downsample, floatToPcm16, pcm16ToBase64 } from "../src/lib/pcm";

describe("pcm audio", () => {
  test("downsamples and round-trips pcm16", () => {
    const input = new Float32Array([0, 0.5, 0, -0.5, 1, -1]);
    const down = downsample(input, 48000, 24000);
    expect(down.length).toBe(3);
    const pcm = floatToPcm16(down);
    const restored = base64ToPcm16(pcm16ToBase64(pcm));
    expect(Array.from(restored)).toEqual(Array.from(pcm));
  });
});
