"""Temperature difference calculator - computes difference between two Celsius temperatures
Args: start_c (float), end_c (float)
Returns: diff_c (float)
"""

import math

def main(start_c: float = 20.0, end_c: float = 90.0) -> float:
    """
    Compute the temperature difference between two Celsius values.

    Parameters
    ----------
    start_c : float
        Starting temperature in degrees Celsius.
    end_c : float
        Ending temperature in degrees Celsius.

    Returns
    -------
    float
        The difference (end_c - start_c) in degrees Celsius.
    """
    diff_c = end_c - start_c
    return diff_c