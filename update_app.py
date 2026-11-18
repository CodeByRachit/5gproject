from pathlib import Path

source = Path("app.py")
output = Path("app_phase4_updated.py")

code = source.read_text(encoding="utf-8")

imports = """
from src.congestion_analyzer import analyze_congestion, get_congestion_description
from src.traffic_predictor import TrafficHistoryLogger, HISTORY_FILE, train_and_predict
"""

anchor = "from src.traffic_processor import ("

if "from src.congestion_analyzer import" not in code:
    if anchor not in code:
        raise ValueError("traffic_processor import block not found.")

    code = code.replace(anchor, imports + "\n" + anchor, 1)

# Phase 4 dashboard code
helper = r'''

def get_history_logger():
    if "traffic_history_logger" not in st.session_state:
        st.session_state["traffic_history_logger"] = TrafficHistoryLogger()

    return st.session_state["traffic_history_logger"]


def render_phase4_dashboard(live_counts):

    st.divider()
    st.markdown("## 🚦 Phase 4 - Congestion Analysis & Prediction")

    try:
        get_history_logger().save_observation(live_counts)

        result = analyze_congestion(live_counts)

        level = result.get("congestion_level", "UNKNOWN")
        total = result.get("total_vehicles", 0)
        score = result.get("weighted_score", 0)

        if level == "LOW":
            st.success("🟢 LOW CONGESTION")

        elif level == "MODERATE":
            st.warning("🟡 MODERATE CONGESTION")

        elif level == "HIGH":
            st.error("🔴 HIGH CONGESTION")

        c1, c2, c3 = st.columns(3)

        c1.metric("Vehicles Detected", total)
        c2.metric("Traffic Score", round(score, 2))
        c3.metric("Congestion Level", level)

        description = get_congestion_description(level)

        st.caption(description)

    except Exception as e:
        st.error(f"Congestion Error: {e}")

    st.divider()

    st.markdown("### 📈 Traffic History")

    if Path(HISTORY_FILE).exists():

        history = pd.read_csv(HISTORY_FILE)

        if not history.empty:

            history["timestamp"] = pd.to_datetime(
                history["timestamp"],
                errors="coerce"
            )

            history = history.dropna(subset=["timestamp"])

            if not history.empty:
                st.line_chart(
                    history.set_index("timestamp")[["vehicle_count"]]
                )

    else:
        st.info("Traffic history is being collected.")

    st.divider()

    st.markdown("### 🔮 Future Traffic Prediction")

    if st.button("Train Models & Predict", key="phase4_predict"):

        with st.spinner("Training models..."):

            try:
                prediction = train_and_predict()

                st.session_state["phase4_prediction"] = prediction

            except Exception as e:
                st.error(f"Prediction Error: {e}")

    prediction = st.session_state.get("phase4_prediction")

    if prediction:

        if str(prediction.get("status", "")).lower() in (
            "success", "ok", "trained"
        ):

            p1, p2, p3 = st.columns(3)

            p1.metric(
                "Predicted Vehicles",
                round(prediction.get("prediction", 0))
            )

            p2.metric(
                "Predicted Congestion",
                prediction.get("congestion", "Unknown")
            )

            p3.metric(
                "Selected Model",
                prediction.get("best_model", "Unknown")
            )

        else:
            st.info(
                prediction.get(
                    "message",
                    "Not enough traffic data available."
                )
            )

'''

if "def render_phase4_dashboard(" not in code:

    marker = "def render_live_dashboard(snapshot):"

    if marker not in code:
        raise ValueError("Live dashboard function not found.")

    code = code.replace(marker, helper + "\n\n" + marker, 1)

    boundary = "\n\n# =====================================================\n# SESSION STATE"

    if boundary not in code:
        raise ValueError("SESSION STATE section not found.")

    before, after = code.split(boundary, 1)

    before = before.rstrip() + """

    # Phase 4 dashboard
    render_phase4_dashboard(live_counts)

"""

    code = before + boundary + after

code = code.replace(
    'st.success("Phase 3 · ByteTrack + Counting")',
    'st.success("Phase 3 · ByteTrack + Counting")\n'
    '    st.success("Phase 4 · Congestion Analysis + Prediction")',
    1
)

output.write_text(code, encoding="utf-8")

print("Updated app created successfully!")
print("File:", output)