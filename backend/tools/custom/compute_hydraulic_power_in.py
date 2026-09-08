"""Hydraulic Power Calculator

Computes hydraulic power in kilowatts from volumetric flow rate and pressure.
"""

def main(flow_m3_per_s, pressure_Pa, watts_per_kilowatt):
    """
    Calculate hydraulic power in kilowatts.

    Parameters
    ----------
    flow_m3_per_s : float
        Volumetric flow rate in cubic metres per second.
    pressure_Pa : float
        Pressure in pascals.
    watts_per_kilowatt : float
        Conversion factor from watts to kilowatts (typically 1000).

    Returns
    -------
    float or None
        Hydraulic power in kilowatts, or None if any input is missing.
    """
    # Guard against missing inputs
    if flow_m3_per_s is None or pressure_Pa is None or watts_per_kilowatt is None:
        return None

    # Power in watts = pressure × flow
    power_watts = pressure_Pa * flow_m3_per_s

    # Convert to kilowatts
    power_kW = power_watts / watts_per_kilowatt
    return power_kW