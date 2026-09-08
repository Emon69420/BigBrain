"""Battery consumption calculator - computes kWh consumed and remaining battery percent after a trip
Args: battery_kwh (float), consumption_wh_per_km (float), distance_km (float)
Returns: consumed_kwh (float), remaining_percent (float)
"""
def main(battery_kwh, consumption_wh_per_km, distance_km):
    # Ensure numeric types
    battery_kwh = float(battery_kwh)
    consumption_wh_per_km = float(consumption_wh_per_km)
    distance_km = float(distance_km)

    # Total energy used in Wh
    total_consumption_wh = consumption_wh_per_km * distance_km
    # Convert to kWh
    consumed_kwh = total_consumption_wh / 1000.0

    # Remaining energy
    remaining_kwh = battery_kwh - consumed_kwh
    if battery_kwh == 0:
        remaining_percent = 0.0
    else:
        remaining_percent = (remaining_kwh / battery_kwh) * 100.0

    return consumed_kwh, remaining_percent