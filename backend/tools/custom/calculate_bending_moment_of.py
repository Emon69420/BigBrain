"""Bending moment calculator - computes max bending moment for a simply supported beam with a centered point load
Args: length_m (float), load_N (float)
Returns: moment_Nm (float)
"""
import math

def main(length_m: float, load_N: float) -> float:
    """
    Calculate the maximum bending moment for a simply supported beam
    with a point load applied at its midpoint.

    Parameters
    ----------
    length_m : float
        Length of the beam in meters.
    load_N : float
        Magnitude of the point load in newtons.

    Returns
    -------
    float
        Maximum bending moment in newton‑meters.
    """
    # For a centered point load, max moment = P * L / 4
    return load_N * length_m / 4.0