"""Temperature rise calculator - computes time required to raise temperature of a substance
Args: initial_temp_c (float), final_temp_c (float), mass_g (float), specific_heat_j_per_g_c (float), power_w (float)
Returns: time_seconds (float)
"""
import math

def main(initial_temp_c, final_temp_c, mass_g, specific_heat_j_per_g_c, power_w):
    """
    Calculate the time needed (in seconds) to raise the temperature of a given mass
    from an initial temperature to a final temperature using a constant power source.

    Parameters
    ----------
    initial_temp_c : float
        Starting temperature in degrees Celsius.
    final_temp_c : float
        Desired ending temperature in degrees Celsius.
    mass_g : float
        Mass of the material in grams.
    specific_heat_j_per_g_c : float
        Specific heat capacity (Joules per gram per degree Celsius).
    power_w : float
        Power supplied in watts (Joules per second).

    Returns
    -------
    float
        Required time in seconds.
    """
    if power_w <= 0:
        raise ValueError("Power must be greater than zero.")
    delta_t = final_temp_c - initial_temp_c
    if delta_t <= 0:
        return 0.0
    energy_j = mass_g * specific_heat_j_per_g_c * delta_t
    time_seconds = energy_j / power_w
    # Guard against floating‑point anomalies
    return float(time_seconds)