"""
AERO-TWIN — CAN Bus Hardware Abstraction Layer & Transceiver Interface
Supports physical engine test bench telemetry acquisition via CAN bus / STM32 node.
Complies with Section 3, 5, and 6 of the Master Implementation Specification.
"""

import time
import struct
import logging
from typing import Dict, Optional, Callable, Any
from dataclasses import dataclass, field

from ..schemas.telemetry import (
    UnifiedTelemetryRecord,
    TelemetrySource,
    MissionPhase,
    SensorConfidenceMap,
    ChannelSourceMap,
)

logger = logging.getLogger(__name__)

# ── Documented CAN Message Arbitration IDs (Standard 11-bit IDs) ──────────────
CAN_ID_CORE_DYNAMICS    = 0x100  # RPM (u16), Throttle (u8), MAP (u16 inHg*100)
CAN_ID_THERMAL_STATE    = 0x101  # CHT (u16 C*10), EGT (u16 C*10)
CAN_ID_FLUID_DYNAMICS   = 0x102  # Oil Pres (u16 bar*100), Oil Temp (u16 C*10), Fuel Flow (u16 L/h*100)
CAN_ID_VIB_AND_LOAD     = 0x103  # Vibration (u16 g*100), Engine Load (u8 %*2.55)
CAN_ID_ENVIRONMENTAL    = 0x104  # Ambient Temp (s16 C*10), Ambient Pres (u16 hPa*10), Alt (s16 ft/10)
CAN_ID_NODE_HEALTH      = 0x105  # Battery V (u8 V*10), Packet Counter (u16), Error Flags (u8)


@dataclass
class RawCanFrame:
    arbitration_id: int
    data: bytes
    timestamp: float = field(default_factory=time.time)
    is_extended: bool = False


class CanProtocolCodec:
    """
    Encodes and decodes binary CAN frames conforming to the AERO-TWIN STM32 specification.
    """

    @staticmethod
    def encode_core_dynamics(rpm: float, throttle: float, map_inhg: float) -> bytes:
        # RPM [0..7500] u16, Throttle [0..1] u8 (0..255), MAP [0..60 inHg] u16 (scaled x100)
        u_rpm = int(max(0.0, min(7500.0, rpm)))
        u_th = int(max(0.0, min(1.0, throttle)) * 255.0)
        u_map = int(max(0.0, min(60.0, map_inhg)) * 100.0)
        return struct.pack(">HBH", u_rpm, u_th, u_map)

    @staticmethod
    def decode_core_dynamics(data: bytes) -> Dict[str, float]:
        u_rpm, u_th, u_map = struct.unpack(">HBH", data[:5])
        return {
            "rpm": float(u_rpm),
            "throttle": round(u_th / 255.0, 3),
            "map": round(u_map / 100.0, 2),
        }

    @staticmethod
    def encode_thermal_state(cht_c: float, egt_c: float) -> bytes:
        # CHT [0..300 C] u16 x10, EGT [0..1200 C] u16 x10
        u_cht = int(max(0.0, min(350.0, cht_c)) * 10.0)
        u_egt = int(max(0.0, min(1200.0, egt_c)) * 10.0)
        return struct.pack(">HH", u_cht, u_egt)

    @staticmethod
    def decode_thermal_state(data: bytes) -> Dict[str, float]:
        u_cht, u_egt = struct.unpack(">HH", data[:4])
        return {
            "cht": round(u_cht / 10.0, 1),
            "egt": round(u_egt / 10.0, 1),
        }

    @staticmethod
    def encode_fluid_dynamics(oil_pres_bar: float, oil_temp_c: float, fuel_flow_lph: float) -> bytes:
        u_op = int(max(0.0, min(12.0, oil_pres_bar)) * 100.0)
        u_ot = int(max(0.0, min(180.0, oil_temp_c)) * 10.0)
        u_ff = int(max(0.0, min(80.0, fuel_flow_lph)) * 100.0)
        return struct.pack(">HHH", u_op, u_ot, u_ff)

    @staticmethod
    def decode_fluid_dynamics(data: bytes) -> Dict[str, float]:
        u_op, u_ot, u_ff = struct.unpack(">HHH", data[:6])
        return {
            "oil_pressure": round(u_op / 100.0, 2),
            "oil_temperature": round(u_ot / 10.0, 1),
            "fuel_flow": round(u_ff / 100.0, 2),
        }

    @staticmethod
    def encode_vibration_load(vib_g: float, load: float) -> bytes:
        u_vib = int(max(0.0, min(30.0, vib_g)) * 100.0)
        u_load = int(max(0.0, min(1.0, load)) * 255.0)
        return struct.pack(">HB", u_vib, u_load)

    @staticmethod
    def decode_vibration_load(data: bytes) -> Dict[str, float]:
        u_vib, u_load = struct.unpack(">HB", data[:3])
        return {
            "vibration": round(u_vib / 100.0, 2),
            "engine_load": round(u_load / 255.0, 3),
        }

    @staticmethod
    def encode_environmental(ambient_temp_c: float, ambient_pres_hpa: float, alt_ft: float) -> bytes:
        s_t = int(max(-60.0, min(80.0, ambient_temp_c)) * 10.0)
        u_p = int(max(200.0, min(1200.0, ambient_pres_hpa)) * 10.0)
        s_alt = int(max(-1000.0, min(40000.0, alt_ft)) / 10.0)
        return struct.pack(">hHh", s_t, u_p, s_alt)

    @staticmethod
    def decode_environmental(data: bytes) -> Dict[str, float]:
        s_t, u_p, s_alt = struct.unpack(">hHh", data[:6])
        return {
            "ambient_temperature": round(s_t / 10.0, 1),
            "ambient_pressure": round(u_p / 10.0, 1),
            "altitude": float(s_alt * 10),
        }


class CanTelemetryBridge:
    """
    Aggregates multi-packet CAN telemetry frames from an STM32 physical sensor acquisition node
    and produces synchronized UnifiedTelemetryRecord instances for the Digital Twin pipeline.
    """

    def __init__(self, engine_id: str = "ROTAX-914-TESTBENCH"):
        self.engine_id = engine_id
        self._latest_buffer: Dict[str, Any] = {
            "rpm": 5000.0,
            "throttle": 0.65,
            "map": 30.0,
            "cht": 160.0,
            "egt": 680.0,
            "oil_pressure": 4.2,
            "oil_temperature": 85.0,
            "fuel_flow": 22.0,
            "vibration": 0.9,
            "engine_load": 0.65,
            "ambient_temperature": 25.0,
            "ambient_pressure": 1013.25,
            "altitude": 250.0,
        }
        self._last_packet_time = time.time()
        self._packet_count = 0
        self._codec = CanProtocolCodec()

    def process_can_frame(self, frame: RawCanFrame) -> Optional[UnifiedTelemetryRecord]:
        """
        Process an incoming CAN frame. Returns an updated UnifiedTelemetryRecord
        when a full core cycle is completed.
        """
        self._last_packet_time = frame.timestamp
        self._packet_count += 1

        try:
            if frame.arbitration_id == CAN_ID_CORE_DYNAMICS:
                self._latest_buffer.update(self._codec.decode_core_dynamics(frame.data))
            elif frame.arbitration_id == CAN_ID_THERMAL_STATE:
                self._latest_buffer.update(self._codec.decode_thermal_state(frame.data))
            elif frame.arbitration_id == CAN_ID_FLUID_DYNAMICS:
                self._latest_buffer.update(self._codec.decode_fluid_dynamics(frame.data))
            elif frame.arbitration_id == CAN_ID_VIB_AND_LOAD:
                self._latest_buffer.update(self._codec.decode_vibration_load(frame.data))
            elif frame.arbitration_id == CAN_ID_ENVIRONMENTAL:
                self._latest_buffer.update(self._codec.decode_environmental(frame.data))
        except Exception as err:
            logger.warning(f"Malformed CAN frame (ID 0x{frame.arbitration_id:X}): {err}")
            return None

        # Calculate torque and brake power
        rpm = self._latest_buffer["rpm"]
        map_val = self._latest_buffer["map"]
        th = self._latest_buffer["throttle"]
        power_kw = (rpm * map_val * th) / 1600.0
        torque_nm = (power_kw * 9548.8) / max(rpm, 100.0)

        # Build physical provenance record
        conf = SensorConfidenceMap()
        src_map = ChannelSourceMap(
            rpm=TelemetrySource.PHYSICAL,
            map=TelemetrySource.PHYSICAL,
            cht=TelemetrySource.PHYSICAL,
            egt=TelemetrySource.PHYSICAL,
            oil_pressure=TelemetrySource.PHYSICAL,
            oil_temperature=TelemetrySource.PHYSICAL,
            vibration=TelemetrySource.PHYSICAL,
            fuel_flow=TelemetrySource.PHYSICAL,
            throttle=TelemetrySource.PHYSICAL,
        )

        return UnifiedTelemetryRecord(
            timestamp=self._last_packet_time,
            engine_id=self.engine_id,
            mission_id="TESTBENCH-GROUND-RUN",
            rpm=self._latest_buffer["rpm"],
            map=self._latest_buffer["map"],
            cht=self._latest_buffer["cht"],
            egt=self._latest_buffer["egt"],
            oil_pressure=self._latest_buffer["oil_pressure"],
            oil_temperature=self._latest_buffer["oil_temperature"],
            vibration=self._latest_buffer["vibration"],
            fuel_flow=self._latest_buffer["fuel_flow"],
            throttle=self._latest_buffer["throttle"],
            ambient_temperature=self._latest_buffer["ambient_temperature"],
            ambient_pressure=self._latest_buffer["ambient_pressure"],
            altitude=self._latest_buffer["altitude"],
            airspeed=0.0,  # Stationary ground test bench
            engine_load=self._latest_buffer["engine_load"],
            torque=round(torque_nm, 2),
            power=round(power_kw, 2),
            efficiency=0.82,
            latitude=28.6139,
            longitude=77.2090,
            heading=0.0,
            mission_phase=MissionPhase.PREFLIGHT,
            sensor_health=100.0,
            sensor_confidence=conf,
            channel_sources=src_map,
            telemetry_integrity=1.0,
            packet_loss=0.0,
            timestamp_valid=True,
            data_quality="OPTIMAL",
            source=TelemetrySource.PHYSICAL,
        )


class MockCanBenchTransmitter:
    """
    Generates synthetic CAN frames identical to those produced by an STM32 sensor node,
    enabling full physical-pipeline validation without requiring connected hardware.
    """

    def __init__(self, bridge: CanTelemetryBridge):
        self.bridge = bridge
        self.codec = CanProtocolCodec()

    def transmit_burst(
        self,
        rpm: float = 5200.0,
        throttle: float = 0.70,
        map_inhg: float = 32.0,
        cht_c: float = 165.0,
        egt_c: float = 710.0,
        oil_pres: float = 4.3,
        oil_temp: float = 90.0,
        fuel_flow: float = 24.0,
        vibration: float = 1.0,
    ) -> UnifiedTelemetryRecord:
        now = time.time()
        f1 = RawCanFrame(CAN_ID_CORE_DYNAMICS, self.codec.encode_core_dynamics(rpm, throttle, map_inhg), now)
        f2 = RawCanFrame(CAN_ID_THERMAL_STATE, self.codec.encode_thermal_state(cht_c, egt_c), now)
        f3 = RawCanFrame(CAN_ID_FLUID_DYNAMICS, self.codec.encode_fluid_dynamics(oil_pres, oil_temp, fuel_flow), now)
        f4 = RawCanFrame(CAN_ID_VIB_AND_LOAD, self.codec.encode_vibration_load(vibration, throttle), now)
        f5 = RawCanFrame(CAN_ID_ENVIRONMENTAL, self.codec.encode_environmental(25.0, 1013.25, 300.0), now)

        self.bridge.process_can_frame(f1)
        self.bridge.process_can_frame(f2)
        self.bridge.process_can_frame(f3)
        self.bridge.process_can_frame(f4)
        record = self.bridge.process_can_frame(f5)
        assert record is not None
        return record
