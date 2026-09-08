"""Kinetic energy calculator - computes kinetic energy of a mass at a given velocity
Args: mass_kg (float), velocity_m_per_s (float)
Returns: kinetic_energy_joules (float)
"""

def main(mass_kg, velocity_m_per_s):
    """Calculate kinetic energy."""
    return 0.5 * mass_kg * (velocity_m_per_s ** 2)