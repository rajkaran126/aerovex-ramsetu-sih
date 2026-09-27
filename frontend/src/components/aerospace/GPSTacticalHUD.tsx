import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { Navigation, MapPin, Satellite, ShieldCheck, Compass } from 'lucide-react';

function toDMS(deg: number, isLat: boolean): string {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
  const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
  return `${degrees}°${minutes.toString().padStart(2, '0')}'${seconds.toString().padStart(2, '0')}" ${dir}`;
}

export function GPSTacticalHUD() {
  const { uav, mission } = useStore(s => ({
    uav: s.uav,
    mission: s.mission,
  }));

  const env = mission.environment || 'MOUNTAIN';

  const indianSector = useMemo(() => {
    switch (env) {
      case 'DESERT':
        return {
          theatre: 'THAR DESERT SECTOR',
          region: 'Rajasthan Border, India',
          base: 'Pokhran Range Airbase',
          grid: '42R XT 89412 32184',
        };
      case 'MARITIME':
        return {
          theatre: 'INDIAN OCEAN EEZ',
          region: 'Arabian Sea / Mumbai High, India',
          base: 'INS Hansa Coastal Command',
          grid: '43Q DA 48921 78912',
        };
      case 'FOREST':
      case 'NORTH_EAST':
        return {
          theatre: 'NORTH-EASTERN TERRAIN',
          region: 'Arunachal Pradesh / Tawang Valley, India',
          base: 'Tezpur Forward Airbase',
          grid: '43R WM 82140 91042',
        };
      case 'MOUNTAIN':
      case 'HIGH_ALTITUDE':
      default:
        return {
          theatre: 'HIMALAYAN BORDER SECTOR',
          region: 'Ladakh (Siachen / Line of Control), India',
          base: 'Leh Airbase / Thoise Forward Post',
          grid: '43S EU 72184 81092',
        };
    }
  }, [env]);

  const latDMS = toDMS(uav.lat || 34.1526, true);
  const lonDMS = toDMS(uav.lon || 77.5771, false);

  return (
    <div className="gps-hud z-20 pointer-events-none">
      <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-2xl bg-slate-950/85 border border-cyan-500/30 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] font-mono text-slate-200 text-xs">
        {/* NavIC Satellite Lock Indicator */}
        <div className="flex items-center gap-1.5 pr-2.5 border-r border-white/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <Satellite className="w-3.5 h-3.5 text-cyan-400" />
          <div className="text-left">
            <div className="text-[9px] font-bold text-cyan-300 tracking-wider">NavIC / IRNSS</div>
            <div className="text-[7px] text-emerald-400 font-bold">3D FIX • 14 SATS</div>
          </div>
        </div>

        {/* Indian Location Sector */}
        <div className="flex items-center gap-2 pr-2.5 border-r border-white/10">
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <div className="text-left">
            <div className="text-[9px] font-bold text-white tracking-wide">{indianSector.theatre}</div>
            <div className="text-[8px] text-slate-400">{indianSector.region}</div>
          </div>
        </div>

        {/* Live GPS Coordinates */}
        <div className="flex items-center gap-3 pr-2.5 border-r border-white/10">
          <div>
            <div className="text-[8px] text-slate-400">LATITUDE</div>
            <div className="text-[10px] font-bold text-cyan-300">{latDMS}</div>
          </div>
          <div>
            <div className="text-[8px] text-slate-400">LONGITUDE</div>
            <div className="text-[10px] font-bold text-cyan-300">{lonDMS}</div>
          </div>
        </div>

        {/* Tactical Altitude & Heading */}
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[8px] text-slate-400">ALT MSL</div>
            <div className="text-[10px] font-bold text-sky-400">{Math.round(uav.altitude_ft || 18500).toLocaleString()} FT</div>
          </div>
          <div>
            <div className="text-[8px] text-slate-400">HEADING</div>
            <div className="text-[10px] font-bold text-amber-400">{Math.round(uav.heading_deg || 55).toString().padStart(3, '0')}°</div>
          </div>
        </div>
      </div>
    </div>
  );
}
