"""Kinetic energy calculator - computes kinetic energy from mass and velocity
Args: mass_kg (float), velocity_m_per_s (float)
Returns: kinetic_energy_joules (float)
"""

def main(mass_kg, velocity_m_per_s):
    """
    Calculate kinetic energy using the formula KE = 0.5 * m * v^2.
    
    Parameters:
    mass_kg (float): Mass in kilograms.
    velocity_m_per_s (float): Velocity in meters per second.
    
    Returns:
    float: Kinetic energy in joules.
    """
    return 0.5 * mass_kg * velocity_m_per_s ** 2