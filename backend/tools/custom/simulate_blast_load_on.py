"""Blast load calculator - computes peak blast pressure on a wall from a TNT charge
Args: charge_kg (float), distance_m (float)
Returns: pressure_kPa (float)
"""

import math

def _scaled_distance(charge_kg: float, distance_m: float) -> float:
    """
    Compute the scaled distance Z = R / W^(1/3)

    Parameters
    ----------
    charge_kg : float
        TNT charge weight in kilograms (must be > 0)
    distance_m : float
        Standoff distance from charge to the wall in meters (must be > 0)

    Returns
    -------
    float
        Scaled distance Z in m·kg^(-1/3)
    """
    # Convert charge to kg^(1/3) factor
    w_cbrt = charge_kg ** (1.0 / 3.0)
    return distance_m / w_cbrt

def _peak_overpressure_psi(z: float) -> float:
    """
    Approximate peak overpressure in psi using the empirical
    Kingery‑Bulmash formula for TNT.

    P(psi) = 1772/Z^3 + 114/Z^2 + 10.4/Z + 0.1

    Parameters
    ----------
    z : float
        Scaled distance (dimensionless)

    Returns
    -------
    float
        Peak overpressure in pounds per square inch (psi)
    """
    if z <= 0:
        # Physically impossible, but guard against division by zero
        return float('inf')
    return 1772.0 / (z ** 3) + 114.0 / (z ** 2) + 10.4 / z + 0.1

def _psi_to_kpa(psi: float) -> float:
    """Convert pressure from psi to kilopascals."""
    return psi * 6.89475729  # 1 psi = 6.89475729 kPa

def main(charge_kg: float, distance_m: float) -> float:
    """
    Compute the peak blast pressure on a wall.

    Parameters
    ----------
    charge_kg : float
        TNT charge weight in kilograms. Must be positive.
    distance_m : float
        Distance from the charge to the wall in meters. Must be positive.

    Returns
    -------
    float
        Peak blast pressure in kilopascals (kPa).
    """
    if charge_kg <= 0:
        raise ValueError("charge_kg must be a positive number")
    if distance_m <= 0:
        raise ValueError("distance_m must be a positive number")

    # 1. Scaled distance
    z = _scaled_distance(charge_kg, distance_m)

    # 2. Peak overpressure in psi (empirical)
    pressure_psi = _peak_overpressure_psi(z)

    # 3. Convert to kPa
    pressure_kpa = _psi_to_kpa(pressure_psi)

    return pressure_kpa

if __name__ == "__main__":
    # Demo with typical values: 10 kg TNT at 5 m distance
    demo_charge = 10.0   # kg
    demo_distance = 5.0  # m
    pressure = main(demo_charge, demo_distance)
    print(f"Charge: {demo_charge} kg, Distance: {demo_distance} m -> Peak Pressure: {pressure:.2f} kPa")