from math import radians, sin, cos, asin, sqrt
from typing import Tuple


EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = EARTH_RADIUS_KM
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r * asin(sqrt(a))


def bounding_box(lat: float, lng: float, radius_km: float) -> Tuple[float, float, float, float]:
    delta_lat = radius_km / 111.0
    delta_lng = radius_km / (111.0 * cos(radians(lat)))
    return (
        lat - delta_lat,
        lat + delta_lat,
        lng - delta_lng,
        lng + delta_lng,
    )


def round_distance(distance_km: float) -> float:
    return round(distance_km * 10) / 10


def round_coords(lat: float, lng: float, decimals: int = 2) -> Tuple[float, float]:
    return (round(lat, decimals), round(lng, decimals))