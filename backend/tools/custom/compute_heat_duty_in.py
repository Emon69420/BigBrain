"""Calculate heat duty in kilowatts."""
def main(mass_kg, specific_heat_J_per_kgC, delta_T_C):
    """
    Compute the heat duty (kW) based on mass, specific heat, and temperature change.

    Parameters
    ----------
    mass_kg : float
        Mass (kg) or mass flow rate (kg/s) if the basis is per second.
    specific_heat_J_per_kgC : float
        Specific heat capacity (J/(kg·°C)).
    delta_T_C : float
        Temperature change (°C).

    Returns
    -------
    float
        Heat duty in kilowatts.
    """
    power_watts = mass_kg * specific_heat_J_per_kgC * delta_T_C
    return power_watts / 1000.0