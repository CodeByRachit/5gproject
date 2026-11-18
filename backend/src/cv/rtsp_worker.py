import sys
import os
import time
import json
import socket
import signal
import threading
import argparse
import numpy as np

# Force UTF-8 binary stream mode on Windows stdout
if sys.platform.startswith("win"):
    import msvcrt
    msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)

def parse_args():
    parser = argparse.ArgumentParser(description="OpenCV RTSP & USB Camera Streamer")
    parser.add_argument("--source", type=str, required=True, help="RTSP URL or USB Device Index")
    parser.add_argument("--ip", type=str, default="", help="Camera IP address")
    parser.add_argument("--port", type=int, default=554, help="RTSP Port")
    parser.add_argument("--simulate", action="store_true", help="Run simulated CCTV feed")
    return parser.parse_args()

def is_port_reachable(ip, port, timeout=3.0):
    try:
        s = socket.create_connection((ip, port), timeout=timeout)
        s.close()
        return True
    except Exception:
        return False

class FreshFrameReader:
    """
    High-performance threaded frame grabber.
    Continuously pulls the newest frame from the OpenCV RTSP/USB capture pipeline
    and discards outdated frames to ensure real-time, low-latency streaming.
    """
    def __init__(self, source, is_usb=False):
        self.source = source
        self.is_usb = is_usb
        self.cap = None
        self.latest_frame = None
        self.latest_time_ms = int(time.time() * 1000)
        self.frame_number = 0
        self.running = False
        self.lock = threading.Lock()
        self.thread = None
        self.fps = 0.0
        self._fps_count = 0
        self._fps_start = time.time()

    def start(self):
        import cv2
        if self.is_usb:
            usb_idx = int(self.source)
            self.cap = cv2.VideoCapture(usb_idx, cv2.CAP_DSHOW)
            if not self.cap.isOpened():
                self.cap.release()
                self.cap = cv2.VideoCapture(usb_idx)
        else:
            # Low latency and no-buffer capture options for RTSP over TCP
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
                "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay|max_delay;500000|probesize;32768|analyzeduration;500000|stimeout;8000000"
            )
            self.cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
            if not self.cap or not self.cap.isOpened():
                if self.cap:
                    self.cap.release()
                # Try UDP transport fallback for Sparsh RTSP cameras
                os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
                    "rtsp_transport;udp|fflags;nobuffer|flags;low_delay|max_delay;500000|probesize;32768|analyzeduration;500000|stimeout;8000000"
                )
                self.cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
            if not self.cap or not self.cap.isOpened():
                if self.cap:
                    self.cap.release()
                self.cap = cv2.VideoCapture(self.source)

        if not self.cap or not self.cap.isOpened():
            return False

        try:
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass

        self.running = True
        self.thread = threading.Thread(target=self._reader_loop, daemon=True)
        self.thread.start()
        return True

    def _reader_loop(self):
        while self.running and self.cap and self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret or frame is None or frame.size == 0:
                time.sleep(0.008)
                continue

            with self.lock:
                self.latest_frame = frame
                self.latest_time_ms = int(time.time() * 1000)
                self.frame_number += 1

            self._fps_count += 1
            now = time.time()
            if now - self._fps_start >= 1.0:
                self.fps = round(self._fps_count / (now - self._fps_start), 1)
                self._fps_count = 0
                self._fps_start = now

    def get_latest_frame(self):
        with self.lock:
            if self.latest_frame is None:
                return None, 0, 0, self.fps
            return self.latest_frame, self.frame_number, self.latest_time_ms, self.fps

    def stop(self):
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=1.0)
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass

def generate_simulated_frame(frame_count):
    import cv2
    w, h = 1280, 720
    img = np.zeros((h, w, 3), dtype=np.uint8)
    
    # Asphalt road
    img[:, :] = (38, 42, 48)
    
    # Sidewalks / grass curbs
    img[0:90, :] = (28, 46, 28)
    img[630:720, :] = (28, 46, 28)
    img[86:92, :] = (190, 190, 190)
    img[628:634, :] = (190, 190, 190)

    # Road dashed lane dividing markings
    dash_length = 50
    gap = 30
    cycle = dash_length + gap
    for x in range(0, w, cycle):
        img[358:362, x:min(x + dash_length, w)] = (240, 240, 240)

    # Crosswalk (Zebra stripes) at x: 980 to 1080
    for y_stripe in range(110, 610, 50):
        cv2.rectangle(img, (980, y_stripe), (1070, y_stripe + 30), (220, 220, 220), -1)

    # Virtual Line-Crossing guide line (y = 0.55 * 720 = 396)
    for lx in range(0, w, 24):
        cv2.line(img, (lx, 396), (min(w, lx + 14), 396), (0, 230, 255), 2)

    # Moving vehicles for simulated 5G demo
    # 1. Car: moving left to right, transitioning from y=340 to y=470 (crosses line 396 incoming)
    car_progress = ((frame_count * 7) % (w + 240)) / float(w + 240)
    car_x = int(car_progress * (w + 240) - 120)
    car_y = int(340 + car_progress * 130)
    if -120 < car_x < w + 60:
        # Shadow
        cv2.rectangle(img, (car_x - 4, car_y + 40), (car_x + 134, car_y + 68), (15, 18, 20), -1)
        # Car body
        cv2.rectangle(img, (car_x, car_y + 15), (car_x + 130, car_y + 60), (195, 120, 30), -1)
        # Car cabin / roof
        cv2.rectangle(img, (car_x + 25, car_y), (car_x + 95, car_y + 30), (225, 140, 45), -1)
        # Windshield & windows
        cv2.rectangle(img, (car_x + 30, car_y + 4), (car_x + 52, car_y + 20), (50, 75, 95), -1)
        cv2.rectangle(img, (car_x + 60, car_y + 4), (car_x + 88, car_y + 20), (50, 75, 95), -1)
        # Headlights / Taillights
        cv2.rectangle(img, (car_x + 125, car_y + 42), (car_x + 130, car_y + 54), (100, 255, 255), -1)
        cv2.rectangle(img, (car_x, car_y + 42), (car_x + 4, car_y + 54), (40, 40, 240), -1)
        # Wheels
        cv2.circle(img, (car_x + 28, car_y + 60), 12, (20, 20, 20), -1)
        cv2.circle(img, (car_x + 102, car_y + 60), 12, (20, 20, 20), -1)
        cv2.putText(img, "CAR", (car_x + 44, car_y + 44), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    # 2. Bus: moving right to left, transitioning from y=450 to y=330 (crosses line 396 outgoing)
    bus_progress = ((frame_count * 5) % (w + 300)) / float(w + 300)
    bus_x = int(w - bus_progress * (w + 300) + 100)
    bus_y = int(450 - bus_progress * 120)
    if -220 < bus_x < w + 80:
        # Shadow
        cv2.rectangle(img, (bus_x - 6, bus_y + 60), (bus_x + 206, bus_y + 88), (15, 18, 20), -1)
        # Bus body
        cv2.rectangle(img, (bus_x, bus_y), (bus_x + 200, bus_y + 75), (45, 125, 225), -1)
        # Bus windows
        for wx in range(bus_x + 15, bus_x + 175, 32):
            cv2.rectangle(img, (wx, bus_y + 12), (wx + 22, bus_y + 36), (60, 85, 110), -1)
        # Bus headlights
        cv2.rectangle(img, (bus_x, bus_y + 52), (bus_x + 5, bus_y + 66), (100, 255, 255), -1)
        # Bus wheels
        cv2.circle(img, (bus_x + 40, bus_y + 76), 15, (20, 20, 20), -1)
        cv2.circle(img, (bus_x + 160, bus_y + 76), 15, (20, 20, 20), -1)
        cv2.putText(img, "CAMPUS SHUTTLE", (bus_x + 28, bus_y + 56), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    # 3. Motorcycle: fast moving left to right along lower lane
    bike_progress = ((frame_count * 10) % (w + 160)) / float(w + 160)
    bike_x = int(bike_progress * (w + 160) - 80)
    bike_y = 540
    if -60 < bike_x < w + 40:
        # Wheels
        cv2.circle(img, (bike_x + 10, bike_y + 25), 8, (20, 20, 20), -1)
        cv2.circle(img, (bike_x + 48, bike_y + 25), 8, (20, 20, 20), -1)
        # Body & Rider
        cv2.line(img, (bike_x + 10, bike_y + 25), (bike_x + 30, bike_y + 12), (50, 180, 70), 3)
        cv2.line(img, (bike_x + 30, bike_y + 12), (bike_x + 48, bike_y + 25), (50, 180, 70), 3)
        # Rider helmet
        cv2.circle(img, (bike_x + 28, bike_y), 6, (240, 200, 40), -1)

    # OSD Header & 5G Telemetry Overlay
    timestamp_str = time.strftime("%Y-%m-%d  %H:%M:%S", time.localtime())
    cv2.putText(img, f"SPARSH CCTV [CHECKPOINT-01]  {timestamp_str}", (20, 36),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(img, "5G STANDALONE (NR-SA) | LOW LATENCY EDGE STREAM", (20, 68),
                cv2.FONT_HERSHEY_SIMPLEX, 0.48, (80, 220, 120), 1, cv2.LINE_AA)
    cv2.putText(img, "VIRTUAL COUNTING LINE (0.55)", (w - 360, 388),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 230, 255), 1, cv2.LINE_AA)

    return img

def main():
    args = parse_args()
    source = args.source

    import cv2

    use_simulation = args.simulate or args.ip.lower() in ["simulate", "demo"]
    reader = None

    if not use_simulation:
        is_usb = source.isdigit()

        # Non-blocking IP reachability check
        if not is_usb and args.ip and args.port:
            port_reachable = is_port_reachable(args.ip, args.port, timeout=4.0)
            if not port_reachable:
                if args.ip in ["127.0.0.1", "localhost", "simulate", "demo"]:
                    use_simulation = True
                else:
                    sys.stderr.write(json.dumps({
                        "status": "warning",
                        "message": f"TCP port probe to {args.ip}:{args.port} timed out. Attempting RTSP direct connection via FFmpeg..."
                    }) + "\n")
                    sys.stderr.flush()

        if not use_simulation:
            reader = FreshFrameReader(source, is_usb=is_usb)
            started = reader.start()

            # Verify actual video frames arrive within ~5 seconds
            verified_frame = None
            if started:
                for _ in range(40):
                    frame, _, _, _ = reader.get_latest_frame()
                    if frame is not None and frame.size > 0:
                        verified_frame = frame
                        break
                    time.sleep(0.12)

            if not started or verified_frame is None:
                if reader:
                    reader.stop()

                # Seamless auto-fallback to simulated 5G CCTV stream if physical camera unreachable
                auto_fallback = os.environ.get("AUTO_FALLBACK_SIMULATION", "1") == "1"
                if auto_fallback:
                    sys.stderr.write(json.dumps({
                        "status": "warning",
                        "message": f"Camera at {args.ip}:{args.port} unreachable. Switched to 5G Simulated CCTV feed for uninterrupted live demo."
                    }) + "\n")
                    sys.stderr.flush()
                    use_simulation = True
                else:
                    sys.stderr.write(json.dumps({
                        "status": "error",
                        "message": f"Could not reach camera at {args.ip}:{args.port}. Check camera network cable, power, and IP routing."
                    }) + "\n")
                    sys.stderr.flush()
                    sys.exit(1)

    # Frame dimensions
    if not use_simulation and verified_frame is not None:
        orig_h, orig_w = verified_frame.shape[:2]
    else:
        orig_w, orig_h = 1280, 720

    # Signal successful verified connection to Node.js backend
    sys.stderr.write(json.dumps({
        "status": "connected",
        "message": "Sparsh IP CCTV stream connected and verified",
        "simulated": use_simulation,
        "width": orig_w,
        "height": orig_h,
    }) + "\n")
    sys.stderr.flush()

    # Target 720p HD resolution: optimal balance of visual crispness and low latency
    target_w, target_h = 1280, 720
    frame_counter = 0
    last_frame_number = -1

    try:
        while True:
            capture_time_ms = int(time.time() * 1000)

            if use_simulation:
                frame = generate_simulated_frame(frame_counter)
                frame_counter += 1
                time.sleep(0.04) # ~25 FPS
            else:
                raw_frame, frame_num, cap_time, current_fps = reader.get_latest_frame()

                if raw_frame is None or frame_num == last_frame_number:
                    time.sleep(0.005) # Brief pause while waiting for freshest frame
                    continue

                last_frame_number = frame_num
                capture_time_ms = cap_time

                # Downscale 4K / high-resolution stream to 1280x720 HD for clear distant vehicle detection
                if raw_frame.shape[1] != target_w or raw_frame.shape[0] != target_h:
                    frame = cv2.resize(raw_frame, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
                else:
                    frame = raw_frame

                # Draw unobtrusive OSD timestamp banner at top edge
                timestamp_str = time.strftime("%Y-%m-%d  %H:%M:%S", time.localtime())
                cv2.putText(frame, f"SPARSH IP CCTV [GATE-01]  {timestamp_str}", (16, 26),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 255, 255), 2, cv2.LINE_AA)

            # Encode as high-quality JPEG
            ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ok:
                continue

            jpeg_bytes = buf.tobytes()
            length = len(jpeg_bytes)

            # Write 12-byte header: 8-byte capture timestamp (ms) + 4-byte length + JPEG bytes
            sys.stdout.buffer.write(capture_time_ms.to_bytes(8, byteorder="big", signed=True))
            sys.stdout.buffer.write(length.to_bytes(4, byteorder="big"))
            sys.stdout.buffer.write(jpeg_bytes)
            sys.stdout.buffer.flush()

    except (KeyboardInterrupt, BrokenPipeError):
        pass
    finally:
        if reader:
            reader.stop()

if __name__ == "__main__":
    main()
