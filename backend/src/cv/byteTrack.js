/**
 * ByteTrack Multi-Object Tracking implementation in Node.js
 * Implements 2-stage association with IoU distance matrix and track persistence.
 * Enhanced for high vehicle detection sensitivity, occlusion recovery,
 * fast-moving vehicles, and duplicate prevention.
 */

export const VEHICLE_CLASSES = ['car', 'motorcycle', 'bus', 'truck', 'bicycle'];
export const isVehicle = (key) => VEHICLE_CLASSES.includes(key);

export const DISPLAY_NAMES = {
  person: 'Pedestrian',
  bicycle: 'Bicycle',
  car: 'Car',
  motorcycle: 'Motorcycle',
  bus: 'Bus',
  truck: 'Truck',
};

const computeIoU = (boxA, boxB) => {
  const [ax1, ay1, ax2, ay2] = boxA;
  const [bx1, by1, bx2, by2] = boxB;

  const xLeft = Math.max(ax1, bx1);
  const yTop = Math.max(ay1, by1);
  const xRight = Math.min(ax2, bx2);
  const yBottom = Math.min(ay2, by2);

  if (xRight < xLeft || yBottom < yTop) return 0.0;

  const intersection = (xRight - xLeft) * (yBottom - yTop);
  const areaA = (ax2 - ax1) * (ay2 - ay1);
  const areaB = (bx2 - bx1) * (by2 - by1);
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0.0;
};

// Greedy / Hungarian matching for IoU cost matrix
const matchDetectionsToTracks = (tracks, detections, iouThreshold = 0.25) => {
  if (tracks.length === 0 || detections.length === 0) {
    return {
      matches: [],
      unmatchedTracks: tracks.map((_, i) => i),
      unmatchedDetections: detections.map((_, i) => i),
    };
  }

  // Build IoU matrix
  const iouMatrix = tracks.map((track) =>
    detections.map((det) => computeIoU(track.bbox, det.bbox))
  );

  const matchedTrackIndices = new Set();
  const matchedDetectionIndices = new Set();
  const matches = [];

  // Sort candidate pairs by highest IoU descending
  const pairs = [];
  for (let t = 0; t < tracks.length; t++) {
    for (let d = 0; d < detections.length; d++) {
      // STRICT: Match tracks only with detections of the identical classId
      // Ensures track identity consistency and prevents class flipping across frames
      if (tracks[t].classId === detections[d].classId && iouMatrix[t][d] >= iouThreshold) {
        pairs.push({ t, d, iou: iouMatrix[t][d] });
      }
    }
  }
  pairs.sort((a, b) => b.iou - a.iou);

  for (const pair of pairs) {
    if (!matchedTrackIndices.has(pair.t) && !matchedDetectionIndices.has(pair.d)) {
      matchedTrackIndices.add(pair.t);
      matchedDetectionIndices.add(pair.d);
      matches.push([pair.t, pair.d]);
    }
  }

  const unmatchedTracks = tracks
    .map((_, i) => i)
    .filter((i) => !matchedTrackIndices.has(i));
  const unmatchedDetections = detections
    .map((_, i) => i)
    .filter((i) => !matchedDetectionIndices.has(i));

  return { matches, unmatchedTracks, unmatchedDetections };
};

export class STrack {
  constructor(bbox, score, classId, classKey, label = null) {
    this.trackId = STrack.nextId++;
    this.bbox = bbox; // [x1, y1, x2, y2]
    this.score = score;
    this.classId = classId;
    this.classKey = classKey;
    this.label = label || DISPLAY_NAMES[classKey] || classKey;
    this.state = 'Tracked';
    this.timeSinceUpdate = 0;
    this.hitStreak = 1;
    this.age = 1;
  }

  static nextId = 1;

  predict() {
    this.age += 1;
    this.timeSinceUpdate += 1;
  }

  update(detection) {
    this.bbox = detection.bbox;
    this.score = detection.confidence;
    this.classId = detection.classId;
    this.classKey = detection.classKey;
    this.label = detection.label || DISPLAY_NAMES[detection.classKey] || detection.classKey;
    this.state = 'Tracked';
    this.timeSinceUpdate = 0;
    this.hitStreak += 1;
  }

  markLost() {
    this.state = 'Lost';
  }

  markRemoved() {
    this.state = 'Removed';
  }
}

export class ByteTracker {
  constructor(maxTimeLost = 45, highThresh = 0.25, matchThresh = 0.25) {
    this.maxTimeLost = maxTimeLost;   // 45 frames (~3.0s at 15 FPS) to prevent fragmentation during occlusion
    this.highThresh = highThresh;     // 0.25: compatible with tuned vehicle detection threshold
    this.matchThresh = matchThresh;   // 0.25: accommodates fast vehicle displacement between frames
    this.trackedTracks = [];
    this.lostTracks = [];
    this.removedTracks = [];
    this.frameCount = 0;
  }

  reset() {
    this.trackedTracks = [];
    this.lostTracks = [];
    this.removedTracks = [];
    this.frameCount = 0;
    STrack.nextId = 1;
  }

  /**
   * Update tracker with frame detections.
   * @param {Array} detections - [{ bbox: [x1, y1, x2, y2], confidence, classId, classKey, label, isPrimary }]
   * @returns {Array} Active tracks with persistent trackId
   */
  update(detections) {
    this.frameCount += 1;

    // 1. Predict state for all active and lost tracks
    for (const track of [...this.trackedTracks, ...this.lostTracks]) {
      track.predict();
    }

    // 2. Separate detections by score
    // dHigh: primary detections or detections >= highThresh (default 0.25)
    const dHigh = detections.filter(
      (d) => d.confidence >= this.highThresh || d.isPrimary === true
    );
    // dLow: secondary candidates for recovering occluded tracks (0.15 <= conf < highThresh)
    const dLow = detections.filter(
      (d) => !dHigh.includes(d) && d.confidence >= 0.15
    );

    // 3. First association: Match dHigh with active tracked tracks
    const firstMatch = matchDetectionsToTracks(
      this.trackedTracks,
      dHigh,
      this.matchThresh
    );

    for (const [tIdx, dIdx] of firstMatch.matches) {
      this.trackedTracks[tIdx].update(dHigh[dIdx]);
    }

    // 4. Second association: Match remaining unmatched tracks with dLow
    const unmatchedTrackObjects = firstMatch.unmatchedTracks.map((i) => this.trackedTracks[i]);
    const remainingTracks = [...unmatchedTrackObjects, ...this.lostTracks];

    const secondMatch = matchDetectionsToTracks(
      remainingTracks,
      dLow,
      0.20 // Relaxed IoU threshold for matching low-confidence occluded tracks
    );

    const recoveredFromLost = new Set();

    for (const [remIdx, dIdx] of secondMatch.matches) {
      const track = remainingTracks[remIdx];
      track.update(dLow[dIdx]);
      if (track.state === 'Lost') {
        track.state = 'Tracked';
        recoveredFromLost.add(track);
      }
    }

    // Unmatched tracks in 2nd stage:
    for (const remIdx of secondMatch.unmatchedTracks) {
      const track = remainingTracks[remIdx];
      if (track.state !== 'Lost') {
        track.markLost();
      }
    }

    // Add recovered tracks back to trackedTracks
    for (const track of recoveredFromLost) {
      this.trackedTracks.push(track);
    }

    // 5. Initialize new tracks for unmatched high-confidence detections
    for (const dIdx of firstMatch.unmatchedDetections) {
      const det = dHigh[dIdx];

      // Prevent duplicate track creation if heavily overlapping (IoU >= 0.40) with an existing active track
      const isDuplicate = this.trackedTracks.some(
        (t) => t.classId === det.classId && computeIoU(t.bbox, det.bbox) >= 0.40
      );

      if (!isDuplicate) {
        const newTrack = new STrack(det.bbox, det.confidence, det.classId, det.classKey, det.label);
        this.trackedTracks.push(newTrack);
      }
    }

    // 6. Handle lost & removed tracks (maxTimeLost: 45 frames ~ 3.0s buffer at 15 FPS)
    const stillTracked = [];
    for (const track of this.trackedTracks) {
      if (track.state === 'Tracked' && track.timeSinceUpdate <= 2) {
        stillTracked.push(track);
      } else if (track.state === 'Lost') {
        if (!this.lostTracks.includes(track)) {
          this.lostTracks.push(track);
        }
      }
    }
    this.trackedTracks = stillTracked;

    // Purge old lost tracks that exceeded maxTimeLost or were recovered
    this.lostTracks = this.lostTracks.filter(
      (t) => !recoveredFromLost.has(t) && t.state === 'Lost' && t.timeSinceUpdate <= this.maxTimeLost
    );

    // Return all currently active tracks formatted as detection objects with trackId
    return this.trackedTracks.map((track) => ({
      bbox: track.bbox,
      trackId: track.trackId,
      confidence: track.score,
      classId: track.classId,
      classKey: track.classKey,
      label: track.label || DISPLAY_NAMES[track.classKey] || track.classKey,
      isVehicle: isVehicle(track.classKey),
    }));
  }
}
