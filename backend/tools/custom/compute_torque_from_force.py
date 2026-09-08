"""Compute torque from force and distance.

Given a force in newtons and a perpendicular distance in meters, returns the torque in newton‑meters.
"""

def main(force_N, distance_m):
    """Compute torque given force and distance.

    Parameters
    ----------
    force_N : float or str
        Force applied in newtons.
    distance_m : float or str
        Perpendicular distance from the pivot in meters.

    Returns
    -------
    float
        Resulting torque in newton‑meters.
    """
    force_val = float(force_N)
    distance_val = float(distance_m)
    return force_val * distance_val