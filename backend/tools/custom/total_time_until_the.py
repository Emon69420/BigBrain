"""Time to impact calculator - computes total time until a ball hits the ground
Args: initial_speed_m_per_s (float), initial_height_m (float), gravity_m_per_s2 (float)
Returns: total_time_s (float)
"""
import math

def main(initial_speed_m_per_s: float, initial_height_m: float, gravity_m_per_s2: float) -> float:
    """
    Calculates the time until the ball reaches the ground, assuming it is launched
    vertically upward with the given initial speed from the specified height.
    
    Uses the kinematic equation:
        y(t) = initial_height_m + initial_speed_m_per_s * t - 0.5 * gravity_m_per_s2 * t^2 = 0
    
    Solving for the positive root gives the total time.
    """
    # Coefficients of the quadratic: (1/2) * g * t^2 - v0 * t - h0 = 0
    a = 0.5 * gravity_m_per_s2
    b = -initial_speed_m_per_s
    c = -initial_height_m

    discriminant = b * b - 4 * a * c
    if discriminant < 0:
        raise ValueError("No real solution for time with given parameters.")

    sqrt_disc = math.sqrt(discriminant)
    t1 = (-b + sqrt_disc) / (2 * a)
    t2 = (-b - sqrt_disc) / (2 * a)

    total_time_s = max(t1, t2)
    return total_time_s