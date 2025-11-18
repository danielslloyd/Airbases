# Air War Game - WWII Air Strategy

A real-time strategy game rendered on a 3D globe where two teams (Red and Blue) compete for global air supremacy through city control, airbase construction, and strategic bombing campaigns.

## Features

- **3D Globe Visualization**: Interactive D3-based globe with drag-to-rotate controls
- **Real Cities**: Uses actual city data with populations from `all-cities-with-population.csv`
- **Two-Team Competition**: Red (player) vs Blue (AI bot)
- **City Conquest**: Capture cities through bombing to expand your territory
- **Airbase System**: Build airbases at strategic locations to extend your reach
- **Aircraft Design**: Customize bombers and fighters with logarithmic cost scaling
- **Production System**: Cities generate production based on population and HP
- **Probabilistic Combat**: Realistic combat resolution using statistical formulas
- **Aggressive AI**: Computer opponent that actively expands and attacks
- **Deterministic RNG**: Reproducible games using random seeds
- **Save/Load**: Persist game state to continue later

## Getting Started

### Requirements

- Modern web browser (Chrome, Firefox, Edge recommended)
- Local web server (or open directly if browser allows)

### Running the Game

1. **Open `index.html` in your browser**
   - If you have Python: `python -m http.server 8000` then visit `http://localhost:8000`
   - Or simply open `index.html` directly if your browser allows local file access

2. **Launch Screen**
   - Set a random seed (or leave blank for random)
   - Choose team colors (Red and Blue)
   - Allocate countries to teams using dropdown menus
   - Click "Start Game"

3. **Playing the Game**
   - **Drag the globe** to rotate and view different regions
   - **Click on cities** to see details and give orders
   - **Build airbases** at owned cities to enable bomber raids
   - **Set bomber targets** to attack enemy cities
   - **Watch AI opponent** expand and retaliate

## Game Mechanics

### Cities and HP

- Cities have **HP from -100 to +100**
- Cities at positive HP are owned by a team
- Cities at negative HP are being captured (ring indicator)
- When HP reaches -100, the city flips to the attacking team
- HP recovers at **+60 HP/minute** toward +100

### Production System

- Each city produces `(population / 1000) * (HP / 100)` M/minute
- Production accumulates across all owned cities
- **Delivery Point** cities always produce at maximum (HP treated as 100)
- Production is used to build aircraft and airbases

### Airbases

- Cost: **50M** (Millions)
- Required for bomber operations
- Building an airbase pauses aircraft production
- Each team starts with one airbase at their largest city
- Set one airbase as **Delivery Point** where new aircraft appear

### Aircraft

**Default Units:**
- Fighter: 1M cost, 50 range, 30 offense, 30 defense
- Bomber: 3M cost, 50 range, 30 offense, 20 defense

**Custom Design:**
- Design cost = 1 minute of current production
- Points available = `floor(18 * log10(cost + 1))`
- Allocate points to range (10-100), offense (1-100), defense (1-100)
- 1 range point = 10 km
- Diminishing returns encourage strategic choices

### Combat

**Fighter vs Fighter:**
- Probability of kill = `offense / (offense + defense + 1)`
- Both sides can take casualties
- Escort fighters protect bombers

**Bomber Attacks:**
- Damage probability = `offense / (offense + city_defense + 50)`
- Damage = `1 + floor(offense / 10)` HP
- Bombers can be shot down by city defenses

### Raids

- Raids dispatch **every 20 seconds** from airbases with orders
- Escort allocation slider: percentage of fighters escorting vs defending
- Raid path follows great-circle route
- Defenders intercept if their range covers any part of the path
- Combat resolves at 50% progress (midpoint)

### AI Opponent

The Blue team AI is programmed to:
- Build airbases aggressively at all cities
- Design upgraded bombers when production allows
- Target highest-value enemy cities within range
- Prefer capturing neutral placeholders for forward bases
- Maintain 70% escort / 30% defense fighter allocation
- Produce 70% bombers / 30% fighters

## Controls

### During Game

- **Drag**: Rotate globe
- **Click City**: View city details and controls
- **Pause**: Pause/resume game
- **Speed**: 1x, 2x, 4x time multipliers
- **Save/Load**: Persist game state

### City Popup (when city is owned by you)

- **Build Airbase**: Start airbase construction (50M)
- **Set as Delivery Point**: Make this airbase the spawn point for new aircraft
- **Set Bomber Target**: Choose target city for raids

## Tunables

All game constants are defined in `constants.js` and can be modified:

```javascript
TICK_MS: 100                    // Game tick interval (milliseconds)
RAID_DISPATCH_INTERVAL_S: 20    // Seconds between raid launches
HP_RECOVERY_PER_MIN: 60         // HP recovery rate
AIRBASE_COST_M: 50              // Airbase build cost
BOMBER_BASE_COST_M: 3           // Default bomber cost
FIGHTER_BASE_COST_M: 1          // Default fighter cost
DESIGN_BASE_POINTS: 18          // Aircraft design point multiplier
POP_SCALE: 1000                 // Population divisor for production
BOT_ATTACK_BIAS: 1.3            // AI aggression multiplier
CITY_BASE_DEFENSE: 50           // Base city defense strength
```

## Files Structure

```
├── index.html              # Main game file with UI
├── constants.js            # Game constants and tunables
├── rng.js                  # Deterministic random number generator
├── map-utils.js            # Geographic calculations
├── data-loader.js          # Load GeoJSON and CSV data
├── game-state.js           # Central state management
├── production.js           # Production and aircraft creation
├── combat.js               # Combat resolution
├── ai-bot.js               # AI opponent controller
├── renderer.js             # Globe and city rendering
├── main-loop.js            # Game tick loop
├── save-load.js            # Save/load persistence
├── ui-controls.js          # UI and controls
├── custom.geo.json         # World map GeoJSON
├── all-cities-with-population.csv  # City data
└── README.md               # This file
```

## Gameplay Tips

1. **Secure High-Population Cities**: They generate more production
2. **Build Forward Airbases**: Extend your bomber range
3. **Balance Your Forces**: Bombers attack, fighters defend
4. **Protect Your Delivery Point**: It produces at maximum HP
5. **Watch Enemy Patterns**: AI will target your production centers
6. **Use Custom Designs**: When production allows, design long-range bombers
7. **Strategic Placement**: Place airbases near enemy territory
8. **HP Management**: Cities recover slowly; sustained attacks matter

## Balancing Notes

The default settings are designed for strategic gameplay:

- **Production Scale**: Cities with 1M population produce ~1M/min at full HP
- **Airbase Cost**: 50M is roughly 1 minute of a large city's production
- **Aircraft Costs**: Fighters are cheap (1M), bombers expensive (3M)
- **HP Recovery**: +60/min means recovery from 0 to 100 takes ~1.7 minutes
- **Combat**: Probabilistic outcomes create uncertainty and excitement

Adjust tunables in `constants.js` to change game balance.

## Debug Mode

Enable combat logging by setting in browser console:

```javascript
GameState.debugLogCombat = true;
```

This will output detailed combat reports to the console.

## Known Limitations

- Country coloring/hatching not fully implemented (cities show ownership)
- Aircraft animation along paths not implemented (instant movement)
- No sound effects or music
- Mobile support limited (designed for desktop)
- Save/load may not persist active raids fully

## Credits

- **D3.js**: Globe visualization and data handling
- **Versor**: Quaternion-based globe rotation (Mike Bostock)
- **World Atlas**: TopoJSON world map data
- **City Data**: Population database from public sources

## License

This project is open source and available for educational purposes.

---

**Enjoy conquering the globe through air supremacy!** ✈️💣🌍
