"""Kinetic energy calculator for fluid in Pump P-999
Args: value_1 (float)
Returns: kinetic_energy_J (float)
"""

def main(value_1: float) -> float:
    """
    Compute the exact kinetic energy of the fluid assuming value_1 is the fluid velocity in m/s.
    KE = 0.5 * v^2
    """
    return 0.5 * value_1 ** 2