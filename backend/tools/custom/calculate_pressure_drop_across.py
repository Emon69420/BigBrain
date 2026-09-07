"""Darcy-Weisbach pressure drop calculator - computes pressure drop across a pipe
Args: flow_rate_m3s (float), diameter_m (float), length_m (float), roughness_m (float), density_kgm3 (float), viscosity_pa_s (float)
Returns: delta_p_pa (float)
"""

import math

def _friction_factor(re, diameter, roughness):
    """Solve Colebrook-White equation for turbulent flow."""
    if re <= 0:
        return 0.0
    # Initial guess (smooth pipe approximation)
    f = 0.02
    for _ in range(30):
        term1 = roughness / (3.7 * diameter)
        term2 = 2.51 / (re * math.sqrt(f))
        # Avoid domain errors in log10
        f_new = 1.0 / ((-2.0 * math.log10(term1 + term2)) ** 2)
        if abs(f - f_new) < 1e-12:
            return f_new
        f = f_new
    return f

def _darcy_weisbach(flow_rate, diameter, length, roughness, density, viscosity):
    """Core calculation of pressure drop."""
    area = math.pi * (diameter ** 2) / 4.0
    if area == 0:
        raise ValueError("Diameter must be non‑zero")
    velocity = flow_rate / area
    re = (density * velocity * diameter) / viscosity
    f = _friction_factor(re, diameter, roughness)
    delta_p = f * (length / diameter) * (density * velocity ** 2 / 2.0)
    return delta_p

def main(flow_rate_m3s, diameter_m, length_m, roughness_m, density_kgm3, viscosity_pa_s):
    """Calculate pressure drop using Darcy‑Weisbach.
    Returns: delta_p_pa (float)
    """
    return _darcy_weisbach(flow_rate_m3s, diameter_m, length_m, roughness_m, density_kgm3, viscosity_pa_s)

if __name__ == "__main__":
    # Example: water at ~20 °C, density 998 kg/m³, viscosity 0.001 Pa·s
    dp = main(
        flow_rate_m3s=0.01,
        diameter_m=0.05,
        length_m=100.0,
        roughness_m=0.000045,
        density_kgm3=998.0,
        viscosity_pa_s=0.001,
    )
    print(f"Pressure drop: {dp:.2f} Pa")