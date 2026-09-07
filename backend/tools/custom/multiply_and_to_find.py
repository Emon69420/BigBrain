"""kWh consumption calculator - computes remaining energy percentage
Args: none
Returns: remaining_percentage (float)
"""

import math

def main():
    """Calculate remaining energy percentage after consumption."""
    consumption = 300 * 200  # kWh
    total = 75.0
    remaining = total - consumption
    remaining_percentage = (remaining / total) * 100.0
    return remaining_percentage