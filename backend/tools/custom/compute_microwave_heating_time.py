"""Microwave heating time calculator - computes heating time given energy and power
Args: energy_j (float), power_w (float)
Returns: time_s (float)
"""

import math

def main(energy_j: float, power_w: float) -> float:
    """Calculate heating time in seconds.

    Args:
        energy_j: Energy required in joules.
        power_w: Microwave power in watts (J/s).

    Returns:
        Heating time in seconds.

    Raises:
        ValueError: If power_w is not positive.
    """
    if power_w <= 0:
        raise ValueError("Microwave power must be positive")
    time_s = energy_j / power_w
    return time_s

if __name__ == "__main__":
    # Demo usage
    demo_energy = 5000.0  # joules
    demo_power = 800.0    # watts
    print(f"Heating time for {demo_energy} J at {demo_power} W: {main(demo_energy, demo_power):.2f} s")