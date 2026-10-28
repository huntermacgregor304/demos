import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import * as THREE from "three";
import dayUrl from "@/assets/earth/day.jpg";
import cloudsUrl from "@/assets/earth/clouds.png";
import nightUrl from "@/assets/earth/night.jpg";
import specularUrl from "@/assets/earth/specular.jpg";
import { SCENE } from "@/lib/constellation";
import { buildEnergyField } from "@/components/space/fieldGeometry";

type Maps = {
  day: THREE.Texture;
  specular: THREE.Texture;
  night: THREE.Texture;
  clouds: THREE.Texture;
};

const sun = new THREE.Vector3(5.4, 0.6, 2.2).normalize();

const flowVertex = `
  attribute float aAlong;
  attribute vec3 aColor;
  varying float vAlong;
  varying vec3 vColor;
  void main() {
    vAlong = aAlong;
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const flowFragment = `
  uniform float uTime;
  varying float vAlong;
  varying vec3 vColor;
  void main() {
    float flow = 0.42 + 0.58 * sin(vAlong * 34.0 - uTime * 1.7);
    gl_FragColor = vec4(vColor * (0.28 + 0.55 * flow), 0.72);
  }
`;

const cloudVertex = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudFragment = `
  uniform sampler2D uCloud;
  uniform vec3 uSun;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vec2 uv = vec2(fract(vUv.x + uTime * 0.004), vUv.y);
    float density = texture2D(uCloud, uv).r;
    float light = smoothstep(-0.25, 0.55, dot(normalize(vNormal), normalize(uSun)));
    float alpha = smoothstep(0.55, 0.92, density) * (0.08 + 0.28 * light);
    gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), alpha);
  }
`;

const nightVertex = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const nightFragment = `
  uniform sampler2D uNight;
  uniform vec3 uSun;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    float ndl = dot(normalize(vNormal), normalize(uSun));
    float night = smoothstep(0.28, -0.55, ndl);
    vec3 lights = texture2D(uNight, vUv).rgb;
    float lum = dot(lights, vec3(0.3, 0.55, 0.15));
    lights *= smoothstep(0.07, 0.22, lum);
    gl_FragColor = vec4(lights * 1.8, night);
  }
`;

const atmoVertex = `
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const atmoFragment = `
  uniform vec3 uCamera;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 2.6);
    vec3 color = mix(vec3(0.15, 0.45, 1.0), vec3(0.75, 0.92, 1.0), fres);
    gl_FragColor = vec4(color, fres * 0.95);
  }
`;

const novaVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const novaFragment = `
  uniform float uTime;
  varying vec2 vUv;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * noise(p);
      p = p * 2.05 + vec3(1.7, 9.2, 3.4);
      amp *= 0.5;
    }
    return sum;
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float ang = atan(p.y, p.x);
    float n = fbm(vec3(p * 2.4, uTime * 0.045));
    float filaments = pow(abs(sin(ang * 7.0 + n * 6.0 - r * 4.0)), 10.0);
    float core = exp(-r * r * 28.0);
    float wave = fract(uTime * 0.045);
    float ring = exp(-pow((r - wave * 1.35) * 16.0, 2.0));
    float ringB = exp(-pow((r - fract(wave + 0.5) * 1.35) * 16.0, 2.0));
    vec3 magenta = vec3(1.0, 0.25, 0.72);
    vec3 cyan = vec3(0.25, 0.9, 1.0);
    vec3 gold = vec3(1.0, 0.82, 0.4);
    vec3 violet = vec3(0.62, 0.35, 1.0);
    vec3 color = mix(magenta, cyan, n);
    color = mix(color, gold, filaments);
    color = mix(color, violet, smoothstep(0.2, 0.9, r) * 0.45);
    float alpha = core * 0.7 + filaments * 0.22 * smoothstep(1.05, 0.15, r) + (ring + ringB) * 0.28;
    alpha *= smoothstep(1.05, 0.25, r);
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

function loadMaps(): Promise<Maps> {
  const loader = new THREE.TextureLoader();
  return Promise.all([
    loader.loadAsync(dayUrl),
    loader.loadAsync(specularUrl),
    loader.loadAsync(nightUrl),
    loader.loadAsync(cloudsUrl),
  ]).then(([day, specular, night, clouds]) => {
    day.colorSpace = THREE.SRGBColorSpace;
    night.colorSpace = THREE.SRGBColorSpace;
    day.anisotropy = 8;
    clouds.wrapS = THREE.RepeatWrapping;
    specular.colorSpace = THREE.NoColorSpace;
    return { day, specular, night, clouds };
  });
}

function EarthGlobe({ maps, reduced }: { maps: Maps; reduced: boolean }) {
  const earth = useRef<THREE.Group>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const cloudMat = useRef<THREE.ShaderMaterial>(null);
  const sunVec = useMemo(() => sun.clone(), []);

  const phong = useMemo(() => {
    const material = new THREE.MeshPhongMaterial({
      map: maps.day,
      specularMap: maps.specular,
      specular: new THREE.Color("#7eb4d6"),
      shininess: 64,
    });
    return material;
  }, [maps.day, maps.specular]);

  useFrame((_, delta) => {
    if (reduced) return;
    if (earth.current) earth.current.rotation.y += delta * 0.045;
    if (clouds.current) clouds.current.rotation.y += delta * 0.07;
    if (cloudMat.current) cloudMat.current.uniforms.uTime.value += delta;
  });

  return (
    <group ref={earth} rotation={[0.41, -1.25, 0]}>
      <mesh material={phong}>
        <sphereGeometry args={[1, 64, 64]} />
      </mesh>
      <mesh scale={1.004}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          vertexShader={nightVertex}
          fragmentShader={nightFragment}
          uniforms={{ uNight: { value: maps.night }, uSun: { value: sunVec } }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={clouds} scale={1.02}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          ref={cloudMat}
          vertexShader={cloudVertex}
          fragmentShader={cloudFragment}
          uniforms={{ uCloud: { value: maps.clouds }, uSun: { value: sunVec }, uTime: { value: 0 } }}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.08}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          vertexShader={atmoVertex}
          fragmentShader={atmoFragment}
          uniforms={{}}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

function EnergyField({ reduced }: { reduced: boolean }) {
  const field = useMemo(() => buildEnergyField(), []);
  const material = useRef<THREE.ShaderMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const points = useRef<THREE.Points>(null);
  const cursor = useRef(Float32Array.from({ length: 640 }, () => Math.random()));

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(field.positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(field.colors, 3));
    geo.setAttribute("aAlong", new THREE.BufferAttribute(field.along, 1));
    return geo;
  }, [field]);

  const spark = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cursor.current.length * 3), 3));
    return geo;
  }, []);

  useFrame((_, delta) => {
    const time = reduced ? 2.4 : (material.current?.uniforms.uTime.value ?? 0) + delta;
    if (material.current && !reduced) material.current.uniforms.uTime.value = time;
    if (group.current && !reduced) group.current.rotation.y += delta * 0.09;
    const attr = spark.getAttribute("position") as THREE.BufferAttribute;
    const array = attr.array as Float32Array;
    const stride = field.pathLength * 3;
    for (let i = 0; i < cursor.current.length; i += 1) {
      if (!reduced) cursor.current[i] = (cursor.current[i] + delta * 0.055) % 1;
      const path = i % field.pathCount;
      const sample = Math.floor(cursor.current[i] * (field.pathLength - 1));
      const index = path * stride + sample * 3;
      array[i * 3] = field.paths[index] ?? 0;
      array[i * 3 + 1] = field.paths[index + 1] ?? 0;
      array[i * 3 + 2] = field.paths[index + 2] ?? 0;
    }
    attr.needsUpdate = !reduced;
  });

  return (
    <group ref={group} rotation={[0.12, 0.15, 0]}>
      <lineSegments geometry={geometry}>
        <shaderMaterial
          ref={material}
          vertexShader={flowVertex}
          fragmentShader={flowFragment}
          uniforms={{ uTime: { value: reduced ? 2.4 : 0 } }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <points ref={points} geometry={spark}>
        <pointsMaterial color="#fff6e8" size={0.035} transparent depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}

function Supernova({ reduced, mouse }: { reduced: boolean; mouse: MutableRefObject<{ x: number; y: number }> }) {
  const group = useRef<THREE.Group>(null);
  const nova = useRef<THREE.ShaderMaterial>(null);
  const debris = useRef<THREE.Points>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: 520 }, () => ({
        dir: new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize(),
        speed: 0.15 + Math.random() * 0.45,
        offset: Math.random(),
      })),
    [],
  );

  const debrisGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(seeds.length * 3), 3));
    return geo;
  }, [seeds.length]);

  useFrame(({ clock }) => {
    const time = reduced ? 6.5 : clock.elapsedTime;
    if (nova.current && !reduced) nova.current.uniforms.uTime.value = time;
    if (group.current) {
      const sway = reduced ? 0 : 1;
      group.current.position.x = -0.15 + mouse.current.x * 0.18 * sway;
      group.current.position.y = 1.15 + mouse.current.y * 0.12 * sway;
    }
    const attr = debrisGeo.getAttribute("position") as THREE.BufferAttribute;
    const array = attr.array as Float32Array;
    for (let i = 0; i < seeds.length; i += 1) {
      const seed = seeds[i];
      const life = reduced ? seed.offset : (seed.offset + time * seed.speed * 0.12) % 1;
      const dist = life * 3.4;
      array[i * 3] = seed.dir.x * dist;
      array[i * 3 + 1] = seed.dir.y * dist;
      array[i * 3 + 2] = seed.dir.z * dist;
    }
    attr.needsUpdate = !reduced;
  });

  return (
    <group ref={group} position={[-0.35, 1.85, -2.3]}>
      <mesh>
        <planeGeometry args={[4.2, 4.2]} />
        <shaderMaterial
          ref={nova}
          vertexShader={novaVertex}
          fragmentShader={novaFragment}
          uniforms={{ uTime: { value: reduced ? 6.5 : 0 } }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {[0, 1, 2, 3].map((index) => (
        <ShockRing key={index} index={index} reduced={reduced} />
      ))}
      <points ref={debris} geometry={debrisGeo}>
        <pointsMaterial color="#ffd2ef" size={0.045} transparent depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}

function ShockRing({ index, reduced }: { index: number; reduced: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const colors = ["#ff4fa3", "#7ee0ff", "#f0d78c", "#b388ff"];
  useFrame(({ clock }) => {
    const meshRef = mesh.current;
    if (!meshRef) return;
    const material = meshRef.material as THREE.MeshBasicMaterial;
    const phase = reduced ? 0.42 + index * 0.12 : (clock.elapsedTime * 0.055 + index * 0.25) % 1;
    const scale = 0.2 + phase * 2.15;
    meshRef.scale.setScalar(scale);
    material.opacity = (1 - phase) * 0.45;
  });
  return (
    <mesh ref={mesh} rotation={[0.2, 0.1, 0]}>
      <ringGeometry args={[0.86, 1, 96]} />
      <meshBasicMaterial color={colors[index]} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function Starfield({ mouse, reduced }: { mouse: MutableRefObject<{ x: number; y: number }>; reduced: boolean }) {
  const near = useRef<THREE.Points>(null);
  const far = useRef<THREE.Points>(null);
  const nearGeo = useMemo(() => starGeometry(700, 7.5, 4), []);
  const farGeo = useMemo(() => starGeometry(1100, 16, 10), []);
  const nearMat = useRef<THREE.PointsMaterial>(null);
  const farMat = useRef<THREE.PointsMaterial>(null);

  useFrame(({ clock }) => {
    const sway = reduced ? 0 : 1;
    if (near.current) {
      near.current.position.x = mouse.current.x * 0.35 * sway;
      near.current.position.y = mouse.current.y * 0.22 * sway;
    }
    if (far.current) {
      far.current.position.x = mouse.current.x * 0.08 * sway;
      far.current.position.y = mouse.current.y * 0.05 * sway;
    }
    const twinkle = reduced ? 0.85 : 0.55 + 0.45 * Math.sin(clock.elapsedTime * 1.3);
    if (nearMat.current) nearMat.current.opacity = twinkle;
  });

  return (
    <>
      <points ref={far} geometry={farGeo} position={[0, 0, -6]}>
        <pointsMaterial ref={farMat} color="#d5e4ff" size={0.018} transparent depthWrite={false} sizeAttenuation />
      </points>
      <points ref={near} geometry={nearGeo} position={[0, 0, -2]}>
        <pointsMaterial ref={nearMat} color="#fff4d2" size={0.035} transparent opacity={0.9} depthWrite={false} sizeAttenuation />
      </points>
    </>
  );
}

function starGeometry(count: number, spread: number, depth: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * spread * 2;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 1.4;
    positions[i * 3 + 2] = -Math.random() * depth;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geo;
}

function Anchor({
  svgRef,
  children,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const point = useRef<DOMPoint | null>(null);
  const { camera, gl } = useThree();

  useFrame(() => {
    const svg = svgRef.current;
    const node = group.current;
    if (!svg || !node) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    if (!point.current) point.current = svg.createSVGPoint();
    const pt = point.current;
    pt.x = SCENE.cx;
    pt.y = SCENE.cy;
    const center = pt.matrixTransform(ctm);
    pt.x = SCENE.cx + SCENE.earthR;
    const edge = pt.matrixTransform(ctm);
    const radiusPx = Math.hypot(edge.x - center.x, edge.y - center.y);
    const rect = gl.domElement.getBoundingClientRect();
    const ndcX = ((center.x - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((center.y - rect.top) / rect.height) * 2 - 1);
    const persp = camera as THREE.PerspectiveCamera;
    const distance = persp.position.z;
    const visibleH = 2 * Math.tan((persp.fov * Math.PI) / 360) * distance;
    const visibleW = visibleH * (rect.width / rect.height);
    node.position.set((ndcX * visibleW) / 2, (ndcY * visibleH) / 2, 0);
    node.scale.setScalar((radiusPx / rect.height) * visibleH);
  });

  return <group ref={group}>{children}</group>;
}

function Scene({
  svgRef,
  reduced,
  mouse,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
  reduced: boolean;
  mouse: MutableRefObject<{ x: number; y: number }>;
}) {
  const maps = useTextureSet();

  return (
    <>
      <color attach="background" args={["#05040c"]} />
      <ambientLight intensity={0.05} />
      <directionalLight position={[5.4, 0.6, 2.2]} intensity={1.05} color="#fff8ee" />
      <Starfield mouse={mouse} reduced={reduced} />
      <Anchor svgRef={svgRef}>
        {maps ? <EarthGlobe maps={maps} reduced={reduced} /> : null}
        <EnergyField reduced={reduced} />
        <Supernova reduced={reduced} mouse={mouse} />
      </Anchor>
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom luminanceThreshold={1.4} luminanceSmoothing={0.12} intensity={0.22} mipmapBlur />
      </EffectComposer>
    </>
  );
}

function useTextureSet(): Maps | null {
  const [maps, setMaps] = useState<Maps | null>(null);
  useEffect(() => {
    let dead = false;
    let loaded: Maps | null = null;
    loadMaps().then((next) => {
      loaded = next;
      if (dead) {
        disposeMaps(next);
        return;
      }
      setMaps(next);
    });
    return () => {
      dead = true;
      if (loaded) disposeMaps(loaded);
    };
  }, []);
  return maps;
}

function disposeMaps(maps: Maps) {
  maps.day.dispose();
  maps.specular.dispose();
  maps.night.dispose();
  maps.clouds.dispose();
}

export function SpaceCanvas({
  svgRef,
  reduced,
  mouse,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
  reduced: boolean;
  mouse: MutableRefObject<{ x: number; y: number }>;
}) {
  return (
    <Canvas
      className="pointer-events-none absolute inset-0"
      style={{ pointerEvents: "none" }}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5.4], fov: 38 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      frameloop={reduced ? "demand" : "always"}
    >
      <Scene svgRef={svgRef} reduced={reduced} mouse={mouse} />
    </Canvas>
  );
}
