"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";

// ============================================================
// CONFIG
// ============================================================
const API_URL = "https://tracker.lachlansear.com/api/public-companies";

const GEO_COORDS: Record<string, { lat: number; lng: number }> = {
  "London, UK": { lat: 51.51, lng: -0.08 },
  "Paris, France": { lat: 48.86, lng: 2.35 },
  "Berlin, DE": { lat: 52.52, lng: 13.40 },
  "Stockholm, Sweden": { lat: 59.33, lng: 18.07 },
  "Barcelona, Spain": { lat: 41.39, lng: 2.17 },
  "Madrid, Spain": { lat: 40.42, lng: -3.70 },
  "Vienna, Austria": { lat: 48.21, lng: 16.37 },
  "Vilnius, Lithuania": { lat: 54.69, lng: 25.28 },
  "Oxford, UK": { lat: 51.75, lng: -1.25 },
  "Tel Aviv, Israel": { lat: 32.08, lng: 34.78 },
  "San Francisco, US": { lat: 37.77, lng: -122.42 },
  "New York, US": { lat: 40.71, lng: -74.01 },
  "Menlo Park, US": { lat: 37.45, lng: -122.18 },
  "Redwood City, US": { lat: 37.49, lng: -122.24 },
  "Santa Clara, US": { lat: 37.35, lng: -121.96 },
  "Miami, US": { lat: 25.76, lng: -80.19 },
};

interface SectorConfig {
  color: string;
  orbitRadius: number;
  planetSize: number;
  speed: number;
  article: string;
  articleTitle: string;
  description: string;
  shortName: string;
}

const SECTORS: Record<string, SectorConfig> = {
  "Vertical AI": {
    color: "#6ECE8A",
    orbitRadius: 3.2,
    planetSize: 0.28,
    speed: 0.06,
    article: "https://lachlansear.com/same-problem-different-waiting-room",
    articleTitle: "Same Problem, Different Waiting Room",
    description: "AI purpose-built for regulated industries \u2014 healthcare, legal, dental, veterinary, fintech. Domain expertise and compliance complexity create defensible moats that horizontal wrappers cannot replicate.",
    shortName: "Vertical AI",
  },
  "Horizontal AI": {
    color: "#E8C87A",
    orbitRadius: 5.2,
    planetSize: 0.25,
    speed: 0.04,
    article: "https://lachlansear.com",
    articleTitle: "View on lachlansear.com",
    description: "General-purpose AI platforms, tools, and models serving broad markets. Category leaders emerge through distribution, developer loyalty, and ecosystem effects rather than domain depth.",
    shortName: "Horizontal AI",
  },
  "AI Infrastructure": {
    color: "#D49A6A",
    orbitRadius: 7.0,
    planetSize: 0.20,
    speed: 0.03,
    article: "https://lachlansear.com",
    articleTitle: "View on lachlansear.com",
    description: "The picks-and-shovels layer \u2014 inference engines, workflow orchestration, data pipelines, and developer tooling powering the application layer above.",
    shortName: "AI Infra",
  },
  "Deep Tech & Defence": {
    color: "#8B9FC4",
    orbitRadius: 9.0,
    planetSize: 0.22,
    speed: 0.02,
    article: "https://lachlansear.com",
    articleTitle: "View on lachlansear.com",
    description: "Frontier research commercialisation, autonomous systems, defence AI, and dual-use technologies. Sovereign capability and deep technical moats define this orbit.",
    shortName: "Deep Tech",
  },
};

const THESIS_TITLE = "Same Problem, Different Waiting Room";

// ============================================================
// TYPES
// ============================================================
interface Company {
  id: number;
  name: string;
  sector: string;
  description: string;
  geo: string;
  status: string;
  founded: number | null;
  dateAdded: string;
  dateUpdated?: string;
  website?: string;
}

interface DistributedCompany extends Company {
  moonAngle: number;
  moonOrbit: number;
}

interface PlanetData {
  mesh: THREE.Mesh;
  glow: THREE.Mesh;
  label: THREE.Sprite;
  atmosphere: THREE.Mesh;
  hitMesh: THREE.Mesh;
  sector: string;
  cfg: SectorConfig;
  angle: number;
  meshScale: number;
  glowScale: number;
  labelScale: number;
  labelOpacity: number;
  glowOpacity: number;
  emissiveVal: number;
}

interface MoonData {
  mesh: THREE.Mesh;
  glow: THREE.Mesh | null;
  hitMesh: THREE.Mesh;
  trail: THREE.Line;
  company: DistributedCompany;
  sector: string;
  moonAngle: number;
  moonOrbit: number;
}

interface SceneState {
  mode: string;
  targetSector: string | null;
  animating: boolean;
  time: number;
  planets: PlanetData[];
  moons: MoonData[];
  camera: THREE.PerspectiveCamera | null;
  scene: THREE.Scene | null;
  renderer: THREE.WebGLRenderer | null;
  cameraTarget: THREE.Vector3;
  cameraPos: THREE.Vector3;
  sunMesh?: THREE.Mesh;
  isMobile: boolean;
  orbitScale: number;
}

// ============================================================
// HELPERS
// ============================================================
function distributeCompaniesOnOrbit(companies: Company[], planetSize: number): DistributedCompany[] {
  const baseOrbit = planetSize * 2.5;
  return companies.map((c, i) => {
    const angle = (i / companies.length) * Math.PI * 2 + (i * 0.3);
    const ring = baseOrbit + (i % 3) * 0.25;
    return { ...c, moonAngle: angle, moonOrbit: ring };
  });
}

function getStatusLabel(status: string) {
  if (status === "Benchmark") return "benchmark";
  if (status === "Written Up") return "written-up";
  return "tracking";
}

function getLastUpdated(companies: Company[]): string {
  let latestMs = 0;
  companies.forEach((c) => {
    const dates = [c.dateUpdated, c.dateAdded].filter(Boolean) as string[];
    dates.forEach((d) => {
      const ms = new Date(d).getTime();
      if (ms > latestMs) latestMs = ms;
    });
  });
  if (latestMs === 0) return "";
  const days = Math.floor((Date.now() - latestMs) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 14) return `Updated ${days} days ago`;
  if (days < 30) return `Updated ${Math.floor(days / 7)} weeks ago`;
  return `Updated ${Math.floor(days / 30)} months ago`;
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function Observatory() {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState>({
    mode: "system",
    targetSector: null,
    animating: false,
    time: 0,
    planets: [],
    moons: [],
    camera: null,
    scene: null,
    renderer: null,
    cameraTarget: new THREE.Vector3(0, 0, 0),
    cameraPos: new THREE.Vector3(0, 5, 12),
    isMobile: false,
    orbitScale: 1.0,
  });

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [mode, setMode] = useState("system");
  const [zoomedSector, setZoomedSector] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showSunCard, setShowSunCard] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isMobileState, setIsMobileState] = useState(false);
  const hoveredRef = useRef<string | null>(null);

  // Fetch data
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        setCompanies(data);
      } catch (e) {
        console.warn("Failed to fetch from tracker API:", e);
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    if (!companies.length) return { total: 0, benchmark: 0, sectors: 0, countries: 0 };
    return {
      total: companies.length,
      benchmark: companies.filter((c) => c.status === "Benchmark").length,
      sectors: Object.keys(SECTORS).length,
      countries: new Set(companies.map((c) => c.geo?.split(", ")[1]).filter(Boolean)).size,
    };
  }, [companies]);

  const lastUpdated = useMemo(() => getLastUpdated(companies), [companies]);

  const sectorCompanies = useMemo(() => {
    if (!zoomedSector) return [];
    return companies.filter((c) => c.sector === zoomedSector);
  }, [companies, zoomedSector]);

  const sectorConfig = useMemo(() => (zoomedSector ? SECTORS[zoomedSector] : null), [zoomedSector]);

  // --------------------------------------------------------
  // THREE.JS SCENE
  // --------------------------------------------------------
  useEffect(() => {
    if (loading || !mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const S = stateRef.current;

    const isMobile = window.innerWidth < 768;
    S.isMobile = isMobile;
    setIsMobileState(isMobile);
    // On mobile, remap orbits to [1.5, 4.0] so all planets stay visible
    const allOrbits = Object.values(SECTORS).map((s) => s.orbitRadius);
    const minOrbit = Math.min(...allOrbits);
    const maxOrbit = Math.max(...allOrbits);
    const getScaledOrbit = (r: number) => {
      if (!isMobile) return r;
      if (maxOrbit === minOrbit) return 2.75;
      return 1.5 + ((r - minOrbit) / (maxOrbit - minOrbit)) * (3.0 - 1.5);
    };
    S.orbitScale = isMobile ? 0.6 : 1.0; // kept for reference but getScaledOrbit used instead

    const systemCamPos = isMobile ? new THREE.Vector3(0, 0, 12) : new THREE.Vector3(0, 5, 12);
    S.cameraPos = systemCamPos.clone();
    S.cameraTarget = new THREE.Vector3(0, 0, 0);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#080c14");
    scene.fog = new THREE.FogExp2("#080c14", 0.01);
    S.scene = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
    camera.position.copy(systemCamPos);
    (camera as any).userData.lookTarget = new THREE.Vector3(0, 0, 0);
    S.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    S.renderer = renderer;

    // ---- Nebula depth spheres (offset for colour variation) ----
    [
      { radius: 20, color: "#0a121e", opacity: 0.04, pos: [3, -2, -5] as const },
      { radius: 30, color: "#0f0c19", opacity: 0.035, pos: [-5, 1, 4] as const },
      { radius: 40, color: "#0a0e1c", opacity: 0.025, pos: [2, 3, -3] as const },
    ].forEach(({ radius, color, opacity, pos }) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 32),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity, side: THREE.BackSide })
      );
      m.position.set(pos[0], pos[1], pos[2]);
      scene.add(m);
    });

    // ---- Warm radial glow around sun ----
    const warmSize = 256;
    const warmCanvas = document.createElement("canvas");
    warmCanvas.width = warmSize;
    warmCanvas.height = warmSize;
    const warmCtx = warmCanvas.getContext("2d")!;
    const warmGrad = warmCtx.createRadialGradient(warmSize / 2, warmSize / 2, 0, warmSize / 2, warmSize / 2, warmSize / 2);
    warmGrad.addColorStop(0, "rgba(35, 25, 15, 0.08)");
    warmGrad.addColorStop(0.5, "rgba(35, 25, 15, 0.03)");
    warmGrad.addColorStop(1, "rgba(35, 25, 15, 0)");
    warmCtx.fillStyle = warmGrad;
    warmCtx.fillRect(0, 0, warmSize, warmSize);
    const warmSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(warmCanvas), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    warmSprite.scale.set(35, 35, 1);
    scene.add(warmSprite);

    // ---- Twinkling Stars (ShaderMaterial) ----
    const starCount = 2500;
    const starGeo = new THREE.BufferGeometry();
    const sPos = new Float32Array(starCount * 3);
    const starPhases = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const r = 50 + Math.random() * 80;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      sPos[i * 3] = r * Math.sin(p) * Math.cos(t);
      sPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      sPos[i * 3 + 2] = r * Math.cos(p);
      starPhases[i] = Math.random();
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    starGeo.setAttribute("phase", new THREE.BufferAttribute(starPhases, 1));

    const starTimeUniform = { value: 0 };
    const starMat = new THREE.ShaderMaterial({
      uniforms: {
        time: starTimeUniform,
        uPointSize: { value: 0.4 },
      },
      vertexShader: `
        attribute float phase;
        varying float vPhase;
        uniform float uPointSize;
        void main() {
          vPhase = phase;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uPointSize * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        varying float vPhase;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = 0.25 + 0.45 * sin(time * (0.5 + vPhase * 1.5) + vPhase * 6.2832);
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * smoothstep(0.5, 0.1, d));
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // ---- System Group (tilted on mobile) ----
    const systemGroup = new THREE.Group();
    if (isMobile) {
      systemGroup.rotation.x = 1.1;
      systemGroup.position.y = -1.5;
    }
    scene.add(systemGroup);

    // ---- Sun ----
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(isMobile ? 0.5 : 0.9, 64, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#D4A574") })
    );
    systemGroup.add(sun);
    S.sunMesh = sun;

    // Sun glow layers (pulsing at different rates)
    const sunGlowData = [
      { radius: 1.3, baseOpacity: 0.07, freq: 3.0, amplitude: 0.02 },
      { radius: 1.8, baseOpacity: 0.04, freq: 2.2, amplitude: 0.015 },
      { radius: 2.5, baseOpacity: 0.02, freq: 1.6, amplitude: 0.01 },
      { radius: 3.5, baseOpacity: 0.008, freq: 1.2, amplitude: 0.004 },
    ];
    const sunGlowMeshes: { mesh: THREE.Mesh; baseOpacity: number; freq: number; amplitude: number }[] = [];
    sunGlowData.forEach(({ radius, baseOpacity, freq, amplitude }) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 32),
        new THREE.MeshBasicMaterial({ color: new THREE.Color("#D4A574"), transparent: true, opacity: baseOpacity, side: THREE.BackSide })
      );
      systemGroup.add(mesh);
      sunGlowMeshes.push({ mesh, baseOpacity, freq, amplitude });
    });

    // Sun rotating disc (light ray effect)
    const sunDisc = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 3.8, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#D4A574"), transparent: true, opacity: 0.012, side: THREE.DoubleSide })
    );
    systemGroup.add(sunDisc);

    // Sun label sprite
    const sunLabelCanvas = document.createElement("canvas");
    sunLabelCanvas.width = 512;
    sunLabelCanvas.height = 64;
    const sunCtx = sunLabelCanvas.getContext("2d")!;
    sunCtx.font = "italic 400 22px 'Lora', serif";
    sunCtx.fillStyle = "#D4A574";
    sunCtx.textAlign = "center";
    sunCtx.fillText("THE OBSERVATORY", 256, 40);
    const sunLabelSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sunLabelCanvas), transparent: true, opacity: 0.4 })
    );
    sunLabelSprite.scale.set(2.5, 0.3, 1);
    sunLabelSprite.position.set(0, -1.4, 0);
    systemGroup.add(sunLabelSprite);

    const dirLight = new THREE.DirectionalLight("#ffffff", 0.5);
    dirLight.position.set(5, 3, 5);
    systemGroup.add(dirLight);
    systemGroup.add(new THREE.PointLight("#D4A574", 2, 50, 1));
    scene.add(new THREE.AmbientLight("#1a2030", 0.8)); // ambient stays in scene

    // ---- Build planets + orbits + moons ----
    const sectorEntries = Object.entries(SECTORS);
    S.planets = [];
    S.moons = [];

    sectorEntries.forEach(([sectorName, cfg], idx) => {
      const scaledOrbit = getScaledOrbit(cfg.orbitRadius);

      // Orbit ring
      const curve = new THREE.EllipseCurve(0, 0, scaledOrbit, scaledOrbit, 0, Math.PI * 2, false, 0);
      const pts = curve.getPoints(128);
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, 0, p.y)));
      systemGroup.add(new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(cfg.color), transparent: true, opacity: 0.07 })));

      // Planet
      const pSize = isMobile ? cfg.planetSize * 0.7 : cfg.planetSize;
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(pSize, 32, 32),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.color), emissive: new THREE.Color(cfg.color), emissiveIntensity: 0.25, roughness: 0.55, metalness: 0.15 })
      );
      planet.userData = { sector: sectorName };
      systemGroup.add(planet);

      // Planet glow
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(pSize * 2.5, 16, 16),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.color), transparent: true, opacity: 0.06, side: THREE.BackSide })
      );
      systemGroup.add(glow);

      // Planet atmosphere ring
      const atmo = new THREE.Mesh(
        new THREE.TorusGeometry(pSize * 1.4, 0.012, 8, 64),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.color), transparent: true, opacity: 0.08 })
      );
      atmo.rotation.x = Math.PI / 2;
      systemGroup.add(atmo);

      // Hit mesh (larger invisible sphere for touch targets)
      const hitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(pSize * 2.5, 16, 16),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitMesh.userData = { sector: sectorName };
      systemGroup.add(hitMesh);

      // Label (short names on mobile)
      const labelName = isMobile ? cfg.shortName : sectorName;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.font = "500 26px 'IBM Plex Sans', Arial, sans-serif";
      ctx.fillStyle = cfg.color;
      ctx.textAlign = "center";
      ctx.fillText(labelName.toUpperCase(), 256, 40);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, opacity: 0.6 }));
      sprite.scale.set(2.8, 0.35, 1);
      systemGroup.add(sprite);

      const startAngle = (idx / sectorEntries.length) * Math.PI * 2;
      S.planets.push({
        mesh: planet, glow, label: sprite, atmosphere: atmo, hitMesh,
        sector: sectorName, cfg, angle: startAngle,
        meshScale: 1, glowScale: 1, labelScale: 1, labelOpacity: 0.55, glowOpacity: 0.06, emissiveVal: 0.25,
      });

      // Moons
      const sectorCos = companies.filter((c) => c.sector === sectorName);
      const distributed = distributeCompaniesOnOrbit(sectorCos, pSize);
      distributed.forEach((co) => {
        const isBench = co.status === "Benchmark";
        const sz = isBench ? 0.065 : 0.04;
        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(sz, 16, 16),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(isBench ? "#D4A574" : cfg.color), transparent: true, opacity: 0.9 })
        );
        moon.userData = { company: co };
        systemGroup.add(moon);

        let moonGlow: THREE.Mesh | null = null;
        if (isBench) {
          moonGlow = new THREE.Mesh(
            new THREE.SphereGeometry(sz * 3, 16, 16),
            new THREE.MeshBasicMaterial({ color: new THREE.Color("#D4A574"), transparent: true, opacity: 0.12 })
          );
          systemGroup.add(moonGlow);
        }

        // Moon hit mesh (larger for touch)
        const moonHit = new THREE.Mesh(
          new THREE.SphereGeometry(sz * 4, 8, 8),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        moonHit.userData = { company: co };
        systemGroup.add(moonHit);

        // Moon trail (orbital ring, hidden by default)
        const trailCurve = new THREE.EllipseCurve(0, 0, co.moonOrbit, co.moonOrbit, 0, Math.PI * 2, false, 0);
        const trailPts = trailCurve.getPoints(64);
        const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPts.map((tp) => new THREE.Vector3(tp.x, 0, tp.y)));
        const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(cfg.color), transparent: true, opacity: 0.06 }));
        trail.visible = false;
        systemGroup.add(trail);

        S.moons.push({ mesh: moon, glow: moonGlow, hitMesh: moonHit, trail, company: co, sector: sectorName, moonAngle: co.moonAngle, moonOrbit: co.moonOrbit });
      });
    });

    // ---- HTML overlay labels (mobile only) ----
    const labelDivs: Map<string, HTMLDivElement> = new Map();
    if (isMobile) {
      S.planets.forEach((p) => {
        const div = document.createElement("div");
        div.textContent = (p.cfg.shortName || p.sector).toUpperCase();
        div.style.cssText = `position:absolute;pointer-events:none;font-family:'IBM Plex Sans',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${p.cfg.color};white-space:nowrap;z-index:5;transform:translateX(-50%);`;
        container.appendChild(div);
        labelDivs.set(p.sector, div);
      });
    }

    // ---- Raycaster ----
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e: MouseEvent) => {
      if (S.animating) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      if (S.mode === "system") {
        const planetHits = raycaster.intersectObjects(S.planets.map((p) => p.hitMesh));
        if (planetHits.length > 0) {
          const sec = planetHits[0].object.userData.sector;
          zoomToSector(sec);
          return;
        }
        const sunHits = raycaster.intersectObjects([sun]);
        if (sunHits.length > 0) {
          setShowSunCard(true);
        }
      } else {
        const sectorMoons = S.moons.filter((m) => m.sector === S.targetSector);
        const hits = raycaster.intersectObjects(sectorMoons.map((m) => m.hitMesh));
        if (hits.length > 0) {
          const co = hits[0].object.userData.company;
          setSelectedCompany((prev) => (prev?.id === co.id ? null : co));
        } else {
          setSelectedCompany(null);
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      if (S.mode === "system") {
        const planetHits = raycaster.intersectObjects(S.planets.map((p) => p.hitMesh));
        if (planetHits.length > 0) {
          hoveredRef.current = planetHits[0].object.userData.sector;
          renderer.domElement.style.cursor = "pointer";
        } else {
          hoveredRef.current = null;
          const sunHits = raycaster.intersectObjects([sun]);
          renderer.domElement.style.cursor = sunHits.length > 0 ? "pointer" : "default";
        }
      } else {
        const sectorMoons = S.moons.filter((m) => m.sector === S.targetSector);
        const hits = raycaster.intersectObjects(sectorMoons.map((m) => m.hitMesh));
        renderer.domElement.style.cursor = hits.length > 0 ? "pointer" : "default";
      }
    };

    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("mousemove", onMouseMove);

    // ---- Touch drag (mobile only) ----
    let touchStart = { x: 0, y: 0 };
    let touchDragging = false;
    let autoRotateTimeout: ReturnType<typeof setTimeout> | null = null;
    const baseRotationX = isMobile ? 1.1 : 0;

    const onTouchStart = (e: TouchEvent) => {
      if (!isMobile || e.touches.length !== 1) return;
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchDragging = true;
      if (autoRotateTimeout) clearTimeout(autoRotateTimeout);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!touchDragging || e.touches.length !== 1) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - touchStart.x;
      const dy = e.touches[0].clientY - touchStart.y;
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      systemGroup.rotation.y += dx * 0.008;
      systemGroup.rotation.x = Math.max(0.3, Math.min(1.5, systemGroup.rotation.x + dy * 0.008));
    };
    const onTouchEnd = () => {
      touchDragging = false;
      autoRotateTimeout = setTimeout(() => {
        // Gently lerp back to default rotation (handled in animate)
      }, 3000);
    };
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: true });
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });
    renderer.domElement.addEventListener("touchend", onTouchEnd, { passive: true });

    // ---- Animate ----
    const animate = () => {
      requestAnimationFrame(animate);
      S.time += 0.006;

      // Stars twinkle
      starTimeUniform.value = S.time;

      // Sun
      sun.rotation.y += 0.001;
      sunDisc.rotation.z += 0.0015;
      sunGlowMeshes.forEach(({ mesh, baseOpacity, freq, amplitude }) => {
        (mesh.material as THREE.MeshBasicMaterial).opacity = baseOpacity + amplitude * Math.sin(S.time * freq);
      });
      (sunLabelSprite.material as THREE.SpriteMaterial).opacity = 0.4 + 0.1 * Math.sin(S.time * 4.0);

      // Planets
      S.planets.forEach((p) => {
        const scaledOrbit = S.isMobile
          ? 1.5 + ((p.cfg.orbitRadius - 3.2) / (9.0 - 3.2)) * (3.0 - 1.5)
          : p.cfg.orbitRadius;
        const angle = p.angle + S.time * p.cfg.speed;
        const x = Math.cos(angle) * scaledOrbit;
        const z = Math.sin(angle) * scaledOrbit;
        p.mesh.position.set(x, 0, z);
        p.glow.position.set(x, 0, z);
        p.atmosphere.position.set(x, 0, z);
        p.hitMesh.position.set(x, 0, z);
        p.label.position.set(x, p.cfg.planetSize + 0.5, z);

        // Planet self-rotation
        p.mesh.rotation.y += 0.003;

        // Smooth hover lerp
        const isHovered = hoveredRef.current === p.sector;
        const tMeshScale = isHovered ? 1.15 : 1.0;
        const tGlowScale = isHovered ? 1.3 : 1.0;
        const tLabelScale = isHovered ? 1.1 : 1.0;
        const tLabelOpacity = isHovered ? 0.9 : 0.55;
        const tGlowOpacity = isHovered ? 0.14 : 0.06;
        const tEmissive = isHovered ? 0.5 : 0.25;

        p.meshScale += (tMeshScale - p.meshScale) * 0.08;
        p.glowScale += (tGlowScale - p.glowScale) * 0.08;
        p.labelScale += (tLabelScale - p.labelScale) * 0.08;
        p.labelOpacity += (tLabelOpacity - p.labelOpacity) * 0.08;
        p.glowOpacity += (tGlowOpacity - p.glowOpacity) * 0.08;
        p.emissiveVal += (tEmissive - p.emissiveVal) * 0.08;

        p.mesh.scale.setScalar(p.meshScale);
        p.glow.scale.setScalar(p.glowScale);
        p.label.scale.set(2.8 * p.labelScale, 0.35 * p.labelScale, 1);
        (p.label.material as THREE.SpriteMaterial).opacity = S.mode === "zoomed" ? 0 : p.labelOpacity;
        (p.glow.material as THREE.MeshBasicMaterial).opacity = p.glowOpacity;
        (p.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = p.emissiveVal;

        // Mobile: hide sprite labels, use HTML overlays instead
        if (S.isMobile) {
          (p.label.material as THREE.SpriteMaterial).opacity = 0;
          const div = labelDivs.get(p.sector);
          if (div) {
            if (S.mode === "zoomed") {
              div.style.display = "none";
            } else {
              div.style.display = "";
              const worldPos = new THREE.Vector3();
              p.mesh.getWorldPosition(worldPos);
              worldPos.y += p.cfg.planetSize + 0.4;
              const projected = worldPos.clone().project(camera);
              const hw = container.clientWidth / 2;
              const hh = container.clientHeight / 2;
              let sx = hw + projected.x * hw;
              let sy = hh - projected.y * hh;
              sx = Math.max(60, Math.min(container.clientWidth - 60, sx));
              sy = Math.max(40, Math.min(container.clientHeight - 40, sy));
              div.style.left = sx + "px";
              div.style.top = sy + "px";
            }
          }
        }
      });

      // Moons
      S.moons.forEach((m) => {
        const parent = S.planets.find((p) => p.sector === m.sector);
        if (!parent) return;
        const pp = parent.mesh.position;
        const ma = m.moonAngle + S.time * 0.35;
        const mx = pp.x + Math.cos(ma) * m.moonOrbit;
        const mz = pp.z + Math.sin(ma) * m.moonOrbit;
        m.mesh.position.set(mx, 0, mz);
        m.hitMesh.position.set(mx, 0, mz);
        if (m.glow) m.glow.position.set(mx, 0, mz);

        // Trail follows parent planet
        m.trail.position.set(pp.x, 0, pp.z);

        if (S.mode === "system") {
          (m.mesh.material as THREE.MeshBasicMaterial).opacity = 0.3;
          m.mesh.scale.setScalar(0.65);
          if (m.glow) (m.glow.material as THREE.MeshBasicMaterial).opacity = 0.04;
          m.trail.visible = false;
        } else if (m.sector === S.targetSector) {
          (m.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95;
          m.mesh.scale.setScalar(1.5);
          if (m.glow) (m.glow.material as THREE.MeshBasicMaterial).opacity = 0.15 + Math.sin(S.time * 2) * 0.08;
          m.trail.visible = true;
        } else {
          (m.mesh.material as THREE.MeshBasicMaterial).opacity = 0.04;
          m.mesh.scale.setScalar(0.3);
          if (m.glow) (m.glow.material as THREE.MeshBasicMaterial).opacity = 0;
          m.trail.visible = false;
        }
      });

      // Camera
      camera.position.lerp(S.cameraPos, 0.03);
      const lt = (camera as any).userData.lookTarget || new THREE.Vector3();
      lt.lerp(S.cameraTarget, 0.03);
      (camera as any).userData.lookTarget = lt;
      camera.lookAt(lt);

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);
    setIsReady(true);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      if (autoRotateTimeout) clearTimeout(autoRotateTimeout);
      labelDivs.forEach((div) => div.remove());
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, loading]);

  // --------------------------------------------------------
  // ZOOM
  // --------------------------------------------------------
  const zoomToSector = useCallback((sector: string) => {
    const S = stateRef.current;
    if (S.animating) return;
    S.animating = true;
    S.targetSector = sector;
    S.mode = "zoomed";

    const planet = S.planets.find((p) => p.sector === sector);
    if (!planet) return;
    const pp = planet.mesh.position.clone();
    const dir = pp.clone().normalize();
    const zoomDist = S.isMobile ? 5.6 : 2.8;

    S.cameraTarget = pp.clone();
    S.cameraPos = new THREE.Vector3(pp.x + dir.x * zoomDist, S.isMobile ? 4.0 : 2.0, pp.z + dir.z * zoomDist);

    window.history.pushState({ view: "zoomed" }, "");
    setMode("zoomed");
    setZoomedSector(sector);
    setSelectedCompany(null);
    setShowSunCard(false);
    setTimeout(() => { S.animating = false; }, 1200);
  }, []);

  const zoomOut = useCallback(() => {
    const S = stateRef.current;
    if (S.animating) return;
    S.animating = true;
    S.mode = "system";
    S.targetSector = null;

    S.cameraTarget = new THREE.Vector3(0, 0, 0);
    S.cameraPos = S.isMobile ? new THREE.Vector3(0, 0, 12) : new THREE.Vector3(0, 5, 12);

    setMode("system");
    setZoomedSector(null);
    setSelectedCompany(null);
    setTimeout(() => { S.animating = false; }, 1200);
  }, []);

  // --------------------------------------------------------
  // BROWSER BACK BUTTON
  // --------------------------------------------------------
  useEffect(() => {
    const onPopState = () => {
      if (stateRef.current.mode === "zoomed") {
        zoomOut();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [zoomOut]);

  // --------------------------------------------------------
  // RENDER
  // --------------------------------------------------------
  if (loading) {
    return (
      <div style={{ width: "100%", height: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: "2px solid rgba(212,165,116,0.2)", borderTopColor: "#D4A574", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ fontFamily: "'Lora', serif", fontStyle: "italic", color: "#D4A574", opacity: 0.6, fontSize: 14 }}>Mapping the landscape...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (fetchError && !companies.length) {
    return (
      <div style={{ width: "100%", height: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: 32 }}>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 22, color: "#E7F3E9", marginBottom: 12 }}>The Observatory</div>
          <p style={{ color: "rgba(231,243,233,0.4)", fontSize: 13, lineHeight: 1.6 }}>
            Unable to connect to the tracker API. The Observatory requires a live connection to tracker.lachlansear.com to display deal flow data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", background: "#080c14", fontFamily: "'IBM Plex Sans', 'Helvetica Neue', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

        .obs-fi { animation: obsFI 1s ease forwards; opacity:0; }
        .obs-fi-1 { animation-delay: 0.3s; }
        .obs-fi-2 { animation-delay: 0.7s; }
        .obs-fi-3 { animation-delay: 1.2s; }
        @keyframes obsFI { to { opacity:1; } }
        .obs-su { animation: obsSU 0.6s cubic-bezier(0.16,1,0.3,1) forwards; opacity:0; transform: translateY(16px); }
        @keyframes obsSU { to { opacity:1; transform: translateY(0); } }
        .obs-ci { animation: obsCI 0.35s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes obsCI { from { opacity:0; transform: translateX(16px); } to { opacity:1; transform: translateX(0); } }

        .obs-g { background: rgba(6,9,16,0.82); border: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }

        .obs-row { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:8px; cursor:pointer; transition: background 0.2s, border-color 0.2s; border: 1px solid transparent; }
        .obs-row:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.06); }
        .obs-row.active { background: rgba(212,165,116,0.08); border-color: rgba(212,165,116,0.2); }

        .obs-pill { display:inline-block; padding:3px 9px; border-radius:11px; font-size:9px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; }
        .obs-bp { background:rgba(212,165,116,0.15); color:#D4A574; border:1px solid rgba(212,165,116,0.25); }
        .obs-wp { background:rgba(110,206,138,0.12); color:#6ECE8A; border:1px solid rgba(110,206,138,0.2); }

        .obs-btn { background:rgba(212,165,116,0.1); border:1px solid rgba(212,165,116,0.25); color:#D4A574; padding:8px 18px; border-radius:6px; cursor:pointer; font-family:'IBM Plex Sans',sans-serif; font-size:11px; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; transition:all 0.25s; text-decoration:none; display:inline-block; }
        .obs-btn:hover { background:rgba(212,165,116,0.2); border-color:rgba(212,165,116,0.45); }

        .obs-bb { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.5); padding:7px 16px; border-radius:6px; cursor:pointer; font-family:'IBM Plex Sans',sans-serif; font-size:11px; font-weight:500; letter-spacing:0.04em; transition:all 0.25s; }
        .obs-bb:hover { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.75); }

        .obs-cl { position:absolute; top:12px; right:12px; background:none; border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.4); width:28px; height:28px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; transition:all 0.2s; }
        .obs-cl:hover { border-color:rgba(255,255,255,0.25); color:rgba(255,255,255,0.7); }

        .obs-link { color:#D4A574; text-decoration:none; font-size:11px; font-weight:500; letter-spacing:0.04em; transition:color 0.2s; }
        .obs-link:hover { color:#E8D4B8; }

        .obs-panel { scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.1) transparent; }
        .obs-panel::-webkit-scrollbar { width:4px; }
        .obs-panel::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:4px; }

        @media (max-width:768px) {
          .obs-hdr { padding:10px 16px 0 !important; }
          .obs-hdr h1 { font-size:18px !important; }
          .obs-hdr p { font-size:11px !important; margin-top:4px !important; }
          .obs-sp { width:100% !important; right:0 !important; left:0 !important; top:auto !important; bottom:0 !important; max-height:45vh !important; border-radius:14px 14px 0 0 !important; }
          .obs-cc { left:0 !important; right:0 !important; bottom:0 !important; max-width:100% !important; border-radius:14px 14px 0 0 !important; padding:16px !important; }
          .obs-sts { gap:16px !important; margin-top:10px !important; }
          .obs-stat-num { font-size:16px !important; }
          .obs-sun-card { width:calc(100% - 32px) !important; max-width:100% !important; }
          .obs-updated { margin-top:6px !important; }
        }
      `}</style>

      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* ======== SYSTEM VIEW ======== */}
      {isReady && mode === "system" && (
        <div className="obs-hdr obs-fi" style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
          padding: "30px 36px 0",
          background: "linear-gradient(to bottom, rgba(6,9,16,0.85) 0%, transparent 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 600, color: "#E7F3E9", margin: 0, letterSpacing: "-0.01em" }}>
              The Observatory
            </h1>
            <span style={{ fontSize: 10, color: "rgba(231,243,233,0.2)", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Lachlan Sear
            </span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(231,243,233,0.35)", marginTop: 8, fontWeight: 300, lineHeight: 1.5, maxWidth: 480 }}>
            Mapping the AI landscape — from vertical specialists in regulated industries to the infrastructure and frontier tech powering them. Click a planet to explore a sector.
          </p>
          <div className="obs-sts" style={{ display: "flex", gap: 32, marginTop: 18 }}>
            {[
              { n: stats.total, l: "Companies" },
              { n: stats.sectors, l: "Sectors" },
              { n: stats.benchmark, l: "Benchmark" },
              { n: stats.countries, l: "Countries" },
            ].map(({ n, l }) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div className="obs-stat-num" style={{ fontFamily: "'Lora', serif", fontSize: 21, fontWeight: 600, color: "#E7F3E9" }}>{n}</div>
                <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(231,243,233,0.25)", marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>
          {lastUpdated && (
            <div className="obs-updated" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6ECE8A", display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "rgba(231,243,233,0.2)", letterSpacing: "0.06em" }}>{lastUpdated}</span>
            </div>
          )}
        </div>
      )}

      {/* ======== ZOOMED VIEW (DESKTOP) ======== */}
      {isReady && mode === "zoomed" && sectorConfig && !isMobileState && (
        <>
          {/* Header + description card */}
          <div className="obs-su" style={{
            position: "absolute", top: 22, left: 24, zIndex: 10,
            maxWidth: 380, borderRadius: 12, padding: "16px 20px",
            background: "rgba(6,9,16,0.85)", border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
              <button className="obs-bb" onClick={zoomOut}>&larr; All Sectors</button>
              <div>
                <h2 style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 600, color: sectorConfig.color, margin: 0 }}>
                  {zoomedSector}
                </h2>
                <span style={{ fontSize: 10, color: "rgba(231,243,233,0.25)", letterSpacing: "0.06em" }}>
                  {sectorCompanies.length} companies
                </span>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "rgba(231,243,233,0.35)", lineHeight: 1.55, fontWeight: 300, margin: "0 0 8px" }}>
              {sectorConfig.description}
            </p>
            {lastUpdated && (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6ECE8A", display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "rgba(231,243,233,0.2)", letterSpacing: "0.06em" }}>{lastUpdated}</span>
              </div>
            )}
          </div>

          {/* Company panel */}
          <div className="obs-sp obs-su obs-g obs-panel" style={{
            position: "absolute", top: 22, right: 20, zIndex: 10,
            width: 320, maxHeight: "calc(100vh - 80px)",
            borderRadius: 12, padding: "14px 6px", overflowY: "auto",
            animationDelay: "0.12s",
          }}>
            <div style={{ padding: "0 10px 8px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(231,243,233,0.2)", fontWeight: 500 }}>
              Companies
            </div>
            {sectorCompanies.map((co) => (
              <div
                key={co.id}
                className={`obs-row ${selectedCompany?.id === co.id ? "active" : ""}`}
                onClick={() => setSelectedCompany((p) => (p?.id === co.id ? null : co))}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: co.status === "Benchmark" ? "#D4A574" : sectorConfig.color,
                  boxShadow: co.status === "Benchmark" ? "0 0 8px rgba(212,165,116,0.5)" : "none",
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#E7F3E9", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span>{co.name}</span>
                    {co.status === "Benchmark" && <span className="obs-pill obs-bp">Benchmark</span>}
                    {co.status === "Written Up" && <span className="obs-pill obs-wp">Written Up</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(231,243,233,0.3)", marginTop: 2 }}>{co.geo}</div>
                </div>
              </div>
            ))}
            <div style={{ padding: "14px 12px 6px", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 6 }}>
              <a href={sectorConfig.article} target="_blank" rel="noopener noreferrer" className="obs-link">
                {sectorConfig.articleTitle} &rarr;
              </a>
            </div>
          </div>

          {/* Company detail card */}
          {selectedCompany && (
            <div className="obs-cc obs-ci obs-g" style={{
              position: "absolute", bottom: 24, left: 24, zIndex: 20,
              borderRadius: 12, padding: 20, maxWidth: 360, width: "100%",
            }}>
              <button className="obs-cl" onClick={() => setSelectedCompany(null)}>&times;</button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: selectedCompany.status === "Benchmark" ? "#D4A574" : sectorConfig.color,
                  boxShadow: selectedCompany.status === "Benchmark" ? "0 0 10px rgba(212,165,116,0.5)" : "none",
                }} />
                <h3 style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 600, color: "#E7F3E9", margin: 0 }}>
                  {selectedCompany.name}
                </h3>
                {selectedCompany.status === "Benchmark" && <span className="obs-pill obs-bp">Benchmark</span>}
              </div>
              <div style={{ fontSize: 10, color: "rgba(231,243,233,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                {selectedCompany.geo} &middot; {selectedCompany.sector}
              </div>
              <p style={{ fontSize: 13, color: "rgba(231,243,233,0.6)", lineHeight: 1.6, margin: "0 0 16px", fontWeight: 300 }}>
                {selectedCompany.description}
              </p>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <a href="https://tracker.lachlansear.com" target="_blank" rel="noopener noreferrer" className="obs-btn">
                  Full Analysis &rarr;
                </a>
                {selectedCompany.website && (
                  <a href={selectedCompany.website} target="_blank" rel="noopener noreferrer" className="obs-link">
                    Website
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ======== ZOOMED VIEW (MOBILE) ======== */}
      {isReady && mode === "zoomed" && sectorConfig && isMobileState && (
        <div className="obs-su obs-panel" style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "55vh",
          background: "#0a0f18", borderTop: "1px solid rgba(255,255,255,0.06)",
          zIndex: 10, overflowY: "auto",
        }}>
          <div style={{ padding: "16px 16px 80px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <button className="obs-bb" onClick={zoomOut}>&larr; All Sectors</button>
              <div>
                <h2 style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 600, color: sectorConfig.color, margin: 0 }}>
                  {zoomedSector}
                </h2>
                <span style={{ fontSize: 10, color: "rgba(231,243,233,0.25)", letterSpacing: "0.06em" }}>
                  {sectorCompanies.length} companies
                </span>
              </div>
            </div>

            {!selectedCompany ? (
              <>
                <p style={{ fontSize: 12, color: "rgba(231,243,233,0.3)", lineHeight: 1.55, fontWeight: 300, margin: "0 0 12px" }}>
                  {sectorConfig.description}
                </p>
                {lastUpdated && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6ECE8A", display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: "rgba(231,243,233,0.2)", letterSpacing: "0.06em" }}>{lastUpdated}</span>
                  </div>
                )}
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 0 12px" }} />
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(231,243,233,0.2)", fontWeight: 500, marginBottom: 8 }}>
                  Companies
                </div>
                {sectorCompanies.map((co) => (
                  <div
                    key={co.id}
                    className="obs-row"
                    onClick={() => setSelectedCompany(co)}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: co.status === "Benchmark" ? "#D4A574" : sectorConfig.color,
                      boxShadow: co.status === "Benchmark" ? "0 0 8px rgba(212,165,116,0.5)" : "none",
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#E7F3E9", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <span>{co.name}</span>
                        {co.status === "Benchmark" && <span className="obs-pill obs-bp">Benchmark</span>}
                        {co.status === "Written Up" && <span className="obs-pill obs-wp">Written Up</span>}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(231,243,233,0.3)", marginTop: 2 }}>{co.geo}</div>
                    </div>
                  </div>
                ))}
                <div style={{ padding: "14px 0 6px", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 6 }}>
                  <a href={sectorConfig.article} target="_blank" rel="noopener noreferrer" className="obs-link">
                    {sectorConfig.articleTitle} &rarr;
                  </a>
                </div>
              </>
            ) : (
              <>
                <button className="obs-bb" onClick={() => setSelectedCompany(null)} style={{ marginBottom: 16 }}>&larr; Back to list</button>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: selectedCompany.status === "Benchmark" ? "#D4A574" : sectorConfig.color,
                    boxShadow: selectedCompany.status === "Benchmark" ? "0 0 10px rgba(212,165,116,0.5)" : "none",
                  }} />
                  <h3 style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 600, color: "#E7F3E9", margin: 0 }}>
                    {selectedCompany.name}
                  </h3>
                  {selectedCompany.status === "Benchmark" && <span className="obs-pill obs-bp">Benchmark</span>}
                  {selectedCompany.status === "Written Up" && <span className="obs-pill obs-wp">Written Up</span>}
                </div>
                <div style={{ fontSize: 10, color: "rgba(231,243,233,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                  {selectedCompany.geo} &middot; {selectedCompany.sector}
                </div>
                <p style={{ fontSize: 13, color: "rgba(231,243,233,0.6)", lineHeight: 1.6, margin: "0 0 16px", fontWeight: 300 }}>
                  {selectedCompany.description}
                </p>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                  <a href="https://tracker.lachlansear.com" target="_blank" rel="noopener noreferrer" className="obs-btn">
                    Full Analysis &rarr;
                  </a>
                  {selectedCompany.website && (
                    <a href={selectedCompany.website} target="_blank" rel="noopener noreferrer" className="obs-link">
                      Website
                    </a>
                  )}
                </div>
                <a href={sectorConfig.article} target="_blank" rel="noopener noreferrer" className="obs-link">
                  Read the thesis &rarr;
                </a>
              </>
            )}
          </div>
        </div>
      )}

      {/* ======== SUN CARD ======== */}
      {showSunCard && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 25, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}
          onClick={() => setShowSunCard(false)}
        >
          <div
            className="obs-g obs-ci obs-sun-card"
            style={{ position: "relative", borderRadius: 14, padding: 28, maxWidth: 420, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="obs-cl" onClick={() => setShowSunCard(false)}>&times;</button>
            <h2 style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 600, color: "#E7F3E9", margin: "0 0 6px" }}>
              The Observatory
            </h2>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(231,243,233,0.3)", marginBottom: 16 }}>
              Lachlan Sear
            </div>
            <p style={{ fontSize: 13, color: "rgba(231,243,233,0.55)", lineHeight: 1.65, fontWeight: 300, margin: "0 0 20px" }}>
              A curated, live view of the companies shaping AI across four sectors. My thesis centres on vertical AI in regulated industries &mdash; healthcare, legal, dental, veterinary &mdash; where domain expertise and compliance complexity create moats that horizontal wrappers cannot replicate. But the full picture includes the horizontal platforms, infrastructure layer, and deep tech powering them. Each planet is a sector. Each moon is a company. The system updates automatically as my pipeline evolves.
            </p>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <a href="https://lachlansear.com" target="_blank" rel="noopener noreferrer" className="obs-link">
                lachlansear.com &rarr;
              </a>
              <a href="https://www.linkedin.com/in/lachlan-sear-41b84b131/" target="_blank" rel="noopener noreferrer" className="obs-link">
                LinkedIn &rarr;
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
