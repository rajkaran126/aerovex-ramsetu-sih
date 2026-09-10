import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Sky, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store/useStore';
import { PhotogrammetricTerrain, TerrainErrorBoundary } from './PhotogrammetricTerrain';

// ── 1. PROCEDURAL TERRAIN TEXTURE GENERATORS ──────────────────────────────

// A. Standard Mixed Urban & Lake Landscape
function createStandardTexture(): THREE.CanvasTexture {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Farmland mosaic
  ctx.fillStyle = '#455d38';
  ctx.fillRect(0, 0, size, size);
  const cols = 36, rows = 36;
  const cW = size / cols, cH = size / rows;
  const fields = ['#384f2c', '#465e34', '#526b3c', '#5e7544', '#687f4c', '#758954', '#4b6338', '#3c532f'];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      ctx.fillStyle = fields[(c * 7 + r * 11) % fields.length];
      ctx.fillRect(c * cW, r * cH, cW, cH);
      ctx.strokeStyle = '#27361f';
      ctx.strokeRect(c * cW, r * cH, cW, cH);
    }
  }

  // Lake on left
  const lk = ctx.createLinearGradient(0, size * 0.1, size * 0.5, size * 0.9);
  lk.addColorStop(0, '#193854');
  lk.addColorStop(0.5, '#26547c');
  lk.addColorStop(1, '#152e46');
  ctx.fillStyle = lk;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.10);
  ctx.bezierCurveTo(size * 0.28, size * 0.18, size * 0.48, size * 0.35, size * 0.50, size * 0.60);
  ctx.bezierCurveTo(size * 0.52, size * 0.80, size * 0.32, size * 0.94, size * 0.18, size);
  ctx.lineTo(0, size);
  ctx.closePath();
  ctx.fill();

  // Winding river
  ctx.strokeStyle = '#234a6e';
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.moveTo(size * 0.92, 0);
  ctx.bezierCurveTo(size * 0.85, size * 0.25, size * 0.95, size * 0.45, size * 0.75, size * 0.65);
  ctx.bezierCurveTo(size * 0.60, size * 0.80, size * 0.85, size * 0.95, size, size * 0.98);
  ctx.stroke();

  // City & Airport runway
  ctx.fillStyle = '#444a50';
  ctx.fillRect(size * 0.14, size * 0.84, 180, 50);
  ctx.fillStyle = '#1c1f22';
  ctx.fillRect(size * 0.16, size * 0.86, 140, 10);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}

// B. High-Altitude Mountainous Terrain (Himalayas / Hindu Kush)
function createMountainTexture(): THREE.CanvasTexture {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Dark slate and granite base
  ctx.fillStyle = '#2b3036';
  ctx.fillRect(0, 0, size, size);

  // Rocky scree & ridges
  for (let i = 0; i < 60; i++) {
    const rx = Math.random() * size;
    const ry = Math.random() * size;
    const rad = 60 + Math.random() * 250;
    const g = ctx.createRadialGradient(rx, ry, 10, rx, ry, rad);
    g.addColorStop(0, '#3f4750');
    g.addColorStop(0.6, '#33383f');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(rx, ry, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Snowcaps and Glacial ice fields (White & Pale Cyan)
  for (let i = 0; i < 40; i++) {
    const sx = Math.random() * size;
    const sy = Math.random() * size;
    const sRad = 40 + Math.random() * 160;
    const sg = ctx.createRadialGradient(sx, sy, 5, sx, sy, sRad);
    sg.addColorStop(0, '#f2f7fc');
    sg.addColorStop(0.5, '#dbe7f2');
    sg.addColorStop(0.8, '#a6c2db');
    sg.addColorStop(1, 'transparent');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx, sy, sRad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glacial meltwater gorges
  ctx.strokeStyle = '#294f70';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.4);
  ctx.bezierCurveTo(size * 0.3, size * 0.45, size * 0.6, size * 0.35, size, size * 0.7);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}

// C. Maritime & Coastal Domains (EEZ / Coral Archipelagos)
function createMaritimeTexture(): THREE.CanvasTexture {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Deep oceanic blue
  const oceanGrad = ctx.createLinearGradient(0, 0, size, size);
  oceanGrad.addColorStop(0, '#0a233a');
  oceanGrad.addColorStop(0.5, '#12395a');
  oceanGrad.addColorStop(1, '#0c2842');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, size, size);

  // Tropical Island Archipelagos & Coral Reefs
  const islands = [
    { x: size * 0.28, y: size * 0.35, r: 160 },
    { x: size * 0.38, y: size * 0.42, r: 110 },
    { x: size * 0.65, y: size * 0.68, r: 180 },
    { x: size * 0.75, y: size * 0.60, r: 120 },
    { x: size * 0.50, y: size * 0.85, r: 90 },
  ];

  for (const isl of islands) {
    // Coral reef shallows (turquoise/aquamarine)
    const reefG = ctx.createRadialGradient(isl.x, isl.y, 20, isl.x, isl.y, isl.r * 1.5);
    reefG.addColorStop(0, '#249da6');
    reefG.addColorStop(0.6, '#186d78');
    reefG.addColorStop(1, 'transparent');
    ctx.fillStyle = reefG;
    ctx.beginPath();
    ctx.arc(isl.x, isl.y, isl.r * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Sandy beach ring
    ctx.fillStyle = '#ded5bc';
    ctx.beginPath();
    ctx.arc(isl.x, isl.y, isl.r * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Lush tropical interior
    ctx.fillStyle = '#225028';
    ctx.beginPath();
    ctx.arc(isl.x, isl.y, isl.r * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shipping lane navigation corridor dashed lines
  ctx.strokeStyle = '#00d4ff33';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.75);
  ctx.lineTo(size, size * 0.25);
  ctx.stroke();
  ctx.setLineDash([]);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}

// D. Desert & Arid Plains (Sand Dunes, Salt Flats & Rocky Mesas)
function createDesertTexture(): THREE.CanvasTexture {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Base golden desert sand
  ctx.fillStyle = '#c69557';
  ctx.fillRect(0, 0, size, size);

  // Sinuous windblown sand dunes
  for (let i = 0; i < 45; i++) {
    const y = (i / 45) * size;
    ctx.strokeStyle = i % 2 === 0 ? '#daaa6c' : '#b27f42';
    ctx.lineWidth = 14 + (i % 5) * 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      size * 0.25, y + 40 * Math.sin(i),
      size * 0.75, y - 40 * Math.cos(i),
      size, y + 20 * Math.sin(i * 1.5)
    );
    ctx.stroke();
  }

  // Rocky plateaus & dry wadi channels
  ctx.strokeStyle = '#855632';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(size * 0.1, 0);
  ctx.bezierCurveTo(size * 0.3, size * 0.4, size * 0.2, size * 0.7, size * 0.5, size);
  ctx.stroke();

  // Fine sand ripple noise
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    data[i] = Math.min(255, Math.max(0, data[i] + n));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}

// E. Dense Jungle & Tropical Forest (Canopy & Winding River)
function createForestTexture(): THREE.CanvasTexture {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Deep rainforest base
  ctx.fillStyle = '#1c3d18';
  ctx.fillRect(0, 0, size, size);

  // Multi-toned canopy foliage patches
  const canopyCols = ['#153312', '#21491d', '#285823', '#1e431a', '#306429', '#173b14', '#265121'];
  for (let i = 0; i < 280; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rad = 25 + Math.random() * 80;
    ctx.fillStyle = canopyCols[i % canopyCols.length];
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Winding brown-green tropical jungle river
  ctx.strokeStyle = '#3d4d30';
  ctx.lineWidth = 32;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.1, 0);
  ctx.bezierCurveTo(size * 0.4, size * 0.25, size * 0.15, size * 0.6, size * 0.6, size * 0.75);
  ctx.bezierCurveTo(size * 0.85, size * 0.85, size * 0.9, size * 0.95, size, size * 0.98);
  ctx.stroke();

  // Clearings / Outposts (FLIR inspection targets)
  ctx.fillStyle = '#5a5438';
  ctx.fillRect(size * 0.45, size * 0.48, 28, 20);
  ctx.fillRect(size * 0.62, size * 0.65, 34, 24);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}

// ── 2. DYNAMIC TERRAIN ELEVATION MESH ──────────────────────────────────────
function AerialTerrainMesh({ environment }: { environment: string }) {
  const texture = useMemo(() => {
    switch (environment) {
      case 'MOUNTAIN':
      case 'HIGH_ALTITUDE':
        return createMountainTexture();
      case 'MARITIME':
        return createMaritimeTexture();
      case 'DESERT':
        return createDesertTexture();
      case 'FOREST':
        return createForestTexture();
      default:
        return createStandardTexture();
    }
  }, [environment]);

  const terrainGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(3200, 3200, 140, 140);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      let h = 0;

      if (environment === 'MOUNTAIN' || environment === 'HIGH_ALTITUDE') {
        // Massive jagged Himalayan mountain ranges & deep gorges
        const peak1 = Math.sin(x * 0.005) * Math.cos(y * 0.005) * 95;
        const peak2 = Math.sin(x * 0.012 + 1.2) * Math.cos(y * 0.014 + 0.8) * 55;
        const ridges = Math.abs(Math.sin(x * 0.02 + y * 0.01)) * 40;
        h = peak1 + peak2 + ridges;
      } else if (environment === 'MARITIME') {
        // Ocean surface with slight island atoll elevations
        const distFromCenter = Math.hypot(x + 200, y - 100);
        if (distFromCenter < 350) {
          h = Math.max(0, (1 - distFromCenter / 350) * 16);
        } else {
          h = -2;
        }
      } else if (environment === 'DESERT') {
        // Windblown dunes and flat plateaus
        const dune1 = Math.sin(x * 0.008 + y * 0.004) * 14;
        const dune2 = Math.sin(x * 0.016) * 6;
        h = Math.max(0, dune1 + dune2);
      } else if (environment === 'FOREST') {
        // Rolling jungle hills
        const hill1 = Math.sin(x * 0.006) * Math.cos(y * 0.006) * 26;
        const hill2 = Math.sin(x * 0.015 + 0.8) * 10;
        h = Math.max(0, hill1 + hill2);
      } else {
        // Standard mixed terrain
        const u = (x + 1600) / 3200;
        const v = (y + 1600) / 3200;
        if (u > 0.36) {
          const h1 = Math.sin(x * 0.005) * Math.cos(y * 0.005) * 22;
          const h2 = Math.sin(x * 0.012 + 1.2) * Math.cos(y * 0.010 + 0.8) * 12;
          h = Math.max(0, h1 + h2);
          if (v > 0.60) h += (v - 0.60) * 110;
        } else {
          h = -3.0;
        }
      }

      pos.setZ(i, h);
    }

    geo.computeVertexNormals();
    return geo;
  }, [environment]);

  const showLake = environment === 'STANDARD';
  const showFullOcean = environment === 'MARITIME';

  return (
    <group position={[0, -15, 0]}>
      {/* Terrain Base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <primitive object={terrainGeo} />
        <meshStandardMaterial
          map={texture}
          roughness={environment === 'MARITIME' ? 0.4 : 0.82}
          metalness={environment === 'MARITIME' ? 0.2 : 0.05}
        />
      </mesh>

      {/* Standard Lake Glint */}
      {showLake && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-750, 0.2, 100]} receiveShadow>
          <planeGeometry args={[1500, 2200, 48, 48]} />
          <meshStandardMaterial color="#173a5a" roughness={0.05} metalness={0.85} transparent opacity={0.96} />
        </mesh>
      )}

      {/* Full Ocean Water Plane for Maritime Domain */}
      {showFullOcean && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[3400, 3400, 64, 64]} />
          <meshStandardMaterial color="#0e2e4a" roughness={0.04} metalness={0.7} transparent opacity={0.92} />
        </mesh>
      )}
    </group>
  );
}

// ── 3. TERRAIN-SPECIFIC TACTICAL SENSOR OVERLAYS ──────────────────────────

// A. Synthetic Aperture Radar (SAR) Scanning Cone for Desert
function SARRadarBeam({ position }: { position: [number, number, number] }) {
  const radarConeRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (radarConeRef.current) {
      radarConeRef.current.rotation.y += delta * 1.5;
    }
  });

  return (
    <group position={position}>
      {/* SAR Radar Beam from Drone to Desert Ground */}
      <mesh ref={radarConeRef} position={[0, -35, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[1.5, 28, 70, 24, 1, true]} />
        <meshBasicMaterial color="#00ffcc" wireframe transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      {/* Ground Radar Footprint Disc */}
      <mesh position={[0, -70, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[22, 28, 32]} />
        <meshBasicMaterial color="#00ffcc" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// B. Thermal FLIR Loitering Scan for Dense Jungle
function ThermalLoiterScan({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Thermal Sensor LOITER Circle in Sky */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[26, 28, 48]} />
        <meshBasicMaterial color="#ff5533" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Canopy Hotspot Detection Markers */}
      {[
        [-15, -60, -10],
        [18, -58, 12],
        [-6, -62, 22],
      ].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <mesh>
            <boxGeometry args={[3.5, 0.4, 3.5]} />
            <meshBasicMaterial color="#ff2200" transparent opacity={0.8} />
          </mesh>
          <pointLight color="#ff3300" intensity={0.8} distance={15} />
        </group>
      ))}
    </group>
  );
}

// C. Maritime EEZ Boundary & Shipping Lane Vessels
function MaritimeEEZOverlay() {
  const corridorPoints = useMemo(
    () => [
      new THREE.Vector3(-1200, 2, 600),
      new THREE.Vector3(0, 2, 0),
      new THREE.Vector3(1200, 2, -600),
    ],
    []
  );

  return (
    <group>
      {/* EEZ Shipping Lane Corridor */}
      <Line points={corridorPoints} color="#00ffaa88" lineWidth={2} dashed />
      {/* Tracked Cargo Vessels in EEZ */}
      {[
        [-320, 0, 180],
        [240, 0, -120],
      ].map((p, idx) => (
        <group key={idx} position={p as [number, number, number]}>
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[14, 3, 5]} />
            <meshStandardMaterial color="#22303c" metalness={0.6} />
          </mesh>
          <mesh position={[0, 4, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 6, 8]} />
            <meshBasicMaterial color="#00ff88" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// D. Himalayan Mountain Border Pass Surveillance
function MountainPassMarkers() {
  const passes = [
    { label: 'PASS BRAVO-1', pos: [-160, 45, -80] },
    { label: 'DEEP VALLEY RADAR SHADOW', pos: [140, 20, 60] },
    { label: 'NORTHERN BORDER RIDGE', pos: [0, 85, -220] },
  ];

  return (
    <group>
      {passes.map((pass, i) => (
        <group key={i} position={pass.pos as [number, number, number]}>
          <mesh position={[0, 15, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 30, 8]} />
            <meshBasicMaterial color="#00d4ff" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, 30, 0]}>
            <sphereGeometry args={[1.6, 12, 12]} />
            <meshBasicMaterial color="#00d4ff" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── 4. MULTI-LAYERED DISTANT HORIZONS ──────────────────────────────────────
function DistantMountains({ environment }: { environment: string }) {
  const mountainGeo = useMemo(() => {
    const segs = 120;
    const r1 = 1500;
    const geo = new THREE.BufferGeometry();
    const v: number[] = [];

    for (let i = 0; i < segs; i++) {
      const t1 = (i / segs) * Math.PI * 2;
      const t2 = ((i + 1) / segs) * Math.PI * 2;

      // Peak height varies by environment
      const mult = environment === 'MOUNTAIN' || environment === 'HIGH_ALTITUDE' ? 2.4 : 1.0;
      const h1 = (40 + Math.sin(i * 0.6) * 35 + Math.cos(i * 1.5) * 22) * mult;
      const h2 = (40 + Math.sin((i + 1) * 0.6) * 35 + Math.cos((i + 1) * 1.5) * 22) * mult;

      const x1 = Math.sin(t1) * r1;
      const z1 = Math.cos(t1) * r1;
      const x2 = Math.sin(t2) * r1;
      const z2 = Math.cos(t2) * r1;

      v.push(
        x1, -15, z1, x1, -15 + h1, z1, x2, -15 + h2, z2,
        x1, -15, z1, x2, -15 + h2, z2, x2, -15, z2
      );
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.computeVertexNormals();
    return geo;
  }, [environment]);

  const mountainColor =
    environment === 'MOUNTAIN' || environment === 'HIGH_ALTITUDE' ? '#b6d5f0' :
    environment === 'DESERT' ? '#cca97e' :
    environment === 'FOREST' ? '#78a688' :
    environment === 'MARITIME' ? '#6fa0c4' : '#9bc4e6';

  return (
    <mesh>
      <primitive object={mountainGeo} />
      <meshBasicMaterial color={mountainColor} />
    </mesh>
  );
}

// ── 5. HIGH-FIDELITY MQ-9 REAPER DRONE ─────────────────────────────────────
function MQ9ReaperModel({
  position,
  heading,
  health,
  ghost = false,
}: {
  position: [number, number, number];
  heading: number;
  health: number;
  ghost?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const propRef = useRef<THREE.Group>(null);
  const prevHeading = useRef(heading);
  const rollAngle = useRef(0);

  useFrame((_, delta) => {
    if (propRef.current) {
      propRef.current.rotation.z += delta * 65;
    }

    const headingDiff = heading - prevHeading.current;
    prevHeading.current = heading;
    const targetRoll = THREE.MathUtils.clamp(-headingDiff * 2.2, -0.38, 0.38);
    rollAngle.current = THREE.MathUtils.lerp(rollAngle.current, targetRoll, delta * 3.5);

    if (groupRef.current) {
      groupRef.current.rotation.z = rollAngle.current;
      groupRef.current.position.y = position[1] + Math.sin(Date.now() * 0.0016) * 0.08;
    }
  });

  const bodyColor = ghost ? '#2b7a99' : '#4d5762';
  const darkDetailColor = ghost ? '#1b4a5c' : '#252a30';
  const opticColor = '#0e1216';
  const opacity = ghost ? 0.45 : 1.0;

  const statusColor =
    health > 80 ? '#00ff88' :
    health > 60 ? '#ffcc00' :
    health > 40 ? '#ff8800' : '#ff3355';

  return (
    <group ref={groupRef} position={position} rotation={[0, (heading * Math.PI) / 180, 0]}>
      {/* Fuselage */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.44, 6.4, 24]} />
        <meshStandardMaterial color={bodyColor} roughness={0.42} metalness={0.18} transparent={ghost} opacity={opacity} />
      </mesh>

      {/* Bulbous SATCOM Nose */}
      <mesh position={[0, 0.18, 2.4]} scale={[0.92, 1.10, 1.70]} castShadow>
        <sphereGeometry args={[0.46, 22, 18]} />
        <meshStandardMaterial color={bodyColor} roughness={0.42} metalness={0.18} transparent={ghost} opacity={opacity} />
      </mesh>

      {/* FLIR Sensor Turret */}
      <mesh position={[0, -0.34, 2.9]} castShadow>
        <sphereGeometry args={[0.24, 18, 18]} />
        <meshStandardMaterial color={darkDetailColor} roughness={0.25} metalness={0.8} transparent={ghost} opacity={opacity} />
      </mesh>
      <mesh position={[0, -0.38, 3.08]} rotation={[0.25, 0, 0]}>
        <circleGeometry args={[0.098, 16]} />
        <meshStandardMaterial color={opticColor} roughness={0.05} metalness={0.95} />
      </mesh>

      {/* Wings */}
      <group position={[0, 0.08, 0.5]}>
        {/* Left Wing */}
        <mesh position={[5.4, 0.12, 0]} rotation={[0, 0, 0.025]} castShadow>
          <boxGeometry args={[10.8, 0.08, 0.82]} />
          <meshStandardMaterial color={bodyColor} roughness={0.44} metalness={0.16} transparent={ghost} opacity={opacity} />
        </mesh>
        <mesh position={[10.8, 0.32, 0]} rotation={[0, 0, 0.42]} castShadow>
          <boxGeometry args={[0.4, 0.42, 0.55]} />
          <meshStandardMaterial color={darkDetailColor} />
        </mesh>
        <mesh position={[10.85, 0.48, 0]}>
          <sphereGeometry args={[0.065, 8, 8]} />
          <meshBasicMaterial color="#ff2244" />
        </mesh>

        {/* Right Wing */}
        <mesh position={[-5.4, 0.12, 0]} rotation={[0, 0, -0.025]} castShadow>
          <boxGeometry args={[10.8, 0.08, 0.82]} />
          <meshStandardMaterial color={bodyColor} roughness={0.44} metalness={0.16} transparent={ghost} opacity={opacity} />
        </mesh>
        <mesh position={[-10.8, 0.32, 0]} rotation={[0, 0, -0.42]} castShadow>
          <boxGeometry args={[0.4, 0.42, 0.55]} />
          <meshStandardMaterial color={darkDetailColor} />
        </mesh>
        <mesh position={[-10.85, 0.48, 0]}>
          <sphereGeometry args={[0.065, 8, 8]} />
          <meshBasicMaterial color="#00ff66" />
        </mesh>
      </group>

      {/* V-Tail */}
      <mesh position={[0.55, 0.58, -2.85]} rotation={[0.18, 0, 0.78]} castShadow>
        <boxGeometry args={[0.08, 1.48, 0.56]} />
        <meshStandardMaterial color={bodyColor} roughness={0.44} metalness={0.16} transparent={ghost} opacity={opacity} />
      </mesh>
      <mesh position={[-0.55, 0.58, -2.85]} rotation={[0.18, 0, -0.78]} castShadow>
        <boxGeometry args={[0.08, 1.48, 0.56]} />
        <meshStandardMaterial color={bodyColor} roughness={0.44} metalness={0.16} transparent={ghost} opacity={opacity} />
      </mesh>
      <mesh position={[0, -0.50, -2.80]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.08, 0.90, 0.54]} />
        <meshStandardMaterial color={bodyColor} roughness={0.44} metalness={0.16} transparent={ghost} opacity={opacity} />
      </mesh>

      {/* Pusher Propeller */}
      <mesh position={[0, 0.05, -3.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.24, 0.45, 16]} />
        <meshStandardMaterial color={darkDetailColor} roughness={0.3} metalness={0.7} />
      </mesh>
      <group ref={propRef} position={[0, 0.05, -3.45]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.12, 0.24, 14]} />
          <meshStandardMaterial color="#181c20" />
        </mesh>
        {[0, 120, 240].map(angle => (
          <group key={angle} rotation={[0, 0, (angle * Math.PI) / 180]}>
            <mesh position={[0, 0.68, 0]}>
              <boxGeometry args={[0.08, 1.20, 0.02]} />
              <meshStandardMaterial color="#262a30" />
            </mesh>
            <mesh position={[0, 1.24, 0]}>
              <boxGeometry args={[0.08, 0.12, 0.022]} />
              <meshBasicMaterial color="#f0b429" />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0, -0.01]}>
          <circleGeometry args={[1.30, 24]} />
          <meshBasicMaterial color="#20242a" transparent opacity={0.20} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Strobe Light */}
      <mesh position={[0, 0.44, 1.4]}>
        <sphereGeometry args={[0.075, 8, 8]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={ghost ? 0.6 : 1.6} />
      </mesh>
    </group>
  );
}

// ── 6. SWARM FORMATION & FANET MESH (UavNetSim) ───────────────────────────
interface NodePos {
  id: string;
  callsign: string;
  pos: [number, number, number];
  status: 'OPTIMAL' | 'DEGRADED' | 'JAMMED';
}

function useSwarmPositions(
  leadPos: [number, number, number],
  heading: number,
  formation: string,
  swarmEnabled: boolean,
  nodes: any[]
): NodePos[] {
  return useMemo(() => {
    if (!swarmEnabled) {
      return [{ id: 'uav-01', callsign: 'REAPER-LEAD', pos: leadPos, status: 'OPTIMAL' }];
    }

    const rad = (heading * Math.PI) / 180;
    const fwdX = Math.sin(rad);
    const fwdZ = Math.cos(rad);
    const rightX = Math.cos(rad);
    const rightZ = -Math.sin(rad);

    let offsets: [number, number, number][] = [];
    if (formation === 'DIAMOND') {
      offsets = [
        [0, 0, 0],
        [-rightX * 18 - fwdX * 14, 0, -rightZ * 18 - fwdZ * 14],
        [rightX * 18 - fwdX * 14, 0, rightZ * 18 - fwdZ * 14],
        [-fwdX * 28, 4, -fwdZ * 28],
      ];
    } else if (formation === 'ECHELON') {
      offsets = [
        [0, 0, 0],
        [rightX * 16 - fwdX * 14, -1, rightZ * 16 - fwdZ * 14],
        [rightX * 32 - fwdX * 28, -2, rightZ * 32 - fwdZ * 28],
        [rightX * 48 - fwdX * 42, -3, rightZ * 48 - fwdZ * 42],
      ];
    } else if (formation === 'ORBIT') {
      offsets = [
        [0, 0, 0],
        [-rightX * 22, 1, -rightZ * 22],
        [rightX * 22, -1, rightZ * 22],
        [-fwdX * 26, 3, -fwdZ * 26],
      ];
    } else {
      // V_SHAPE
      offsets = [
        [0, 0, 0],
        [-rightX * 18 - fwdX * 16, -0.5, -rightZ * 18 - fwdZ * 16],
        [rightX * 18 - fwdX * 16, -0.5, rightZ * 18 - fwdZ * 16],
        [-fwdX * 32, 6, -fwdZ * 32],
      ];
    }

    return offsets.map((off, i) => {
      const nodeData = nodes[i] || {};
      return {
        id: nodeData.id || `uav-0${i + 1}`,
        callsign: nodeData.callsign || `UAV-0${i + 1}`,
        pos: [leadPos[0] + off[0], leadPos[1] + off[1], leadPos[2] + off[2]] as [number, number, number],
        status: nodeData.status || 'OPTIMAL',
      };
    });
  }, [leadPos, heading, formation, swarmEnabled, nodes]);
}

function SwarmCommsMesh({
  nodePositions,
  showCommsMesh,
  showRfBubbles,
  commsJamming,
}: {
  nodePositions: NodePos[];
  showCommsMesh: boolean;
  showRfBubbles: boolean;
  commsJamming: boolean;
}) {
  const packetRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (packetRef.current) {
      packetRef.current.children.forEach((child, idx) => {
        child.position.y += Math.sin(Date.now() * 0.005 + idx) * 0.015;
      });
    }
  });

  if (!showCommsMesh && !showRfBubbles) return null;

  const links = [
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 3],
    [2, 3],
  ];
  const gcsPos: [number, number, number] = [-180, 2, 80];

  return (
    <group>
      {/* Ground Control Station Base */}
      <group position={gcsPos}>
        <mesh position={[0, 4, 0]}>
          <cylinderGeometry args={[1.5, 2.5, 8, 8]} />
          <meshStandardMaterial color="#2a333d" metalness={0.7} />
        </mesh>
        <mesh position={[0, 9, 0]} rotation={[0.4, 0.2, 0]}>
          <sphereGeometry args={[2.5, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color="#00d4ff" emissive="#004466" emissiveIntensity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* GCS Uplink */}
      {showCommsMesh && nodePositions[0] && (
        <Line
          points={[new THREE.Vector3(...gcsPos), new THREE.Vector3(...nodePositions[0].pos)]}
          color="#00d4ff77"
          lineWidth={1.5}
          dashed
        />
      )}

      {/* Inter-UAV Links */}
      {showCommsMesh &&
        links.map(([i, j], linkIdx) => {
          const n1 = nodePositions[i];
          const n2 = nodePositions[j];
          if (!n1 || !n2) return null;
          const isJammed = commsJamming && (i === 2 || j === 2);
          const lineColor = isJammed ? '#ff3355' : linkIdx % 2 === 0 ? '#00d4ff' : '#00ff88';

          return (
            <group key={`link-${linkIdx}`}>
              <Line
                points={[new THREE.Vector3(...n1.pos), new THREE.Vector3(...n2.pos)]}
                color={lineColor}
                lineWidth={isJammed ? 2.5 : 1.8}
                transparent
                opacity={isJammed ? 0.9 : 0.65}
              />
            </group>
          );
        })}

      {/* Data Packets */}
      {showCommsMesh && (
        <group ref={packetRef}>
          {links.map(([i, j], linkIdx) => {
            const n1 = nodePositions[i];
            const n2 = nodePositions[j];
            if (!n1 || !n2) return null;
            const t = Math.sin(Date.now() * 0.003 + linkIdx * 1.5) * 0.5 + 0.5;
            const px = n1.pos[0] + (n2.pos[0] - n1.pos[0]) * t;
            const py = n1.pos[1] + (n2.pos[1] - n1.pos[1]) * t;
            const pz = n1.pos[2] + (n2.pos[2] - n1.pos[2]) * t;
            const isJammed = commsJamming && (i === 2 || j === 2);

            return (
              <mesh key={`pkt-${linkIdx}`} position={[px, py, pz]}>
                <sphereGeometry args={[0.38, 8, 8]} />
                <meshBasicMaterial color={isJammed ? '#ff3355' : '#ffffff'} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* RF Coverage Spheres */}
      {showRfBubbles &&
        nodePositions.map(node => (
          <mesh key={`rf-${node.id}`} position={node.pos}>
            <sphereGeometry args={[22, 16, 16]} />
            <meshBasicMaterial
              color={node.status === 'JAMMED' ? '#ff3355' : '#00d4ff'}
              wireframe
              transparent
              opacity={0.12}
            />
          </mesh>
        ))}
    </group>
  );
}

// ── 7. CAMERA RIG ──────────────────────────────────────────────────────────
function CameraRig({
  view,
  uavPos,
  heading,
}: {
  view: string;
  uavPos: [number, number, number];
  heading: number;
}) {
  const controlsRef = useRef<any>(null);

  useFrame(({ camera }) => {
    const headingRad = (heading * Math.PI) / 180;

    if (view === 'chase') {
      const distBehind = 16.5;
      const heightAbove = 6.2;
      const lateralShift = -2.8;

      const camX = uavPos[0] - Math.sin(headingRad) * distBehind + Math.cos(headingRad) * lateralShift;
      const camY = uavPos[1] + heightAbove;
      const camZ = uavPos[2] - Math.cos(headingRad) * distBehind - Math.sin(headingRad) * lateralShift;

      const lookX = uavPos[0] + Math.sin(headingRad) * 16;
      const lookY = uavPos[1] - 2.8;
      const lookZ = uavPos[2] + Math.cos(headingRad) * 16;

      camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.08);
      if (controlsRef.current) {
        controlsRef.current.target.lerp(new THREE.Vector3(lookX, lookY, lookZ), 0.08);
        controlsRef.current.update();
      }
    } else if (view === 'swarm') {
      const distBehind = 42;
      const heightAbove = 18;

      const camX = uavPos[0] - Math.sin(headingRad) * distBehind;
      const camY = uavPos[1] + heightAbove;
      const camZ = uavPos[2] - Math.cos(headingRad) * distBehind;

      const lookX = uavPos[0] + Math.sin(headingRad) * 8;
      const lookY = uavPos[1] - 1.0;
      const lookZ = uavPos[2] + Math.cos(headingRad) * 8;

      camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.08);
      if (controlsRef.current) {
        controlsRef.current.target.lerp(new THREE.Vector3(lookX, lookY, lookZ), 0.08);
        controlsRef.current.update();
      }
    } else if (view === 'cockpit') {
      camera.position.set(
        uavPos[0] + Math.sin(headingRad) * 3.4,
        uavPos[1] - 0.2,
        uavPos[2] + Math.cos(headingRad) * 3.4
      );
      camera.lookAt(
        uavPos[0] + Math.sin(headingRad) * 150,
        uavPos[1] - 8,
        uavPos[2] + Math.cos(headingRad) * 150
      );
    }
  });

  if (view === 'cockpit') return null;

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={view !== 'chase' && view !== 'swarm'}
      enableZoom={true}
      enableRotate={true}
      maxPolarAngle={Math.PI / 2 - 0.03}
      minDistance={6}
      maxDistance={600}
    />
  );
}

// ── 8. MAIN UAV SCENE WITH ENVIRONMENT ATMOSPHERE ──────────────────────────
export function UAVScene({ view }: { view: string }) {
  const {
    uav,
    health,
    mission,
    replanning,
    showGhostUAV,
    swarmEnabled,
    swarmFormation,
    showCommsMesh,
    showRfBubbles,
    commsJamming,
    swarmNodes,
  } = useStore(s => ({
    uav: s.uav,
    health: s.health,
    mission: s.mission,
    replanning: s.replanning,
    showGhostUAV: s.showGhostUAV,
    swarmEnabled: s.swarmEnabled,
    swarmFormation: s.swarmFormation,
    showCommsMesh: s.showCommsMesh,
    showRfBubbles: s.showRfBubbles,
    commsJamming: s.commsJamming,
    swarmNodes: s.swarmNodes,
  }));

  const env = mission.environment || 'STANDARD';

  // Environment-specific cruise altitude and atmospheric colors
  const envConfig = useMemo(() => {
    switch (env) {
      case 'MOUNTAIN':
      case 'HIGH_ALTITUDE':
        return {
          baseAlt: 120, // High operational ceiling (28,000+ ft)
          skyColor: '#6da0cc',
          fogColor: '#9ec4e6',
          sunPos: [-200, 280, -140] as [number, number, number],
          sunIntensity: 2.8,
          fogNear: 350,
          fogFar: 2600,
        };
      case 'MARITIME':
        return {
          baseAlt: 75,
          skyColor: '#589acc',
          fogColor: '#8ec0e4',
          sunPos: [-220, 300, -180] as [number, number, number],
          sunIntensity: 2.9,
          fogNear: 300,
          fogFar: 2800,
        };
      case 'DESERT':
        return {
          baseAlt: 72,
          skyColor: '#8fb1cc',
          fogColor: '#d6ba94', // Dust haze
          sunPos: [-160, 340, -100] as [number, number, number],
          sunIntensity: 3.0,
          fogNear: 250,
          fogFar: 1800,
        };
      case 'FOREST':
        return {
          baseAlt: 68, // Slow persistent loitering ceiling
          skyColor: '#689cb8',
          fogColor: '#92bca8', // Humid canopy mist
          sunPos: [-180, 260, -120] as [number, number, number],
          sunIntensity: 2.5,
          fogNear: 250,
          fogFar: 2000,
        };
      default:
        return {
          baseAlt: 110,
          skyColor: '#6da0cc',
          fogColor: '#9ec4e6',
          sunPos: [-200, 280, -140] as [number, number, number],
          sunIntensity: 2.8,
          fogNear: 350,
          fogFar: 2600,
        };
    }
  }, [env]);

  return (
    <Canvas
      shadows
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      style={{ background: envConfig.skyColor }}
    >
      <color attach="background" args={[envConfig.skyColor]} />
      <Sky
        distance={450000}
        sunPosition={envConfig.sunPos}
        turbidity={env === 'DESERT' ? 8 : 5}
        rayleigh={env === 'MOUNTAIN' ? 0.4 : 0.62}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      <PerspectiveCamera makeDefault position={[-14, envConfig.baseAlt + 8, 20]} fov={56} near={0.5} far={4500} />

      {/* Lighting */}
      <hemisphereLight args={['#8fc5eb', '#45593c', 0.95]} />
      <directionalLight
        position={envConfig.sunPos}
        intensity={envConfig.sunIntensity}
        color="#fffcf2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={10}
        shadow-camera-far={1400}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0002}
      />
      <ambientLight intensity={0.32} color="#cfe6fa" />
      <fog attach="fog" args={[envConfig.fogColor, envConfig.fogNear, envConfig.fogFar]} />

      {/* Tactical Real-time Flight Controller */}
      <TacticalFlightController view={view} envConfig={envConfig} env={env} />
    </Canvas>
  );
}

// ── 9. FLIGHT SPEED MOTION PARTICLES ──────────────────────────────────────
function FlightSpeedParticles({ uavPos, heading }: { uavPos: [number, number, number]; heading: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 180;

  const [positions, offs] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const offsData = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      offsData[i * 3] = (Math.random() - 0.5) * 55;
      offsData[i * 3 + 1] = (Math.random() - 0.5) * 22;
      offsData[i * 3 + 2] = (Math.random() - 0.5) * 75;
    }
    return [pos, offsData];
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.getElapsedTime();
    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position;
    const rad = (heading * Math.PI) / 180;
    const fwdX = Math.sin(rad);
    const fwdZ = Math.cos(rad);

    for (let i = 0; i < count; i++) {
      const speed = 48;
      // Cycle particles backwards relative to UAV
      const cycleZ = ((offs[i * 3 + 2] - t * speed) % 80) + 40;
      const ox = offs[i * 3];
      const oy = offs[i * 3 + 1];

      posAttr.setXYZ(
        i,
        uavPos[0] + ox * Math.cos(rad) + cycleZ * fwdX,
        uavPos[1] + oy,
        uavPos[2] - ox * Math.sin(rad) + cycleZ * fwdZ
      );
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#c8f5ff"
        size={0.65}
        transparent
        opacity={0.42}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ── 10. TACTICAL REAL-TIME FLIGHT CONTROLLER ──────────────────────────────
function TacticalFlightController({
  view,
  envConfig,
  env,
}: {
  view: string;
  envConfig: any;
  env: string;
}) {
  const {
    uav,
    health,
    manualFlight,
    joystick,
    updateUavFlight,
    swarmEnabled,
    swarmFormation,
    swarmNodes,
    showCommsMesh,
    showRfBubbles,
    commsJamming,
    showGhostUAV,
    replanning,
  } = useStore(s => ({
    uav: s.uav,
    health: s.health,
    manualFlight: s.manualFlight,
    joystick: s.joystick,
    updateUavFlight: s.updateUavFlight,
    swarmEnabled: s.swarmEnabled,
    swarmFormation: s.swarmFormation,
    swarmNodes: s.swarmNodes,
    showCommsMesh: s.showCommsMesh,
    showRfBubbles: s.showRfBubbles,
    commsJamming: s.commsJamming,
    showGhostUAV: s.showGhostUAV,
    replanning: s.replanning,
  }));

  // Persistent flight vectors
  const currentPos = useRef(new THREE.Vector3(0, envConfig.baseAlt, 0));
  const currentHeading = useRef(uav.heading_deg || 55);
  const currentPitch = useRef(0);
  const currentRoll = useRef(0);
  const currentSpeed = useRef(uav.speed_kts || 110);
  const lastGpsTick = useRef(0);

  // Group reference for the single UAV
  const uavRef = useRef<THREE.Group>(null);

  // Update loop for smooth 60fps real-time flight motion
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    if (manualFlight) {
      // Direct joystick flight controls:
      // Pitch [-1 to 1]: nose down / dive or nose up / climb
      currentPitch.current = THREE.MathUtils.lerp(currentPitch.current, -joystick.pitch * 0.35, dt * 4.5);
      // Roll [-1 to 1]: bank wings and rotate heading
      currentRoll.current = THREE.MathUtils.lerp(currentRoll.current, -joystick.roll * 0.55, dt * 5.0);
      currentHeading.current = (currentHeading.current + joystick.roll * 38 * dt) % 360;
      if (currentHeading.current < 0) currentHeading.current += 360;

      // Throttle regulates airspeed
      const targetSpeed = 65 + joystick.throttle * 95; // 65 to 160 kts
      currentSpeed.current = THREE.MathUtils.lerp(currentSpeed.current, targetSpeed, dt * 2.5);

      // Climb / dive vertical velocity
      const vertSpeed = -joystick.pitch * 30 + (joystick.throttle - 0.5) * 14;
      currentPos.current.y = THREE.MathUtils.clamp(
        currentPos.current.y + vertSpeed * dt,
        envConfig.baseAlt - 40,
        envConfig.baseAlt + 140
      );
    } else {
      // Auto-cruise flight mode: smoothly forward cruise
      currentSpeed.current = THREE.MathUtils.lerp(currentSpeed.current, uav.speed_kts || 110, dt * 1.5);
      currentRoll.current = THREE.MathUtils.lerp(currentRoll.current, 0, dt * 3.0);
      currentPitch.current = THREE.MathUtils.lerp(currentPitch.current, 0, dt * 3.0);

      // Align heading with store
      const diff = ((uav.heading_deg - currentHeading.current + 540) % 360) - 180;
      currentHeading.current = (currentHeading.current + diff * dt * 1.2) % 360;
      if (currentHeading.current < 0) currentHeading.current += 360;
    }

    // Advance forward in 3D world space
    const headingRad = (currentHeading.current * Math.PI) / 180;
    const forwardSpeedUnits = currentSpeed.current * 0.18; // ~20 units/second
    currentPos.current.x += Math.sin(headingRad) * forwardSpeedUnits * dt;
    currentPos.current.z += Math.cos(headingRad) * forwardSpeedUnits * dt;

    // Apply translation and rotation to UAV group
    if (uavRef.current) {
      uavRef.current.position.copy(currentPos.current);
      uavRef.current.rotation.y = headingRad;
      uavRef.current.rotation.z = currentRoll.current;
      uavRef.current.rotation.x = currentPitch.current;
    }

    // Dynamic GPS coordinate incrementing (10Hz)
    const now = performance.now();
    if (now - lastGpsTick.current > 100) {
      lastGpsTick.current = now;
      const dLat = (Math.cos(headingRad) * forwardSpeedUnits * 0.1 * 18) / 111320;
      const dLon = (Math.sin(headingRad) * forwardSpeedUnits * 0.1 * 18) / (111320 * Math.cos(((uav.lat || 34.1526) * Math.PI) / 180));

      updateUavFlight({
        lat: Number(((uav.lat || 34.1526) + dLat).toFixed(6)),
        lon: Number(((uav.lon || 77.5771) + dLon).toFixed(6)),
        heading_deg: Math.round(currentHeading.current),
        altitude_ft: Math.round(currentPos.current.y * 210),
        speed_kts: Math.round(currentSpeed.current),
      });
    }
  });

  const posArray: [number, number, number] = [
    currentPos.current.x,
    currentPos.current.y,
    currentPos.current.z,
  ];

  // Tile the terrain center to wrap seamlessly around the moving UAV
  const terrainCenter: [number, number, number] = [
    Math.round(currentPos.current.x / 450) * 450,
    0,
    Math.round(currentPos.current.z / 450) * 450,
  ];

  const swarmPositions = useSwarmPositions(
    posArray,
    currentHeading.current,
    swarmFormation,
    swarmEnabled,
    swarmNodes
  );

  return (
    <>
      <CameraRig view={view} uavPos={posArray} heading={currentHeading.current} />

      {/* Endless Multi-Layer Terrain Group that follows and wraps the UAV */}
      <group position={terrainCenter}>
        <Suspense fallback={<AerialTerrainMesh environment={env} />}>
          <TerrainErrorBoundary fallback={<AerialTerrainMesh environment={env} />}>
            <PhotogrammetricTerrain environment={env} />
          </TerrainErrorBoundary>
        </Suspense>
        <DistantMountains environment={env} />
      </group>

      {/* Domain Tactical Overlays anchored to current UAV position */}
      {env === 'DESERT' && <SARRadarBeam position={posArray} />}
      {env === 'FOREST' && <ThermalLoiterScan position={posArray} />}
      {env === 'MARITIME' && <MaritimeEEZOverlay />}
      {(env === 'MOUNTAIN' || env === 'HIGH_ALTITUDE') && <MountainPassMarkers />}

      {/* Single UAV (Solo Flight) with physical banking and pitch */}
      <group ref={uavRef}>
        <MQ9ReaperModel
          position={[0, 0, 0]}
          heading={0}
          health={health.index}
        />
        {/* Dynamic wingtip vapor trails during flight */}
        <mesh position={[5.4, 0.1, -1.2]}>
          <cylinderGeometry args={[0.04, 0.12, 3.2, 6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
        </mesh>
        <mesh position={[-5.4, 0.1, -1.2]}>
          <cylinderGeometry args={[0.04, 0.12, 3.2, 6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
        </mesh>
      </group>

      {/* Airspeed Motion Particles: Streams past the UAV to convey realistic flight speed */}
      <FlightSpeedParticles uavPos={posArray} heading={currentHeading.current} />

      {/* Swarm Drones: Only rendered if user explicitly enabled swarm */}
      {swarmEnabled &&
        swarmPositions.slice(1).map(node => (
          <MQ9ReaperModel
            key={node.id}
            position={node.pos}
            heading={currentHeading.current}
            health={node.status === 'JAMMED' ? 45 : health.index}
          />
        ))}

      {/* Swarm Comms Mesh & Data Packets (UavNetSim) */}
      {swarmEnabled && (
        <SwarmCommsMesh
          nodePositions={swarmPositions}
          showCommsMesh={showCommsMesh}
          showRfBubbles={showRfBubbles}
          commsJamming={commsJamming}
        />
      )}

      {/* Ghost UAV */}
      {showGhostUAV && replanning?.triggered && (
        <MQ9ReaperModel
          position={[posArray[0] + 12, posArray[1], posArray[2] + 12]}
          heading={currentHeading.current + 25}
          health={100}
          ghost
        />
      )}
    </>
  );
}
