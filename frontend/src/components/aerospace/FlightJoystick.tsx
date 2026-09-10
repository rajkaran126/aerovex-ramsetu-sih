import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { Compass, Gauge, ChevronDown, ChevronUp, Crosshair, RotateCcw, Radio } from 'lucide-react';

export function FlightJoystick() {
  const { manualFlight, setManualFlight, joystick, setJoystick, uav } = useStore(s => ({
    manualFlight: s.manualFlight,
    setManualFlight: s.setManualFlight,
    joystick: s.joystick,
    setJoystick: s.setJoystick,
    uav: s.uav,
  }));

  const [isDragging, setIsDragging] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const stickRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);

  // Position offset from center [-1 to 1]
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });

  // Handle pointer down / touch start
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setManualFlight(true);
    updateStickFromEvent(e);
  };

  const updateStickFromEvent = useCallback((e: MouseEvent | TouchEvent | React.PointerEvent) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const maxRadius = rect.width / 2 - 16;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    const normX = dx / maxRadius; // Roll [-1, 1]
    const normY = dy / maxRadius; // Pitch [-1, 1]

    setStickPos({ x: dx, y: dy });
    setJoystick({
      roll: normX,
      pitch: normY,
    });
  }, [setJoystick]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: MouseEvent) => {
      updateStickFromEvent(e);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      // Elastic spring back to center
      setStickPos({ x: 0, y: 0 });
      setJoystick({ roll: 0, pitch: 0 });
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [isDragging, updateStickFromEvent, setJoystick]);

  // Keyboard flight controls
  useEffect(() => {
    const keysDown = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 's', 'a', 'd', 'Shift', 'Control'].includes(e.key)) {
        // Prevent page scrolling on arrow keys when simulator is active
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
        }
        keysDown.add(e.key.toLowerCase());
        setManualFlight(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.key.toLowerCase());
    };

    const interval = setInterval(() => {
      if (keysDown.size === 0) return;

      let p = 0;
      let r = 0;
      let thrDelta = 0;

      if (keysDown.has('w') || keysDown.has('arrowup')) p -= 0.65; // Dive / pitch down
      if (keysDown.has('s') || keysDown.has('arrowdown')) p += 0.65; // Climb / pitch up
      if (keysDown.has('a') || keysDown.has('arrowleft')) r -= 0.75; // Bank left
      if (keysDown.has('d') || keysDown.has('arrowright')) r += 0.75; // Bank right
      if (keysDown.has('shift')) thrDelta += 0.04;
      if (keysDown.has('control')) thrDelta -= 0.04;

      const currentJoy = useStore.getState().joystick;
      setJoystick({
        pitch: p,
        roll: r,
        throttle: Math.min(1, Math.max(0.2, currentJoy.throttle + thrDelta)),
      });

      const maxR = 36;
      setStickPos({ x: r * maxR, y: p * maxR });
    }, 40);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setManualFlight, setJoystick]);

  const levelHorizon = () => {
    setStickPos({ x: 0, y: 0 });
    setJoystick({ pitch: 0, roll: 0 });
  };

  const rollDeg = (joystick.roll * 30).toFixed(1);
  const pitchDeg = (-joystick.pitch * 20).toFixed(1);

  return (
    <div className="absolute bottom-4 right-4 z-20 select-none">
      <div className="rounded-2xl border border-cyan-400/40 bg-slate-950/85 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-300">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${manualFlight ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="font-mono text-[10px] font-bold text-cyan-300 tracking-wider">
              {manualFlight ? 'JOYSTICK: MANUAL FLY' : 'FLIGHT: AUTO-CRUISE'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setManualFlight(!manualFlight)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider transition-all ${
                manualFlight
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                  : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
              }`}
            >
              {manualFlight ? 'MANUAL' : 'AUTO'}
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="p-3.5 flex items-center gap-4">
            {/* Virtual 2D Joystick Gimbal */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                ref={baseRef}
                onPointerDown={handlePointerDown}
                className="relative w-28 h-28 rounded-full bg-slate-900/90 border-2 border-cyan-500/40 shadow-inner flex items-center justify-center cursor-grab active:cursor-grabbing group"
              >
                {/* Crosshairs & Angle Grids */}
                <div className="absolute inset-2 rounded-full border border-dashed border-cyan-500/20 pointer-events-none" />
                <div className="absolute w-full h-[1px] bg-cyan-500/20 pointer-events-none" />
                <div className="absolute h-full w-[1px] bg-cyan-500/20 pointer-events-none" />
                <Crosshair className="w-4 h-4 text-cyan-500/40 pointer-events-none" />

                {/* Draggable Thumbstick */}
                <div
                  ref={stickRef}
                  style={{
                    transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.2)',
                  }}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-sky-600 border-2 border-white shadow-[0_0_15px_rgba(6,182,212,0.6)] flex items-center justify-center pointer-events-none"
                >
                  <div className="w-3 h-3 rounded-full bg-slate-950/70" />
                </div>
              </div>

              {/* Angle Readouts */}
              <div className="flex items-center justify-between w-full font-mono text-[9px] text-slate-400">
                <span>ROLL: <b className="text-cyan-300">{rollDeg}°</b></span>
                <span>PITCH: <b className="text-cyan-300">{pitchDeg}°</b></span>
              </div>
            </div>

            {/* Throttle Slider */}
            <div className="flex flex-col items-center gap-1.5 h-28 justify-between border-l border-white/10 pl-3">
              <div className="text-[9px] font-mono text-cyan-400 font-bold tracking-widest uppercase">
                THR: {Math.round(joystick.throttle * 100)}%
              </div>
              <input
                type="range"
                min={0.2}
                max={1.0}
                step={0.02}
                value={joystick.throttle}
                onChange={e => {
                  setManualFlight(true);
                  setJoystick({ throttle: parseFloat(e.target.value) });
                }}
                className="h-20 w-3 accent-cyan-400 cursor-pointer appearance-none bg-slate-900 rounded-lg border border-white/15 [writing-mode:vertical-lr] [direction:rtl]"
              />
              <button
                onClick={levelHorizon}
                title="Level Horizon (Reset Pitch & Roll)"
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-[9px] font-mono text-slate-300 border border-white/10 transition-all"
              >
                <RotateCcw className="w-2.5 h-2.5 text-cyan-400" />
                LEVEL
              </button>
            </div>
          </div>
        )}

        {/* Bottom Hotkey Help */}
        {!collapsed && (
          <div className="px-3 py-1 bg-black/40 border-t border-white/5 flex items-center justify-between font-mono text-[8px] text-slate-400">
            <span>KEYS: <b className="text-slate-300">W/S</b> PITCH • <b className="text-slate-300">A/D</b> BANK</span>
            <span><b className="text-slate-300">SHIFT/CTRL</b> THR</span>
          </div>
        )}
      </div>
    </div>
  );
}
