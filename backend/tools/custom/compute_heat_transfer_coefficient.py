"""Heat transfer coefficient calculator for pipe flow
Args: diameter_m (float), temp_K (float), velocity_m_s (float)
Returns: h_W_m2K (float)
"""
import math

def main(diameter_m: float, temp_K: float, velocity_m_s: float) -> float:
    """
    Estimate the convective heat transfer coefficient inside a circular pipe
    using the Dittus‑Boelter correlation (turbulent flow).

    Parameters
    ----------
    diameter_m : float
        Internal pipe diameter in meters.
    temp_K : float
        Fluid temperature in Kelvin (used only for selecting fluid property
        constants; assumed water at ~300 K).
    velocity_m_s : float
        Mean fluid velocity in meters per second.

    Returns
    -------
    float
        Heat transfer coefficient h in W/(m²·K).
    """
    # Assumed constant fluid properties for water near 300 K
    rho = 998.0          # kg/m³
    mu = 0.001           # Pa·s (kg/(m·s))
    k = 0.6              # W/(m·K) thermal conductivity
    cp = 4182.0          # J/(kg·K)
    Pr = cp * mu / k     # Prandtl number

    # Reynolds number
    Re = rho * velocity_m_s * diameter_m / mu

    # Dittus‑Boelter correlation (heating, exponent 0.4)
    if Re <= 0:
        raise ValueError("Reynolds number must be positive.")
    Nu = 0.023 * (Re ** 0.8) * (Pr ** 0.4)

    # Heat transfer coefficient
    h = Nu * k / diameter_m
    return h