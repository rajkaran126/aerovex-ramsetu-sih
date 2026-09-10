"""
AERO-TWIN — Reduced-Order Physics-Informed Aero-Piston Engine Model

This module implements a simplified but physically sensible model of an
aero-piston engine (conceptually inspired by Rotax-class architecture).

DISCLAIMER: This is a RESEARCH DEMONSTRATOR.
- NOT a certified flight model
- NOT a CFD simulation
- Uses physically-motivated relationships for demonstration purposes
- All values are SYNTHETIC/SIMULATED

The model computes thermodynamic and performance parameters from:
  throttle, RPM_target, altitude, ambient_temperature, engine_load,
  fuel_flow, degradation_state, environmental_conditions
"""

import numpy as np
from dataclasses import dataclass, field
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

# ─── Reference engine constants (conceptually inspired by ~100hp aero-piston) ─
ENGINE_DISP_L = 1.211          # displacement in litres
MAX_RPM = 5800.0               # max rated RPM
IDLE_RPM = 800.0               # idle RPM
MAX_POWER_KW = 73.5            # ~100 HP at SL
MAX_TORQUE_NM = 127.0          # at rated RPM
COMPRESSION_RATIO = 9.0

# Thermal reference values at SL, ISA, 100% throttle
REF_EGT_CELSIUS = 720.0        # exhaust gas temp at full power
REF_CHT_CELSIUS = 200.0        # cylinder head temp at full power
REF_OIL_TEMP_CELSIUS = 95.0    # oil temperature at full power
REF_OIL_PRESSURE_BAR = 4.8    # oil pressure at cruise
REF_FUEL_FLOW_LPH = 25.0       # litres per hour at full power
REF_VIBRATION = 1.0            # vibration index at 1.0 = normal

# ISA atmosphere
ISA_SL_TEMP_K = 288.15
ISA_SL_PRESSURE_PA = 101325.0
LAPSE_RATE = 0.0065            # K/m

@dataclass
class DegradationState:
    """Engine degradation state — each 0.0 (healthy) to 1.0 (critical)"""
    injector: float = 0.0
    cooling: float = 0.0
    lubrication: float = 0.0
    mechanical: float = 0.0
    combustion: float = 0.0

    def to_dict(self) -> Dict[str, float]:
        return {
            "injector": self.injector,
            "cooling": self.cooling,
            "lubrication": self.lubrication,
            "mechanical": self.mechanical,
            "combustion": self.combustion,
        }

    @property
    def overall(self) -> float:
        """Weighted overall degradation 0–1"""
        return (
            0.30 * self.injector
            + 0.20 * self.cooling
            + 0.20 * self.lubrication
            + 0.20 * self.mechanical
            + 0.10 * self.combustion
        )


@dataclass
class EngineInputs:
    """Inputs to the engine model"""
    throttle: float = 0.65          # 0.0–1.0
    rpm_target: float = 4800.0      # target RPM
    altitude_ft: float = 10000.0   # altitude in feet
    ambient_temp_c: float = 15.0   # ambient temperature °C
    engine_load: float = 0.65       # 0.0–1.0 (normalized load)
    fuel_flow_lph: Optional[float] = None  # if None, model computes it
    degradation: DegradationState = field(default_factory=DegradationState)
    noise_factor: float = 1.0       # sensor noise multiplier


@dataclass
class EngineOutputs:
    """All engine model outputs"""
    # Performance
    rpm: float = 0.0
    torque_nm: float = 0.0
    power_kw: float = 0.0
    efficiency: float = 0.0         # thermal/volumetric combined 0–1

    # Thermodynamics
    egt_c: float = 0.0              # Exhaust Gas Temperature °C
    cht_c: float = 0.0              # Cylinder Head Temperature °C
    oil_temp_c: float = 0.0         # Oil Temperature °C
    oil_pressure_bar: float = 0.0  # Oil Pressure bar

    # Fuel & combustion
    fuel_flow_lph: float = 0.0      # Fuel Flow L/hr
    mixture_ratio: float = 0.0      # air-fuel ratio proxy

    # Mechanical
    vibration: float = 0.0         # vibration index (1.0 = nominal)

    # Derived
    thermal_margin: float = 0.0     # degrees below CHT limit (220°C)
    manifold_pressure_inhg: float = 0.0

    def to_dict(self) -> Dict[str, float]:
        return {
            "rpm": round(self.rpm, 1),
            "torque_nm": round(self.torque_nm, 2),
            "power_kw": round(self.power_kw, 2),
            "efficiency": round(self.efficiency, 4),
            "egt_c": round(self.egt_c, 1),
            "cht_c": round(self.cht_c, 1),
            "oil_temp_c": round(self.oil_temp_c, 1),
            "oil_pressure_bar": round(self.oil_pressure_bar, 3),
            "fuel_flow_lph": round(self.fuel_flow_lph, 2),
            "mixture_ratio": round(self.mixture_ratio, 3),
            "vibration": round(self.vibration, 4),
            "thermal_margin": round(self.thermal_margin, 1),
            "manifold_pressure_inhg": round(self.manifold_pressure_inhg, 2),
        }


def isa_atmosphere(altitude_ft: float) -> tuple[float, float]:
    """
    Compute ISA ambient temperature (K) and density ratio (sigma)
    for given altitude in feet.
    Returns: (temp_K, sigma) where sigma = rho/rho_0
    """
    altitude_m = altitude_ft * 0.3048
    if altitude_m <= 11000:  # troposphere
        temp_k = ISA_SL_TEMP_K - LAPSE_RATE * altitude_m
        pressure_ratio = (temp_k / ISA_SL_TEMP_K) ** 5.256
    else:  # lower stratosphere
        temp_k = 216.65
        pressure_ratio = 0.2234 * np.exp(-0.0001577 * (altitude_m - 11000))
    sigma = pressure_ratio * (ISA_SL_TEMP_K / temp_k)
    return temp_k, max(sigma, 0.01)


class AeroPistonEngineModel:
    """
    Reduced-Order Physics-Informed Aero-Piston Engine Model

    Implements physically-motivated relationships for:
    - Power & torque
    - EGT, CHT thermal model
    - Oil temperature & pressure
    - Fuel flow
    - Vibration
    - Degradation effects

    All parameters are SYNTHETIC. This is a research demonstrator.
    """

    CHT_LIMIT = 220.0       # °C operational limit
    EGT_LIMIT = 850.0       # °C operational limit
    OIL_TEMP_LIMIT = 130.0  # °C
    OIL_PRESSURE_MIN = 2.5  # bar (low pressure warning)

    def __init__(self, noise_factor: float = 1.0, seed: int = 42):
        self._rng = np.random.default_rng(seed)
        self.noise_factor = noise_factor

    def _noise(self, value: float, std_pct: float = 0.005) -> float:
        """Add Gaussian noise proportional to value"""
        sigma = abs(value) * std_pct * self.noise_factor
        return value + self._rng.normal(0, sigma)

    def compute(self, inputs: EngineInputs) -> EngineOutputs:
        """
        Compute engine outputs from inputs.
        Central physics pipeline.
        """
        out = EngineOutputs()
        deg = inputs.degradation

        # ── Atmosphere ──────────────────────────────────────────────────────
        _, sigma = isa_atmosphere(inputs.altitude_ft)
        # Account for user-specified ambient temp offset from ISA
        isa_temp_k, _ = isa_atmosphere(inputs.altitude_ft)
        actual_temp_k = inputs.ambient_temp_c + 273.15
        temp_ratio = actual_temp_k / isa_temp_k

        # ── RPM ─────────────────────────────────────────────────────────────
        # Mechanical degradation limits achievable RPM
        rpm_limit_factor = 1.0 - 0.15 * deg.mechanical
        # RPM follows throttle in simplified model
        rpm_range = MAX_RPM - IDLE_RPM
        target_rpm = IDLE_RPM + inputs.throttle * rpm_range
        out.rpm = min(target_rpm, inputs.rpm_target) * rpm_limit_factor
        out.rpm = max(IDLE_RPM, out.rpm)

        # ── Manifold Pressure ────────────────────────────────────────────────
        # MAP ~ sigma * 29.92 * throttle (simplified)
        out.manifold_pressure_inhg = sigma * 29.92 * (0.3 + 0.7 * inputs.throttle)

        # ── Power & Torque ───────────────────────────────────────────────────
        # Power scales with throttle, density ratio, and degrades with overall deg
        volumetric_efficiency = 0.85 * (1.0 - 0.30 * deg.mechanical)
        combustion_efficiency = 0.90 * (1.0 - 0.25 * deg.combustion)
        injector_efficiency = 1.0 - 0.35 * deg.injector

        out.efficiency = volumetric_efficiency * combustion_efficiency * injector_efficiency
        # Clamp efficiency
        out.efficiency = np.clip(out.efficiency, 0.1, 1.0)

        # BHP available at altitude
        power_fraction = (inputs.throttle * sigma * out.efficiency * (1.0 / max(temp_ratio, 0.5)))
        out.power_kw = MAX_POWER_KW * power_fraction
        out.power_kw = max(0.0, out.power_kw)

        # Torque: P = τ * ω
        omega = (out.rpm / 60.0) * 2 * np.pi
        if omega > 0:
            out.torque_nm = (out.power_kw * 1000.0) / omega
        out.torque_nm = np.clip(out.torque_nm, 0, MAX_TORQUE_NM * 1.1)

        # ── Fuel Flow ────────────────────────────────────────────────────────
        # FF = f(throttle, efficiency, injector degradation)
        base_ff = REF_FUEL_FLOW_LPH * inputs.throttle
        # Injector degradation: clogged injectors → lean mixture → less FF but bad combustion
        # OR rich injectors → excess FF
        injector_ff_effect = 1.0 + 0.20 * deg.injector * self._rng.choice([-1, 1], p=[0.5, 0.5]) if deg.injector > 0.1 else 1.0
        out.fuel_flow_lph = base_ff * injector_ff_effect / max(out.efficiency, 0.1) * (sigma ** 0.5)
        out.fuel_flow_lph = max(0.5, out.fuel_flow_lph)

        # Air-fuel ratio proxy
        air_mass_ratio = sigma * inputs.throttle
        out.mixture_ratio = air_mass_ratio / (out.fuel_flow_lph / REF_FUEL_FLOW_LPH + 1e-6)
        out.mixture_ratio = np.clip(out.mixture_ratio, 0.5, 2.5)

        # ── EGT ─────────────────────────────────────────────────────────────
        # EGT = f(throttle, RPM, fuel_air_ratio, altitude, temp, degradation)
        # Higher throttle → hotter exhaust
        # Leaner mixture → hotter EGT (simplified: FF deviation from optimal)
        egt_base = REF_EGT_CELSIUS * inputs.throttle * (1.0 + 0.15 * (1 - sigma))
        # Injector degradation → EGT deviation
        egt_injector_delta = 80.0 * deg.injector
        # Combustion instability → EGT spike + random fluctuation
        egt_combustion_delta = 60.0 * deg.combustion
        combustion_noise = self._rng.normal(0, 15.0 * deg.combustion)
        # Temperature effect
        egt_temp_delta = 20.0 * (inputs.ambient_temp_c - 15.0) / 15.0

        out.egt_c = egt_base + egt_injector_delta + egt_combustion_delta + combustion_noise + egt_temp_delta
        out.egt_c = max(200.0, out.egt_c)

        # ── CHT ─────────────────────────────────────────────────────────────
        # CHT = f(EGT, RPM, load, ambient_temp, cooling_condition)
        cooling_factor = 1.0 - 0.40 * deg.cooling   # cooling deg → less heat rejection
        cht_base = (out.egt_c * 0.26) + 20.0 + (inputs.engine_load * 30.0)
        cht_ambient_correction = 0.5 * (inputs.ambient_temp_c - 15.0)
        cht_cooling_correction = (1.0 / max(cooling_factor, 0.2) - 1.0) * 35.0

        out.cht_c = cht_base + cht_ambient_correction + cht_cooling_correction
        out.cht_c = max(ambient_c := inputs.ambient_temp_c + 20, out.cht_c)

        out.thermal_margin = self.CHT_LIMIT - out.cht_c

        # ── Oil Temperature ──────────────────────────────────────────────────
        # Oil temp rises with load, ambient temp, poor lubrication
        oil_load_rise = 45.0 * inputs.engine_load
        oil_ambient = 0.6 * inputs.ambient_temp_c
        oil_lub_penalty = 20.0 * deg.lubrication
        out.oil_temp_c = 50.0 + oil_load_rise + oil_ambient + oil_lub_penalty
        out.oil_temp_c = np.clip(out.oil_temp_c, inputs.ambient_temp_c + 5, 155.0)

        # ── Oil Pressure ─────────────────────────────────────────────────────
        # Oil pressure ~ RPM, viscosity (degrades with temp), lubrication condition
        rpm_factor = (out.rpm - IDLE_RPM) / (MAX_RPM - IDLE_RPM)
        viscosity_factor = max(0.2, 1.0 - 0.008 * max(0, out.oil_temp_c - 60.0))
        lubrication_penalty = 1.0 - 0.50 * deg.lubrication
        out.oil_pressure_bar = REF_OIL_PRESSURE_BAR * rpm_factor * viscosity_factor * lubrication_penalty
        out.oil_pressure_bar = max(0.5, out.oil_pressure_bar)

        # ── Vibration ────────────────────────────────────────────────────────
        # Vibration = f(RPM, load, mechanical condition, combustion, imbalance)
        mech_vib = 2.5 * deg.mechanical
        combustion_vib = 1.5 * deg.combustion
        rpm_resonance = 0.3 * np.sin(out.rpm / 500.0)   # simplified resonance
        base_vib = REF_VIBRATION + mech_vib + combustion_vib + rpm_resonance
        out.vibration = max(0.1, base_vib)

        # ── Add Sensor Noise ─────────────────────────────────────────────────
        out.rpm = self._noise(out.rpm, 0.003)
        out.egt_c = self._noise(out.egt_c, 0.008)
        out.cht_c = self._noise(out.cht_c, 0.007)
        out.oil_temp_c = self._noise(out.oil_temp_c, 0.005)
        out.oil_pressure_bar = self._noise(out.oil_pressure_bar, 0.010)
        out.fuel_flow_lph = self._noise(out.fuel_flow_lph, 0.008)
        out.vibration = self._noise(out.vibration, 0.020)
        out.power_kw = self._noise(out.power_kw, 0.005)

        # Final clamps
        out.rpm = max(0.0, out.rpm)
        out.egt_c = max(0.0, out.egt_c)
        out.cht_c = max(0.0, out.cht_c)
        out.oil_pressure_bar = max(0.0, out.oil_pressure_bar)
        out.fuel_flow_lph = max(0.0, out.fuel_flow_lph)
        out.vibration = max(0.0, out.vibration)

        return out
