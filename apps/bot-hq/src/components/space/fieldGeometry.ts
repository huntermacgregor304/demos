export type FieldLines = {
  positions: Float32Array;
  colors: Float32Array;
  along: Float32Array;
  paths: Float32Array;
  pathCount: number;
  pathLength: number;
};

const vortexThreads = 56;
const vortexCopies = 3;
const vortexSamples = 140;
const spiralThreads = 18;
const spiralSamples = 180;

function hue(h: number): [number, number, number] {
  const wrapped = ((h % 1) + 1) % 1;
  const sector = wrapped * 6;
  const index = Math.floor(sector);
  const x = 1 - Math.abs((sector % 2) - 1);
  const map: [number, number, number][] = [
    [1, x, 0],
    [x, 1, 0],
    [0, 1, x],
    [0, x, 1],
    [x, 0, 1],
    [1, 0, x],
  ];
  return map[index] ?? [1, 1, 1];
}

function threadColor(index: number, along: number): [number, number, number] {
  if (index % 6 === 0) return [1, 1, 1];
  const [r, g, b] = hue(along * 0.92 + index * 0.013);
  return [r * 0.72 + 0.28, g * 0.72 + 0.28, b * 0.72 + 0.28];
}

function lemniscate(t: number, amplitude: number): [number, number, number] {
  const s = Math.sin(t);
  const c = Math.cos(t);
  return [s * c * amplitude, s * amplitude, 0];
}

function lemniscateTangent(t: number, amplitude: number): [number, number, number] {
  const c2 = Math.cos(2 * t);
  const x = c2 * amplitude;
  const y = Math.cos(t) * amplitude;
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length, 0];
}

function rotateY(x: number, y: number, z: number, angle: number): [number, number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c + z * s, y, -x * s + z * c];
}

export function buildEnergyField(): FieldLines {
  const positions: number[] = [];
  const colors: number[] = [];
  const along: number[] = [];

  const push = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, color: [number, number, number], t0: number, t1: number) => {
    positions.push(ax, ay, az, bx, by, bz);
    colors.push(color[0], color[1], color[2], color[0], color[1], color[2]);
    along.push(t0, t1);
  };

  const lattice = [0.28, 0.36, 0.48] as [number, number, number];
  const radius = 1.62;
  const latRings = 9;
  const lonRings = 14;
  const ringSegs = 72;

  for (let lat = 1; lat < latRings; lat += 1) {
    const phi = (lat / latRings) * Math.PI;
    const y = Math.cos(phi) * radius;
    const ring = Math.sin(phi) * radius;
    for (let seg = 0; seg < ringSegs; seg += 1) {
      const a0 = (seg / ringSegs) * Math.PI * 2;
      const a1 = ((seg + 1) / ringSegs) * Math.PI * 2;
      push(Math.cos(a0) * ring, y, Math.sin(a0) * ring, Math.cos(a1) * ring, y, Math.sin(a1) * ring, lattice, seg / ringSegs, (seg + 1) / ringSegs);
    }
  }

  for (let lon = 0; lon < lonRings; lon += 1) {
    const theta = (lon / lonRings) * Math.PI * 2;
    for (let seg = 0; seg < ringSegs; seg += 1) {
      const p0 = (seg / ringSegs) * Math.PI;
      const p1 = ((seg + 1) / ringSegs) * Math.PI;
      const y0 = Math.cos(p0) * radius;
      const y1 = Math.cos(p1) * radius;
      const r0 = Math.sin(p0) * radius;
      const r1 = Math.sin(p1) * radius;
      push(Math.cos(theta) * r0, y0, Math.sin(theta) * r0, Math.cos(theta) * r1, y1, Math.sin(theta) * r1, lattice, seg / ringSegs, (seg + 1) / ringSegs);
    }
  }

  for (let circle = 0; circle < 3; circle += 1) {
    const tilt = ((circle + 1) / 3) * Math.PI;
    for (let seg = 0; seg < 120; seg += 1) {
      const a0 = (seg / 120) * Math.PI * 2;
      const a1 = ((seg + 1) / 120) * Math.PI * 2;
      const p0 = rotateY(Math.cos(a0) * radius, Math.sin(a0) * radius * Math.cos(tilt), Math.sin(a0) * radius * Math.sin(tilt), tilt * 0.5);
      const p1 = rotateY(Math.cos(a1) * radius, Math.sin(a1) * radius * Math.cos(tilt), Math.sin(a1) * radius * Math.sin(tilt), tilt * 0.5);
      push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], [0.45, 0.55, 0.7], seg / 120, (seg + 1) / 120);
    }
  }

  const pathLength = vortexSamples;
  const pathCount = vortexThreads * vortexCopies * 2;
  const paths = new Float32Array(pathCount * pathLength * 3);
  let pathIndex = 0;

  const writeVortex = (amplitude: number, tube: number, twist: number) => {
    for (let copy = 0; copy < vortexCopies; copy += 1) {
      const yaw = (copy - 1) * 0.62;
      for (let thread = 0; thread < vortexThreads; thread += 1) {
        const phase = (thread / vortexThreads) * Math.PI * 2;
        const tubeRadius = tube * (0.45 + (thread % 5) * 0.16);
        let previous: [number, number, number] | null = null;
        for (let sample = 0; sample < vortexSamples; sample += 1) {
          const t = (sample / (vortexSamples - 1)) * Math.PI * 2;
          const [cx, cy, cz] = lemniscate(t, amplitude);
          const tangent = lemniscateTangent(t, amplitude);
          const up: [number, number, number] = Math.abs(tangent[1]) > 0.92 ? [0, 0, 1] : [0, 1, 0];
          let nx = tangent[1] * up[2] - tangent[2] * up[1];
          let ny = tangent[2] * up[0] - tangent[0] * up[2];
          let nz = tangent[0] * up[1] - tangent[1] * up[0];
          const nLen = Math.hypot(nx, ny, nz) || 1;
          nx /= nLen;
          ny /= nLen;
          nz /= nLen;
          const bx = tangent[1] * nz - tangent[2] * ny;
          const by = tangent[2] * nx - tangent[0] * nz;
          const bz = tangent[0] * ny - tangent[1] * nx;
          const ang = t * twist + phase;
          const ox = cx + (nx * Math.cos(ang) + bx * Math.sin(ang)) * tubeRadius;
          const oy = cy + (ny * Math.cos(ang) + by * Math.sin(ang)) * tubeRadius;
          const oz = cz + (nz * Math.cos(ang) + bz * Math.sin(ang)) * tubeRadius;
          const point = rotateY(ox, oy, oz, yaw);
          const cursor = (pathIndex * pathLength + sample) * 3;
          paths[cursor] = point[0];
          paths[cursor + 1] = point[1];
          paths[cursor + 2] = point[2];
          if (previous) {
            const color = threadColor(thread + copy * 3, sample / vortexSamples);
            push(previous[0], previous[1], previous[2], point[0], point[1], point[2], color, (sample - 1) / vortexSamples, sample / vortexSamples);
          }
          previous = point;
        }
        pathIndex += 1;
      }
    }
  };

  writeVortex(1.5, 0.14, 2.2);
  writeVortex(1.05, 0.08, -2.6);

  for (let thread = 0; thread < spiralThreads; thread += 1) {
    const phase = (thread / spiralThreads) * Math.PI * 2;
    const turns = thread % 2 === 0 ? 3 : -2;
    let previous: [number, number, number] | null = null;
    for (let sample = 0; sample <= spiralSamples; sample += 1) {
      const u = (sample / spiralSamples) * Math.PI;
      const v = u * turns + phase;
      const spiralRadius = 1.56;
      const point: [number, number, number] = [
        spiralRadius * Math.sin(u) * Math.cos(v),
        spiralRadius * Math.cos(u),
        spiralRadius * Math.sin(u) * Math.sin(v),
      ];
      if (previous) {
        const color = threadColor(thread + 11, sample / spiralSamples);
        push(previous[0], previous[1], previous[2], point[0], point[1], point[2], color, (sample - 1) / spiralSamples, sample / spiralSamples);
      }
      previous = point;
    }
  }

  for (let sample = 0; sample < 24; sample += 1) {
    const y0 = -1.55 + (sample / 24) * 3.1;
    const y1 = -1.55 + ((sample + 1) / 24) * 3.1;
    push(0, y0, 0, 0, y1, 0, [1, 0.97, 0.9], sample / 24, (sample + 1) / 24);
  }

  return {
    positions: Float32Array.from(positions),
    colors: Float32Array.from(colors),
    along: Float32Array.from(along),
    paths,
    pathCount,
    pathLength,
  };
}
