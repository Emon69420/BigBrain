"""Energy calculator - computes total energy required to heat a substance
Args: initial_temp_c (float), final_temp_c (float), mass_g (float), specific_heat_j_per_g_c (float), power_w (float)
Returns: energy_j (float)
"""
import math

def main(initial_temp_c: float, final_temp_c: float, mass_g: float, specific_heat_j_per_g_c: float, power_w: float) -> float:
    """
    Calculate the total energy needed to raise the temperature of a given mass.

    Parameters:
        initial_temp_c (float): Starting temperature in Celsius.
        final_temp_c (float): Desired final temperature in Celsius.
        mass_g (float): Mass of the material in grams.
        specific_heat_j_per_g_c (float): Specific heat capacity (J/g·°C).
        power_w (float): Power of the heater in watts (unused for energy calculation).

    Returns:
        float: Total energy required in joules.
    """
    delta_t = final_temp_c - initial_temp_c
    energy_j = mass_g * specific_heat_j_per_g_c * delta_t
    return energy_j