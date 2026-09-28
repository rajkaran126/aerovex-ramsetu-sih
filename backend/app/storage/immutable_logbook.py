"""
AERO-TWIN — Cryptographically Immutable Digital Engine Logbook

Implements an immutable SHA-256 hash chain for flight sorties, cyber anomalies,
sensor self-healing events, and prescriptive maintenance taskcard sign-offs.
Provides tamper-evident mathematical verification for airworthiness certification
(CEMILAC / DGCA compliance).
"""

import time
import json
import hashlib
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
import logging

logger = logging.getLogger(__name__)


@dataclass
class LogbookBlock:
    index: int
    timestamp: float
    event_type: str                 # "SORTIE_START", "FAULT_ALERT", "CYBER_INTERVENTION", "MAINTENANCE_SIGNOFF", "SORTIE_END"
    payload: Dict[str, Any]
    prev_hash: str
    hash: str = ""

    def calculate_hash(self) -> str:
        data_str = json.dumps({
            "index": self.index,
            "timestamp": self.timestamp,
            "event_type": self.event_type,
            "payload": self.payload,
            "prev_hash": self.prev_hash,
        }, sort_keys=True)
        return hashlib.sha256(data_str.encode("utf-8")).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "timestamp": round(self.timestamp, 4),
            "event_type": self.event_type,
            "payload": self.payload,
            "prev_hash": self.prev_hash,
            "hash": self.hash,
        }


class ImmutableDigitalLogbook:
    """
    Append-only cryptographically chained digital twin blackbox logbook.
    """

    GENESIS_HASH = "0" * 64

    def __init__(self, engine_id: str = "ROTAX-914-DEMO"):
        self.engine_id = engine_id
        self.chain: List[LogbookBlock] = []
        self._init_genesis_block()

    def _init_genesis_block(self):
        """Create genesis block anchoring the digital twin ledger"""
        genesis = LogbookBlock(
            index=0,
            timestamp=time.time(),
            event_type="GENESIS",
            payload={"engine_id": self.engine_id, "note": "AERO-TWIN Digital Ledger Initialized"},
            prev_hash=self.GENESIS_HASH,
        )
        genesis.hash = genesis.calculate_hash()
        self.chain.append(genesis)

    def append_event(self, event_type: str, payload: Dict[str, Any], timestamp: Optional[float] = None) -> LogbookBlock:
        """
        Append a new tamper-evident event block to the hash chain.
        """
        ts = timestamp if timestamp is not None else time.time()
        prev = self.chain[-1]
        block = LogbookBlock(
            index=len(self.chain),
            timestamp=ts,
            event_type=event_type,
            payload=payload,
            prev_hash=prev.hash,
        )
        block.hash = block.calculate_hash()
        self.chain.append(block)
        return block

    def verify_integrity(self) -> Tuple[bool, Optional[str]]:
        """
        Validate the complete cryptographic chain.
        Returns (is_valid, error_description).
        """
        if not self.chain:
            return False, "Empty chain"

        # Check genesis
        if self.chain[0].prev_hash != self.GENESIS_HASH:
            return False, "Genesis block corrupted: invalid prev_hash"
        if self.chain[0].hash != self.chain[0].calculate_hash():
            return False, "Genesis block hash mismatch"

        # Check successive links
        for i in range(1, len(self.chain)):
            curr = self.chain[i]
            prev = self.chain[i - 1]

            if curr.prev_hash != prev.hash:
                return False, f"Broken link at block #{curr.index}: prev_hash does not match #{prev.index} hash"

            if curr.hash != curr.calculate_hash():
                return False, f"Tampered payload at block #{curr.index}: recalculation mismatch"

        return True, None

    def get_recent_blocks(self, n: int = 20) -> List[Dict[str, Any]]:
        return [b.to_dict() for b in self.chain[-n:]]

    def to_dict(self) -> Dict[str, Any]:
        is_valid, err = self.verify_integrity()
        return {
            "engine_id": self.engine_id,
            "total_blocks": len(self.chain),
            "integrity_valid": is_valid,
            "integrity_error": err,
            "latest_hash": self.chain[-1].hash if self.chain else "",
            "recent_blocks": self.get_recent_blocks(10),
        }

    def reset(self):
        self.chain.clear()
        self._init_genesis_block()

