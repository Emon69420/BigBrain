"""Calculate the required r based on pump identifier and operating temperature."""

def main(value_1: float, value_2: float) -> float:
    """
    Compute the required r value according to the standard operating procedures (SOPs).

    Parameters
    ----------
    value_1 : float
        Pump identifier.
    value_2 : float
        Operating temperature.

    Returns
    -------
    float
        Calculated r value.
    """
    # SOP example: r is proportional to the pump identifier and scaled by temperature.
    # The scaling factor (e.g., 1/100) is a placeholder; replace with the actual SOP factor as needed.
    r = value_1 * (value_2 / 100.0)
    return r