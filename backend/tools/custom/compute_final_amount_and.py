"""Compound interest calculator - computes final amount and total interest earned
Args: principal (float), annual_rate_percent (float), years (int)
Returns: final_amount (float), total_interest (float)
"""

def main(principal, annual_rate_percent, years):
    """
    Calculate compound interest.
    """
    rate = annual_rate_percent / 100.0
    final_amount = principal * (1 + rate) ** years
    total_interest = final_amount - principal
    return final_amount, total_interest