// Air War Game - Constants and Tunables
// All tunable game parameters in one place for easy balancing

const CONSTANTS = {
  // Timing
  TICK_MS: 100,                          // Game tick interval (100ms = 10 ticks/sec)
  RAID_DISPATCH_INTERVAL_S: 20,          // Raids dispatch every 20 seconds

  // HP and Recovery
  HP_MIN: -100,
  HP_MAX: 100,
  HP_RECOVERY_PER_MIN: 60,               // +60 HP per minute toward +100
  HP_RECOVERY_PER_TICK: 60 / 600,        // 0.1 HP per 100ms tick

  // Production
  POP_SCALE: 1000,                       // Divide population by this for production
  AIRBASE_COST_M: 50,                    // Cost to build an airbase (in Millions)
  BOMBER_BASE_COST_M: 3,                 // Default bomber cost
  FIGHTER_BASE_COST_M: 1,                // Default fighter cost

  // Aircraft Design System
  DESIGN_BASE_POINTS: 18,                // Base multiplier for log10(cost) formula
  DESIGN_COST_MULTIPLIER: 1,             // Design costs 1 minute of current production

  // Aircraft Stats Bounds
  RANGE_MIN: 10,                         // Minimum range points
  RANGE_MAX: 100,                        // Maximum range points
  OFFENSE_MIN: 1,                        // Minimum offense points
  OFFENSE_MAX: 100,                      // Maximum offense points
  DEFENSE_MIN: 1,                        // Minimum defense points
  DEFENSE_MAX: 100,                      // Maximum defense points
  RANGE_KM_PER_POINT: 10,                // 1 range point = 10 km

  // Combat
  EPSILON: 1,                            // Small value to avoid division by zero
  CITY_BASE_DEFENSE: 50,                 // Base defense value for cities
  BOMBER_DAMAGE_BASE: 1,                 // Base damage per bomber hit
  BOMBER_DAMAGE_SCALE: 10,               // floor(offense / 10) bonus damage

  // AI Bot Behavior
  BOT_ATTACK_BIAS: 1.3,                  // Multiplier for target priority (higher = more aggressive)
  BOT_AIRBASE_BUILD_THRESHOLD: 0.8,      // Fraction of production reserved for airbase builds
  BOT_MIN_PRODUCTION_FOR_DESIGN: 100,    // Minimum M production before bot designs new aircraft
  BOT_DESIGN_CHANCE: 0.1,                // 10% chance per eligible tick to design

  // UI / Colors
  MIN_COLOR_LUMINANCE: 0.08,             // Minimum luminance for team colors (prevent too dark)
  MAX_COLOR_LUMINANCE: 0.92,             // Maximum luminance for team colors (prevent too light)

  // Rendering
  CITY_DOT_RADIUS: 3,                    // Radius for city dots
  CITY_DOT_RADIUS_PLACEHOLDER: 2,        // Radius for placeholder cities
  AIRBASE_HALO_RADIUS: 8,                // Halo around airbases
  DELIVERY_SQUARE_SIZE: 6,               // Size of delivery point square
  CAPTURE_RING_WIDTH: 2,                 // Width of capture progress ring

  // Placeholder City Generation
  PLACEHOLDER_CITIES_PER_COUNTRY: 3,     // Number of placeholder cities to create per country
  PLACEHOLDER_MIN_SPACING_KM: 500,       // Minimum distance between placeholders
};

// Default Aircraft Templates
const DEFAULT_TEMPLATES = {
  fighter: {
    id: 'tmpl-fighter-default',
    type: 'fighter',
    costM: 1,
    rangePoints: 50,
    offense: 30,
    defense: 30,
    name: 'Default Fighter'
  },
  bomber: {
    id: 'tmpl-bomber-default',
    type: 'bomber',
    costM: 3,
    rangePoints: 50,
    offense: 30,
    defense: 20,
    name: 'Default Bomber'
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONSTANTS, DEFAULT_TEMPLATES };
}
