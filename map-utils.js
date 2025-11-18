// Map Utilities - Geographic calculations for the globe

const MapUtils = {
  // Earth radius in kilometers
  EARTH_RADIUS_KM: 6371,

  /**
   * Calculate great-circle distance between two lat/lon points (Haversine formula)
   * @param {number} lat1 - Latitude of first point in degrees
   * @param {number} lon1 - Longitude of first point in degrees
   * @param {number} lat2 - Latitude of second point in degrees
   * @param {number} lon2 - Longitude of second point in degrees
   * @returns {number} Distance in kilometers
   */
  greatCircleDistance(lat1, lon1, lat2, lon2) {
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_KM * c;
  },

  /**
   * Calculate intermediate point along great circle path
   * @param {number} lat1 - Start latitude in degrees
   * @param {number} lon1 - Start longitude in degrees
   * @param {number} lat2 - End latitude in degrees
   * @param {number} lon2 - End longitude in degrees
   * @param {number} fraction - Fraction along path [0, 1]
   * @returns {object} {lat, lon} of intermediate point
   */
  intermediatePoint(lat1, lon1, lat2, lon2, fraction) {
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;

    const φ1 = lat1 * toRad;
    const λ1 = lon1 * toRad;
    const φ2 = lat2 * toRad;
    const λ2 = lon2 * toRad;

    const d = this.greatCircleDistance(lat1, lon1, lat2, lon2) / this.EARTH_RADIUS_KM;
    const a = Math.sin((1 - fraction) * d) / Math.sin(d);
    const b = Math.sin(fraction * d) / Math.sin(d);

    const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
    const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
    const z = a * Math.sin(φ1) + b * Math.sin(φ2);

    const φ = Math.atan2(z, Math.sqrt(x * x + y * y));
    const λ = Math.atan2(y, x);

    return {
      lat: φ * toDeg,
      lon: λ * toDeg
    };
  },

  /**
   * Sample points along a great circle path
   * @param {number} lat1 - Start latitude
   * @param {number} lon1 - Start longitude
   * @param {number} lat2 - End latitude
   * @param {number} lon2 - End longitude
   * @param {number} numPoints - Number of intermediate points
   * @returns {Array} Array of {lat, lon} points along the path
   */
  sampleGreatCirclePath(lat1, lon1, lat2, lon2, numPoints = 50) {
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
      const fraction = i / numPoints;
      points.push(this.intermediatePoint(lat1, lon1, lat2, lon2, fraction));
    }
    return points;
  },

  /**
   * Check if any portion of a path is within range of a point
   * @param {number} pathLat1 - Path start latitude
   * @param {number} pathLon1 - Path start longitude
   * @param {number} pathLat2 - Path end latitude
   * @param {number} pathLon2 - Path end longitude
   * @param {number} pointLat - Reference point latitude
   * @param {number} pointLon - Reference point longitude
   * @param {number} rangeKm - Range in kilometers
   * @returns {boolean} True if any part of path is within range
   */
  isPathWithinRange(pathLat1, pathLon1, pathLat2, pathLon2, pointLat, pointLon, rangeKm) {
    // Sample the path and check if any point is within range
    const samples = this.sampleGreatCirclePath(pathLat1, pathLon1, pathLat2, pathLon2, 20);
    for (const sample of samples) {
      if (this.greatCircleDistance(sample.lat, sample.lon, pointLat, pointLon) <= rangeKm) {
        return true;
      }
    }
    return false;
  },

  /**
   * Calculate bearing from point 1 to point 2
   * @param {number} lat1 - Start latitude in degrees
   * @param {number} lon1 - Start longitude in degrees
   * @param {number} lat2 - End latitude in degrees
   * @param {number} lon2 - End longitude in degrees
   * @returns {number} Bearing in degrees [0, 360)
   */
  bearing(lat1, lon1, lat2, lon2) {
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;

    const φ1 = lat1 * toRad;
    const φ2 = lat2 * toRad;
    const Δλ = (lon2 - lon1) * toRad;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);

    return (θ * toDeg + 360) % 360;
  },

  /**
   * Calculate destination point given start point, bearing, and distance
   * @param {number} lat - Start latitude in degrees
   * @param {number} lon - Start longitude in degrees
   * @param {number} bearingDeg - Bearing in degrees
   * @param {number} distanceKm - Distance in kilometers
   * @returns {object} {lat, lon} of destination point
   */
  destinationPoint(lat, lon, bearingDeg, distanceKm) {
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;

    const δ = distanceKm / this.EARTH_RADIUS_KM;
    const θ = bearingDeg * toRad;
    const φ1 = lat * toRad;
    const λ1 = lon * toRad;

    const φ2 = Math.asin(
      Math.sin(φ1) * Math.cos(δ) +
      Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
    );

    const λ2 = λ1 + Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

    return {
      lat: φ2 * toDeg,
      lon: ((λ2 * toDeg + 540) % 360) - 180 // Normalize to [-180, 180]
    };
  },

  /**
   * Get polygon centroid from GeoJSON coordinates
   * @param {Array} coordinates - GeoJSON polygon coordinates
   * @returns {object} {lat, lon} of centroid
   */
  getPolygonCentroid(coordinates) {
    // Simple average of all vertices (works for most country polygons)
    let sumLat = 0, sumLon = 0, count = 0;

    const processCoords = (coords) => {
      for (const point of coords) {
        if (Array.isArray(point[0])) {
          processCoords(point);
        } else {
          sumLon += point[0];
          sumLat += point[1];
          count++;
        }
      }
    };

    processCoords(coordinates);

    return count > 0 ? {
      lat: sumLat / count,
      lon: sumLon / count
    } : { lat: 0, lon: 0 };
  },

  /**
   * Get a random point from polygon vertices (for placeholder cities)
   * @param {Array} coordinates - GeoJSON polygon coordinates
   * @param {RNG} rng - Random number generator
   * @returns {object} {lat, lon} of selected vertex
   */
  getRandomPolygonVertex(coordinates, rng) {
    const vertices = [];

    const collectVertices = (coords) => {
      for (const point of coords) {
        if (Array.isArray(point[0])) {
          collectVertices(point);
        } else {
          vertices.push({ lon: point[0], lat: point[1] });
        }
      }
    };

    collectVertices(coordinates);

    return vertices.length > 0 ? rng.choice(vertices) : { lat: 0, lon: 0 };
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapUtils;
}
