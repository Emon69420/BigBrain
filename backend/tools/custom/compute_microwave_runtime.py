"""Microwave runtime calculator - computes heating time for given parameters
Args: initial_temp_c (float), final_temp_c (float), mass_g (float), specific_heat_j_per_g_c (float), power_w (float)
Returns: runtime_seconds (float)
"""
import math

def main(initial_temp_c, final_temp_c, mass_g, specific_heat_j_per_g_c, power_w):
    """
    Calculate the runtime of a microwave to raise the temperature of a substance.

    Parameters
    ----------
    initial_temp_c : float
        Starting temperature in degrees Celsius.
    final_temp_c : float
        Desired final temperature in degrees Celsius.
    mass_g : float
        Mass of the substance in grams.
    specific_heat_j_per_g_c : float
        Specific heat capacity in joules per gram per degree Celsius.
    power_w : float
        Microwave power in watts (joules per second).

    Returns
    -------
    float
        Required runtime in seconds.
    """
    delta_t = final_temp_c - initial_temp_c
    if delta_t <= 0:
        return 0.0
    energy_j = mass_g * specific_heat_j_per_g_c * delta_t
    if power_w <= 0:
        raise ValueError("Power must be positive")
    runtime_seconds = energy_j / power_w
    return runtime_seconds