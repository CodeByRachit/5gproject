from datetime import datetime


# Vehicle categories
VEHICLE_CLASSES = [
    "car",
    "motorcycle",
    "bus",
    "truck",
    "bicycle"
]


# Initial congestion thresholds
LOW_THRESHOLD = 5
MODERATE_THRESHOLD = 15


def analyze_congestion(live_counts):

    """
    Analyze current traffic congestion using live vehicle detections.

    Parameters:
        live_counts: Dictionary containing current frame detections.

    Returns:
        Dictionary containing vehicle count, congestion score and status.
    """

    # Get current vehicle counts
    cars = live_counts.get("car", 0)
    motorcycles = live_counts.get("motorcycle", 0)
    buses = live_counts.get("bus", 0)
    trucks = live_counts.get("truck", 0)
    bicycles = live_counts.get("bicycle", 0)

    # Total vehicles currently detected
    total_vehicles = (
        cars
        + motorcycles
        + buses
        + trucks
        + bicycles
    )

    # Weighted congestion score
    congestion_score = (
        cars * 1.0
        + motorcycles * 0.5
        + buses * 2.5
        + trucks * 2.0
        + bicycles * 0.4
    )

    # Congestion classification
    if total_vehicles == 0:
        congestion_level = "NO DATA"
        color = "GRAY"

    elif total_vehicles <= LOW_THRESHOLD:
        congestion_level = "LOW"
        color = "GREEN"

    elif total_vehicles <= MODERATE_THRESHOLD:
        congestion_level = "MODERATE"
        color = "YELLOW"

    else:
        congestion_level = "HIGH"
        color = "RED"

    return {

        "timestamp": datetime.now().isoformat(timespec="seconds"),

        "vehicle_count": total_vehicles,

        "cars": cars,

        "motorcycles": motorcycles,

        "buses": buses,

        "trucks": trucks,

        "bicycles": bicycles,

        "congestion_score": round(congestion_score, 2),

        "color": color,
        "counts": live_counts,
        

        "congestion_level": congestion_level,

        "congestion_color": color

    }


def get_congestion_description(level):


    if level == "NO DATA":
        return "No vehicles detected. Waiting for traffic data."

    elif level == "LOW":
        return "Traffic is flowing smoothly."

    elif level == "MODERATE":
        return "Moderate traffic congestion detected."

    elif level == "HIGH":
        return "Heavy traffic congestion detected."

    descriptions = {

        "LOW": "Traffic is flowing smoothly.",

        "MODERATE": "Traffic density is increasing.",

        "HIGH": "Heavy traffic detected. Congestion warning!"

    }

    return descriptions.get(
        level,
        "Traffic status unavailable."
    )