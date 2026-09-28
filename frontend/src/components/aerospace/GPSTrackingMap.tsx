import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation,
  Crosshair,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  Play,
  Pause,
  LocateFixed,
  Eye,
  Radio,
  Compass,
  Layers,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { api } from '../../services/api';

export interface TerrainConfig {
  key: string;
  name: string;
  shortName: string;
  sector: string;
  code: string;
  lat: number;
  lon: number;
  zoom: number;
  defaultAlt: number;
  terrainType: string;
  elevationMsl: number;
  navicStatus: string;
}

export const INDIAN_TERRAINS: TerrainConfig[] = [
  {
    key: 'DESERT',
    name: 'Thar Desert Sector',
    shortName: 'THAR DESERT',
    sector: 'Rajasthan / Pokhran / Jaisalmer Border',
    code: 'SEC-01',
    lat: 26.9157,
    lon: 70.9083,
    zoom: 11,
    defaultAlt: 4500,
    terrainType: 'Arid Sand Dunes & Salt Flats',
    elevationMsl: 225,
    navicStatus: 'NavIC L5 / S-Band LOCKED (14 Sats)',
  },
  {
    key: 'MOUNTAIN',
    name: 'Himalayan High Altitude',
    shortName: 'HIMALAYAS',
    sector: 'Ladakh / Siachen / Pangong LAC Sector',
    code: 'SEC-02',
    lat: 34.1526,
    lon: 77.5771,
    zoom: 11,
    defaultAlt: 18500,
    terrainType: 'Glaciated Mountain Ridges & Passes',
    elevationMsl: 3524,
    navicStatus: 'NavIC L5 / S-Band LOCKED (12 Sats)',
  },
  {
    key: 'MARITIME',
    name: 'Indian Ocean EEZ',
    shortName: 'INDIAN OCEAN',
    sector: 'Arabian Sea / Mumbai High Continental Shelf',
    code: 'SEC-03',
    lat: 18.9220,
    lon: 72.8347,
    zoom: 10,
    defaultAlt: 7200,
    terrainType: 'Maritime EEZ & Offshore Rigs',
    elevationMsl: 0,
    navicStatus: 'NavIC L5 / S-Band LOCKED (15 Sats)',
  },
  {
    key: 'FOREST',
    name: 'North-Eastern Terrain',
    shortName: 'NORTH-EAST',
    sector: 'Arunachal Pradesh / Tawang Valley / Sela Pass',
    code: 'SEC-04',
    lat: 27.5861,
    lon: 91.8594,
    zoom: 11,
    defaultAlt: 9500,
    terrainType: 'Dense Montane Forest & Steep River Gorges',
    elevationMsl: 3048,
    navicStatus: 'NavIC L5 / S-Band LOCKED (13 Sats)',
  },
];

export const DEFAULT_TERRAIN_WAYPOINTS: Record<string, Array<{ lat: number; lon: number; label: string }>> = {
  DESERT: [
    { lat: 26.9157, lon: 70.9083, label: 'WP-1 (Pokhran Range)' },
    { lat: 27.0850, lon: 71.1200, label: 'WP-2 (Jaisalmer Ridge)' },
    { lat: 27.2400, lon: 70.8100, label: 'WP-3 (Indo-Pak Border Radar)' },
    { lat: 27.0500, lon: 70.6200, label: 'WP-4 (Tanot Post)' },
  ],
  MOUNTAIN: [
    { lat: 34.1526, lon: 77.5771, label: 'WP-1 (Leh Base)' },
    { lat: 34.2800, lon: 77.6100, label: 'WP-2 (Khardung La Pass)' },
    { lat: 34.4500, lon: 77.5200, label: 'WP-3 (Nubra Valley)' },
    { lat: 34.1000, lon: 78.3500, label: 'WP-4 (Pangong Tso LAC)' },
  ],
  MARITIME: [
    { lat: 18.9220, lon: 72.8347, label: 'WP-1 (Mumbai Shelf)' },
    { lat: 19.1800, lon: 72.4500, label: 'WP-2 (Offshore Platform Echo)' },
    { lat: 18.7500, lon: 72.2000, label: 'WP-3 (Arabian Sea EEZ)' },
    { lat: 18.5500, lon: 72.6800, label: 'WP-4 (Coastal Radar)' },
  ],
  FOREST: [
    { lat: 27.5861, lon: 91.8594, label: 'WP-1 (Tawang Valley)' },
    { lat: 27.5100, lon: 92.1200, label: 'WP-2 (Sela Pass Ridge)' },
    { lat: 27.7100, lon: 91.8900, label: 'WP-3 (Bum La LAC Post)' },
    { lat: 27.3800, lon: 92.0500, label: 'WP-4 (Kameng River Sentry)' },
  ],
};

function formatCoord(deg: number, isLat: boolean) {
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const min = Math.floor((abs - d) * 60);
  const sec = Math.round(((abs - d) * 60 - min) * 60);
  const dir = isLat ? (deg >= 0 ? 'N' : 'S') : deg >= 0 ? 'E' : 'W';
  return `${d}°${min.toString().padStart(2, '0')}'${sec.toString().padStart(2, '0')}" ${dir}`;
}

export function GPSTrackingMap({ className = '' }: { className?: string }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const uavMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const ghostPolylineRef = useRef<L.Polyline | null>(null);
  const ghostMarkerRef = useRef<L.Marker | null>(null);
  const waypointsLayerRef = useRef<L.LayerGroup | null>(null);
  const patrolRouteLayerRef = useRef<L.Polyline | null>(null);

  const uav = useStore(s => s.uav);
  const mission = useStore(s => s.mission);
  const replanning = useStore(s => s.replanning);
  const showGhostUAV = useStore(s => s.showGhostUAV);
  const isRunning = useStore(s => s.isRunning);
  const themeMode = useStore(s => s.themeMode);
  const isLight = themeMode === 'light';

  const [activeTerrainKey, setActiveTerrainKey] = useState<string>(
    mission.environment || 'DESERT'
  );
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [isPatrolActive, setIsPatrolActive] = useState<boolean>(true);
  const [targetWpIdx, setTargetWpIdx] = useState<number>(0);

  const activeTerrain = useMemo(() => {
    return INDIAN_TERRAINS.find(t => t.key === activeTerrainKey) || INDIAN_TERRAINS[0];
  }, [activeTerrainKey]);

  const activeWaypoints = useMemo(() => {
    if (uav.waypoints && uav.waypoints.length > 0) {
      return uav.waypoints;
    }
    return DEFAULT_TERRAIN_WAYPOINTS[activeTerrainKey] || DEFAULT_TERRAIN_WAYPOINTS.DESERT;
  }, [uav.waypoints, activeTerrainKey]);

  // Synchronize with mission environment if modified externally
  useEffect(() => {
    if (mission.environment && mission.environment !== activeTerrainKey) {
      const match = INDIAN_TERRAINS.find(t => t.key === mission.environment);
      if (match) {
        setActiveTerrainKey(match.key);
        if (polylineRef.current) polylineRef.current.setLatLngs([]);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([match.lat, match.lon], match.zoom, { duration: 1.2 });
        }
      }
    }
  }, [mission.environment, activeTerrainKey]);

  const [mapMode, setMapMode] = useState<'dark' | 'satellite' | 'terrain'>('dark');

  const getTileUrl = useCallback((mode: 'dark' | 'satellite' | 'terrain', light: boolean) => {
    const BASEMAPS_KEY = 'cb1_40ig_1_ff2a05b6062b9c5bbd8b56fa';
    if (mode === 'satellite') {
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    }
    if (mode === 'terrain') {
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
    }
    return light
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${BASEMAPS_KEY}`
      : `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${BASEMAPS_KEY}`;
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Clean up potential existing leaflet instance attached to the DOM node
    const container = mapContainerRef.current as any;
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }

    const initial = INDIAN_TERRAINS.find(t => t.key === activeTerrainKey) || INDIAN_TERRAINS[0];
    const initialCenter: [number, number] = [uav.lat || initial.lat, uav.lon || initial.lon];

    const tileUrl = getTileUrl(mapMode, isLight);

    const tileLayer = L.tileLayer(tileUrl, {
      attribution: '&copy; CartoDB &copy; OpenStreetMap contributors &copy; Esri',
      subdomains: 'abcd',
      maxZoom: 19,
    });

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initial.zoom,
      zoomControl: false,
    });

    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    // Planned patrol route line (Faint Cyan Dash)
    const patrolRoute = L.polyline([], {
      color: '#0284c7',
      weight: 1.5,
      opacity: 0.6,
      dashArray: '4, 6',
    }).addTo(map);
    patrolRouteLayerRef.current = patrolRoute;

    // Breadcrumbs live track line (Aerospace High-Vis Cyan)
    const polyline = L.polyline([], {
      color: '#00d4ff',
      weight: 3.5,
      opacity: 0.95,
    }).addTo(map);

    // Ghost replanned route line (Divergent Sky Dash)
    const ghostPolyline = L.polyline([], {
      color: '#38bdf8',
      weight: 3,
      opacity: 0.9,
      dashArray: '6, 8',
    }).addTo(map);

    // Layer group for tactical waypoints
    const waypointsLayer = L.layerGroup().addTo(map);

    // Custom tactical UAV Icon (High-vis cyan and aerospace navy)
    const uavIcon = L.divIcon({
      className: 'uav-gps-icon',
      html: `
        <div style="transform: rotate(${uav.heading_deg || 0}deg); transition: transform 0.25s linear; display: flex; align-items: center; justify-content: center;">
          <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; inset: 0; background: rgba(0, 212, 255, 0.2); border: 2px solid #00d4ff; border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 28px; height: 28px; background: #0284c7; border: 2px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,212,255,0.6);">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
              </svg>
            </div>
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    const marker = L.marker(initialCenter, { icon: uavIcon }).addTo(map);

    // Tactical Holographic Ghost UAV Icon (Purple/Cyan Pulsing)
    const ghostIcon = L.divIcon({
      className: 'ghost-uav-gps-icon',
      html: `
        <div style="transform: rotate(${uav.heading_deg || 0}deg); display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; inset: 0; background: rgba(192, 132, 252, 0.35); border: 2px dashed #c084fc; border-radius: 50%; animation: spin 6s linear infinite;"></div>
            <div style="width: 24px; height: 24px; background: #7e22ce; border: 2px solid #e9d5ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px rgba(168,85,247,0.8);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
              </svg>
            </div>
          </div>
          <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid #a855f7; border-radius: 4px; padding: 1px 4px; font-family: monospace; font-size: 8px; color: #d8b4fe; font-weight: bold; margin-top: 2px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.6);">
            GHOST
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 17],
    });
    const ghostMarker = L.marker(initialCenter, { icon: ghostIcon, opacity: 0 }).addTo(map);

    mapInstanceRef.current = map;
    uavMarkerRef.current = marker;
    ghostMarkerRef.current = ghostMarker;
    polylineRef.current = polyline;
    ghostPolylineRef.current = ghostPolyline;
    waypointsLayerRef.current = waypointsLayer;

    // Invalidate size to guarantee no grey tiles
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    // Watch resize of container
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map tiles when theme mode or map layer changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(getTileUrl(mapMode, isLight));
  }, [mapMode, isLight, getTileUrl]);

  // Render Waypoints & Planned Flight Route on Map
  useEffect(() => {
    if (!mapInstanceRef.current || !waypointsLayerRef.current || !patrolRouteLayerRef.current) return;

    waypointsLayerRef.current.clearLayers();

    if (activeWaypoints && activeWaypoints.length > 0) {
      const latlngs: [number, number][] = activeWaypoints.map(wp => [wp.lat, wp.lon]);
      // Close loop for continuous patrol
      latlngs.push([activeWaypoints[0].lat, activeWaypoints[0].lon]);
      patrolRouteLayerRef.current.setLatLngs(latlngs);

      activeWaypoints.forEach((wp, idx) => {
        const isCurrent = idx === targetWpIdx;
        const color = isCurrent ? '#00d4ff' : '#64748b';

        const circle = L.circleMarker([wp.lat, wp.lon], {
          radius: isCurrent ? 8 : 5,
          color: color,
          fillColor: color,
          fillOpacity: isCurrent ? 0.9 : 0.4,
          weight: 2,
        });

        circle.bindTooltip(`[${wp.label || `WP-${idx + 1}`}]`, {
          permanent: false,
          direction: 'top',
          className: 'tactical-map-tooltip',
        });

        waypointsLayerRef.current?.addLayer(circle);
      });
    }
  }, [activeWaypoints, targetWpIdx]);

  // Update UAV marker position and breadcrumbs in real-time
  useEffect(() => {
    if (!mapInstanceRef.current || !uavMarkerRef.current || !polylineRef.current) return;
    if (!uav.lat || !uav.lon) return;

    const newPos: [number, number] = [uav.lat, uav.lon];
    uavMarkerRef.current.setLatLng(newPos);

    // Rotate marker to match current UAV heading
    const el = uavMarkerRef.current.getElement();
    if (el) {
      const heading = uav.heading_deg || 0;
      const inner = el.querySelector('div') as HTMLElement;
      if (inner) {
        inner.style.transform = `rotate(${heading}deg)`;
      }
    }

    // Append to live trajectory polyline
    const currentPoints = polylineRef.current.getLatLngs() as L.LatLng[];
    currentPoints.push(L.latLng(uav.lat, uav.lon));
    // Keep max 350 historical points to prevent memory bloat
    if (currentPoints.length > 350) {
      currentPoints.shift();
    }
    polylineRef.current.setLatLngs(currentPoints);

    // Auto-follow pan
    if (autoFollow && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(newPos, { animate: true, duration: 0.5 });
    }
  }, [uav.lat, uav.lon, uav.heading_deg, autoFollow]);

  // Real-Time GPS Dead-Reckoning Autonomous Patrol Loop
  // If backend simulation is idle, this high-precision loop keeps the UAV flying in real-time along tactical waypoints
  useEffect(() => {
    if (!isPatrolActive) return;

    const interval = setInterval(() => {
      // If backend simulation is actively running, let backend drive state
      if (isRunning) return;

      const currentLat = useStore.getState().uav.lat || activeTerrain.lat;
      const currentLon = useStore.getState().uav.lon || activeTerrain.lon;
      const targetWp = activeWaypoints[targetWpIdx] || activeWaypoints[0];

      if (!targetWp) return;

      const dLat = targetWp.lat - currentLat;
      const dLon = targetWp.lon - currentLon;
      const distM = Math.sqrt(
        Math.pow(dLat * 111320, 2) +
        Math.pow(dLon * 111320 * Math.cos((currentLat * Math.PI) / 180), 2)
      );

      // Advance waypoint when within 400m
      if (distM < 400) {
        const nextIdx = (targetWpIdx + 1) % activeWaypoints.length;
        setTargetWpIdx(nextIdx);
        return;
      }

      // Calculate bearing
      const bearingRad = Math.atan2(
        dLon * Math.cos((currentLat * Math.PI) / 180),
        dLat
      );
      const bearingDeg = (bearingRad * (180 / Math.PI) + 360) % 360;

      // UAV ground speed: 110 knots (~56.5 m/s)
      const speedKts = 110;
      const speedMps = (speedKts * 1852) / 3600;
      const stepDistM = speedMps * 0.8; // 0.8s interval step

      const stepLat = (stepDistM * Math.cos(bearingRad)) / 111320;
      const stepLon = (stepDistM * Math.sin(bearingRad)) / (111320 * Math.cos((currentLat * Math.PI) / 180));

      const nextLat = currentLat + stepLat;
      const nextLon = currentLon + stepLon;

      useStore.getState().updateUavFlight({
        lat: nextLat,
        lon: nextLon,
        heading_deg: Math.round(bearingDeg),
        speed_kts: speedKts,
        altitude_ft: activeTerrain.defaultAlt,
      });
    }, 800);

    return () => clearInterval(interval);
  }, [isPatrolActive, isRunning, activeWaypoints, targetWpIdx, activeTerrain]);

  // Update Dynamic Replanning Ghost Route overlay & Tactical Marker
  useEffect(() => {
    if (!ghostPolylineRef.current) return;

    if (showGhostUAV) {
      const currLat = uav.lat || activeTerrain.lat;
      const currLon = uav.lon || activeTerrain.lon;

      if (replanning?.triggered && replanning.best_candidate) {
        // Contingency Diversion Route towards recovery base / safe loiter
        const diversionWp = [
          [currLat, currLon],
          [currLat + 0.075, currLon - 0.055],
          [currLat + 0.15, currLon - 0.12],
        ] as L.LatLngExpression[];

        ghostPolylineRef.current.setStyle({ color: '#c084fc', dashArray: '6, 8', weight: 3.5 });
        ghostPolylineRef.current.setLatLngs(diversionWp);

        if (ghostMarkerRef.current) {
          ghostMarkerRef.current.setLatLng([currLat + 0.075, currLon - 0.055]);
          ghostMarkerRef.current.setOpacity(1.0);
        }
      } else {
        // Predictive Horizon Shadow Twin (+25s forward vector)
        const hdgRad = ((uav.heading_deg || 55) * Math.PI) / 180;
        const shadowLat = currLat + Math.cos(hdgRad) * 0.038;
        const shadowLon = currLon + Math.sin(hdgRad) * 0.038;

        const shadowWp = [
          [currLat, currLon],
          [shadowLat, shadowLon],
          [currLat + Math.cos(hdgRad) * 0.075, currLon + Math.sin(hdgRad) * 0.075],
        ] as L.LatLngExpression[];

        ghostPolylineRef.current.setStyle({ color: '#38bdf8', dashArray: '4, 6', weight: 3 });
        ghostPolylineRef.current.setLatLngs(shadowWp);

        if (ghostMarkerRef.current) {
          ghostMarkerRef.current.setLatLng([shadowLat, shadowLon]);
          ghostMarkerRef.current.setOpacity(0.9);
        }
      }
    } else {
      ghostPolylineRef.current.setLatLngs([]);
      if (ghostMarkerRef.current) {
        ghostMarkerRef.current.setOpacity(0);
      }
    }
  }, [showGhostUAV, replanning, uav.lat, uav.lon, uav.heading_deg, activeTerrain]);

  const handleSelectTerrain = async (terrain: TerrainConfig) => {
    setActiveTerrainKey(terrain.key);
    setTargetWpIdx(0);

    // Clear previous breadcrumbs across sectors
    if (polylineRef.current) {
      polylineRef.current.setLatLngs([]);
    }

    useStore.getState().setEnvironment(terrain.key);
    useStore.getState().updateUavFlight({
      lat: terrain.lat,
      lon: terrain.lon,
      altitude_ft: terrain.defaultAlt,
      heading_deg: 45,
    });

    try {
      await api.setMission(mission.profile, terrain.key);
      const state = await api.getState();
      useStore.getState().updateFromBackend(state);
    } catch (e) {
      console.warn('Terrain update sync note:', e);
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([terrain.lat, terrain.lon], terrain.zoom, {
        duration: 1.2,
      });
    }
  };

  const centerOnUAV = useCallback(() => {
    if (mapInstanceRef.current && uav.lat && uav.lon) {
      mapInstanceRef.current.panTo([uav.lat, uav.lon], { animate: true });
      setAutoFollow(true);
    }
  }, [uav.lat, uav.lon]);

  const togglePatrol = async () => {
    if (isRunning) {
      try {
        await api.stopSimulation();
      } catch (err) {
        console.warn('Failed to stop backend simulation:', err);
      }
    } else {
      try {
        await api.startSimulation();
      } catch (err) {
        console.warn('Failed to start backend simulation:', err);
      }
    }
    setIsPatrolActive(prev => !prev);
  };

  return (
    <div className={`relative flex flex-col w-full h-full overflow-hidden ${isLight ? 'bg-white' : 'bg-slate-950'} ${className}`}>
      {/* ─── Top Header Controls & Terrain Quick Selector ─── */}
      <div className={`z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3 backdrop-blur-xl border-b shadow-lg transition-colors ${
        isLight
          ? 'bg-white/95 border-cyan-500/20 text-slate-900'
          : 'bg-slate-950/85 border-cyan-500/30 text-white'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
            <Crosshair className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-xs font-bold tracking-wider ${isLight ? 'text-slate-950' : 'text-white'}`}>
                REAL-TIME GPS TACTICAL TRACKING
              </span>
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                LIVE NavIC LOCK
              </span>
              {isRunning && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  STREAMING 1Hz
                </span>
              )}
            </div>
            <div className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {activeTerrain.sector}
            </div>
          </div>
        </div>

        {/* ─── Control Bar: Live Patrol Play/Pause + Auto-Follow + 4 Terrains ─── */}
        <div className="flex items-center gap-2">
          {/* Patrol Toggle */}
          <button
            onClick={togglePatrol}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider transition-all cursor-pointer border ${
              isPatrolActive || isRunning
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-[0_0_10px_rgba(0,212,255,0.3)]'
                : 'bg-slate-800 text-slate-300 border-white/10 hover:bg-slate-700'
            }`}
            title="Toggle autonomous real-time patrol simulation"
          >
            {isPatrolActive || isRunning ? (
              <>
                <Pause className="w-3 h-3 text-cyan-400" />
                <span>PATROL ACTIVE</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-emerald-400" />
                <span>START PATROL</span>
              </>
            )}
          </button>

          {/* Auto-Follow Toggle */}
          <button
            onClick={() => setAutoFollow(prev => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono tracking-wider transition-all cursor-pointer border ${
              autoFollow
                ? 'bg-sky-500/20 text-sky-300 border-sky-400/50'
                : 'text-slate-400 hover:text-white border-transparent'
            }`}
            title="Auto-center camera on UAV"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">FOLLOW: {autoFollow ? 'ON' : 'OFF'}</span>
          </button>

          {/* 4 Terrain Selector Buttons */}
          <div className={`flex items-center gap-1 p-1 rounded-xl border ${
            isLight ? 'bg-slate-100/90 border-slate-200' : 'bg-slate-900/80 border-white/10'
          }`}>
            {INDIAN_TERRAINS.map(t => {
              const isSelected = activeTerrainKey === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => handleSelectTerrain(t)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono tracking-wider transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/60 shadow-[0_0_12px_rgba(0,212,255,0.3)] font-bold'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-950 hover:bg-white/80'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={t.sector}
                >
                  <span className="px-1 py-0.5 rounded text-[8px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    {t.code}
                  </span>
                  <span>{t.shortName}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Map Canvas Container (Ensures explicit 100% dimensions for Leaflet) ─── */}
      <div className="relative flex-1 w-full min-h-[460px] overflow-hidden">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

        {/* ─── Floating Tactical Overlay (Top-Left HUD) ─── */}
        <div className={`absolute top-4 left-4 z-[400] p-3.5 rounded-2xl backdrop-blur-xl border shadow-xl max-w-xs pointer-events-auto transition-colors ${
          isLight
            ? 'bg-white/95 border-cyan-500/25 text-slate-900 shadow-[0_8px_32px_rgba(0,0,0,0.08)]'
            : 'bg-slate-950/85 border-cyan-500/30 text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)]'
        }`}>
          <div className={`flex items-center justify-between gap-2 border-b pb-2 mb-2 ${
            isLight ? 'border-slate-200' : 'border-white/10'
          }`}>
            <span className={`text-[10px] font-mono uppercase font-semibold tracking-wider flex items-center gap-1.5 ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
              UAV TELEMETRY LOCK
            </span>
            <span className="text-[10px] font-mono font-bold text-cyan-400">
              {activeTerrain.key}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <div className="text-[10px] text-slate-500">LATITUDE</div>
              <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {formatCoord(uav.lat || activeTerrain.lat, true)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">LONGITUDE</div>
              <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {formatCoord(uav.lon || activeTerrain.lon, false)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">ALTITUDE MSL</div>
              <div className="font-bold text-cyan-400">
                {Math.round(uav.altitude_ft || activeTerrain.defaultAlt).toLocaleString()} ft
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">GROUND SPEED</div>
              <div className="font-bold text-emerald-400">
                {Math.round(uav.speed_kts || 110)} kts
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">HEADING</div>
              <div className="font-bold text-sky-300">
                {Math.round(uav.heading_deg || 0)}°
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">AGL CLEARANCE</div>
              <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {Math.max(
                  500,
                  Math.round((uav.altitude_ft || activeTerrain.defaultAlt) - activeTerrain.elevationMsl * 3.28)
                ).toLocaleString()}{' '}
                ft
              </div>
            </div>
          </div>

          <div className={`mt-2 pt-2 border-t flex items-center justify-between text-[10px] font-mono ${
            isLight ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'
          }`}>
            <span className="truncate">{activeTerrain.navicStatus}</span>
          </div>
        </div>

        {/* ─── Dynamic Replanning Ghost Route Alert Overlay ─── */}
        {replanning?.triggered && (
          <div className="absolute top-4 right-4 z-[400] p-3 rounded-2xl bg-sky-950/85 backdrop-blur-xl border border-sky-500/50 shadow-xl max-w-sm pointer-events-auto">
            <div className="flex items-center gap-2 text-sky-300 font-mono text-xs font-bold mb-1">
              <AlertTriangle className="w-4 h-4 text-sky-400" />
              <span>DYNAMIC MISSION REPLAN ACTIVE</span>
            </div>
            <p className="text-[11px] font-sans text-sky-100/90 leading-snug">
              {replanning.reason || 'Shorter/safer return route projected onto tactical map.'}
            </p>
            {replanning.best_candidate && (
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono bg-sky-900/40 p-1.5 rounded-lg border border-sky-500/30 text-sky-200">
                <span>DIVERT: {replanning.best_candidate.name}</span>
                <span className="font-bold text-sky-300">
                  {replanning.best_candidate.duration_hours}h duration
                </span>
              </div>
            )}
          </div>
        )}

        {/* ─── Quick Map Controls (Bottom-Right) ─── */}
        <div className="absolute bottom-4 right-4 z-[400] flex flex-col gap-1.5 pointer-events-auto">
          {/* Layer Switcher */}
          <button
            onClick={() => setMapMode(m => m === 'dark' ? 'satellite' : m === 'satellite' ? 'terrain' : 'dark')}
            className={`p-2.5 rounded-xl border shadow-md transition-all cursor-pointer ${
              mapMode === 'satellite'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/60 shadow-[0_0_12px_rgba(0,212,255,0.4)]'
                : mapMode === 'terrain'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/60'
                : isLight
                ? 'bg-white border-slate-200 text-slate-700 hover:text-cyan-500 hover:bg-slate-50'
                : 'bg-slate-900/90 border-white/15 text-slate-300 hover:text-cyan-400 hover:bg-slate-800'
            }`}
            title={`Active: ${mapMode.toUpperCase()} VIEW (Click to cycle Dark / Satellite Recon / Topo)`}
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={centerOnUAV}
            className={`p-2.5 rounded-xl border shadow-md transition-all cursor-pointer ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700 hover:text-cyan-500 hover:bg-slate-50'
                : 'bg-slate-900/90 border-white/15 text-slate-300 hover:text-cyan-400 hover:bg-slate-800'
            }`}
            title="Center on UAV Position"
          >
            <Navigation className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className={`p-2.5 rounded-xl border shadow-md transition-all cursor-pointer ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700 hover:text-cyan-500 hover:bg-slate-50'
                : 'bg-slate-900/90 border-white/15 text-slate-300 hover:text-cyan-400 hover:bg-slate-800'
            }`}
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className={`p-2.5 rounded-xl border shadow-md transition-all cursor-pointer ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700 hover:text-cyan-500 hover:bg-slate-50'
                : 'bg-slate-900/90 border-white/15 text-slate-300 hover:text-cyan-400 hover:bg-slate-800'
            }`}
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Bottom Elevation Profile Widget ─── */}
        <div className={`absolute bottom-4 left-4 z-[400] px-3.5 py-2 rounded-xl backdrop-blur-xl border shadow-md flex items-center gap-4 text-xs font-mono pointer-events-auto transition-colors ${
          isLight
            ? 'bg-white/95 border-cyan-500/25 text-slate-900'
            : 'bg-slate-950/85 border-cyan-500/30 text-white'
        }`}>
          <div className="flex items-center gap-2 text-cyan-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span>TERRAIN: {activeTerrain.terrainType}</span>
          </div>
          <div className={`hidden sm:flex items-center gap-2 border-l pl-3 ${
            isLight ? 'border-slate-200 text-slate-600' : 'border-white/10 text-slate-400'
          }`}>
            <span>SECTOR BASE EL: {activeTerrain.elevationMsl}m MSL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
