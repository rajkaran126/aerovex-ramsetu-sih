import React from 'react';

interface AerospaceBackgroundProps {
  isHome: boolean;
}

export const AerospaceBackground: React.FC<AerospaceBackgroundProps> = ({ isHome }) => {
  return (
    <div className="reference-backdrop fixed inset-0 z-0 overflow-hidden pointer-events-none select-none bg-[#030710]">
      {isHome && (
        <div
          className="reference-backdrop-image absolute inset-0"
          style={{ backgroundImage: "url('/images/aerovex-uav-hero.jpg')" }}
          aria-hidden="true"
        />
      )}
      <div className={`reference-backdrop-wash absolute inset-0 transition-opacity duration-700 ${isHome ? 'opacity-100' : 'opacity-80'}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,#16436155,transparent_32%),radial-gradient(circle_at_10%_80%,#087da833,transparent_27%),linear-gradient(145deg,#020d19,#071b2c_54%,#03111f)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#79dfff0c_1px,transparent_1px),linear-gradient(to_bottom,#79dfff0c_1px,transparent_1px)] bg-[size:6rem_6rem] [mask-image:radial-gradient(ellipse_70%_75%_at_50%_50%,#000_35%,transparent_90%)] opacity-70" />
    </div>
  );
};
