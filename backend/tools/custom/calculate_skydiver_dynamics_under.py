"""Skydiver dynamics calculator - computes descent time and impact velocity under gravity with drag
Args: mass_kg (float), drag_coefficient (float), area_m2 (float), air_density (float), height_m (float), time_step (float, optional, default=0.1)
Returns: descent_time_s (float), impact_velocity_m_s (float)
"""

import math

def main(mass_kg: float,
         drag_coefficient: float,
         area_m2: float,
         air_density: float,
         height_m: float,
         time_step: float = 0.1) -> tuple[float, float]:
    """
    Simulate a skydiver's vertical fall with quadratic air drag using explicit Euler integration.

    Parameters
    ----------
    mass_kg : float
        Mass of the skydiver (kg).
    drag_coefficient : float
        Dimensionless drag coefficient (C_d).
    area_m2 : float
        Frontal area of the skydiver (m^2).
    air_density : float
        Air density (kg/m^3), typically ~1.225 at sea level.
    height_m : float
        Initial altitude above ground (m).
    time_step : float, optional
        Integration step size (s). Default is 0.1 s.

    Returns
    -------
    descent_time_s : float
        Time elapsed until ground impact (s).
    impact_velocity_m_s : float
        Velocity just before impact (positive downward) (m/s).
    """
    # Guard against non‑positive initial height
    if height_m <= 0 or mass_kg <= 0 or time_step <= 0:
        return 0.0, 0.0

    g = 9.80665  # standard gravity (m/s^2)
    v = 0.0      # initial velocity (downward positive)
    y = height_m # current altitude
    t = 0.0      # elapsed time

    # Pre‑compute constant part of drag force
    drag_const = 0.5 * drag_coefficient * air_density * area_m2

    while y > 0:
        # Compute drag force (always opposes motion; direction upward when v>0)
        drag = drag_const * v * v
        # Net acceleration (downward positive)
        a = g - (drag / mass_kg)
        # Euler update
        v += a * time_step
        y -= v * time_step
        t += time_step

        # Prevent overshoot below ground: linearly interpolate last step
        if y <= 0:
            # fraction of the last step before hitting ground
            if v != 0:
                dt_back = ( -y) / v
                t -= time_step
                t += dt_back
                v -= a * (time_step - dt_back)  # adjust velocity back to impact moment
                y = 0.0
            break

    return t, v