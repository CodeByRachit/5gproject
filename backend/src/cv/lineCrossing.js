/**
 * 5G Smart Campus Virtual Line Crossing & Tracking Counter
 * Detects vehicle crossings, assigns tracking IDs, determines direction (incoming/outgoing),
 * and maintains synchronized category-wise vehicle statistics.
 */

export const VEHICLE_CLASSES = ['car', 'motorcycle', 'bus', 'truck', 'bicycle'];
export const isVehicle = (key) => VEHICLE_CLASSES.includes(key);

export const CLASS_KEYS = {
  0: 'person',
  1: 'bicycle',
  2: 'car',
  3: 'motorcycle',
  5: 'bus',
  7: 'truck',
};

export const DISPLAY_NAMES = {
  person: 'Pedestrian',
  bicycle: 'Bicycle',
  car: 'Car',
  motorcycle: 'Motorcycle',
  bus: 'Bus',
  truck: 'Truck',
};

export class LineCrossingTracker {
  constructor(linePositionRatio = 0.55) {
    this.linePositionRatio = linePositionRatio;
    this.previousY = new Map(); // trackId -> previous center_y
    this.countedIds = new Set(); // trackIds that have crossed
    this.uniqueObjects = new Set(); // all trackIds ever seen
    this.incomingCount = 0;
    this.outgoingCount = 0;
    this.recentCrossings = [];

    this.counts = {
      car: 0,
      motorcycle: 0,
      bus: 0,
      truck: 0,
      bicycle: 0,
      person: 0,
    };

    this.liveCounts = {
      car: 0,
      motorcycle: 0,
      bus: 0,
      truck: 0,
      bicycle: 0,
      person: 0,
    };

    this.currentObjects = 0;
  }

  setLineRatio(ratio) {
    const val = Number(ratio);
    if (!isNaN(val) && val > 0.05 && val < 0.95) {
      this.linePositionRatio = val;
    }
  }

  reset() {
    this.previousY.clear();
    this.countedIds.clear();
    this.uniqueObjects.clear();
    this.incomingCount = 0;
    this.outgoingCount = 0;
    this.recentCrossings = [];

    this.counts = {
      car: 0,
      motorcycle: 0,
      bus: 0,
      truck: 0,
      bicycle: 0,
      person: 0,
    };

    this.liveCounts = {
      car: 0,
      motorcycle: 0,
      bus: 0,
      truck: 0,
      bicycle: 0,
      person: 0,
    };

    this.currentObjects = 0;
  }

  /**
   * Process frame detections and update line-crossing counter.
   * @param {Array} detections - Array of { bbox: [x1, y1, x2, y2], classId, trackId, confidence, label }
   * @param {number} frameHeight - Height of video frame
   * @param {number} frameWidth - Width of video frame
   */
  processFrame(detections, frameHeight = 720, frameWidth = 1280) {
    const lineY = Math.floor(frameHeight * this.linePositionRatio);
    const activeFrameCounts = {
      car: 0,
      motorcycle: 0,
      bus: 0,
      truck: 0,
      bicycle: 0,
      person: 0,
    };
    const currentVehicleTrackIds = new Set();
    const currentPedestrianTrackIds = new Set();
    const newCrossingEvents = [];

    for (const det of detections) {
      const classKey = det.classKey || CLASS_KEYS[det.classId];
      if (!classKey || activeFrameCounts[classKey] === undefined) continue;

      activeFrameCounts[classKey] += 1;

      const trackId = det.trackId !== undefined ? Number(det.trackId) : -1;
      const [x1, y1, x2, y2] = det.bbox;
      const centerY = Math.floor((y1 + y2) / 2);
      const isVeh = isVehicle(classKey);

      if (trackId >= 0) {
        if (isVeh) {
          currentVehicleTrackIds.add(trackId);
          this.uniqueObjects.add(trackId);
        } else {
          currentPedestrianTrackIds.add(trackId);
        }

        const prevY = this.previousY.get(trackId);

        if (prevY !== undefined) {
          // Check if object crossed line between previous frame and current frame
          const crossedIncoming = prevY < lineY && centerY >= lineY; // Moving downward (Entering)
          const crossedOutgoing = prevY > lineY && centerY <= lineY; // Moving upward (Exiting)

          if ((crossedIncoming || crossedOutgoing) && !this.countedIds.has(trackId)) {
            this.countedIds.add(trackId);

            // Increment specific category count
            this.counts[classKey] = (this.counts[classKey] || 0) + 1;

            // STRICT: Only supported vehicle classes trigger vehicle crossings and direction updates!
            if (isVeh) {
              const direction = crossedIncoming ? 'incoming' : 'outgoing';
              if (crossedIncoming) {
                this.incomingCount += 1;
              } else {
                this.outgoingCount += 1;
              }

              const event = {
                trackId,
                classKey,
                label: DISPLAY_NAMES[classKey] || classKey,
                direction,
                timestamp: new Date().toISOString(),
              };

              newCrossingEvents.push(event);
              this.recentCrossings.unshift(event);
              if (this.recentCrossings.length > 50) {
                this.recentCrossings.pop();
              }
            } else if (classKey === 'person') {
              // Pedestrian crossed line: accounted in counts.person only.
              // Strictly does NOT increment incomingCount, outgoingCount, or vehicle crossing events!
            }
          }
        }

        this.previousY.set(trackId, centerY);
      }
    }

    this.liveCounts = activeFrameCounts;
    this.currentObjects = currentVehicleTrackIds.size; // Vehicle tracks ONLY!

    // Total vehicles strictly excludes pedestrians
    const totalVehicles =
      (this.counts.car || 0) +
      (this.counts.motorcycle || 0) +
      (this.counts.bus || 0) +
      (this.counts.truck || 0) +
      (this.counts.bicycle || 0);

    return {
      lineY,
      linePositionRatio: this.linePositionRatio,
      counts: { ...this.counts },
      liveCounts: { ...this.liveCounts },
      totalCrossings: totalVehicles, // Vehicles ONLY!
      totalVehiclesCrossed: totalVehicles,
      totalPedestriansCrossed: this.counts.person || 0,
      incoming: this.incomingCount, // Vehicles ONLY!
      outgoing: this.outgoingCount, // Vehicles ONLY!
      currentObjects: this.currentObjects, // Vehicle tracks ONLY!
      currentPedestrians: currentPedestrianTrackIds.size,
      uniqueObjects: this.uniqueObjects.size, // Unique vehicle tracks!
      newCrossingEvents, // Vehicle crossing events ONLY!
      recentCrossings: this.recentCrossings.slice(0, 15),
    };
  }

  getSnapshot() {
    const totalVehicles =
      this.counts.car +
      this.counts.motorcycle +
      this.counts.bus +
      this.counts.truck +
      this.counts.bicycle;

    return {
      linePositionRatio: this.linePositionRatio,
      counts: { ...this.counts },
      liveCounts: { ...this.liveCounts },
      totalCrossings: totalVehicles,
      totalVehiclesCrossed: totalVehicles,
      totalPedestriansCrossed: this.counts.person,
      incoming: this.incomingCount,
      outgoing: this.outgoingCount,
      currentObjects: this.currentObjects,
      uniqueObjects: this.uniqueObjects.size,
      recentCrossings: this.recentCrossings.slice(0, 15),
    };
  }
}
