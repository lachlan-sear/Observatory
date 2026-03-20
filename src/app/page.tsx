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
  },
  "Horizontal AI": {
    color: "#E8C87A",
    orbitRadius: 5.2,
    planetSize: 0.25,
    speed: 0.04,
    article: "https://lachlansear.com",
    articleTitle: "View on lachlansear.com",
    description: "General-purpose AI platforms, tools, and models serving broad markets. Category leaders emerge through distribution, developer loyalty, and ecosystem effects rather than domain depth.",
  },
  "AI Infrastructure": {
    color: "#D49A6A",
    orbitRadius: 7.0,
    planetSize: 0.20,
    speed: 0.03,
    article: "https://lachlansear.com",
    articleTitle: "View on lachlansear.com",
    description: "The picks-and-shovels layer \u2014 inference engines, workflow orchestration, data pipelines, and developer tooling powering the application layer above.",
  },
  "Deep Tech & Defence": {
    color: "#8B9FC4",
    orbitRadius: 9.0,
    planetSize: 0.22,
    speed: 0.02,
    article: "https://lachlansear.com",
    articleTitle: "View on lachlansear.com",
    description: "Frontier research commercialisation, autonomous systems, defence AI, and dual-use technologies. Sovereign capability and deep technical moats define this orbit.",
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
  sector: string;
  cfg: SectorConfig;
  angle: number;
}

interface MoonData {
  mesh: THREE.Mesh;
  glow: THREE.Mesh | null;
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
    cameraPos: new THREE.Vector3(0, 7, 18),
  });

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [mode, setMode] = useState("system");
  const [zoomedSector, setZoomedSector] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isReady, setIsReady] = useState(false);
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
        console.warn("Failed to fetch from tracker API, using fallback:", e);
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

  const sectorCompanies = useMemo(() => {
    if (!zoomedSector) return [];
    return companies.filter((c) => c.sector === zoomedSector);
  }, [companies, zoomedSector]);

  const sectorConfig = useMemo(() => zoomedSector ? SECTORS[zoomedSector] : null, [zoomedSector]);

  // --------------------------------------------------------
  // THREE.JS SCENE
  // --------------------------------------------------------
  useEffect(() => {
    if (loading || !mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const S = stateRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#060910");
    scene.fog = new THREE.FogExp2("#060910", 0.01);
    S.scene = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
    camera.position.set(0, 7, 18);
    (camera as any).userData.lookTarget = new THREE.Vector3(0, 0, 0);
    S.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    S.renderer = renderer;

    // Stars
    const starCount = 2500;
    const starGeo = new THREE.BufferGeometry();
    const sPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 50 + Math.random() * 80;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      sPos[i * 3] = r * Math.sin(p) * Math.cos(t);
      sPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      sPos[i * 3 + 2] = r * Math.cos(p);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.5, sizeAttenuation: true })));

    // Sun
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 64, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#D4A574") })
    );
    scene.add(sun);
    S.sunMesh = sun;

    [1.3, 1.8, 2.5].forEach((s, i) => {
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(s, 32, 32),
        new THREE.MeshBasicMaterial({ color: new THREE.Color("#D4A574"), transparent: true, opacity: [0.07, 0.035, 0.015][i], side: THREE.BackSide })
      ));
    });

    scene.add(new THREE.PointLight("#D4A574", 2, 50, 1));
    scene.add(new THREE.AmbientLight("#1a2030", 1.5));

    // Build planets + orbits + moons
    const sectorEntries = Object.entries(SECTORS);
    S.planets = [];
    S.moons = [];

    sectorEntries.forEach(([sectorName, cfg], idx) => {
      // Orbit ring
      const curve = new THREE.EllipseCurve(0, 0, cfg.orbitRadius, cfg.orbitRadius, 0, Math.PI * 2, false, 0);
      const pts = curve.getPoints(128);
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, 0, p.y)));
      scene.add(new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(cfg.color), transparent: true, opacity: 0.07 })));

      // Planet
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(cfg.planetSize, 32, 32),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.color), emissive: new THREE.Color(cfg.color), emissiveIntensity: 0.3, roughness: 0.7, metalness: 0.2 })
      );
      planet.userData = { sector: sectorName };
      scene.add(planet);

      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(cfg.planetSize * 2.5, 16, 16),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.color), transparent: true, opacity: 0.06, side: THREE.BackSide })
      );
      scene.add(glow);

      // Label
      const canvas = document.createElement("canvas");
      canvas.width = 512; canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.font = "500 26px 'IBM Plex Sans', Arial, sans-serif";
      ctx.fillStyle = cfg.color;
      ctx.textAlign = "center";
      ctx.fillText(sectorName.toUpperCase(), 256, 40);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, opacity: 0.6 }));
      sprite.scale.set(2.8, 0.35, 1);
      scene.add(sprite);

      const startAngle = (idx / sectorEntries.length) * Math.PI * 2;
      S.planets.push({ mesh: planet, glow, label: sprite, sector: sectorName, cfg, angle: startAngle });

      // Moons
      const sectorCos = companies.filter((c) => c.sector === sectorName);
      const distributed = distributeCompaniesOnOrbit(sectorCos, cfg.planetSize);
      distributed.forEach((co) => {
        const isBench = co.status === "Benchmark";
        const sz = isBench ? 0.065 : 0.04;
        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(sz, 16, 16),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(isBench ? "#D4A574" : cfg.color), transparent: true, opacity: 0.9 })
        );
        moon.userData = { company: co };
        scene.add(moon);

        let moonGlow: THREE.Mesh | null = null;
        if (isBench) {
          moonGlow = new THREE.Mesh(
            new THREE.SphereGeometry(sz * 3, 16, 16),
            new THREE.MeshBasicMaterial({ color: new THREE.Color("#D4A574"), transparent: true, opacity: 0.12 })
          );
          scene.add(moonGlow);
        }
        S.moons.push({ mesh: moon, glow: moonGlow, company: co, sector: sectorName, moonAngle: co.moonAngle, moonOrbit: co.moonOrbit });
      });
    });

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e: MouseEvent) => {
      if (S.animating) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      if (S.mode === "system") {
        const hits = raycaster.intersectObjects(S.planets.map((p) => p.mesh));
        if (hits.length > 0) {
          const sec = hits[0].object.userData.sector;
          zoomToSector(sec);
        }
      } else {
        const sectorMoons = S.moons.filter((m) => m.sector === S.targetSector);
        const hits = raycaster.intersectObjects(sectorMoons.map((m) => m.mesh));
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
        const hits = raycaster.intersectObjects(S.planets.map((p) => p.mesh));
        hoveredRef.current = hits.length > 0 ? hits[0].object.userData.sector : null;
        renderer.domElement.style.cursor = hits.length > 0 ? "pointer" : "default";
      } else {
        const sectorMoons = S.moons.filter((m) => m.sector === S.targetSector);
        const hits = raycaster.intersectObjects(sectorMoons.map((m) => m.mesh));
        renderer.domElement.style.cursor = hits.length > 0 ? "pointer" : "default";
      }
    };

    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("mousemove", onMouseMove);

    // Animate
    const animate = () => {
      requestAnimationFrame(animate);
      S.time += 0.006;

      sun.rotation.y += 0.001;

      S.planets.forEach((p) => {
        const angle = p.angle + S.time * p.cfg.speed;
        const x = Math.cos(angle) * p.cfg.orbitRadius;
        const z = Math.sin(angle) * p.cfg.orbitRadius;
        p.mesh.position.set(x, 0, z);
        p.glow.position.set(x, 0, z);
        p.label.position.set(x, p.cfg.planetSize + 0.5, z);

        const isHovered = hoveredRef.current === p.sector;
        (p.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = isHovered ? 0.6 + Math.sin(S.time * 3) * 0.2 : 0.3;
        (p.glow.material as THREE.MeshBasicMaterial).opacity = isHovered ? 0.14 : 0.06;
        (p.label.material as THREE.SpriteMaterial).opacity = isHovered ? 0.9 : 0.55;
      });

      S.moons.forEach((m) => {
        const parent = S.planets.find((p) => p.sector === m.sector);
        if (!parent) return;
        const pp = parent.mesh.position;
        const ma = m.moonAngle + S.time * 0.35;
        m.mesh.position.set(pp.x + Math.cos(ma) * m.moonOrbit, 0, pp.z + Math.sin(ma) * m.moonOrbit);
        if (m.glow) m.glow.position.copy(m.mesh.position);

        if (S.mode === "system") {
          (m.mesh.material as THREE.MeshBasicMaterial).opacity = 0.3;
          m.mesh.scale.setScalar(0.65);
          if (m.glow) (m.glow.material as THREE.MeshBasicMaterial).opacity = 0.04;
        } else if (m.sector === S.targetSector) {
          (m.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95;
          m.mesh.scale.setScalar(1.5);
          if (m.glow) (m.glow.material as THREE.MeshBasicMaterial).opacity = 0.15 + Math.sin(S.time * 2) * 0.08;
        } else {
          (m.mesh.material as THREE.MeshBasicMaterial).opacity = 0.04;
          m.mesh.scale.setScalar(0.3);
          if (m.glow) (m.glow.material as THREE.MeshBasicMaterial).opacity = 0;
        }
      });

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

    S.cameraTarget = pp.clone();
    S.cameraPos = new THREE.Vector3(pp.x + dir.x * 2.8, 2.0, pp.z + dir.z * 2.8);

    setMode("zoomed");
    setZoomedSector(sector);
    setSelectedCompany(null);
    setTimeout(() => { S.animating = false; }, 1200);
  }, []);

  const zoomOut = useCallback(() => {
    const S = stateRef.current;
    if (S.animating) return;
    S.animating = true;
    S.mode = "system";
    S.targetSector = null;

    S.cameraTarget = new THREE.Vector3(0, 0, 0);
    S.cameraPos = new THREE.Vector3(0, 7, 18);

    setMode("system");
    setZoomedSector(null);
    setSelectedCompany(null);
    setTimeout(() => { S.animating = false; }, 1200);
  }, []);

  // --------------------------------------------------------
  // RENDER
  // --------------------------------------------------------
  if (loading) {
    return (
      <div style={{ width: "100%", height: "100vh", background: "#060910", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: "2px solid rgba(212,165,116,0.2)", borderTopColor: "#D4A574", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ color: "rgba(231,243,233,0.4)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading tracker data</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (fetchError && !companies.length) {
    return (
      <div style={{ width: "100%", height: "100vh", background: "#060910", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif" }}>
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
    <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", background: "#060910", fontFamily: "'IBM Plex Sans', 'Helvetica Neue', sans-serif" }}>
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

        @media (max-width:700px) {
          .obs-hdr { padding:14px 16px 0 !important; }
          .obs-hdr h1 { font-size:20px !important; }
          .obs-sp { width:100% !important; right:0 !important; left:0 !important; top:auto !important; bottom:0 !important; max-height:50vh !important; border-radius:14px 14px 0 0 !important; }
          .obs-cc { left:12px !important; right:12px !important; bottom:0 !important; max-width:100% !important; border-radius:14px 14px 0 0 !important; }
          .obs-sts { gap:20px !important; }
        }
      `}</style>

      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* ======== SYSTEM VIEW ======== */}
      {isReady && mode === "system" && (
        <>
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
              Mapping vertical AI across regulated industries. Click a planet to explore a vertical.
            </p>
            <div className="obs-sts" style={{ display: "flex", gap: 32, marginTop: 18 }}>
              {[
                { n: stats.total, l: "Companies" },
                { n: stats.sectors, l: "Sectors" },
                { n: stats.benchmark, l: "Benchmark" },
                { n: stats.countries, l: "Countries" },
              ].map(({ n, l }) => (
                <div key={l} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Lora', serif", fontSize: 21, fontWeight: 600, color: "#E7F3E9" }}>{n}</div>
                  <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(231,243,233,0.25)", marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom line */}
          <div className="obs-fi obs-fi-3" style={{ position: "absolute", bottom: 22, left: 0, right: 0, textAlign: "center", zIndex: 10 }}>
            <span style={{ fontSize: 11, color: "rgba(231,243,233,0.18)", fontWeight: 300 }}>
              Full analysis available on request &mdash;{" "}
              <a href="https://www.linkedin.com/in/lachlan-sear-41b84b131/" target="_blank" rel="noopener noreferrer"
                style={{ color: "rgba(212,165,116,0.4)", textDecoration: "none", borderBottom: "1px solid rgba(212,165,116,0.15)" }}>
                LinkedIn
              </a>
              {" "} &middot; {" "}
              <a href="https://lachlansear.com" target="_blank" rel="noopener noreferrer"
                style={{ color: "rgba(212,165,116,0.4)", textDecoration: "none", borderBottom: "1px solid rgba(212,165,116,0.15)" }}>
                lachlansear.com
              </a>
            </span>
          </div>
        </>
      )}

      {/* ======== ZOOMED VIEW ======== */}
      {isReady && mode === "zoomed" && sectorConfig && (
        <>
          {/* Header */}
          <div className="obs-su" style={{ position: "absolute", top: 22, left: 24, zIndex: 10, display: "flex", alignItems: "center", gap: 14 }}>
            <button className="obs-bb" onClick={zoomOut}>&larr; System</button>
            <div>
              <h2 style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 600, color: sectorConfig.color, margin: 0 }}>
                {zoomedSector}
              </h2>
              <span style={{ fontSize: 10, color: "rgba(231,243,233,0.25)", letterSpacing: "0.06em" }}>
                {sectorCompanies.length} companies
              </span>
            </div>
          </div>

          {/* Sector description */}
          <div className="obs-su" style={{
            position: "absolute", top: 72, left: 24, zIndex: 10,
            maxWidth: 340, animationDelay: "0.1s",
          }}>
            <p style={{ fontSize: 12, color: "rgba(231,243,233,0.3)", lineHeight: 1.55, fontWeight: 300, margin: 0 }}>
              {sectorConfig.description}
            </p>
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

          {/* Bottom line */}
          <div style={{ position: "absolute", bottom: selectedCompany ? 150 : 22, left: 0, right: 0, textAlign: "center", zIndex: 5, transition: "bottom 0.3s" }}>
            <span style={{ fontSize: 11, color: "rgba(231,243,233,0.15)", fontWeight: 300 }}>
              Full analysis available on request &mdash;{" "}
              <a href="https://www.linkedin.com/in/lachlan-sear-41b84b131/" target="_blank" rel="noopener noreferrer"
                style={{ color: "rgba(212,165,116,0.35)", textDecoration: "none", borderBottom: "1px solid rgba(212,165,116,0.15)" }}>
                LinkedIn
              </a>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
