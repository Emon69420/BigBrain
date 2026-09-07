"""Torque calculator - computes torque from force and lever arm
Args: force_N (float), distance_m (float)
Returns: torque_Nm (float)
"""
import math

def main(force_N: float, distance_m: float) -> float:
    """
    Calculate torque produced by a force applied at a given distance.
    
    Args:
        force_N: Magnitude of the force in newtons.
        distance_m: Perpendicular distance from the rotation axis in meters.
    
    Returns:
        Torque in newton‑meters (N·m).
    """
    return force_N * distance_m

if __name__ == "__main__":
    # Demonstration with the given task values
    demo_torque = main(100.0, 2.0)
    print(f"Torque: {demo_torque} N·m")