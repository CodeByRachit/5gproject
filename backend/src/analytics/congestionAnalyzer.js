/**
 * 5G Smart Campus Congestion Analyzer
 * Preserves exact vehicle weights and classification thresholds from original Python engine.
 */

export const VEHICLE_CLASSES = [
  'car',
  'motorcycle',
  'bus',
  'truck',
  'bicycle',
];

export const LOW_THRESHOLD = 5;
export const MODERATE_THRESHOLD = 15;

export const DEFAULT_WEIGHTS = {
  car: 1.0,
  motorcycle: 0.5,
  bus: 2.5,
  truck: 2.0,
  bicycle: 0.4,
};

/**
 * Analyze current traffic congestion using live vehicle detections.
 * @param {Object} liveCounts - Dictionary of object counts in current frame.
 * @param {Object} customWeights - Optional custom weights.
 * @returns {Object} Congestion breakdown, weighted score, and status level.
 */
export const analyzeCongestion = (liveCounts = {}, customWeights = DEFAULT_WEIGHTS) => {
  const cars = Number(liveCounts.car) || 0;
  const motorcycles = Number(liveCounts.motorcycle) || 0;
  const buses = Number(liveCounts.bus) || 0;
  const trucks = Number(liveCounts.truck) || 0;
  const bicycles = Number(liveCounts.bicycle) || 0;
  const pedestrians = Number(liveCounts.person) || 0;

  // Total vehicles currently detected (pedestrians strictly excluded!)
  const totalVehicles = cars + motorcycles + buses + trucks + bicycles;

  // Weighted congestion score
  const congestionScore = 
    cars * (customWeights.car ?? 1.0) +
    motorcycles * (customWeights.motorcycle ?? 0.5) +
    buses * (customWeights.bus ?? 2.5) +
    trucks * (customWeights.truck ?? 2.0) +
    bicycles * (customWeights.bicycle ?? 0.4);

  // Congestion classification: LOW (0-5) -> MODERATE (6-15) -> HIGH (>15)
  // 'NO DATA' reserved strictly for disconnected / standby state
  let congestionLevel = 'LOW';
  let color = 'GREEN';

  if (liveCounts === null || liveCounts === undefined) {
    congestionLevel = 'NO DATA';
    color = 'GRAY';
  } else if (totalVehicles <= LOW_THRESHOLD) {
    congestionLevel = 'LOW';
    color = 'GREEN';
  } else if (totalVehicles <= MODERATE_THRESHOLD) {
    congestionLevel = 'MODERATE';
    color = 'YELLOW';
  } else {
    congestionLevel = 'HIGH';
    color = 'RED';
  }

  return {
    timestamp: new Date().toISOString(),
    vehicle_count: totalVehicles,
    cars,
    motorcycles,
    buses,
    trucks,
    bicycles,
    pedestrians,
    congestion_score: Number(congestionScore.toFixed(2)),
    congestion_level: congestionLevel,
    congestion_color: color,
    color,
    counts: liveCounts,
  };
};

/**
 * Returns human-readable status explanation.
 */
export const getCongestionDescription = (level) => {
  switch (level) {
    case 'NO DATA':
      return 'Camera standby or disconnected. Waiting for video stream.';
    case 'LOW':
      return 'Traffic is flowing smoothly (0–5 vehicles).';
    case 'MODERATE':
      return 'Moderate traffic congestion detected (6–15 vehicles).';
    case 'HIGH':
      return 'Heavy traffic congestion detected (> 15 vehicles). Alert active!';
    default:
      return 'Traffic status unavailable.';
  }
};
