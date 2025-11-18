// AI Bot - Aggressive AI opponent controller

const AIBot = {
  teamName: 'Blue',
  lastDecisionTime: 0,
  decisionIntervalSeconds: 5, // Make decisions every 5 seconds

  /**
   * Initialize the bot
   * @param {string} teamName - Team name for the bot
   */
  initialize(teamName) {
    this.teamName = teamName;
    this.lastDecisionTime = 0;
  },

  /**
   * Update bot AI (called each tick)
   * @param {number} elapsedSeconds - Elapsed game time in seconds
   */
  update(elapsedSeconds) {
    // Make decisions at intervals
    if (elapsedSeconds - this.lastDecisionTime >= this.decisionIntervalSeconds) {
      this.makeDecisions();
      this.lastDecisionTime = elapsedSeconds;
    }
  },

  /**
   * Make strategic decisions
   */
  makeDecisions() {
    const team = GameState.teams[this.teamName];
    if (!team) return;

    // Priority 1: Build airbases at cities without them
    this.considerAirbaseBuilds();

    // Priority 2: Design better aircraft occasionally
    this.considerDesigns();

    // Priority 3: Set bomber targets for all airbases
    this.setBomberTargets();

    // Priority 4: Allocate production to aircraft
    this.allocateProduction();
  },

  /**
   * Consider building airbases
   */
  considerAirbaseBuilds() {
    const team = GameState.teams[this.teamName];
    const cities = GameState.getTeamCities(this.teamName);

    for (const city of cities) {
      // Skip if already has airbase or is building one
      if (city.hasAirbase || (city.airbase && !city.airbase.complete)) continue;

      // Skip placeholders with negative HP (not captured yet)
      if (city.isPlaceholder && city.hp < 0) continue;

      // Check if we have enough production buffer
      if (team.productionAccumulated >= CONSTANTS.AIRBASE_COST_M * CONSTANTS.BOT_AIRBASE_BUILD_THRESHOLD) {
        ProductionSystem.buildAirbase(city.id, this.teamName);

        if (GameState.debugLogCombat) {
          console.log(`Bot building airbase at ${city.name}`);
        }

        // Only build one at a time
        return;
      }
    }
  },

  /**
   * Consider designing new aircraft
   */
  considerDesigns() {
    const team = GameState.teams[this.teamName];

    // Only design if we have plenty of production
    if (team.productionPerMinute < CONSTANTS.BOT_MIN_PRODUCTION_FOR_DESIGN) return;

    const designCost = ProductionSystem.getDesignCost(this.teamName);
    if (team.productionAccumulated < designCost * 2) return; // Need 2x design cost buffer

    // Random chance to design
    if (!GameState.rng.nextBool(CONSTANTS.BOT_DESIGN_CHANCE)) return;

    // Design a better bomber with higher cost
    const currentBestBomber = team.templates
      .filter(t => t.type === 'bomber')
      .reduce((best, t) => t.costM > best.costM ? t : best, DEFAULT_TEMPLATES.bomber);

    const newCost = currentBestBomber.costM * 1.5; // 50% more expensive
    const points = ProductionSystem.calculateDesignPoints(newCost);

    // Allocate points: prioritize offense, then range, then defense
    const offense = Math.min(CONSTANTS.OFFENSE_MAX, Math.floor(points * 0.5));
    const range = Math.min(CONSTANTS.RANGE_MAX, Math.floor(points * 0.3));
    const defense = Math.min(CONSTANTS.DEFENSE_MAX, points - offense - range);

    const specs = {
      type: 'bomber',
      costM: newCost,
      rangePoints: range,
      offense: offense,
      defense: defense,
      name: `Bot Bomber Mk${team.templates.filter(t => t.type === 'bomber').length + 1}`
    };

    ProductionSystem.startDesign(this.teamName, specs);

    if (GameState.debugLogCombat) {
      console.log(`Bot designed ${specs.name}: ${newCost}M, ${offense}O/${defense}D/${range}R`);
    }
  },

  /**
   * Set bomber targets for all airbases
   */
  setBomberTargets() {
    const cities = GameState.getTeamCities(this.teamName);

    for (const city of cities) {
      if (!city.hasAirbase || !city.airbase || !city.airbase.complete) continue;

      // Find best target
      const target = this.findBestBomberTarget(city);
      if (target) {
        ProductionSystem.setBomberOrders(city.id, target.id);

        // Set escort allocation aggressively (70% escort, 30% defend)
        city.airbase.escortAllocation = 0.7;
      }
    }
  },

  /**
   * Find best bomber target from an airbase
   * @param {object} fromCity - Airbase city
   * @returns {object|null} Best target city or null
   */
  findBestBomberTarget(fromCity) {
    // Get bombers at this airbase
    const bombers = GameState.getBombersAtCity(fromCity.id);
    if (bombers.length === 0) return null;

    // Find longest range bomber
    const maxRange = Math.max(...bombers.map(b => {
      const template = GameState.getTemplate(b.templateId);
      return template ? template.rangePoints * CONSTANTS.RANGE_KM_PER_POINT : 0;
    }));

    // Get all enemy cities
    const enemyCities = GameState.cities.filter(c => c.owner !== this.teamName && c.owner !== null);

    // Find targets within range
    const targetsInRange = enemyCities.filter(target => {
      const distance = MapUtils.greatCircleDistance(
        fromCity.lat, fromCity.lon,
        target.lat, target.lon
      );
      return distance <= maxRange;
    });

    if (targetsInRange.length === 0) {
      // Try neutral targets (for expansion)
      const neutralTargets = GameState.cities.filter(c => c.owner === null).filter(target => {
        const distance = MapUtils.greatCircleDistance(
          fromCity.lat, fromCity.lon,
          target.lat, target.lon
        );
        return distance <= maxRange;
      });

      if (neutralTargets.length === 0) return null;

      // Prefer placeholders for forward bases
      const placeholders = neutralTargets.filter(c => c.isPlaceholder);
      if (placeholders.length > 0) {
        return this.selectBestTarget(fromCity, placeholders);
      }

      return this.selectBestTarget(fromCity, neutralTargets);
    }

    return this.selectBestTarget(fromCity, targetsInRange);
  },

  /**
   * Select best target from candidates
   * @param {object} fromCity - Airbase city
   * @param {Array} candidates - Candidate target cities
   * @returns {object} Best target
   */
  selectBestTarget(fromCity, candidates) {
    // Score each target: population * HP * attackBias / distance
    let bestTarget = null;
    let bestScore = -Infinity;

    for (const target of candidates) {
      const distance = MapUtils.greatCircleDistance(
        fromCity.lat, fromCity.lon,
        target.lat, target.lon
      );

      // Production proxy: population * (hp / 100)
      const productionValue = target.population * Math.max(0, target.hp / 100);

      // Score: value * bias / distance (prefer close, high-value targets)
      const score = (productionValue * CONSTANTS.BOT_ATTACK_BIAS) / (distance + 1);

      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    }

    return bestTarget;
  },

  /**
   * Allocate production to aircraft
   */
  allocateProduction() {
    const team = GameState.teams[this.teamName];

    // Check if building airbase
    const buildingAirbase = GameState.getTeamCities(this.teamName).some(c =>
      c.airbase && !c.airbase.complete
    );

    if (buildingAirbase) return; // Production is diverted to airbase

    // Try to produce aircraft
    // Bot strategy: 70% bombers, 30% fighters
    const bomberChance = 0.7;

    while (team.productionAccumulated > 0) {
      // Get best templates
      const bestBomber = team.templates
        .filter(t => t.type === 'bomber')
        .reduce((best, t) => t.costM > best.costM ? t : best, null);

      const bestFighter = team.templates
        .filter(t => t.type === 'fighter')
        .reduce((best, t) => t.costM > best.costM ? t : best, null);

      if (!bestBomber && !bestFighter) break;

      // Decide what to produce
      const produceBomber = GameState.rng.nextBool(bomberChance);

      if (produceBomber && bestBomber) {
        if (!ProductionSystem.tryProduceAircraft(this.teamName, bestBomber.id)) {
          break; // Not enough production
        }
      } else if (bestFighter) {
        if (!ProductionSystem.tryProduceAircraft(this.teamName, bestFighter.id)) {
          break; // Not enough production
        }
      } else {
        break;
      }
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIBot;
}
