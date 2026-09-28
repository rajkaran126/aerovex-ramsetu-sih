"""
AERO-TWIN — Terrain Elevation & Emergency Diversion Airfield Database

Maintains tactical emergency landing sites across Northern & Western operational sectors.
Computes:
- Great-circle haversine distances and bearings
- Aircraft glide cone reachability using Rotax 914/915 aerodynamic L/D (~14:1)
- Terrain clearance margins
"""

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
import logging

logger = logging.getLogger(__name__)

# Canonical emergency recovery airfields
EMERGENCY_AIRFIELDS = [
    {
        "code": "IXL",
        "name": "Kushok Bakula Rimpochee Airfield, Leh",
        "lat": 34.1359,
        "lon": 77.5465,
        "elevation_ft": 10682,
        "runway_m": 2750,
        "type": "MIL_CIVIL",
    },
    {
        "code": "AWI",
        "name": "AFI Awantipur Air Base",
        "lat": 33.8767,
        "lon": 74.9733,
        "elevation_ft": 5300,
        "runway_m": 2744,
        "type": "MIL_FIGHTER",
    },
    {
        "code": "HAL",
        "name": "AF Station Halwara",
        "lat": 30.7492,
        "lon": 75.6339,
        "elevation_ft": 790,
        "runway_m": 2865,
        "type": "MIL_FIGHTER",
    },
    {
        "code": "SUT",
        "name": "AF Station Suratgarh",
        "lat": 29.3886,
        "lon": 73.9039,
        "elevation_ft": 560,
        "runway_m": 2743,
        "type": "MIL_TACTICAL",
    },
    {
        "code": "JDH",
        "name": "AF Station Jodhpur",
        "lat": 26.2511,
        "lon": 73.0489,
        "elevation_ft": 719,
        "runway_m": 2743,
        "type": "MIL_COMMAND",
    },
    {
        "code": "BTI",
        "name": "AF Station Bhatinda (Bhisiāna)",
        "lat": 30.2694,
        "lon": 74.7572,
        "elevation_ft": 700,
        "runway_m": 2800,
        "type": "MIL_FIGHTER",
    },
    {
        "code": "AMB",
        "name": "AF Station Ambala",
        "lat": 30.3686,
        "lon": 76.8172,
        "elevation_ft": 900,
        "runway_m": 2743,
        "type": "MIL_TACTICAL",
    },
    {
        "code": "NAL",
        "name": "AF Station Nal (Bikaner)",
        "lat": 28.0708,
        "lon": 73.2064,
        "elevation_ft": 750,
        "runway_m": 2743,
        "type": "MIL_FIGHTER",
    },
]


@dataclass
class AirfieldReachability:
    code: str
    name: str
    lat: float
    lon: float
    elevation_ft: float
    distance_km: float
    bearing_deg: float
    is_reachable: bool
    glide_margin_m: float
    time_to_reach_min: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "code": self.code,
            "name": self.name,
            "lat": round(self.lat, 5),
            "lon": round(self.lon, 5),
            "elevation_ft": self.elevation_ft,
            "distance_km": round(self.distance_km, 1),
            "bearing_deg": round(self.bearing_deg, 1),
            "is_reachable": self.is_reachable,
            "glide_margin_m": round(self.glide_margin_m, 1),
            "time_to_reach_min": round(self.time_to_reach_min, 1),
        }


class TerrainDiversionManager:
    """
    Manages airfields and terrain reachability calculations.
    """

    GLIDE_RATIO: float = 14.0  # MALE UAV clean aerodynamic L/D

    @staticmethod
    def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Great-circle distance in kilometers"""
        R = 6371.0
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = (
            math.sin(d_lat / 2.0) ** 2
            + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2.0) ** 2
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return R * c

    @staticmethod
    def calculate_bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """True heading bearing from point 1 to point 2"""
        y = math.sin(math.radians(lon2 - lon1)) * math.cos(math.radians(lat2))
        x = (
            math.cos(math.radians(lat1)) * math.sin(math.radians(lat2))
            - math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(math.radians(lon2 - lon1))
        )
        b = math.degrees(math.atan2(y, x))
        return (b + 360.0) % 360.0

    def evaluate_reachability(
        self,
        uav_lat: float,
        uav_lon: float,
        altitude_ft: float,
        ground_speed_kts: float = 90.0,
    ) -> List[AirfieldReachability]:
        """
        Evaluate reachability to all diversion airfields.
        """
        results: List[AirfieldReachability] = []
        uav_alt_m = altitude_ft * 0.3048
        speed_kmh = max(ground_speed_kts * 1.852, 50.0)

        for af in EMERGENCY_AIRFIELDS:
            dist_km = self.haversine_distance_km(uav_lat, uav_lon, af["lat"], af["lon"])
            bearing = self.calculate_bearing_deg(uav_lat, uav_lon, af["lat"], af["lon"])

            af_elev_m = af["elevation_ft"] * 0.3048
            agl_m = max(0.0, uav_alt_m - af_elev_m)

            # Max reachable glide distance in km
            max_glide_dist_km = (agl_m * self.GLIDE_RATIO) / 1000.0
            is_reachable = dist_km <= max_glide_dist_km

            # Margin in meters of altitude above runway threshold upon arrival
            required_alt_loss_m = (dist_km * 1000.0) / self.GLIDE_RATIO
            glide_margin_m = agl_m - required_alt_loss_m

            time_min = (dist_km / speed_kmh) * 60.0

            results.append(
                AirfieldReachability(
                    code=af["code"],
                    name=af["name"],
                    lat=af["lat"],
                    lon=af["lon"],
                    elevation_ft=af["elevation_ft"],
                    distance_km=dist_km,
                    bearing_deg=bearing,
                    is_reachable=is_reachable,
                    glide_margin_m=glide_margin_m,
                    time_to_reach_min=time_min,
                )
            )

        # Sort by distance
        results.sort(key=lambda x: x.distance_km)
        return results
