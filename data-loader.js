// Data Loader - Load GeoJSON and CSV files, create cities and placeholders

const DataLoader = {
  /**
   * Load all game data: GeoJSON map and cities from CSV
   * @param {RNG} rng - Random number generator for placeholder creation
   * @returns {Promise<object>} {countries, cities}
   */
  async loadGameData(rng) {
    const [geoData, citiesData] = await Promise.all([
      this.loadGeoJSON('custom.geo.json'),
      this.loadCitiesCSV('all-cities-with-population.csv')
    ]);

    // Create country map from GeoJSON
    const countries = this.processGeoJSON(geoData);

    // Create city objects from CSV
    const cities = this.processCities(citiesData, countries);

    // Generate placeholder cities
    const placeholders = this.generatePlaceholders(countries, cities, rng);

    // Combine real cities and placeholders
    const allCities = [...cities, ...placeholders];

    return { countries, cities: allCities, geoData };
  },

  /**
   * Load GeoJSON file
   * @param {string} url - URL to GeoJSON file
   * @returns {Promise<object>} GeoJSON data
   */
  async loadGeoJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load GeoJSON: ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Load cities CSV file
   * @param {string} url - URL to CSV file
   * @returns {Promise<Array>} Array of city records
   */
  async loadCitiesCSV(url) {
    return new Promise((resolve, reject) => {
      d3.csv(url, (error, data) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  },

  /**
   * Process GeoJSON into country objects
   * @param {object} geoData - GeoJSON FeatureCollection
   * @returns {Map} Map of country name -> country object
   */
  processGeoJSON(geoData) {
    const countries = new Map();

    if (geoData.type === 'FeatureCollection') {
      geoData.features.forEach(feature => {
        const countryName = feature.properties.name || feature.properties.NAME || 'Unknown';
        countries.set(countryName, {
          name: countryName,
          geometry: feature.geometry,
          cities: [],
          properties: feature.properties
        });
      });
    }

    return countries;
  },

  /**
   * Process cities from CSV data
   * @param {Array} citiesData - Raw CSV data
   * @param {Map} countries - Map of countries
   * @returns {Array} Array of city objects
   */
  processCities(citiesData, countries) {
    // Sort cities by population (descending) so we process largest first
    const sortedData = citiesData.slice().sort((a, b) => {
      return (parseInt(b.population) || 0) - (parseInt(a.population) || 0);
    });

    const cities = [];
    let idCounter = 0;

    sortedData.forEach(row => {
      const lat = parseFloat(row.lat);
      const lon = parseFloat(row.lon);
      const population = parseInt(row.population) || 0;

      // Skip if too close to an already-placed (larger) city
      const tooClose = cities.some(existing => {
        return MapUtils.greatCircleDistance(
          lat, lon,
          existing.lat, existing.lon
        ) < CONSTANTS.MIN_CITY_SPACING_KM;
      });

      if (tooClose) return; // Skip this city

      const city = {
        id: `city-${idCounter++}`,
        name: row.name || row.city || 'Unnamed',
        lat: lat,
        lon: lon,
        population: population,
        country: row.country || 'Unknown',
        owner: null,
        hp: 100,
        hasAirbase: false,
        airbase: null,
        queuedProduction: {
          fighter: 0,
          bomber: 0,
          designingAirbase: false
        },
        isPlaceholder: false,
        // Runtime properties (set by renderer)
        screenXY: null,
        visibleRing: false
      };

      cities.push(city);

      // Add city to its country
      const country = countries.get(city.country);
      if (country) {
        country.cities.push(city);
      }
    });

    return cities;
  },

  /**
   * Generate placeholder cities for countries
   * @param {Map} countries - Map of countries
   * @param {Array} existingCities - Already created cities
   * @param {RNG} rng - Random number generator
   * @returns {Array} Array of placeholder city objects
   */
  generatePlaceholders(countries, existingCities, rng) {
    const placeholders = [];
    let idCounter = existingCities.length;

    countries.forEach((country, countryName) => {
      if (!country.geometry) return;

      // Generate PLACEHOLDER_CITIES_PER_COUNTRY placeholders
      for (let i = 0; i < CONSTANTS.PLACEHOLDER_CITIES_PER_COUNTRY; i++) {
        const position = MapUtils.getRandomPolygonVertex(country.geometry.coordinates, rng);

        // Check minimum spacing from existing cities and placeholders
        const tooClose = [...existingCities, ...placeholders].some(existing => {
          return MapUtils.greatCircleDistance(
            position.lat, position.lon,
            existing.lat, existing.lon
          ) < CONSTANTS.PLACEHOLDER_MIN_SPACING_KM;
        });

        if (tooClose) continue; // Skip this placeholder

        const placeholder = {
          id: `city-${idCounter++}`,
          name: `${countryName} Placeholder ${i + 1}`,
          lat: position.lat,
          lon: position.lon,
          population: 0,
          country: countryName,
          owner: null,
          hp: 100,
          hasAirbase: false,
          airbase: null,
          queuedProduction: {
            fighter: 0,
            bomber: 0,
            designingAirbase: false
          },
          isPlaceholder: true,
          screenXY: null,
          visibleRing: false
        };

        placeholders.push(placeholder);
        country.cities.push(placeholder);
      }
    });

    return placeholders;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataLoader;
}
