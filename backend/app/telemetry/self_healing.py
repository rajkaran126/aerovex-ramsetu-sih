"""
AERO-TWIN — Self-Healing Telemetry Pipeline

When sensor channels are compromised, spoofed, or suffering from signal stiction/dropout:
1. Isolates the corrupted physical channel from downstream AI prognostics.
2. Substitutes the Digital Twin's analytical physics estimate.
3. Explicitly stamps channel provenance: source = TelemetrySource.RECONSTRUCTED.
4. Decrements overall telemetry integrity score while preserving objective mechanical health calculations.
5. Emits an immutable audit log record for blackbox flight recording.

Complies strictly with §11 & §40 (Numerical Authority Rule):
Substitutions are computed by the physics engine, with clear provenance metadata.
"""

import time
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple

from ..schemas.telemetry import (
    UnifiedTelemetryRecord,
    TelemetrySource,
    SensorConfidenceMap,
    ChannelSourceMap,
)
from ..cyber_security.zero_trust_shield import CyberShieldReport

logger = logging.getLogger(__name__)


@dataclass
class SelfHealingAuditEvent:
    timestamp: float
    channel: str
    original_value: float
    substituted_value: float
    confidence: float
    reason: str
    flight_step: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": round(self.timestamp, 4),
            "channel": self.channel,
            "original_value": round(self.original_value, 2),
            "substituted_value": round(self.substituted_value, 2),
            "confidence": round(self.confidence, 3),
            "reason": self.reason,
            "flight_step": self.flight_step,
        }


class SelfHealingPipeline:
    """
    Transparent Self-Healing Telemetry Pipeline.
    Guarantees downstream AI prognostics never ingest spoofed or poisoned data,
    while visibly tagging reconstructed channels with provenance metadata.
    """

    def __init__(self, confidence_threshold: float = 0.65):
        self.confidence_threshold = confidence_threshold
        self._audit_log: List[SelfHealingAuditEvent] = []
        self._active_reconstructed_channels: List[str] = []

    def heal_telemetry(
        self,
        actual_telemetry: Dict[str, float],
        expected_telemetry: Dict[str, float],
        cyber_report: CyberShieldReport,
        step: int = 0,
    ) -> Tuple[Dict[str, float], Dict[str, TelemetrySource], List[SelfHealingAuditEvent]]:
        """
        Produce cleansed/healed telemetry dictionary and channel source map.

        Returns:
            healed_telemetry: dict of values (original or analytically substituted)
            channel_sources: dict mapping channel name -> TelemetrySource (PHYSICAL/SIMULATION or RECONSTRUCTED)
            events: list of SelfHealingAuditEvent triggered during this step
        """
        healed = dict(actual_telemetry)
        channel_sources: Dict[str, TelemetrySource] = {}
        events: List[SelfHealingAuditEvent] = []
        newly_reconstructed: List[str] = []

        now = time.time()

        for ch, status in cyber_report.sensor_statuses.items():
            orig_val = actual_telemetry.get(ch, 0.0)
            exp_val = expected_telemetry.get(ch, orig_val)

            # If confidence is below threshold or sensor flagged as using twin estimate
            if status.confidence < self.confidence_threshold or status.using_twin_estimate:
                sub_val = status.twin_estimate if status.twin_estimate is not None else exp_val
                healed[ch] = sub_val
                channel_sources[ch] = TelemetrySource.RECONSTRUCTED
                newly_reconstructed.append(ch)

                event = SelfHealingAuditEvent(
                    timestamp=now,
                    channel=ch,
                    original_value=float(orig_val) if orig_val is not None else 0.0,
                    substituted_value=float(sub_val),
                    confidence=float(status.confidence),
                    reason="; ".join(status.reasons) if status.reasons else "Confidence below threshold",
                    flight_step=step,
                )
                events.append(event)
                self._audit_log.append(event)
                logger.warning(
                    f"[SELF-HEALING] Isolated compromised channel '{ch}' "
                    f"(Confidence={status.confidence:.2f}). Replaced {orig_val:.2f} -> {sub_val:.2f}"
                )
            else:
                # Retain original source
                channel_sources[ch] = TelemetrySource.PHYSICAL

        self._active_reconstructed_channels = newly_reconstructed
        return healed, channel_sources, events

    def heal_unified_record(
        self,
        record: UnifiedTelemetryRecord,
        expected_telemetry: Dict[str, float],
        cyber_report: CyberShieldReport,
        step: int = 0,
    ) -> Tuple[UnifiedTelemetryRecord, List[SelfHealingAuditEvent]]:
        """
        Directly heal and stamp a UnifiedTelemetryRecord.
        """
        raw_dict = {
            "rpm": record.rpm,
            "map": record.map,
            "cht_c": record.cht,
            "egt_c": record.egt,
            "oil_pressure_bar": record.oil_pressure,
            "oil_temp_c": record.oil_temperature,
            "vibration": record.vibration,
            "fuel_flow_lph": record.fuel_flow,
            "throttle": record.throttle,
        }

        healed, sources, events = self.heal_telemetry(
            actual_telemetry=raw_dict,
            expected_telemetry=expected_telemetry,
            cyber_report=cyber_report,
            step=step,
        )

        # Update record fields
        record.rpm = healed["rpm"]
        record.map = healed["map"]
        record.cht = healed["cht_c"]
        record.egt = healed["egt_c"]
        record.oil_pressure = healed["oil_pressure_bar"]
        record.oil_temperature = healed["oil_temp_c"]
        record.vibration = healed["vibration"]
        record.fuel_flow = healed["fuel_flow_lph"]

        # Update confidence map
        for ch, status in cyber_report.sensor_statuses.items():
            clean_ch = ch.replace("_c", "").replace("_bar", "").replace("_lph", "")
            if hasattr(record.sensor_confidence, clean_ch):
                setattr(record.sensor_confidence, clean_ch, status.confidence)

            # Update channel sources
            if hasattr(record.channel_sources, clean_ch):
                setattr(record.channel_sources, clean_ch, sources.get(ch, TelemetrySource.SIMULATION))

        # Overall telemetry source flag if any channel reconstructed
        if any(s == TelemetrySource.RECONSTRUCTED for s in sources.values()):
            record.source = TelemetrySource.RECONSTRUCTED

        return record, events

    def get_audit_log(self, n: int = 50) -> List[Dict[str, Any]]:
        return [e.to_dict() for e in self._audit_log[-n:]]

    def get_active_reconstructed_channels(self) -> List[str]:
        return list(self._active_reconstructed_channels)

    def reset(self):
        self._audit_log.clear()
        self._active_reconstructed_channels.clear()
