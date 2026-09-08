"""Heating calculator - computes temperature rise, total energy required, and runtime for heating water
Args: mass_g (float), delta_T (float), specific_heat_J_per_g_C (float), power_W (float)
Returns: temperature_rise_C (float), energy_J (float), runtime_s (float)
"""
def main(mass_g, delta_T, specific_heat_J_per_g_C, power_W):
    temperature_rise = float(delta_T)
    energy_J = float(mass_g) * float(specific_heat_J_per_g_C) * float(delta_T)
    runtime_s = energy_J / float(power_W)
    return temperature_rise, energy_J, runtime_s