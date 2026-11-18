import csv
from pathlib import Path
from datetime import datetime, timedelta

from src.congestion_analyzer import analyze_congestion


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

ALERT_FILE = DATA_DIR / "traffic_alerts.csv"

DATA_DIR.mkdir(exist_ok=True)

ALERT_COLUMNS = [
    "timestamp",
    "congestion_level",
    "object_count",
    "traffic_score",
    "alert_message",
]


def get_alert_status(live_counts):

    result = analyze_congestion(live_counts)

    # Vehicle + Pedestrian counting
    object_classes = [
        "car",
        "motorcycle",
        "bus",
        "truck",
        "bicycle",
        "person"
    ]

    total_objects = sum(
        int(live_counts.get(category, 0))
        for category in object_classes
    )

    level = result.get(
        "congestion_level",
        result.get("level", "NO DATA")
    )

    traffic_score = result.get(
        "weighted_score",
        result.get("congestion_score", 0)
    )

    if level == "NO DATA":
        message = "No vehicles detected. Waiting for traffic data."

    elif level == "HIGH":
        message = "Heavy traffic detected!"

    elif level == "MODERATE":
        message = "Moderate traffic detected."

    elif level == "LOW":
        message = "Traffic is flowing normally."

    else:
        message = "Traffic status unavailable."

    return {
        "timestamp": datetime.now().strftime(
            "%Y-%m-%d %H:%M:%S"
        ),
        "congestion_level": level,
        "object_count": total_objects,
        "traffic_score": traffic_score,
        "alert_message": message
    }


def save_alert(alert):
    """
    Save alert only when congestion level changes
    or the previous alert is older than 60 seconds.
    """

    if not ALERT_FILE.exists():
        with open(ALERT_FILE, "w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(
                file,
                fieldnames=ALERT_COLUMNS
            )
            writer.writeheader()

    last_alert = None

    try:
        with open(ALERT_FILE, "r", encoding="utf-8") as file:
            rows = list(csv.DictReader(file))

            if rows:
                last_alert = rows[-1]

    except Exception:
        last_alert = None

    should_save = True

    if last_alert:

        last_level = last_alert["congestion_level"]

        last_time = datetime.strptime(
            last_alert["timestamp"],
            "%Y-%m-%d %H:%M:%S"
        )

        current_time = datetime.now()

        if (
            last_level == alert["congestion_level"]
            and current_time - last_time < timedelta(seconds=60)
        ):
            should_save = False

    if should_save:

        with open(
            ALERT_FILE,
            "a",
            newline="",
            encoding="utf-8"
        ) as file:

            writer = csv.DictWriter(
                file,
                fieldnames=ALERT_COLUMNS
            )

            writer.writerow(alert)

    return should_save


def get_alert_history(limit=100):
    """
    Read previous traffic alerts.
    """

    if not ALERT_FILE.exists():
        return []

    try:
        with open(ALERT_FILE, "r", encoding="utf-8") as file:

            rows = list(csv.DictReader(file))

            return rows[-limit:][::-1]

    except Exception:
        return []