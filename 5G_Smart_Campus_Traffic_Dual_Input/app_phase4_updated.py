import os
import tempfile
from pathlib import Path

import cv2
import pandas as pd
import plotly.express as px
import streamlit as st
from streamlit_webrtc import webrtc_streamer, WebRtcMode


from src.congestion_analyzer import analyze_congestion, get_congestion_description
from src.traffic_predictor import TrafficHistoryLogger, HISTORY_FILE, train_and_predict

from src.traffic_processor import (
    TrafficProcessor,
    ExternalCameraProcessor,
    get_shared_state,
    reset_shared_state,
    process_uploaded_video,
)

from src.alert_manager import (
    get_alert_status,
    save_alert,
    get_alert_history,
)

st.set_page_config(
    page_title="5G Smart Campus Traffic Analytics",
    page_icon="🚦",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    .stApp { background: #f4f7fb; }
    [data-testid="stSidebar"] { background: #101b2d; }
    [data-testid="stSidebar"] * { color: #f4f7fb !important; }
    .main-title {
        font-size: 2rem;
        font-weight: 800;
        color: #14213d;
        margin-bottom: 0;
    }
    .sub-title {
        color: #64748b;
        margin-top: .2rem;
    }
    div[data-testid="stMetric"] {
        background: white;
        border: 1px solid #e5eaf2;
        padding: 15px;
        border-radius: 14px;
        box-shadow: 0 2px 8px rgba(15,23,42,.04);
    }
    .stAlert {
        border-radius: 12px;
    }
</style>
""", unsafe_allow_html=True)


LIVE_LABELS = [
    ("Cars", "car"),
    ("Motorcycles", "motorcycle"),
    ("Buses", "bus"),
    ("Trucks", "truck"),
    ("Bicycles", "bicycle"),
    ("Pedestrians", "person"),
]


state = get_shared_state()


# =====================================================
# COMMON LIVE DASHBOARD
# =====================================================



def get_history_logger():
    if "traffic_history_logger" not in st.session_state:
        st.session_state["traffic_history_logger"] = TrafficHistoryLogger()

    return st.session_state["traffic_history_logger"]


def render_phase5_dashboard(live_counts):

    st.divider()
    st.markdown("## 🚨 Phase 5 - Traffic Alerts & Analytics")

    alert = get_alert_status(live_counts)
    save_alert(alert)

    level = alert["congestion_level"]

    if level == "HIGH":
        st.error(f"🔴 HIGH CONGESTION: {alert['alert_message']}")

    elif level == "MODERATE":
        st.warning(f"🟡 MODERATE CONGESTION: {alert['alert_message']}")

    else:
        st.success(f"🟢 LOW CONGESTION: {alert['alert_message']}")

    col1, col2, col3 = st.columns(3)

    col1.metric("Objects Detected", alert["object_count"])
    col2.metric("Traffic Score", alert["traffic_score"])
    col3.metric("Congestion", level)

    st.markdown("### 📋 Alert History")

    history = get_alert_history()

    if history:

        history_df = pd.DataFrame(history)

        st.dataframe(
            history_df,
            use_container_width=True,
            hide_index=True
        )

        st.markdown("### 📈 Congestion Analytics")

        level_counts = (
            history_df["congestion_level"]
            .value_counts()
            .reset_index()
        )

        level_counts.columns = [
            "Congestion Level",
            "Number of Alerts"
        ]

        fig = px.bar(
            level_counts,
            x="Congestion Level",
            y="Number of Alerts",
            color="Congestion Level",
            title="Congestion Distribution"
        )

        st.plotly_chart(fig, use_container_width=True)

    else:
        st.info("No alert history available.")


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

        elif level == "NO DATA":
            st.info("⚪ NO DATA - Waiting for vehicle detections.")

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
                round(prediction.get("predicted_vehicles", 0))
            )

            p2.metric(
                "Predicted Congestion",
                prediction.get("predicted_congestion", "Unknown")
            )

            p3.metric(
                "Selected Model",
                prediction.get("model_name", "Unknown")
            )

        else:
            st.info(
                prediction.get(
                    "message",
                    "Not enough traffic data available."
                )
            )



def render_live_dashboard(snapshot):

    counts = snapshot.get("counts", {})
    live_counts = snapshot.get("live_counts", {})

    total_crossings = sum(counts.values())
    live_total = sum(live_counts.values())

    # TOP SUMMARY
    st.markdown("### 📊 Live Count Summary")

    a, b, c = st.columns(3)

    a.metric(
        "Total Crossings",
        total_crossings
    )

    b.metric(
        "Objects Detected Now",
        live_total
    )

    c.metric(
        "Currently Tracked",
        snapshot.get("current_objects", 0)
    )

    st.divider()

    # =================================================
    # CATEGORY-WISE LIVE DETECTION
    # =================================================

    st.markdown("### 🔍 Category-wise Live Detection")

    st.caption(
        "These values represent objects detected in the current camera frame."
    )

    live_cols = st.columns(2)

    for i, (label, key) in enumerate(LIVE_LABELS):

        live_value = live_counts.get(key, 0)

        live_cols[i % 2].metric(
            label,
            live_value
        )

    st.divider()

    # =================================================
    # CATEGORY-WISE TOTAL CROSSINGS
    # =================================================

    st.markdown("### 🚦 Category-wise Total Line Crossings")

    st.caption(
        "Cumulative number of unique tracked objects that have crossed "
        "the red counting line since the camera was started or counts were reset."
    )

    crossing_cols = st.columns(2)

    for i, (label, key) in enumerate(LIVE_LABELS):

        crossed_value = counts.get(key, 0)

        crossing_cols[i % 2].metric(
            f"{label} Crossed",
            crossed_value
        )

    # CROSSING GRAPH

    crossing_df = pd.DataFrame([
        {
            "Category": label,
            "Total Crossings": counts.get(key, 0)
        }
        for label, key in LIVE_LABELS
    ])

    fig = px.bar(
        crossing_df,
        x="Category",
        y="Total Crossings",
        text="Total Crossings",
        title="Category-wise Cumulative Line Crossings",
        color="Category"
    )

    fig.update_layout(
        showlegend=False,
        height=300,
        margin=dict(l=10, r=10, t=45, b=10),
        paper_bgcolor="white",
        plot_bgcolor="white"
    )

    st.plotly_chart(
        fig,
        use_container_width=True
    )

    st.caption(
        f"Model Status: {snapshot.get('model_status', 'Unknown')}"
    )

    if snapshot.get("last_error"):
        st.error(snapshot["last_error"])

    # Phase 4 dashboard
    render_phase4_dashboard(live_counts)

    # Phase 5 dashboard
    render_phase5_dashboard(live_counts)



# =====================================================
# SESSION STATE
# =====================================================

if "external_camera" not in st.session_state:
    st.session_state.external_camera = None

if "external_camera_source_key" not in st.session_state:
    st.session_state.external_camera_source_key = None


# =====================================================
# SIDEBAR
# =====================================================

with st.sidebar:

    st.markdown("## 🚦 Campus Traffic")

    st.caption(
        "5G Smart Campus Traffic and Mobility Analytics"
    )

    page = st.radio(
        "Navigation",
        ["Traffic Monitoring", "Project Overview"]
    )

    st.divider()

    st.markdown("### Current Implementation")

    st.success("Phase 1 · Camera / Video Input")

    st.success("Phase 2 · YOLOv8 Detection")

    st.success("Phase 3 · ByteTrack + Counting")
    st.success("Phase 4 · Congestion Analysis + Prediction")

    st.info(
        "Congestion prediction and 5G/MEC integration are planned for later."
    )


# =====================================================
# MAIN TITLE
# =====================================================

st.markdown(
    '<p class="main-title">5G Smart Campus Traffic Analytics</p>',
    unsafe_allow_html=True
)

st.markdown(
    '<p class="sub-title">Laptop webcam · External USB/IP CCTV · Uploaded video · Detection · Tracking · Counting</p>',
    unsafe_allow_html=True
)


# =====================================================
# PROJECT OVERVIEW
# =====================================================

if page == "Project Overview":

    st.markdown("### Project Objective")

    st.write(
        "The system detects people and vehicles, assigns tracking IDs, "
        "and counts each tracked object when it crosses a virtual line. "
        "Test it with the laptop webcam, external USB/IP CCTV, or uploaded video."
    )

    st.markdown("### Processing Architecture")

    st.code(
        "Laptop Webcam / USB CCTV / IP CCTV (RTSP) / Uploaded Video\n"
        "                         ↓\n"
        "                       OpenCV\n"
        "                         ↓\n"
        "                       YOLOv8\n"
        "                         ↓\n"
        "                      ByteTrack\n"
        "                         ↓\n"
        "            Virtual Line Crossing + Counting\n"
        "                         ↓\n"
        "                 Streamlit Dashboard",
        language="text"
    )

    st.markdown("### Supported Object Classes")

    st.write(
        "Cars, motorcycles, buses, trucks, bicycles and pedestrians."
    )

    st.warning(
        "This is currently a local prototype. Real 5G transmission, "
        "MEC deployment, congestion estimation and prediction are not implemented."
    )


# =====================================================
# TRAFFIC MONITORING
# =====================================================

else:

    mode = st.radio(
        "Choose input source",
        ["📹 Live Camera", "📁 Upload Video"],
        horizontal=True,
        key="input_mode"
    )

    st.divider()

    # =================================================
    # LIVE CAMERA
    # =================================================

    if mode == "📹 Live Camera":

        camera_source = st.radio(
            "Select Camera Device",
            [
                "Laptop Camera (Built-in)",
                "External USB Camera",
                "Sparsh IP CCTV (RTSP)"
            ],
            horizontal=True,
            key="camera_device_type"
        )

        # ---------------------------------------------
        # LAPTOP CAMERA
        # ---------------------------------------------

        if camera_source == "Laptop Camera (Built-in)":

            if st.session_state.external_camera is not None:

                st.session_state.external_camera.stop()

                st.session_state.external_camera = None

                st.session_state.external_camera_source_key = None

            left, right = st.columns([1.7, 1])

            with left:

                st.markdown("### 💻 Laptop Webcam Monitoring")

                st.caption(
                    "Press START and allow camera access in your browser."
                )

                ctx = webrtc_streamer(
                    key="campus-traffic-webcam-dual",
                    mode=WebRtcMode.SENDRECV,
                    video_processor_factory=lambda: TrafficProcessor(state),
                    media_stream_constraints={
                        "video": True,
                        "audio": False
                    },
                    async_processing=True
                )

                if ctx.state.playing:

                    st.success(
                        "Laptop camera is running. Objects crossing the red line are counted."
                    )

                else:

                    st.info(
                        "Camera is stopped. Press START above the video to begin."
                    )

            with right:

                @st.fragment(run_every="1s")
                def show_laptop_metrics():

                    render_live_dashboard(
                        state.snapshot()
                    )

                show_laptop_metrics()

        # ---------------------------------------------
        # EXTERNAL USB / SPARSH CCTV
        # ---------------------------------------------

        else:

            st.markdown("### 🎥 External Camera Monitoring")

            if camera_source == "External USB Camera":

                usb_index = st.selectbox(
                    "External USB Camera Device Index",
                    options=[1, 2, 3, 4, 5],
                    index=0,
                    help="External USB camera ka device index select karein."
                )

                source_value = int(usb_index)

                source_key = f"usb:{usb_index}"

                camera_name = f"External USB Camera (index {usb_index})"

            else:

                rtsp_url = st.text_input(
                    "Sparsh CCTV RTSP URL",
                    type="password",
                    placeholder="rtsp://username:password@camera-ip:554/stream1",
                    help="Actual RTSP path camera/DVR/NVR model par depend karta hai."
                )

                source_value = rtsp_url.strip()

                source_key = f"rtsp:{source_value}"

                camera_name = "Sparsh IP CCTV"

            c1, c2 = st.columns(2)

            with c1:

                start_clicked = st.button(
                    "▶ Start External Camera",
                    type="primary",
                    use_container_width=True
                )

            with c2:

                stop_clicked = st.button(
                    "■ Stop External Camera",
                    use_container_width=True
                )

            # STOP CAMERA

            if stop_clicked:

                if st.session_state.external_camera is not None:

                    st.session_state.external_camera.stop()

                st.session_state.external_camera = None

                st.session_state.external_camera_source_key = None

                st.success("External camera stopped.")

            # START CAMERA

            if start_clicked:

                if camera_source == "Sparsh IP CCTV" and not source_value:

                    st.warning(
                        "Please enter the CCTV RTSP URL first."
                    )

                else:

                    if st.session_state.external_camera is not None:

                        st.session_state.external_camera.stop()

                    reset_shared_state()

                    camera = ExternalCameraProcessor(
                        shared_state=state,
                        camera_source=source_value,
                        camera_name=camera_name
                    )

                    try:

                        camera.start()

                        st.session_state.external_camera = camera

                        st.session_state.external_camera_source_key = source_key

                        st.success(
                            f"Connecting to {camera_name}..."
                        )

                    except Exception as exc:

                        st.session_state.external_camera = None

                        st.error(
                            f"Camera connection failed: {type(exc).__name__}: {exc}"
                        )

            # CAMERA FRAME

            @st.fragment(run_every="0.3s")
            def show_external_camera():

                camera = st.session_state.get("external_camera")

                if camera is None:

                    st.info(
                        "Select a camera and press Start External Camera."
                    )

                    return

                frame = camera.get_frame()

                if frame is not None:

                    st.image(
                        cv2.cvtColor(frame, cv2.COLOR_BGR2RGB),
                        channels="RGB",
                        use_container_width=True
                    )

                else:

                    st.info(
                        "Camera connected. Waiting for video frames..."
                    )

            left, right = st.columns([1.7, 1])

            with left:

                st.markdown("#### Live Camera Feed")

                show_external_camera()

            with right:

                @st.fragment(run_every="1s")
                def show_external_metrics():

                    render_live_dashboard(
                        state.snapshot()
                    )

                show_external_metrics()

            # RESET COUNTS

            if st.button("↻ Reset External Camera Counts"):

                reset_shared_state()

                st.rerun()

            st.caption(
                "USB camera ke liye device index select karein. "
                "IP CCTV ke liye valid RTSP URL aur reachable network required hai."
            )

    # =================================================
    # UPLOADED VIDEO
    # =================================================

    else:

        if st.session_state.external_camera is not None:

            st.session_state.external_camera.stop()

            st.session_state.external_camera = None

            st.session_state.external_camera_source_key = None

        st.markdown("### 📁 Upload a Traffic Video")

        uploaded_file = st.file_uploader(
            "Choose Video",
            type=["mp4", "avi", "mov", "mkv"],
            accept_multiple_files=False,
            help="Recommended: a short traffic video (10–60 seconds)."
        )

        if uploaded_file is not None:

            st.video(uploaded_file)

            st.caption(
                f"Selected file: {uploaded_file.name} · "
                f"{uploaded_file.size / (1024 * 1024):.2f} MB"
            )

            if st.button(
                "▶ Process Uploaded Video",
                type="primary"
            ):

                suffix = Path(uploaded_file.name).suffix.lower() or ".mp4"

                with tempfile.NamedTemporaryFile(
                    delete=False,
                    suffix=suffix
                ) as input_tmp:

                    input_tmp.write(
                        uploaded_file.getbuffer()
                    )

                    input_path = input_tmp.name

                output_path = str(
                    Path(tempfile.gettempdir()) /
                    f"campus_traffic_annotated_{os.getpid()}.mp4"
                )

                progress = st.progress(
                    0,
                    text="Preparing video..."
                )

                status = st.empty()

                def update_progress(value, message):

                    progress.progress(
                        min(max(int(value), 0), 100),
                        text=message
                    )

                    status.write(message)

                try:

                    result = process_uploaded_video(
                        input_path=input_path,
                        output_path=output_path,
                        progress_callback=update_progress
                    )

                    st.session_state["uploaded_video_result"] = {
                        "output_path": output_path,
                        "counts": result["counts"],
                        "unique_objects": result["unique_objects"],
                        "frames": result["frames"],
                        "fps": result["fps"],
                        "duration": result["duration"],
                        "filename": uploaded_file.name
                    }

                    progress.progress(
                        100,
                        text="Video processing completed."
                    )

                    status.success(
                        "Video analysis completed successfully."
                    )

                except Exception as exc:

                    st.error(
                        f"Video processing failed: {type(exc).__name__}: {exc}"
                    )

                finally:

                    try:
                        os.remove(input_path)

                    except OSError:
                        pass

        # VIDEO RESULT

        result = st.session_state.get("uploaded_video_result")

        if result:

            st.divider()

            st.markdown("## 📊 Video Analysis Result")

            st.caption(
                f"Processed: {result['filename']} · "
                f"{result['frames']} frames · "
                f"{result['fps']:.1f} FPS · "
                f"{result['duration']:.1f} seconds"
            )

            total_crossings = sum(
                result["counts"].values()
            )

            m1, m2, m3 = st.columns(3)

            m1.metric(
                "Total Line Crossings",
                total_crossings
            )

            m2.metric(
                "Unique Tracked Objects",
                result["unique_objects"]
            )

            m3.metric(
                "Frames Processed",
                result["frames"]
            )

            st.markdown("### Category-wise Total Line Crossings")

            count_df = pd.DataFrame([
                {
                    "Category": label,
                    "Total Crossings": result["counts"].get(key, 0)
                }
                for label, key in LIVE_LABELS
            ])

            chart_col, table_col = st.columns([1.5, 1])

            with chart_col:

                fig = px.bar(
                    count_df,
                    x="Category",
                    y="Total Crossings",
                    text="Total Crossings",
                    title="Category-wise Line Crossing Count",
                    color="Category"
                )

                fig.update_layout(
                    showlegend=False,
                    height=360,
                    margin=dict(l=10, r=10, t=45, b=10),
                    paper_bgcolor="white",
                    plot_bgcolor="white"
                )

                st.plotly_chart(
                    fig,
                    use_container_width=True
                )

            with table_col:

                st.markdown("#### Count Summary")

                st.dataframe(
                    count_df,
                    hide_index=True,
                    use_container_width=True
                )

            output_path = result["output_path"]

            if os.path.exists(output_path):

                st.markdown("### 🎬 Processed Video")

                st.video(output_path)

                with open(output_path, "rb") as video_file:

                    st.download_button(
                        "⬇ Download Annotated Video",
                        data=video_file.read(),
                        file_name="campus_traffic_annotated.mp4",
                        mime="video/mp4"
                    )

            st.caption(
                "Uploaded-video counts are based on objects crossing the virtual line. "
                "Each tracked ID is counted only once."
            )


# =====================================================
# FOOTER
# =====================================================

st.markdown("---")

st.caption(
    "Prototype scope: Phase 1–3 only | "
    "Laptop webcam + External USB/IP CCTV + Uploaded video | "
    "5G/MEC integration planned for a later phase"
)
