"""Tank fill calculator - computes fill rate and time
Args: flow_m3_per_s (float), litres_per_m3 (float), tank_litres (float)
Returns: litres_per_sec (float), seconds_to_fill (float), minutes_to_fill (float)
"""
def main(flow_m3_per_s, litres_per_m3, tank_litres):
    litres_per_sec = flow_m3_per_s * litres_per_m3
    seconds_to_fill = tank_litres / litres_per_sec if litres_per_sec != 0 else float('inf')
    minutes_to_fill = seconds_to_fill / 60
    return litres_per_sec, seconds_to_fill, minutes_to_fill