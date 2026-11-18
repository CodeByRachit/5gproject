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
                "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay|max_delay;500000|probesize;32768|analyzeduration;500000|stimeout;5000000"
            )
            self.cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
            if not self.cap.isOpened():
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
    
    # Curb/grass sides
    img[0:80, :] = (24, 40, 24)
    img[640:720, :] = (24, 40, 24)
    img[80:88, :] = (180, 180, 180)
    img[632:640, :] = (180, 180, 180)

    # Road dashed lanes
    dash_length = 50
    gap = 30
    cycle = dash_length + gap
    for x in range(0, w, cycle):
        img[358:362, x:min(x + dash_length, w)] = (240, 240, 240)

    # Moving vehicles for simulated demo
    # Car 1: moving left to right
    car1_x = int((frame_count * 7) % (w + 180)) - 120
    car1_y = 440
    if -120 < car1_x < w + 120:
        cv2.rectangle(img, (car1_x, car1_y), (car1_x + 120, car1_y + 60), (200, 130, 40), -1)
        cv2.rectangle(img, (car1_x, car1_y), (car1_x + 120, car1_y + 60), (255, 255, 255), 2)
        cv2.putText(img, "CAR", (car1_x + 16, car1_y + 38), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    # Bus 1: moving right to left
    bus1_x = w - int((frame_count * 5) % (w + 240)) + 80
    bus1_y = 170
    if -220 < bus1_x < w + 100:
        cv2.rectangle(img, (bus1_x, bus1_y), (bus1_x + 190, bus1_y + 75), (40, 120, 220), -1)
        cv2.rectangle(img, (bus1_x, bus1_y), (bus1_x + 190, bus1_y + 75), (255, 255, 255), 2)
        cv2.putText(img, "BUS", (bus1_x + 24, bus1_y + 48), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    # Motorcycle
    bike_x = int((frame_count * 10) % (w + 120)) - 60
    bike_y = 540
    if -60 < bike_x < w + 60:
        cv2.rectangle(img, (bike_x, bike_y), (bike_x + 55, bike_y + 30), (80, 200, 80), -1)
        cv2.putText(img, "MOTO", (bike_x + 6, bike_y + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)

    # OSD Header
    timestamp_str = time.strftime("%Y-%m-%d  %H:%M:%S", time.localtime())
    cv2.putText(img, f"SPARSH IP CCTV [GATE-01 CHECKPOINT]  {timestamp_str}", (20, 36),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255), 2, cv2.LINE_AA)
    
    cv2.putText(img, "5G CAMPUS TRAFFIC MONITORING", (w - 380, h - 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1, cv2.LINE_AA)

    return img

def main():
    args = parse_args()
    source = args.source

    import cv2

    use_simulation = args.simulate or args.ip.lower() in ["simulate", "demo"]
    reader = None

    if not use_simulation:
        is_usb = source.isdigit()

        # Pre-check IP reachability if IP and port provided
        if not is_usb and args.ip and args.port:
            if not is_port_reachable(args.ip, args.port, timeout=3.0):
                if args.ip in ["127.0.0.1", "localhost"]:
                    use_simulation = True
                else:
                    sys.stderr.write(json.dumps({
                        "status": "error",
                        "message": f"Could not reach camera at {args.ip}:{args.port}. Check camera network cable and power."
                    }) + "\n")
                    sys.stderr.flush()
                    sys.exit(1)

        if not use_simulation:
            reader = FreshFrameReader(source, is_usb=is_usb)
            started = reader.start()

            if not started:
                sys.stderr.write(json.dumps({
                    "status": "error",
                    "message": "Failed to connect to camera. Check RTSP URL or USB index."
                }) + "\n")
                sys.stderr.flush()
                sys.exit(1)

            # Verify actual video frames arrive within ~4 seconds
            verified_frame = None
            for _ in range(35):
                frame, _, _, _ = reader.get_latest_frame()
                if frame is not None and frame.size > 0:
                    verified_frame = frame
                    break
                time.sleep(0.12)

            if verified_frame is None:
                sys.stderr.write(json.dumps({
                    "status": "error",
                    "message": "Connection opened, but no video frames could be decoded from camera. Check H.264 stream settings."
                }) + "\n")
                sys.stderr.flush()
                reader.stop()
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
