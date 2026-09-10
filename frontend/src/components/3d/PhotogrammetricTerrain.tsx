import { useRef, useMemo, Component, ReactNode } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useTexture, Line } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// ── Error Boundary for 3D Model Loading ───────────────────────────────────
interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class TerrainErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('Terrain model fallback engaged:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ── 1. MULTI-LAYER MOUNT EVEREST / HIMALAYAS 3D MODEL ─────────────────────
// Multiplies the 3D photogrammetric mesh across seamless tiled layers
function EverestTerrain() {
  const obj = useLoader(OBJLoader, '/models/mountain/mount_everest.obj');
  const texture = useTexture('/models/mountain/aerial_satellite.jpg');

  const baseMesh = useMemo(() => {
    const clone = obj.clone(true);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    // Center geometry to origin
    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    box.getCenter(center);

    clone.position.x = -center.x * 0.13;
    clone.position.z = -center.z * 0.13;
    clone.position.y = -box.min.y * 0.045 - 80;

    clone.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.82,
          metalness: 0.08,
          flatShading: false,
        });
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });

    clone.scale.set(0.13, 0.045, 0.13);
    return clone;
  }, [obj, texture]);

  // Multiplied layers across the operational flight corridor
  const mountainLayers = useMemo(
    () => [
      { pos: [0, -15, 0] as [number, number, number], rot: 0, s: 1.0 },
      { pos: [0, -18, -480] as [number, number, number], rot: 0.45, s: 1.05 },
      { pos: [0, -20, 480] as [number, number, number], rot: -0.35, s: 0.98 },
      { pos: [450, -17, 0] as [number, number, number], rot: 1.25, s: 1.02 },
      { pos: [-450, -19, 0] as [number, number, number], rot: -0.85, s: 1.04 },
      { pos: [400, -22, -440] as [number, number, number], rot: 2.1, s: 1.08 },
      { pos: [-400, -16, -440] as [number, number, number], rot: -1.45, s: 0.96 },
      { pos: [400, -21, 440] as [number, number, number], rot: 0.95, s: 1.03 },
      { pos: [-400, -18, 440] as [number, number, number], rot: -2.2, s: 0.97 },
    ],
    []
  );

  return (
    <group>
      {mountainLayers.map((layer, idx) => (
        <group
          key={idx}
          position={layer.pos}
          rotation={[0, layer.rot, 0]}
          scale={[layer.s, layer.s, layer.s]}
        >
          <primitive object={baseMesh.clone(true)} />
        </group>
      ))}

      {/* Surrounding high-altitude snow valley base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -78, 0]} receiveShadow>
        <planeGeometry args={[5200, 5200, 32, 32]} />
        <meshStandardMaterial color="#2d3742" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ── 2. MULTI-LAYER ROCKY DESERT CANYON 3D MODEL (THAR DESERT) ────────────
// Multiplies the canyon model across 9 layers for continuous terrain flight
function DesertCanyonTerrain() {
  const obj = useLoader(OBJLoader, '/models/desert/rocky_desert.obj');
  const texture = useTexture('/models/desert/desert_albedo.jpg');

  const baseMesh = useMemo(() => {
    const clone = obj.clone(true);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;

    clone.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.88,
          metalness: 0.04,
        });
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });

    // Desert model has Z up; rotate to make Y up
    clone.rotation.x = -Math.PI / 2;
    clone.scale.set(2800, 2800, 620);
    return clone;
  }, [obj, texture]);

  // Multiplied canyon layers
  const canyonLayers = useMemo(
    () => [
      { pos: [0, -60, 0] as [number, number, number], rot: 0 },
      { pos: [0, -60, -920] as [number, number, number], rot: 0.8 },
      { pos: [0, -60, 920] as [number, number, number], rot: -0.6 },
      { pos: [920, -60, 0] as [number, number, number], rot: 1.4 },
      { pos: [-920, -60, 0] as [number, number, number], rot: -1.1 },
      { pos: [880, -60, -880] as [number, number, number], rot: 2.2 },
      { pos: [-880, -60, -880] as [number, number, number], rot: -1.8 },
      { pos: [880, -60, 880] as [number, number, number], rot: 0.5 },
      { pos: [-880, -60, 880] as [number, number, number], rot: -2.5 },
    ],
    []
  );

  return (
    <group>
      {canyonLayers.map((layer, idx) => (
        <group key={idx} position={layer.pos} rotation={[0, layer.rot, 0]}>
          <primitive object={baseMesh.clone(true)} />
        </group>
      ))}

      {/* Extended perimeter desert floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -62, 0]} receiveShadow>
        <planeGeometry args={[5800, 5800, 32, 32]} />
        <meshStandardMaterial color="#b88349" roughness={0.95} />
      </mesh>
    </group>
  );
}

// ── 3. REVERTED PROCEDURAL OCEAN MODEL (INDIAN OCEAN EEZ) ─────────────────
// High-performance dynamic oceanic water plane with animated wave swells
function OceanWaveTerrain() {
  const waveMeshRef = useRef<THREE.Mesh>(null);
  const deepOceanRef = useRef<THREE.Mesh>(null);

  // Dynamic wave motion
  useFrame(state => {
    const t = state.clock.getElapsedTime();
    if (waveMeshRef.current) {
      waveMeshRef.current.position.y = -1.2 + Math.sin(t * 0.9) * 0.8;
      waveMeshRef.current.rotation.z = Math.sin(t * 0.4) * 0.005;
    }
  });

  const corridorPoints = useMemo(
    () => [
      new THREE.Vector3(-1400, 2, 700),
      new THREE.Vector3(0, 2, 0),
      new THREE.Vector3(1400, 2, -700),
    ],
    []
  );

  return (
    <group position={[0, -10, 0]}>
      {/* Upper wave crest layer with shimmer */}
      <mesh
        ref={waveMeshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.2, 0]}
        receiveShadow
      >
        <planeGeometry args={[4800, 4800, 80, 80]} />
        <meshStandardMaterial
          color="#124870"
          roughness={0.12}
          metalness={0.78}
          transparent
          opacity={0.88}
        />
      </mesh>

      {/* Deep maritime ocean floor */}
      <mesh
        ref={deepOceanRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -3.5, 0]}
        receiveShadow
      >
        <planeGeometry args={[5200, 5200, 32, 32]} />
        <meshStandardMaterial
          color="#092036"
          roughness={0.05}
          metalness={0.92}
          transparent
          opacity={0.98}
        />
      </mesh>

      {/* EEZ Shipping Lane Corridor */}
      <Line points={corridorPoints} color="#00ffcc88" lineWidth={2} dashed />

      {/* Tracked Indian EEZ Cargo / Naval Vessels */}
      {[
        [-360, 0, 200],
        [280, 0, -160],
        [-120, 0, -380],
      ].map((p, idx) => (
        <group key={idx} position={p as [number, number, number]}>
          <mesh position={[0, 1.8, 0]}>
            <boxGeometry args={[16, 3.5, 5]} />
            <meshStandardMaterial color="#1e2c38" metalness={0.7} />
          </mesh>
          <mesh position={[0, 4.5, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 6, 8]} />
            <meshBasicMaterial color="#00ff88" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── 4. REVERTED PROCEDURAL DENSE FOREST (WESTERN GHATS) ───────────────────
// Lush rolling canopy terrain with winding river, outposts & tree clusters
function ForestNightTerrain() {
  const forestGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(4200, 4200, 100, 100);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      // Rolling dense jungle hills & river valley
      const hill1 = Math.sin(x * 0.005) * Math.cos(y * 0.005) * 32;
      const hill2 = Math.sin(x * 0.012 + 0.8) * 14;
      const valley = Math.cos(x * 0.002 + y * 0.003) * 18;
      pos.setZ(i, Math.max(-2, hill1 + hill2 + valley));
    }

    geo.computeVertexNormals();
    return geo;
  }, []);

  // Naturally distributed canopy tree clusters
  const treeClusters = useMemo(() => {
    const list: [number, number, number][] = [];
    for (let i = 0; i < 90; i++) {
      const angle = (i / 90) * Math.PI * 2;
      const dist = 60 + (i % 15) * 32;
      list.push([
        Math.cos(angle) * dist + (Math.sin(i * 3) * 40),
        0,
        Math.sin(angle) * dist + (Math.cos(i * 5) * 40),
      ]);
    }
    return list;
  }, []);

  return (
    <group position={[0, -15, 0]}>
      {/* Rolling Jungle Canopy Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <primitive object={forestGeo} />
        <meshStandardMaterial color="#1a3d1c" roughness={0.88} metalness={0.06} />
      </mesh>

      {/* Canopy tree crowns */}
      {treeClusters.map((pos, idx) => (
        <group key={idx} position={pos}>
          {/* Canopy crown dome */}
          <mesh position={[0, 4.5, 0]}>
            <sphereGeometry args={[5.5, 8, 8]} />
            <meshStandardMaterial color={idx % 2 === 0 ? '#1f4722' : '#27572b'} roughness={0.9} />
          </mesh>
          {/* Trunk */}
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.6, 0.9, 3.5, 6]} />
            <meshStandardMaterial color="#3a2a1a" roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* Dark night woodland perimeter */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -20, 0]} receiveShadow>
        <planeGeometry args={[5200, 5200, 24, 24]} />
        <meshStandardMaterial color="#0e2111" roughness={0.95} />
      </mesh>
    </group>
  );
}

// ── MAIN PHOTOGRAMMETRIC TERRAIN SELECTOR ────────────────────────────────
// Cleanly handles Indian operational theatres with multiplied 3D layers
export function PhotogrammetricTerrain({ environment }: { environment: string }) {
  switch (environment) {
    case 'DESERT':
      return <DesertCanyonTerrain />;
    case 'MARITIME':
      return <OceanWaveTerrain />;
    case 'FOREST':
      return <ForestNightTerrain />;
    case 'MOUNTAIN':
    case 'HIGH_ALTITUDE':
    default:
      return <EverestTerrain />;
  }
}
