"""Oil barrel converter - converts volume in litres to number of standard oil barrels and provides barrel volume
Args: volume_L (float)
Returns: barrels (float), barrel_volume_L (float)
"""

def main(volume_L):
    barrel_volume_L = 159.0
    barrels = volume_L / barrel_volume_L
    return barrels, barrel_volume_L