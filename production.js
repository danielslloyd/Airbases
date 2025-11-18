// Production System - Handle production accumulation and unit creation

const ProductionSystem = {
  /**
   * Calculate production per minute for a city
   * @param {object} city - City object
   * @param {string} teamName - Team name
   * @returns {number} Production in M per minute
   */
  getCityProduction(city, teamName) {
    if (city.owner !== teamName) return 0;

    // If city is the delivery point, always produce at max
    const team = GameState.teams[teamName];
    if (team.deliveryPointCity && team.deliveryPointCity.id === city.id) {
      return (city.population / CONSTANTS.POP_SCALE);
    }

    // Normal production: population * (hp / 100)
    const productionFraction = city.hp / 100;
    return (city.population / CONSTANTS.POP_SCALE) * productionFraction;
  },

  /**
   * Calculate total production per minute for a team
   * @param {string} teamName - Team name
   * @returns {number} Total production in M per minute
   */
  getTeamProduction(teamName) {
    const cities = GameState.getTeamCities(teamName);
    let total = 0;

    for (const city of cities) {
      total += this.getCityProduction(city, teamName);
    }

    return total;
  },

  /**
   * Update production for all teams (called each tick)
   * @param {number} deltaMs - Time since last update in milliseconds
   */
  updateProduction(deltaMs) {
    const deltaMinutes = deltaMs / 60000;

    for (const teamName in GameState.teams) {
      const team = GameState.teams[teamName];

      // Calculate current production rate
      team.productionPerMinute = this.getTeamProduction(teamName);

      // Accumulate production
      const productionThisTick = team.productionPerMinute * deltaMinutes;
      team.productionAccumulated += productionThisTick;
    }
  },

  /**
   * Process airbase builds (called each tick)
   * @param {number} deltaMs - Time since last update
   */
  processAirbaseBuilds(deltaMs) {
    const deltaMinutes = deltaMs / 60000;

    for (const teamName in GameState.teams) {
      const team = GameState.teams[teamName];

      // Find cities with incomplete airbases
      const cities = GameState.getTeamCities(teamName);
      for (const city of cities) {
        if (city.airbase && !city.airbase.complete) {
          // Allocate production to airbase build
          const productionNeeded = CONSTANTS.AIRBASE_COST_M - city.airbase.buildProgressM;
          const productionAvailable = team.productionPerMinute * deltaMinutes;

          const productionUsed = Math.min(productionAvailable, productionNeeded);
          city.airbase.buildProgressM += productionUsed;

          // Deduct from team production
          team.productionAccumulated -= productionUsed;

          // Check if complete
          if (city.airbase.buildProgressM >= CONSTANTS.AIRBASE_COST_M) {
            city.airbase.complete = true;
            city.hasAirbase = true;

            if (GameState.debugLogCombat) {
              console.log(`${teamName} completed airbase at ${city.name}`);
            }
          }

          // Only one airbase build at a time
          break;
        }
      }
    }
  },

  /**
   * Try to produce aircraft from accumulated production
   * @param {string} teamName - Team name
   * @param {string} templateId - Template to produce
   * @returns {boolean} True if aircraft was produced
   */
  tryProduceAircraft(teamName, templateId) {
    const team = GameState.teams[teamName];
    const template = GameState.getTemplate(templateId);

    if (!template) return false;
    if (team.productionAccumulated < template.costM) return false;

    // Check if we have a delivery point
    if (!team.deliveryPointCity) return false;

    // Deduct cost and create aircraft
    team.productionAccumulated -= template.costM;
    const aircraft = GameState.createAircraft(templateId, team.deliveryPointCity.id, teamName);

    if (GameState.debugLogCombat) {
      console.log(`${teamName} produced ${template.type} at ${team.deliveryPointCity.name}`);
    }

    return true;
  },

  /**
   * Calculate points available for a custom aircraft design
   * @param {number} costM - Cost in Millions
   * @returns {number} Points available
   */
  calculateDesignPoints(costM) {
    return Math.floor(CONSTANTS.DESIGN_BASE_POINTS * Math.log10(costM + 1));
  },

  /**
   * Get design cost (1 minute of current production)
   * @param {string} teamName - Team name
   * @returns {number} Design cost in M
   */
  getDesignCost(teamName) {
    const team = GameState.teams[teamName];
    return team.productionPerMinute * CONSTANTS.DESIGN_COST_MULTIPLIER;
  },

  /**
   * Start designing a custom aircraft
   * @param {string} teamName - Team name
   * @param {object} specs - {type, costM, rangePoints, offense, defense, name}
   * @returns {boolean} True if design started
   */
  startDesign(teamName, specs) {
    const team = GameState.teams[teamName];
    const designCost = this.getDesignCost(teamName);

    if (team.productionAccumulated < designCost) return false;

    // Deduct design cost
    team.productionAccumulated -= designCost;

    // Create the template
    GameState.createTemplate(teamName, specs);

    if (GameState.debugLogCombat) {
      console.log(`${teamName} designed ${specs.name} for ${designCost}M`);
    }

    return true;
  },

  /**
   * Build an airbase at a city
   * @param {string} cityId - City ID
   * @param {string} teamName - Team name
   * @returns {boolean} True if airbase build started
   */
  buildAirbase(cityId, teamName) {
    const city = GameState.getCity(cityId);
    if (!city) return false;

    // Check ownership
    if (city.owner !== teamName) return false;

    // Check if already has airbase
    if (city.hasAirbase) return false;

    // Placeholder cities must be captured first (hp >= 0)
    if (city.isPlaceholder && city.hp < 0) return false;

    // Start airbase build
    city.airbase = {
      owner: teamName,
      buildProgressM: 0,
      complete: false,
      deliveryPoint: false,
      orders: null,
      escortAllocation: 0.5
    };

    if (GameState.debugLogCombat) {
      console.log(`${teamName} started building airbase at ${city.name}`);
    }

    return true;
  },

  /**
   * Set a city's airbase as the delivery point
   * @param {string} cityId - City ID
   * @param {string} teamName - Team name
   * @returns {boolean} True if delivery point set
   */
  setDeliveryPoint(cityId, teamName) {
    const city = GameState.getCity(cityId);
    if (!city) return false;

    // Must have complete airbase
    if (!city.hasAirbase || !city.airbase || !city.airbase.complete) return false;

    // Must be owned by team
    if (city.owner !== teamName) return false;

    const team = GameState.teams[teamName];

    // Clear old delivery point
    if (team.deliveryPointCity && team.deliveryPointCity.airbase) {
      team.deliveryPointCity.airbase.deliveryPoint = false;
    }

    // Set new delivery point
    team.deliveryPointCity = city;
    city.airbase.deliveryPoint = true;

    if (GameState.debugLogCombat) {
      console.log(`${teamName} set delivery point at ${city.name}`);
    }

    return true;
  },

  /**
   * Set bomber target orders for an airbase
   * @param {string} cityId - Airbase city ID
   * @param {string} targetCityId - Target city ID
   * @returns {boolean} True if orders set
   */
  setBomberOrders(cityId, targetCityId) {
    const city = GameState.getCity(cityId);
    const target = GameState.getCity(targetCityId);

    if (!city || !target) return false;
    if (!city.hasAirbase || !city.airbase || !city.airbase.complete) return false;

    // Calculate distance
    const distance = MapUtils.greatCircleDistance(
      city.lat, city.lon,
      target.lat, target.lon
    );

    city.airbase.orders = {
      targetCityId: targetCityId,
      distance: distance
    };

    if (GameState.debugLogCombat) {
      console.log(`Set bomber orders from ${city.name} to ${target.name} (${distance.toFixed(0)} km)`);
    }

    return true;
  },

  /**
   * Clear bomber orders for an airbase
   * @param {string} cityId - Airbase city ID
   * @returns {boolean} True if orders cleared
   */
  clearBomberOrders(cityId) {
    const city = GameState.getCity(cityId);
    if (!city || !city.airbase) return false;

    city.airbase.orders = null;

    if (GameState.debugLogCombat) {
      console.log(`Cleared bomber orders from ${city.name}`);
    }

    return true;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductionSystem;
}
