"""Factorial calculator - computes factorial of a given integer
Args: n (int) - integer to compute factorial for (default 5)
Returns: result (int) - factorial of n
"""
import math

def main(n: int = 5) -> int:
    """Calculate the factorial of n."""
    return math.factorial(n)