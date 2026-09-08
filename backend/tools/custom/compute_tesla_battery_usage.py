"""Tesla battery range estimator - computes estimated driving range for a Tesla Model S
Args:
Returns: range_miles (float)
"""
def main():
    # Tesla Model S specifications (typical values)
    battery_capacity_kWh = 100.0      # total usable battery capacity in kilowatt-hours
    consumption_Wh_per_mile = 300.0  # average energy consumption in watt-hours per mile
    
    # Convert battery capacity to watt-hours and compute range
    battery_capacity_Wh = battery_capacity_kWh * 1000.0
    range_miles = battery_capacity_Wh / consumption_Wh_per_mile
    
    return range_miles