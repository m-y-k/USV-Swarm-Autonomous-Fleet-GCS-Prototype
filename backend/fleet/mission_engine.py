"""
Mission Engine — Swarm pattern generation and mission coordination.
Spec §4.7: Line formation, area survey grid, perimeter patrol, follow-the-leader.
"""
import math
from typing import Dict, List, Tuple, Optional


def haversine_offset(lat: float, lon: float, d_north: float, d_east: float) -> Tuple[float, float]:
    """
    Calculate a new GPS coordinate given a starting point and offset in meters.
    d_north: meters north (positive) or south (negative)
    d_east: meters east (positive) or west (negative)
    Returns: (new_lat, new_lon)
    """
    R = 6371000  # Earth radius in meters
    new_lat = lat + (d_north / R) * (180 / math.pi)
    new_lon = lon + (d_east / (R * math.cos(math.radians(lat)))) * (180 / math.pi)
    return new_lat, new_lon


class MissionEngine:
    """Generates waypoint missions for fleet coordination."""

    @staticmethod
    def generate_line_formation(
        start_lat: float, start_lon: float,
        end_lat: float, end_lon: float,
        num_vessels: int,
        spacing_meters: float = 50,
    ) -> Dict[int, List[dict]]:
        """
        Line formation: all boats sail in parallel lines.

        Args:
            start_lat/lon: Start point of the formation
            end_lat/lon: End point of the formation
            num_vessels: Number of vessels
            spacing_meters: Distance between parallel tracks

        Returns:
            Dict of vessel_id -> list of waypoints
        """
        # Direction vector
        d_lat = end_lat - start_lat
        d_lon = end_lon - start_lon
        length = math.sqrt(d_lat ** 2 + d_lon ** 2)
        if length == 0:
            return {}

        # Perpendicular offset direction
        perp_lat = -d_lon / length
        perp_lon = d_lat / length

        # Convert spacing from meters to degrees (approximate)
        spacing_deg = spacing_meters / 111320

        missions = {}
        for v in range(num_vessels):
            offset = (v - (num_vessels - 1) / 2) * spacing_deg
            missions[v] = [
                {
                    "lat": start_lat + perp_lat * offset,
                    "lon": start_lon + perp_lon * offset,
                    "alt": 0,
                },
                {
                    "lat": end_lat + perp_lat * offset,
                    "lon": end_lon + perp_lon * offset,
                    "alt": 0,
                },
            ]
        return missions

    @staticmethod
    def generate_grid_survey(
        corner1_lat: float, corner1_lon: float,
        corner2_lat: float, corner2_lon: float,
        num_vessels: int,
        rows_per_strip: int = 4,
    ) -> Dict[int, List[dict]]:
        """
        Area survey: divide rectangular area into strips, each vessel covers one strip
        in a lawn-mower pattern.
        """
        min_lat = min(corner1_lat, corner2_lat)
        max_lat = max(corner1_lat, corner2_lat)
        min_lon = min(corner1_lon, corner2_lon)
        max_lon = max(corner1_lon, corner2_lon)

        strip_width = (max_lon - min_lon) / max(num_vessels, 1)
        missions = {}

        for v in range(num_vessels):
            strip_left = min_lon + v * strip_width
            strip_right = strip_left + strip_width
            wps = []

            for r in range(rows_per_strip):
                lat = min_lat + (max_lat - min_lat) * (r / max(rows_per_strip - 1, 1))
                if r % 2 == 0:
                    wps.append({"lat": lat, "lon": strip_left, "alt": 0})
                    wps.append({"lat": lat, "lon": strip_right, "alt": 0})
                else:
                    wps.append({"lat": lat, "lon": strip_right, "alt": 0})
                    wps.append({"lat": lat, "lon": strip_left, "alt": 0})

            missions[v] = wps
        return missions

    @staticmethod
    def generate_perimeter_patrol(
        center_lat: float, center_lon: float,
        radius_meters: float,
        num_vessels: int,
        waypoints_per_sector: int = 6,
    ) -> Dict[int, List[dict]]:
        """
        Perimeter patrol: distribute vessels evenly around a perimeter.
        Each vessel patrols back and forth within its sector.
        """
        radius_deg = radius_meters / 111320
        sector_size = (2 * math.pi) / max(num_vessels, 1)

        missions = {}
        for v in range(num_vessels):
            start_angle = v * sector_size
            end_angle = (v + 1) * sector_size
            wps = []

            # Forward arc
            for s in range(waypoints_per_sector + 1):
                angle = start_angle + (end_angle - start_angle) * (s / waypoints_per_sector)
                lat = center_lat + radius_deg * math.cos(angle)
                lon = center_lon + radius_deg * math.sin(angle) / math.cos(math.radians(center_lat))
                wps.append({"lat": lat, "lon": lon, "alt": 0})

            # Return arc (inner radius)
            inner_radius = radius_deg * 0.8
            for s in range(waypoints_per_sector, -1, -1):
                angle = start_angle + (end_angle - start_angle) * (s / waypoints_per_sector)
                lat = center_lat + inner_radius * math.cos(angle)
                lon = center_lon + inner_radius * math.sin(angle) / math.cos(math.radians(center_lat))
                wps.append({"lat": lat, "lon": lon, "alt": 0})

            missions[v] = wps
        return missions

    @staticmethod
    def generate_follow_leader(
        leader_lat: float, leader_lon: float,
        leader_heading: float,
        num_followers: int,
        formation: str = "line",
        spacing_meters: float = 50,
    ) -> Dict[int, List[dict]]:
        """
        Follow-the-leader: generate GUIDED waypoints for followers
        relative to the leader's position and heading.
        """
        heading_rad = math.radians(leader_heading)
        missions = {}

        for f in range(num_followers):
            follower_id = f + 1  # Leader is 0

            if formation == "line":
                # Straight line behind leader
                offset_dist = -(f + 1) * spacing_meters
                d_north = offset_dist * math.cos(heading_rad)
                d_east = offset_dist * math.sin(heading_rad)

            elif formation == "v_shape":
                # V formation
                side = 1 if f % 2 == 0 else -1
                row = (f // 2) + 1
                d_north = -row * spacing_meters * math.cos(heading_rad)
                d_east = side * row * spacing_meters * 0.5 * math.sin(heading_rad + math.pi / 2)

            elif formation == "echelon":
                # Diagonal echelon
                d_north = -(f + 1) * spacing_meters * math.cos(heading_rad)
                d_east = (f + 1) * spacing_meters * 0.5 * math.sin(heading_rad + math.pi / 4)

            else:
                d_north = -(f + 1) * spacing_meters
                d_east = 0

            new_lat, new_lon = haversine_offset(leader_lat, leader_lon, d_north, d_east)
            missions[follower_id] = [{"lat": new_lat, "lon": new_lon, "alt": 0}]

        return missions
