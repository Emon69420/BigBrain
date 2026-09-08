"""Maximum height calculator - computes max height of projectile thrown upward from a given height
Args: initial_velocity_m_s (float), initial_height_m (float), gravity_m_s2 (float)
Returns: max_height_m (float)
"""
def main(initial_velocity_m_s, initial_height_m, gravity_m_s2):
    """
    Compute the maximum height reached by a projectile launched upward from an initial height.
    """
    # Additional height gained from the upward velocity until velocity reaches zero
    additional_height = (initial_velocity_m_s ** 2) / (2 * gravity_m_s2)
    max_height = initial_height_m + additional_height
    return max_height