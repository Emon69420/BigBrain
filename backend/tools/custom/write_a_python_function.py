"""List sorter - returns a sorted copy of the input list
Args: items (list) – a list of comparable elements
Returns: sorted_items (list) – the input list in ascending order
"""

def main(items):
    """
    Sort the provided list and return a new sorted list.

    Parameters
    ----------
    items : list
        A list of elements that can be compared with each other.

    Returns
    -------
    list
        A new list containing the elements of `items` sorted in ascending order.
    """
    # Using Python's built‑in sorted ensures a stable, deterministic sort.
    return sorted(items)