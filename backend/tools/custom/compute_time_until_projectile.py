"""Projectile time to ground calculator
Args: initial_velocity (float), initial_height (float), gravity (float)
Returns: time_seconds (float)
"""
import math

def main(initial_velocity, initial_height, gravity):
    """
    Calculate the time until the projectile hits the ground.

    Parameters:
    initial_velocity (float): Initial vertical velocity (m/s).
    initial_height (float): Initial height above ground (m).
    gravity (float): Acceleration due to gravity (m/s^2).

    Returns:
    float: Time in seconds until impact.
    """
    # Solve 0 = h0 + v0*t - 0.5*g*t^2
    discriminant = initial_velocity**2 + 2 * gravity * initial_height
    if discriminant < 0:
        raise ValueError("No real solution for the given parameters.")
    time = (initial_velocity + math.sqrt(discriminant)) / gravity
    return time