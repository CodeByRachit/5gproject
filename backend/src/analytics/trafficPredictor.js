import { TrafficHistory } from '../models/TrafficHistory.js';

export const SAMPLE_INTERVAL = 10;
export const PREDICTION_MINUTES = 5;
export const FUTURE_SAMPLES = (PREDICTION_MINUTES * 60) / SAMPLE_INTERVAL; // 30 samples

export const FEATURE_COLUMNS = ['vehicle_count', 'mean_1m', 'mean_3m', 'trend_1m'];

/**
 * Feature engineering for historical traffic series.
 * Matches exact Python rolling window arithmetic:
 * - mean_1m: 6-step rolling mean (1 minute)
 * - mean_3m: 18-step rolling mean (3 minutes)
 * - trend_1m: vehicle_count[i] - vehicle_count[i - 5]
 */
export const prepareFeatures = (records) => {
  if (!records || records.length === 0) return [];

  // Sort ascending by timestamp
  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return sorted.map((row, i) => {
    const vCount = Number(row.vehicle_count) || 0;

    // mean_1m (window = 6)
    const start1m = Math.max(0, i - 5);
    const window1m = sorted.slice(start1m, i + 1);
    const mean1m = window1m.reduce((acc, r) => acc + (Number(r.vehicle_count) || 0), 0) / window1m.length;

    // mean_3m (window = 18)
    const start3m = Math.max(0, i - 17);
    const window3m = sorted.slice(start3m, i + 1);
    const mean3m = window3m.reduce((acc, r) => acc + (Number(r.vehicle_count) || 0), 0) / window3m.length;

    // trend_1m (lag 5)
    const lag5Index = i - 5;
    const trend1m = lag5Index >= 0 ? vCount - (Number(sorted[lag5Index].vehicle_count) || 0) : 0;

    return {
      timestamp: row.timestamp,
      vehicle_count: vCount,
      mean_1m: mean1m,
      mean_3m: mean3m,
      trend_1m: trend1m,
    };
  });
};

/**
 * Ordinary Least Squares (OLS) Linear Regression implementation.
 */
class LinearRegressionModel {
  constructor() {
    this.weights = [];
    this.bias = 0;
  }

  fit(X, y) {
    const n = X.length;
    if (n === 0) return;
    const p = X[0].length;

    // Design matrix with leading column of 1s for intercept
    const XtX = Array.from({ length: p + 1 }, () => new Float64Array(p + 1));
    const Xty = new Float64Array(p + 1);

    for (let i = 0; i < n; i++) {
      const row = [1, ...X[i]];
      const target = y[i];

      for (let j = 0; j <= p; j++) {
        Xty[j] += row[j] * target;
        for (let k = 0; k <= p; k++) {
          XtX[j][k] += row[j] * row[k];
        }
      }
    }

    // Solve (XtX) * beta = Xty using Gaussian elimination with partial pivoting
    const beta = this.solveLinearSystem(XtX, Xty);
    this.bias = beta[0] || 0;
    this.weights = Array.from(beta.slice(1));
  }

  solveLinearSystem(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);

    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxEl = Math.abs(M[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > maxEl) {
          maxEl = Math.abs(M[k][i]);
          maxRow = k;
        }
      }

      // Swap rows
      const tmp = M[maxRow];
      M[maxRow] = M[i];
      M[i] = tmp;

      if (Math.abs(M[i][i]) < 1e-12) {
        M[i][i] = 1e-12; // regularize
      }

      // Eliminate
      for (let k = i + 1; k < n; k++) {
        const c = -M[k][i] / M[i][i];
        for (let j = i; j <= n; j++) {
          if (i === j) {
            M[k][j] = 0;
          } else {
            M[k][j] += c * M[i][j];
          }
        }
      }
    }

    // Back substitution
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = M[i][n] / M[i][i];
      for (let k = i - 1; k >= 0; k--) {
        M[k][n] -= M[k][i] * x[i];
      }
    }
    return x;
  }

  predict(X) {
    return X.map((features) => {
      let pred = this.bias;
      for (let j = 0; j < features.length; j++) {
        pred += (this.weights[j] || 0) * features[j];
      }
      return pred;
    });
  }
}

/**
 * Random Forest Regressor Tree Ensemble implementation.
 */
class DecisionTreeRegressor {
  constructor(maxDepth = 8, minSamplesSplit = 2) {
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
    this.tree = null;
  }

  fit(X, y, depth = 0) {
    const n = X.length;
    if (n === 0) return null;

    const meanY = y.reduce((a, b) => a + b, 0) / n;
    if (depth >= this.maxDepth || n < this.minSamplesSplit) {
      return { leaf: true, value: meanY };
    }

    const p = X[0].length;
    let bestVarReduction = -1;
    let bestSplit = null;

    const currentVar = y.reduce((acc, val) => acc + Math.pow(val - meanY, 2), 0);

    // Sample subset of features (random subspace)
    for (let f = 0; f < p; f++) {
      const colValues = X.map((r) => r[f]);
      const thresholds = Array.from(new Set(colValues));

      for (const thresh of thresholds) {
        const leftY = [];
        const rightY = [];

        for (let i = 0; i < n; i++) {
          if (X[i][f] <= thresh) leftY.push(y[i]);
          else rightY.push(y[i]);
        }

        if (leftY.length === 0 || rightY.length === 0) continue;

        const leftMean = leftY.reduce((a, b) => a + b, 0) / leftY.length;
        const rightMean = rightY.reduce((a, b) => a + b, 0) / rightY.length;

        const leftVar = leftY.reduce((acc, val) => acc + Math.pow(val - leftMean, 2), 0);
        const rightVar = rightY.reduce((acc, val) => acc + Math.pow(val - rightMean, 2), 0);

        const varReduction = currentVar - (leftVar + rightVar);
        if (varReduction > bestVarReduction) {
          bestVarReduction = varReduction;
          bestSplit = { feature: f, threshold: thresh };
        }
      }
    }

    if (!bestSplit) {
      return { leaf: true, value: meanY };
    }

    const leftX = [], leftY = [], rightX = [], rightY = [];
    for (let i = 0; i < n; i++) {
      if (X[i][bestSplit.feature] <= bestSplit.threshold) {
        leftX.push(X[i]);
        leftY.push(y[i]);
      } else {
        rightX.push(X[i]);
        rightY.push(y[i]);
      }
    }

    return {
      leaf: false,
      feature: bestSplit.feature,
      threshold: bestSplit.threshold,
      left: this.fit(leftX, leftY, depth + 1),
      right: this.fit(rightX, rightY, depth + 1),
    };
  }

  predictSingle(node, sample) {
    if (!node || node.leaf) return node ? node.value : 0;
    if (sample[node.feature] <= node.threshold) {
      return this.predictSingle(node.left, sample);
    }
    return this.predictSingle(node.right, sample);
  }

  predict(X) {
    return X.map((sample) => this.predictSingle(this.tree, sample));
  }
}

class RandomForestRegressorModel {
  constructor(nEstimators = 30, maxDepth = 8) {
    this.nEstimators = nEstimators;
    this.maxDepth = maxDepth;
    this.trees = [];
  }

  fit(X, y) {
    this.trees = [];
    const n = X.length;

    for (let t = 0; t < this.nEstimators; t++) {
      // Bootstrap sample with replacement
      const bootX = [];
      const bootY = [];
      for (let i = 0; i < n; i++) {
        const randIdx = Math.floor(Math.random() * n);
        bootX.push(X[randIdx]);
        bootY.push(y[randIdx]);
      }

      const tree = new DecisionTreeRegressor(this.maxDepth);
      tree.tree = tree.fit(bootX, bootY);
      this.trees.push(tree);
    }
  }

  predict(X) {
    return X.map((sample) => {
      let sum = 0;
      for (const tree of this.trees) {
        sum += tree.predictSingle(tree.tree, sample);
      }
      return sum / this.trees.length;
    });
  }
}

const computeMAE = (actual, predicted) => {
  let err = 0;
  for (let i = 0; i < actual.length; i++) {
    err += Math.abs(actual[i] - predicted[i]);
  }
  return err / Math.max(1, actual.length);
};

export const classifyPredictedTraffic = (vehicleCount) => {
  if (vehicleCount <= 5) return 'LOW';
  if (vehicleCount <= 15) return 'MODERATE';
  return 'HIGH';
};

/**
 * Train both Linear Regression and Random Forest models on historical traffic data.
 * Returns comparative metrics and 5-minute future prediction.
 */
export const trainAndPredict = async (cameraId = null) => {
  const filter = cameraId ? { cameraId } : {};
  const rawHistory = await TrafficHistory.find(filter)
    .sort({ timestamp: 1 })
    .lean();

  if (rawHistory.length < 60) {
    return {
      status: 'insufficient_data',
      message: `Only ${rawHistory.length} observations available. Minimum 60 required for training.`,
    };
  }

  // Feature engineering
  const featureDf = prepareFeatures(rawHistory);

  // Future target shifted by FUTURE_SAMPLES (30 steps = 5 minutes)
  const labeledData = [];
  for (let i = 0; i < featureDf.length - FUTURE_SAMPLES; i++) {
    const row = featureDf[i];
    const futureTarget = featureDf[i + FUTURE_SAMPLES].vehicle_count;
    labeledData.push({
      features: [row.vehicle_count, row.mean_1m, row.mean_3m, row.trend_1m],
      target: futureTarget,
    });
  }

  if (labeledData.length < 30) {
    return {
      status: 'insufficient_data',
      message: 'Not enough future-labeled observations available for training.',
    };
  }

  const X = labeledData.map((d) => d.features);
  const y = labeledData.map((d) => d.target);

  // Chronological 80/20 train/test split
  const splitIndex = Math.floor(X.length * 0.8);
  const X_train = X.slice(0, splitIndex);
  const y_train = y.slice(0, splitIndex);
  const X_test = X.slice(splitIndex);
  const y_test = y.slice(splitIndex);

  // 1. Train Linear Regression
  const lrModel = new LinearRegressionModel();
  lrModel.fit(X_train, y_train);
  const lrPreds = lrModel.predict(X_test);
  const linearMAE = computeMAE(y_test, lrPreds);

  // 2. Train Random Forest Regressor
  const rfModel = new RandomForestRegressorModel(30, 8);
  rfModel.fit(X_train, y_train);
  const rfPreds = rfModel.predict(X_test);
  const rfMAE = computeMAE(y_test, rfPreds);

  // 3. Select Winner Model
  let bestModel;
  let bestModelName;
  let bestMAE;

  if (linearMAE <= rfMAE) {
    bestModel = new LinearRegressionModel();
    bestModel.fit(X, y);
    bestModelName = 'Linear Regression';
    bestMAE = linearMAE;
  } else {
    bestModel = new RandomForestRegressorModel(30, 8);
    bestModel.fit(X, y);
    bestModelName = 'Random Forest';
    bestMAE = rfMAE;
  }

  // 4. Predict on latest feature observation
  const latestRow = featureDf[featureDf.length - 1];
  const latestFeatures = [latestRow.vehicle_count, latestRow.mean_1m, latestRow.mean_3m, latestRow.trend_1m];
  const rawPred = bestModel.predict([latestFeatures])[0];
  const predictedVehicles = Math.max(0, Math.round(rawPred));
  const currentVehicles = latestRow.vehicle_count;

  return {
    status: 'success',
    model_name: bestModelName,
    current_vehicles: currentVehicles,
    current_congestion: classifyPredictedTraffic(currentVehicles),
    predicted_vehicles: predictedVehicles,
    predicted_congestion: classifyPredictedTraffic(predictedVehicles),
    prediction_minutes: PREDICTION_MINUTES,
    linear_regression_mae: Number(linearMAE.toFixed(2)),
    random_forest_mae: Number(rfMAE.toFixed(2)),
    best_model_mae: Number(bestMAE.toFixed(2)),
    training_samples: X_train.length,
    testing_samples: X_test.length,
  };
};
