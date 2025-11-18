// Game State - Central state management for the air war game

const GameState = {
  // Core game data
  seed: 0,
  rng: null,
  countries: null,
  cities: [],
  geoData: null,  // Raw GeoJSON for country rendering

  // Teams
  teams: {
    Red: {
      name: 'Red',
      color: '#cc0000',
      cities: [],
      aircraft: [],
      templates: [],
      productionAccumulated: 0,
      productionPerMinute: 0,
      deliveryPointCity: null,
      isBot: false,
      // Per-template production allocation and progress
      // Key: templateId, Value: {allocation: 0-100, progress: 0-100}
      templateProduction: {},
      // Legacy fields for compatibility
      fighterAllocation: 50,
      bomberAllocation: 50,
      fighterProgress: 0,
      bomberProgress: 0,
      selectedFighterTemplate: null,
      selectedBomberTemplate: null
    },
    Blue: {
      name: 'Blue',
      color: '#0066cc',
      cities: [],
      aircraft: [],
      templates: [],
      productionAccumulated: 0,
      productionPerMinute: 0,
      deliveryPointCity: null,
      isBot: true,
      // Per-template production allocation and progress
      templateProduction: {},
      // Legacy fields for compatibility
      fighterAllocation: 50,
      bomberAllocation: 50,
      fighterProgress: 0,
      bomberProgress: 0,
      selectedFighterTemplate: null,
      selectedBomberTemplate: null
    }
  },

  // Aircraft instances
  aircraft: [],
  aircraftIdCounter: 0,

  // Aircraft templates
  templates: [],
  templateIdCounter: 0,

  // Active raids
  activeRaids: [],
  raidIdCounter: 0,

  // Game timing
  tickCount: 0,
  elapsedSeconds: 0,
  isPaused: false,
  speedMultiplier: 1,

  // Debug
  debugLogCombat: false,

  /**
   * Initialize game state with seed and data
   * @param {number} seed - Random seed
   * @param {object} data - {countries, cities} from DataLoader
   */
  initialize(seed, data) {
    this.seed = seed;
    this.rng = new RNG(seed);
    this.countries = data.countries;
    this.cities = data.cities;
    this.geoData = data.geoData;

    // Reset state
    this.aircraft = [];
    this.aircraftIdCounter = 0;
    this.templates = [];
    this.templateIdCounter = 0;
    this.activeRaids = [];
    this.raidIdCounter = 0;
    this.tickCount = 0;
    this.elapsedSeconds = 0;
    this.isPaused = false;
    this.speedMultiplier = 1;

    // Create default templates
    this.createDefaultTemplates();
  },

  /**
   * Create default aircraft templates
   */
  createDefaultTemplates() {
    // Default fighter
    const defaultFighter = {
      ...DEFAULT_TEMPLATES.fighter,
      id: `tmpl-${this.templateIdCounter++}`
    };
    this.templates.push(defaultFighter);
    this.teams.Red.templates.push(defaultFighter);
    this.teams.Blue.templates.push(defaultFighter);

    // Default bomber
    const defaultBomber = {
      ...DEFAULT_TEMPLATES.bomber,
      id: `tmpl-${this.templateIdCounter++}`
    };
    this.templates.push(defaultBomber);
    this.teams.Red.templates.push(defaultBomber);
    this.teams.Blue.templates.push(defaultBomber);

    // Initialize templateProduction for both teams
    for (const teamName in this.teams) {
      const team = this.teams[teamName];
      team.templateProduction[defaultFighter.id] = { allocation: 50, progress: 0 };
      team.templateProduction[defaultBomber.id] = { allocation: 50, progress: 0 };
    }
  },

  /**
   * Assign countries to teams during game setup
   * @param {object} allocation - {countryName: "Red"|"Blue"|null}
   */
  assignCountries(allocation) {
    // Reset team cities
    this.teams.Red.cities = [];
    this.teams.Blue.cities = [];

    // Assign cities based on country allocation
    this.cities.forEach(city => {
      const teamName = allocation[city.country];
      if (teamName) {
        city.owner = teamName;
        this.teams[teamName].cities.push(city);
      } else {
        city.owner = null;
      }
    });

    // Set delivery points to largest city for each team
    this.setInitialDeliveryPoints();
  },

  /**
   * Set initial delivery points for each team (largest city)
   */
  setInitialDeliveryPoints() {
    for (const teamName in this.teams) {
      const team = this.teams[teamName];
      if (team.cities.length === 0) continue;

      // Find largest city
      const largestCity = team.cities.reduce((max, city) =>
        city.population > max.population ? city : max
      );

      // Build airbase at largest city
      largestCity.hasAirbase = true;
      largestCity.airbase = {
        owner: teamName,
        buildProgressM: CONSTANTS.AIRBASE_COST_M,
        complete: true,
        deliveryPoint: true,
        orders: null,
        escortAllocation: 0.5 // 50% escort, 50% defend
      };

      team.deliveryPointCity = largestCity;
    }
  },

  /**
   * Create a new aircraft instance
   * @param {string} templateId - Template ID
   * @param {string} cityId - Location city ID
   * @param {string} teamName - Owning team
   * @returns {object} New aircraft instance
   */
  createAircraft(templateId, cityId, teamName) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return null;

    const aircraft = {
      id: `plane-${this.aircraftIdCounter++}`,
      type: template.type,
      templateId: templateId,
      locationCityId: cityId,
      homeCityId: cityId, // Assigned base - stays even when in flight
      status: 'idle',
      hp: 1,
      owner: teamName
    };

    this.aircraft.push(aircraft);
    this.teams[teamName].aircraft.push(aircraft);

    return aircraft;
  },

  /**
   * Create a custom aircraft template
   * @param {string} teamName - Team creating the template
   * @param {object} specs - {type, costM, rangePoints, offense, defense, name}
   * @returns {object} New template
   */
  createTemplate(teamName, specs) {
    const template = {
      id: `tmpl-${this.templateIdCounter++}`,
      type: specs.type,
      costM: specs.costM,
      rangePoints: Math.max(CONSTANTS.RANGE_MIN, Math.min(CONSTANTS.RANGE_MAX, specs.rangePoints)),
      offense: Math.max(CONSTANTS.OFFENSE_MIN, Math.min(CONSTANTS.OFFENSE_MAX, specs.offense)),
      defense: Math.max(CONSTANTS.DEFENSE_MIN, Math.min(CONSTANTS.DEFENSE_MAX, specs.defense)),
      name: specs.name || `Custom ${specs.type}`
    };

    this.templates.push(template);
    this.teams[teamName].templates.push(template);

    // Initialize production allocation for new template
    const team = this.teams[teamName];
    team.templateProduction[template.id] = { allocation: 0, progress: 0 };

    return template;
  },

  /**
   * Get aircraft at a specific city (idle only)
   * @param {string} cityId - City ID
   * @returns {Array} Aircraft at this city
   */
  getAircraftAtCity(cityId) {
    return this.aircraft.filter(a => a.locationCityId === cityId && a.status === 'idle' && a.hp > 0);
  },

  /**
   * Get all aircraft assigned to a city (including those in flight)
   * @param {string} cityId - City ID
   * @returns {Array} Aircraft assigned to this city
   */
  getAircraftAssignedToCity(cityId) {
    return this.aircraft.filter(a => a.homeCityId === cityId && a.hp > 0);
  },

  /**
   * Get fighters at a city
   * @param {string} cityId - City ID
   * @returns {Array} Fighters at this city
   */
  getFightersAtCity(cityId) {
    return this.getAircraftAtCity(cityId).filter(a => a.type === 'fighter');
  },

  /**
   * Get bombers at a city
   * @param {string} cityId - City ID
   * @returns {Array} Bombers at this city
   */
  getBombersAtCity(cityId) {
    return this.getAircraftAtCity(cityId).filter(a => a.type === 'bomber');
  },

  /**
   * Get bombers assigned to a city (including those in flight)
   * @param {string} cityId - City ID
   * @returns {Array} Bombers assigned to this city
   */
  getBombersAssignedToCity(cityId) {
    return this.getAircraftAssignedToCity(cityId).filter(a => a.type === 'bomber');
  },

  /**
   * Re-base aircraft to a new city
   * @param {string} aircraftId - Aircraft ID
   * @param {string} newCityId - New home city ID
   */
  rebaseAircraft(aircraftId, newCityId) {
    const aircraft = this.aircraft.find(a => a.id === aircraftId);
    if (aircraft && aircraft.status === 'idle') {
      aircraft.homeCityId = newCityId;
      aircraft.locationCityId = newCityId;
    }
  },

  /**
   * Re-base all aircraft from one city to another
   * @param {string} fromCityId - Source city ID
   * @param {string} toCityId - Destination city ID
   */
  rebaseAllAircraft(fromCityId, toCityId) {
    const aircraft = this.getAircraftAtCity(fromCityId);
    for (const a of aircraft) {
      a.homeCityId = toCityId;
      a.locationCityId = toCityId;
    }
    console.log(`Rebased ${aircraft.length} aircraft from ${fromCityId} to ${toCityId}`);
  },

  /**
   * Get template by ID
   * @param {string} templateId - Template ID
   * @returns {object} Template or null
   */
  getTemplate(templateId) {
    return this.templates.find(t => t.id === templateId) || null;
  },

  /**
   * Get city by ID
   * @param {string} cityId - City ID
   * @returns {object} City or null
   */
  getCity(cityId) {
    return this.cities.find(c => c.id === cityId) || null;
  },

  /**
   * Get cities owned by a team
   * @param {string} teamName - Team name
   * @returns {Array} Cities owned by team
   */
  getTeamCities(teamName) {
    return this.cities.filter(c => c.owner === teamName);
  },

  /**
   * Update elapsed time
   */
  updateTime() {
    this.tickCount++;
    this.elapsedSeconds = (this.tickCount * CONSTANTS.TICK_MS) / 1000;
  },

  /**
   * Check if a country is fully controlled by a team
   * @param {string} countryName - Country name
   * @returns {string|null} Team name or null
   */
  getCountryController(countryName) {
    const country = this.countries.get(countryName);
    if (!country || country.cities.length === 0) return null;

    const owners = new Set(country.cities.map(c => c.owner).filter(o => o !== null));

    // If all cities owned by one team, return that team
    if (owners.size === 1) {
      return Array.from(owners)[0];
    }

    return null; // Multiple teams or no owner
  },

  /**
   * Check if a country is contested (both teams have cities)
   * @param {string} countryName - Country name
   * @returns {boolean} True if contested
   */
  isCountryContested(countryName) {
    const country = this.countries.get(countryName);
    if (!country || country.cities.length === 0) return false;

    const owners = new Set(country.cities.map(c => c.owner).filter(o => o !== null));
    return owners.size > 1;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameState;
}
