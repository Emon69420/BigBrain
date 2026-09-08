"""Weight, net force, and acceleration calculator - computes weight, net force, and acceleration from mass, gravity, and drag
Args: mass (float), gravity (float), drag (float)
Returns: weight_N (float), net_force_N (float), acceleration_m_s2 (float)
"""

def main(mass, gravity, drag):
    weight = mass * gravity
    net_force = weight - drag
    acceleration = net_force / mass
    return weight, net_force, acceleration