"""
Traffic metric utility functions.
"""

import math
from typing import List


def normalize(value: float, min_val: float, max_val: float) -> float:
    """Normalize value to [0, 1] range."""
    if max_val == min_val:
        return 0.0
    return max(0.0, min(1.0, (value - min_val) / (max_val - min_val)))


def moving_average(values: List[float], window: int = 10) -> float:
    """Compute moving average over last `window` values."""
    if not values:
        return 0.0
    recent = values[-window:]
    return sum(recent) / len(recent)


def compute_flow_rate(count: int, duration_sec: float) -> float:
    """Vehicles per minute."""
    if duration_sec <= 0:
        return 0.0
    return (count / duration_sec) * 60.0


def estimate_queue_length(
    vehicles_in_lane: int,
    avg_vehicle_length_m: float = 5.0,
    gap_m: float = 2.0,
) -> float:
    """Estimate queue length in meters."""
    return vehicles_in_lane * (avg_vehicle_length_m + gap_m)


def congestion_level_label(index: float) -> str:
    """Human-readable congestion label."""
    if index < 0.2:
        return "Free Flow"
    elif index < 0.4:
        return "Light"
    elif index < 0.6:
        return "Moderate"
    elif index < 0.8:
        return "Heavy"
    else:
        return "Gridlock"
