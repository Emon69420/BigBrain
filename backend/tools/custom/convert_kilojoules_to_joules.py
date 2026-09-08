"""
Tool: kilojoules_to_joules

Converts an energy value from kilojoules to joules.
"""

def main(energy_kj, kj_to_j):
    """
    Convert energy from kilojoules to joules.

    Parameters
    ----------
    energy_kj : float, int, or None
        Energy value in kilojoules.
    kj_to_j : any
        Placeholder argument required by the interface; not used.

    Returns
    -------
    float or None
        Energy in joules, or None if the input is invalid.
    """
    # Return None for missing input
    if energy_kj is None:
        return None

    # Try to convert to a float and compute joules
    try:
        return float(energy_kj) * 1000.0
    except (TypeError, ValueError):
        # Invalid (non‑numeric) input
        return None