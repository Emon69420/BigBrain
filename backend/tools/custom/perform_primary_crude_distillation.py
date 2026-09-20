"""Primary crude distillation cut calculator - estimates fraction of crude distilled below given temperature
Args: value_1 (float)
Returns: fraction_below_temp (float)
"""

def main(value_1):
    """
    Estimate the fraction of crude that would be distilled below the specified temperature.
    
    Parameters
    ----------
    value_1 : float
        Temperature in degrees Celsius (e.g., column top temperature).
    
    Returns
    -------
    float
        Fraction (0 to 1) of crude expected to be distilled below the given temperature.
    """
    # Simple linear approximation: assume crude components boil between 0°C and 400°C.
    # Clamp result between 0 and 1.
    fraction = value_1 / 400.0
    if fraction < 0.0:
        fraction = 0.0
    elif fraction > 1.0:
        fraction = 1.0
    return fraction