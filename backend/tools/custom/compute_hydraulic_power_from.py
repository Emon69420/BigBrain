"""Hydraulic power calculator - computes hydraulic power from flow rate and pressure
Args: flow_m3_per_s (float), pressure_pa (float)
Returns: power_watts (float)
"""

def main(flow_m3_per_s, pressure_pa):
    """Calculate hydraulic power in watts."""
    power_watts = pressure_pa * flow_m3_per_s
    return power_watts