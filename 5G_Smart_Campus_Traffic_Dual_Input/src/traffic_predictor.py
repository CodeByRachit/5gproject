import os
import pickle
import time

import numpy as np
import pandas as pd

from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

from src.congestion_analyzer import analyze_congestion


# =====================================================
# PROJECT PATHS
# =====================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

DATA_DIR = os.path.join(BASE_DIR, "data")

MODEL_DIR = os.path.join(BASE_DIR, "models")

HISTORY_FILE = os.path.join(
    DATA_DIR,
    "traffic_history.csv"
)

MODEL_FILE = os.path.join(
    MODEL_DIR,
    "traffic_model.pkl"
)


os.makedirs(DATA_DIR, exist_ok=True)

os.makedirs(MODEL_DIR, exist_ok=True)


# =====================================================
# CONFIGURATION
# =====================================================

SAMPLE_INTERVAL = 10

PREDICTION_MINUTES = 5

# 5 minutes / 10 seconds = 30 samples
FUTURE_SAMPLES = (
    PREDICTION_MINUTES * 60
) // SAMPLE_INTERVAL


FEATURE_COLUMNS = [
    "vehicle_count",
    "mean_1m",
    "mean_3m",
    "trend_1m"
]


# =====================================================
# TRAFFIC HISTORY LOGGER
# =====================================================

class TrafficHistoryLogger:

    def __init__(self):

        self.last_saved_time = 0

    def save_observation(self, live_counts):

        """
        Save traffic observations every 10 seconds.
        """

        current_time = time.time()

        # Avoid saving every video frame
        if (
            current_time - self.last_saved_time
            < SAMPLE_INTERVAL
        ):
            return False

        analysis = analyze_congestion(live_counts)

        row = {

            "timestamp": analysis["timestamp"],

            "vehicle_count": analysis["vehicle_count"],

            "cars": analysis["cars"],

            "motorcycles": analysis["motorcycles"],

            "buses": analysis["buses"],

            "trucks": analysis["trucks"],

            "bicycles": analysis["bicycles"],

            "congestion_score": analysis["congestion_score"],

            "congestion_level": analysis["congestion_level"]

        }

        df = pd.DataFrame([row])

        file_exists = os.path.exists(HISTORY_FILE)

        df.to_csv(
            HISTORY_FILE,
            mode="a",
            header=not file_exists,
            index=False
        )

        self.last_saved_time = current_time

        return True


# =====================================================
# FEATURE ENGINEERING
# =====================================================

def prepare_features(df):

    """
    Prepare historical traffic features for ML prediction.
    """

    df = df.copy()

    df["timestamp"] = pd.to_datetime(
        df["timestamp"],
        errors="coerce"
    )

    df = df.dropna(
        subset=["timestamp", "vehicle_count"]
    )

    df = df.sort_values("timestamp").reset_index(
        drop=True
    )

    # Average vehicles in the previous 1 minute
    df["mean_1m"] = (
        df["vehicle_count"]
        .rolling(window=6, min_periods=1)
        .mean()
    )

    # Average vehicles in the previous 3 minutes
    df["mean_3m"] = (
        df["vehicle_count"]
        .rolling(window=18, min_periods=1)
        .mean()
    )

    # Traffic trend over the previous 1 minute
    df["trend_1m"] = (
        df["vehicle_count"]
        - df["vehicle_count"].shift(5)
    )

    df["trend_1m"] = df["trend_1m"].fillna(0)

    return df


# =====================================================
# CONGESTION CLASSIFICATION
# =====================================================

def classify_predicted_traffic(vehicle_count):

    if vehicle_count <= 5:

        return "LOW"

    elif vehicle_count <= 15:

        return "MODERATE"

    else:

        return "HIGH"


# =====================================================
# TRAINING + PREDICTION
# =====================================================

def train_and_predict():

    """
    Train Linear Regression and Random Forest models.

    Predict traffic vehicle count for the next 5 minutes.
    """

    if not os.path.exists(HISTORY_FILE):

        return {

            "status": "insufficient_data",

            "message": "Traffic history not available yet."

        }

    df = pd.read_csv(HISTORY_FILE)

    if len(df) < 60:

        return {

            "status": "insufficient_data",

            "message": (
                f"Only {len(df)} observations available. "
                "Collect more traffic history before training."
            )

        }

    # Prepare features
    df = prepare_features(df)

    # Future vehicle count after 5 minutes
    df["target"] = df["vehicle_count"].shift(
        -FUTURE_SAMPLES
    )

    training_df = df.dropna(
        subset=["target"]
    ).copy()

    if len(training_df) < 30:

        return {

            "status": "insufficient_data",

            "message": "Not enough future-labelled observations."

        }

    X = training_df[FEATURE_COLUMNS]

    y = training_df["target"]

    # Chronological train-test split
    split_index = int(len(X) * 0.8)

    if split_index < 10 or len(X) - split_index < 5:

        return {

            "status": "insufficient_data",

            "message": "Not enough training and testing observations."

        }

    X_train = X.iloc[:split_index]

    X_test = X.iloc[split_index:]

    y_train = y.iloc[:split_index]

    y_test = y.iloc[split_index:]

    # =================================================
    # LINEAR REGRESSION
    # =================================================

    linear_model = LinearRegression()

    linear_model.fit(
        X_train,
        y_train
    )

    linear_predictions = linear_model.predict(
        X_test
    )

    linear_mae = mean_absolute_error(
        y_test,
        linear_predictions
    )

    # =================================================
    # RANDOM FOREST
    # =================================================

    random_forest = RandomForestRegressor(

        n_estimators=100,

        max_depth=8,

        random_state=42,

        n_jobs=-1

    )

    random_forest.fit(
        X_train,
        y_train
    )

    rf_predictions = random_forest.predict(
        X_test
    )

    rf_mae = mean_absolute_error(
        y_test,
        rf_predictions
    )

    # =================================================
    # SELECT BEST MODEL
    # =================================================

    if linear_mae <= rf_mae:

        best_model = LinearRegression()

        best_model.fit(X, y)

        best_model_name = "Linear Regression"

        best_mae = linear_mae

    else:

        best_model = RandomForestRegressor(

            n_estimators=100,

            max_depth=8,

            random_state=42,

            n_jobs=-1

        )

        best_model.fit(X, y)

        best_model_name = "Random Forest"

        best_mae = rf_mae

    # =================================================
    # CURRENT TRAFFIC FEATURES
    # =================================================

    latest_features = df.iloc[[-1]][
        FEATURE_COLUMNS
    ]

    predicted_vehicles = best_model.predict(
        latest_features
    )[0]

    predicted_vehicles = max(
        0,
        int(round(predicted_vehicles))
    )

    current_vehicles = int(
        df.iloc[-1]["vehicle_count"]
    )

    predicted_level = classify_predicted_traffic(
        predicted_vehicles
    )

    current_level = classify_predicted_traffic(
        current_vehicles
    )

    # =================================================
    # SAVE MODEL
    # =================================================

    model_data = {

        "model": best_model,

        "model_name": best_model_name,

        "feature_columns": FEATURE_COLUMNS,

        "mae": best_mae,

        "prediction_minutes": PREDICTION_MINUTES,

        "sample_interval": SAMPLE_INTERVAL

    }

    with open(MODEL_FILE, "wb") as file:

        pickle.dump(
            model_data,
            file
        )

    # =================================================
    # RETURN RESULT
    # =================================================

    return {

        "status": "success",

        "model_name": best_model_name,

        "current_vehicles": current_vehicles,

        "current_congestion": current_level,

        "predicted_vehicles": predicted_vehicles,

        "predicted_congestion": predicted_level,

        "prediction_minutes": PREDICTION_MINUTES,

        "linear_regression_mae": round(
            linear_mae,
            2
        ),

        "random_forest_mae": round(
            rf_mae,
            2
        ),

        "best_model_mae": round(
            best_mae,
            2
        ),

        "training_samples": len(X_train),

        "testing_samples": len(X_test)

    }