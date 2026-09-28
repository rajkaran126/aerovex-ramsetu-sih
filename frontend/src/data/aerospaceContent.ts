export interface AircraftHotspot {
  id: string;
  name: string;
  category: string;
  x: number; // percentage from left
  y: number; // percentage from top
  detail: string;
  specs: { label: string; value: string }[];
}

export interface TechFeature {
  id: string;
  icon: string;
  title: string;
  summary: string;
  description: string;
  highlights: string[];
}

export interface SpecCategory {
  category: string;
  items: { label: string; value: string; unit?: string; note?: string }[];
}

export interface GalleryItem {
  id: string;
  title: string;
  theatre: string;
  altitude: string;
  description: string;
  tag: string;
}

export const AEROSPACE_CONTENT = {
  brand: {
    name: 'VYOMAMEDHA',
    tagline: 'AI-ENABLED CYBER-PHYSICAL INTELLIGENCE',
    subtagline: 'FOR UAV ENGINE RELIABILITY',
    motto: 'Predict. Understand. Protect.',
    kicker: 'MISSION-AWARE ENGINE INTELLIGENCE',
    sideKicker: ['PREDICT', 'UNDERSTAND', 'PROTECT', 'AERO-PROPULSION TWIN'],
  },
  hero: {
    headlinePrefix: 'MISSION-AWARE',
    headlineHighlight: 'ENGINE INTELLIGENCE',
    description:
      'AI-Enabled Cyber-Physical Intelligence for UAV Engine Reliability. Physics-grounded digital twin, real-time prognostics, and autonomous mission risk replanning.',
    ctaPrimary: 'START MISSION',
    ctaSecondary: 'EXPLORE PLATFORM',
    bottomLeft: 'PREDICT • UNDERSTAND • PROTECT',
    bottomRight: 'FOR UAV ENGINE RELIABILITY',
    features: [
      {
        id: 'nav',
        icon: 'Crosshair',
        title: 'AUTONOMOUS NAVIGATION',
        desc: 'Reliable in complex environments',
      },
      {
        id: 'stealth',
        icon: 'Shield',
        title: 'STEALTH DESIGN',
        desc: 'Low observable profile',
      },
      {
        id: 'intel',
        icon: 'BarChart3',
        title: 'MISSION INTELLIGENCE',
        desc: 'Real-time data and insights',
      },
      {
        id: 'payload',
        icon: 'Box',
        title: 'MODULAR PAYLOAD',
        desc: 'Adaptable for diverse missions',
      },
    ],
  },
  hotspots: [
    {
      id: 'flir-turret',
      name: 'Multi-Spectral EO/IR Gimbal Turret',
      category: 'OPTICAL SENSORS',
      x: 37,
      y: 63,
      detail:
        'Continuous 360° pan, 4K daylight electro-optical zoom, cooled MWIR thermal imager, and laser target designator for all-weather day/night reconnaissance.',
      specs: [
        { label: 'Sensor Type', value: 'EO / MWIR Cooled FLIR' },
        { label: 'Optical Zoom', value: '30x Continuous Optical' },
        { label: 'Laser Range', value: '25 km Target Designator' },
      ],
    },
    {
      id: 'twin-turboprop',
      name: 'Dual High-Efficiency Turboprop Engines',
      category: 'PROPULSION',
      x: 50,
      y: 58,
      detail:
        'Twin twin-blade pusher/tractor turboprop configuration engineered for maximum fuel economy and quiet acoustic signature during loitering.',
      specs: [
        { label: 'Engine Config', value: 'Twin 180 HP Turboprop' },
        { label: 'Endurance', value: '30 - 36+ Hours' },
        { label: 'Fuel Type', value: 'Aviation Fuel / Jet-A1' },
      ],
    },
    {
      id: 'wingspan',
      name: 'High-Aspect Carbon-Composite Wings',
      category: 'AERODYNAMICS',
      x: 72,
      y: 64,
      detail:
        'Ultra-high aspect ratio wing designed for low drag, high lift-to-drag glide efficiency, and extreme stability across high-altitude mountain winds.',
      specs: [
        { label: 'Wingspan', value: '20.6 Meters' },
        { label: 'Aspect Ratio', value: '18.4' },
        { label: 'Winglets', value: 'Vortex-Reduction Carbon Tips' },
      ],
    },
    {
      id: 'twin-boom-tail',
      name: 'Twin-Boom Empennage & Twin Rudder',
      category: 'STRUCTURAL AIRFRAME',
      x: 74,
      y: 44,
      detail:
        'Twin tail booms connected by a high horizontal stabilizer providing exceptional crosswind stability and clear payload deployment clearance.',
      specs: [
        { label: 'Configuration', value: 'Twin-Boom Twin-Rudder' },
        { label: 'Material', value: 'Lightweight Carbon-Kevlar' },
        { label: 'Control', value: 'Triple-Redundant Fly-By-Wire' },
      ],
    },
    {
      id: 'satcom-radome',
      name: 'Avionics Pod & Ku/Ka-band SATCOM',
      category: 'COMMUNICATIONS',
      x: 44,
      y: 52,
      detail:
        'Bulbous front fuselage radome housing encrypted satellite communication antenna for Beyond-Line-Of-Sight (BLOS) real-time HD video feed.',
      specs: [
        { label: 'Datalink', value: 'Ku/Ka-Band Encrypted SATCOM' },
        { label: 'Latency', value: '< 80 ms Global Relay' },
        { label: 'AI Compute', value: 'Dual Embedded Jetson Edge AI' },
      ],
    },
  ] as AircraftHotspot[],
  technologies: [
    {
      id: 'autonomy',
      icon: 'Cpu',
      title: 'Autonomous Flight & Waypoint Intelligence',
      summary: 'Level-4 autonomous mission execution with real-time dynamic obstacle rerouting.',
      description:
        'Our proprietary flight computer executes complex flight paths autonomously. In GNSS-denied environments, visual-inertial odometry and terrain contour matching ensure uninterrupted mission navigation without GPS dependency.',
      highlights: [
        'GPS-denied visual navigation (VIO)',
        'Dynamic collision avoidance & no-fly zone adaptation',
        'Automatic Takeoff & Landing (ATOL) with crosswind compensation',
      ],
    },
    {
      id: 'stealth',
      icon: 'Shield',
      title: 'Low Radar Cross-Section Airframe',
      summary: 'Radar-absorbent composite skin with blended wing-body contours.',
      description:
        'Constructed from autoclave-cured carbon-aramid composites coated in radar-absorbent materials (RAM). Acoustic dampening muffles propeller signatures, while recessed exhaust channels minimize infrared tracking.',
      highlights: [
        'Composite radar-absorbent materials (RAM)',
        'Shielded infrared engine exhaust plume',
        'Minimal optical cross-section in cloud-layer transit',
      ],
    },
    {
      id: 'mesh',
      icon: 'Share2',
      title: 'Swarm Intelligence & FANET Comms Mesh',
      summary: 'Inter-UAV ad-hoc mesh networking powered by UavNetSim protocols.',
      description:
        'Multiple UAVs form an airborne self-healing communication grid. If one aircraft acts as an antenna relay, telemetry and sensor feeds propagate across the entire swarm to ground command stations.',
      highlights: [
        'Dynamic multi-hop communication mesh',
        'Decentralized swarm formation re-balancing',
        'Electronic warfare & anti-jamming adaptive routing',
      ],
    },
    {
      id: 'payloads',
      icon: 'Layers',
      title: 'Modular Multi-Mission Payload Bay',
      summary: 'Quick-change payload architecture supporting up to 350 kg mission gear.',
      description:
        'The center underbelly modular bay supports swappable sensor suites in under 30 minutes: Synthetic Aperture Radar (SAR), Maritime Patrol Radar, Electronic Intelligence (ELINT), or cargo survival pods.',
      highlights: [
        'Synthetic Aperture Radar (SAR) with 1m ground resolution',
        'Maritime AIS transceiver & ship classification',
        'Active Electronic Warfare / Signal Intelligence suite',
      ],
    },
  ] as TechFeature[],
  specifications: [
    {
      category: 'Airframe & Dimensions',
      items: [
        { label: 'Wingspan', value: '20.6', unit: 'm', note: 'Carbon composite structure' },
        { label: 'Overall Length', value: '9.5', unit: 'm' },
        { label: 'Height', value: '2.4', unit: 'm' },
        { label: 'Max Takeoff Weight (MTOW)', value: '1,800', unit: 'kg' },
        { label: 'Empty Weight', value: '1,100', unit: 'kg' },
        { label: 'Max Payload Capacity', value: '350', unit: 'kg', note: 'Multi-bay modular' },
      ],
    },
    {
      category: 'Flight Performance',
      items: [
        { label: 'Operational Ceiling', value: '32,000', unit: 'ft', note: 'High-altitude mountain capability' },
        { label: 'Max Flight Endurance', value: '30 - 36+', unit: 'hrs', note: 'Continuous loitering' },
        { label: 'Cruise Speed', value: '220', unit: 'km/h' },
        { label: 'Maximum Speed', value: '280', unit: 'km/h' },
        { label: 'Ferry Range', value: '4,500', unit: 'km' },
        { label: 'Loiter Speed', value: '150', unit: 'km/h', note: 'Optimized for thermal imaging' },
      ],
    },
    {
      category: 'Avionics & Communication',
      items: [
        { label: 'Control Range (LOS)', value: '250', unit: 'km', note: 'C-Band line of sight' },
        { label: 'Control Range (BLOS)', value: 'Unlimited', note: 'Encrypted SATCOM Ku/Ka' },
        { label: 'Navigation System', value: 'Triple INS / GPS / VIO', note: 'Jam-proof triple redundancy' },
        { label: 'Flight Controller', value: 'Redundant Quad-Core Avionics' },
        { label: 'Datalink Security', value: 'AES-256 GCM Hardware Crypto' },
        { label: 'Swarm Protocol', value: 'FANET UavNetSim Mesh' },
      ],
    },
  ] as SpecCategory[],
  theatres: [
    {
      id: 'mountain',
      title: 'Himalayan Ridge & High-Altitude Patrol',
      theatre: 'HIGH ALTITUDE',
      altitude: '28,000 FT',
      tag: 'MOUNTAIN PASS SURVEILLANCE',
      description:
        'Continuous border vigil over glaciated peaks and deep valley radar shadow zones inaccessible to ground-based radar installations.',
    },
    {
      id: 'maritime',
      title: 'Exclusive Economic Zone (EEZ) Deep Ocean',
      theatre: 'MARITIME DOMAIN',
      altitude: '18,000 FT',
      tag: 'OCEANIC ANTI-PIRACY',
      description:
        'Mapping thousands of square kilometers of territorial waters, escorting international shipping convoys, and tracking illicit maritime traffic.',
    },
    {
      id: 'desert',
      title: 'Arid Plains & Sandstorm Reconnaissance',
      theatre: 'DESERT & ARID',
      altitude: '16,000 FT',
      tag: 'SAR RADAR PENETRATION',
      description:
        'Utilizing Synthetic Aperture Radar (SAR) to pierce through blinding dust storms and thermal mirages to monitor vehicle movements.',
    },
    {
      id: 'jungle',
      title: 'Tropical Rainforest Persistent Loiter',
      theatre: 'DENSE CANOPY',
      altitude: '14,000 FT',
      tag: 'FLIR THERMAL RECON',
      description:
        'Slow, persistent circular orbits deploying multi-spectral infrared FLIR sensors to detect thermal heat signatures beneath dense tree canopies.',
    },
  ] as GalleryItem[],
};
