#!/usr/bin/env python3
"""
===================================================================================
 🚦 5G Smart Campus Traffic Monitoring - Laptop Camera Ingest Streamer
 Connects to Sparsh IP CCTV (or USB Camera) on this laptop and streams video frames
 to the 5G Edge Server for real-time YOLOv8 detection & mobility analytics.
 
 Zero SSH password, zero sudo, zero server network configuration required!
===================================================================================
"""

import sys
import os
import time
import argparse
import base64

def check_dependencies():
    missing = []
    try:
        import cv2
    except ImportError:
        missing.append("opencv-python")
    try:
        import requests
    except ImportError:
        missing.append("requests")
    if missing:
        print(f"[!] Missing required Python packages: {', '.join(missing)}")
        print(f"[*] Install them with: pip3 install {' '.join(missing)}")
        sys.exit(1)

check_dependencies()
import cv2
import requests

def parse_args():
    parser = argparse.ArgumentParser(
        description="Stream local Sparsh CCTV / USB camera from this laptop to the 5G Edge Server"
    )
    parser.add_argument(
        "--server",
        type=str,
        default="",
        help="5G Server URL (e.g. http://192.168.1.100:5000 or http://SERVER_IP:5000)",
    )
    parser.add_argument(
        "--camera-ip",
        type=str,
        default="192.168.128.10",
        help="Sparsh CCTV IP address (default: 192.168.128.10)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=554,
        help="RTSP port (default: 554)",
    )
    parser.add_argument(
        "--username",
        type=str,
        default="admin",
        help="Camera username (default: admin)",
    )
    parser.add_argument(
        "--password",
        type=str,
        default="",
        help="Camera password",
    )
    parser.add_argument(
        "--stream-path",
        type=str,
        default="/avstream/channel=1/stream=0.sdp",
        help="RTSP stream path (default: /avstream/channel=1/stream=0.sdp)",
    )
    parser.add_argument(
        "--usb",
        type=int,
        default=-1,
        help="Use USB camera index instead of RTSP (e.g. --usb 0)",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=12,
        help="Target streaming frame rate (default: 12 FPS)",
    )
    parser.add_argument(
        "--camera-id",
        type=str,
        default="external_camera",
        help="Target Camera ID on dashboard (default: external_camera)",
    )
    return parser.parse_args()

def main():
    args = parse_args()

    # Prompt for server URL if not provided
    server_url = args.server.strip()
    while not server_url:
        print("\n==================================================================")
        print(" 📡 Enter your 5G Edge Server IP or URL")
        print("    (As shown in the output of ./run-native.sh on your server)")
        print("==================================================================")
        val = input("5G Server URL [e.g. http://10.0.0.1:5000 or IP]: ").strip()
        if val:
            if not val.startswith("http://") and not val.startswith("https://"):
                if ":" in val:
                    val = f"http://{val}"
                else:
                    val = f"http://{val}:5000"
            server_url = val

    server_url = server_url.rstrip("/")
    api_endpoint = f"{server_url}/api/detection/detect-frame"

    print("\n" + "=" * 66)
    print(" 🚦 5G Smart Campus Traffic Monitoring - Local Camera Streamer")
    print("=" * 66)
    print(f"[*] Target 5G Server:   {server_url}")
    print(f"[*] Ingest Endpoint:    {api_endpoint}")

    # Determine camera source
    is_usb = args.usb >= 0
    if is_usb:
        source = args.usb
        source_desc = f"Local USB Camera (Index #{args.usb})"
    else:
        clean_user = args.username
        clean_pass = args.password
        clean_ip = args.camera_ip
        clean_port = args.port
        raw_path = args.stream_path if args.stream_path.startswith("/") else f"/{args.stream_path}"
        if clean_pass:
            source = f"rtsp://{clean_user}:{clean_pass}@{clean_ip}:{clean_port}{raw_path}"
            sanitized = f"rtsp://{clean_user}:***@{clean_ip}:{clean_port}{raw_path}"
        else:
            source = f"rtsp://{clean_user}@{clean_ip}:{clean_port}{raw_path}"
            sanitized = source
        source_desc = f"Sparsh CCTV ({sanitized})"

    print(f"[*] Camera Source:      {source_desc}")
    print(f"[*] Target Ingest Rate: {args.fps} FPS")
    print("=" * 66)

    # Verify 5G Server API Health
    print(f"[*] Testing connection to 5G Edge Server at {server_url}...")
    try:
        health_resp = requests.get(f"{server_url}/api/health", timeout=5)
        if health_resp.status_code == 200:
            print("[✓] 5G Edge Server is ONLINE and reachable!")
        else:
            print(f"[!] Server returned status {health_resp.status_code}. Proceeding anyway...")
    except Exception as e:
        print(f"[!] Warning: Could not reach {server_url}/api/health ({e})")
        print("    Ensure your 5G server is running and port 5000 is accessible.")
        proceed = input("    Attempt to stream anyway? (y/n) [y]: ").strip().lower()
        if proceed == "n":
            sys.exit(1)

    # Open Camera with OpenCV
    print(f"\n[*] Connecting to {source_desc}...")
    if not is_usb:
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
            "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay|max_delay;500000|probesize;32768|analyzeduration;500000|stimeout;5000000"
        )
        cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
        if not cap or not cap.isOpened():
            if cap:
                cap.release()
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
                "rtsp_transport;udp|fflags;nobuffer|flags;low_delay|max_delay;500000|probesize;32768|analyzeduration;500000|stimeout;5000000"
            )
            cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
        if not cap or not cap.isOpened():
            if cap:
                cap.release()
            cap = cv2.VideoCapture(source)
    else:
        cap = cv2.VideoCapture(source)

    if not cap or not cap.isOpened():
        print(f"\n[ERROR] Failed to open camera: {source_desc}")
        print("  • If Sparsh CCTV: Verify Ethernet cable is plugged into this laptop.")
        print(f"  • Verify your laptop has an IP on {args.camera_ip} subnet (e.g. 192.168.128.99).")
        print("  • Verify camera power adapter / POE is connected and powered ON.")
        sys.exit(1)

    print("[✓] Camera stream successfully opened and active!")
    print("\n" + "=" * 66)
    print(" 🚀 Streaming Live Camera Frames to 5G Edge Server...")
    print("    Open your 5G Dashboard at: " + server_url)
    print("    Press Ctrl+C to stop streaming anytime.")
    print("=" * 66 + "\n")

    frame_interval = 1.0 / max(1, args.fps)
    frame_count = 0
    consecutive_errors = 0
    session = requests.Session()

    try:
        while True:
            t0 = time.time()
            ret, frame = cap.read()
            if not ret or frame is None or frame.size == 0:
                time.sleep(0.02)
                continue

            frame_count += 1

            # Downscale for optimal 5G streaming balance (1280x720 HD)
            target_w, target_h = 1280, 720
            if frame.shape[1] != target_w or frame.shape[0] != target_h:
                frame_resized = cv2.resize(frame, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
            else:
                frame_resized = frame

            # Encode frame to JPEG
            ok, buf = cv2.imencode(".jpg", frame_resized, [cv2.IMWRITE_JPEG_QUALITY, 75])
            if not ok:
                continue

            # Convert to base64 Data URL
            base64_jpg = base64.b64encode(buf.tobytes()).decode("ascii")
            data_url = f"data:image/jpeg;base64,{base64_jpg}"

            # Transmit frame to 5G Edge Server for YOLOv8 & ByteTrack inference
            req_start = time.time()
            try:
                payload = {
                    "image": data_url,
                    "cameraId": args.camera_id,
                }
                resp = session.post(api_endpoint, json=payload, timeout=2.5)
                roundtrip_ms = int((time.time() - req_start) * 1000)

                if resp.status_code == 200:
                    consecutive_errors = 0
                    res_data = resp.json()
                    dets = res_data.get("detections", [])
                    congestion = res_data.get("congestionLevel", "LOW")
                    total_cross = res_data.get("totalCrossings", 0)

                    # Summarize detected classes
                    class_summary = {}
                    for d in dets:
                        lbl = d.get("label", "object")
                        class_summary[lbl] = class_summary.get(lbl, 0) + 1
                    det_str = ", ".join([f"{k}: {v}" for k, v in class_summary.items()]) if class_summary else "No vehicles"

                    print(
                        f"\r[5G Edge Ingest] Frame #{frame_count:04d} | "
                        f"5G Latency: {roundtrip_ms:3d}ms | "
                        f"Detections ({len(dets)}): {det_str:<25} | "
                        f"Congestion: {congestion:<6} | Crossings: {total_cross}",
                        end="",
                        flush=True,
                    )
                else:
                    consecutive_errors += 1
                    if consecutive_errors % 20 == 1:
                        print(f"\n[!] Server error ({resp.status_code}): {resp.text[:80]}")
            except Exception as net_err:
                consecutive_errors += 1
                if consecutive_errors % 20 == 1:
                    print(f"\n[!] Network error sending frame to 5G Server: {net_err}")

            # Maintain smooth target FPS
            elapsed = time.time() - t0
            sleep_time = max(0.005, frame_interval - elapsed)
            time.sleep(sleep_time)

    except KeyboardInterrupt:
        print("\n\n[*] Stream stopped by user.")
    finally:
        cap.release()
        print("[✓] Camera closed. Goodbye!")

if __name__ == "__main__":
    main()
