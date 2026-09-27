import React from 'react';
import { useStore } from '../../store/useStore';

interface AerospaceBackgroundProps {
  isHome: boolean;
}

export const AerospaceBackground: React.FC<AerospaceBackgroundProps> = ({ isHome }) => {
  const themeMode = useStore(s => s.themeMode);
  const isLight = themeMode === 'light';

  return (
    <div
      className={`reference-backdrop fixed inset-0 z-0 overflow-hidden pointer-events-none select-none transition-colors duration-500 ${
        isLight ? 'bg-[#f8fafc]' : 'bg-[#070709]'
      }`}
    >
      {isHome && (
        <div
          className={`reference-backdrop-image absolute inset-0 transition-opacity duration-700 ${
            isLight ? 'opacity-15' : 'opacity-85'
          }`}
          style={{ backgroundImage: "url('/images/aerovex-uav-hero.jpg')" }}
          aria-hidden="true"
        />
      )}
      <div
        className={`reference-backdrop-wash absolute inset-0 transition-opacity duration-700 ${
          isHome ? (isLight ? 'opacity-30' : 'opacity-100') : (isLight ? 'opacity-50' : 'opacity-80')
        }`}
      />

      {/* Dynamic Theme Glow Layers */}
      {isLight ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(234,88,12,0.08),transparent_42%),radial-gradient(circle_at_20%_80%,rgba(249,115,22,0.05),transparent_35%),linear-gradient(180deg,#ffffff,#f8fafc_60%,#f1f5f9)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(234,88,12,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(234,88,12,0.06)_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:radial-gradient(ellipse_75%_75%_at_50%_50%,#000_40%,transparent_95%)] opacity-80" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(249,115,22,0.14),transparent_38%),radial-gradient(circle_at_15%_80%,rgba(234,88,12,0.10),transparent_30%),linear-gradient(145deg,#050507,#0c0c0e_55%,#070709)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(249,115,22,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(249,115,22,0.05)_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:radial-gradient(ellipse_70%_75%_at_50%_50%,#000_35%,transparent_90%)] opacity-60" />
        </>
      )}
    </div>
  );
};
