"""Kinetic energy calculator - computes kinetic energy of a moving object
Args: mass (float), velocity (float)
Returns: kinetic_energy (float)
"""
import math

def main(mass: float = 5.0, velocity: float = 10.0) -> float:
    """Calculate kinetic energy using 0.5 * mass * velocity^2."""
    return 0.5 * mass * math.pow(velocity, 2)

if __name__ == "__main__":
    print(main())