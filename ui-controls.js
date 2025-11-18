// UI Controls - Launch screen, left pane, city popup, and other UI elements

const UIControls = {
  currentScreen: 'launch', // 'launch' or 'game'
  countryAllocation: {},
  selectedCity: null,
  playerTeam: 'Red',

  /**
   * Initialize UI controls
   */
  initialize() {
    this.setupLaunchScreen();
    this.setupGameUI();
  },

  /**
   * Setup launch screen
   */
  setupLaunchScreen() {
    const launchScreen = document.getElementById('launch-screen');
    if (!launchScreen) return;

    // Generate random seed
    const seedInput = document.getElementById('seed-input');
    if (seedInput && !seedInput.value) {
      seedInput.value = Math.floor(Math.random() * 1000000);
    }

    // Team color pickers
    this.setupColorPickers();

    // Country allocation
    this.setupCountryAllocation();

    // Start game button
    const startButton = document.getElementById('start-game-btn');
    if (startButton) {
      startButton.addEventListener('click', () => this.startGame());
    }
  },

  /**
   * Setup color pickers with luminance validation
   */
  setupColorPickers() {
    const redColorInput = document.getElementById('red-color');
    const blueColorInput = document.getElementById('blue-color');

    if (redColorInput) {
      redColorInput.value = '#cc0000';
      redColorInput.addEventListener('change', (e) => {
        if (!this.validateColor(e.target.value)) {
          alert('Color too dark or too light. Please choose a different color.');
          e.target.value = '#cc0000';
        }
      });
    }

    if (blueColorInput) {
      blueColorInput.value = '#0066cc';
      blueColorInput.addEventListener('change', (e) => {
        if (!this.validateColor(e.target.value)) {
          alert('Color too dark or too light. Please choose a different color.');
          e.target.value = '#0066cc';
        }
      });
    }
  },

  /**
   * Validate color luminance
   * @param {string} color - Hex color
   * @returns {boolean} True if valid
   */
  validateColor(color) {
    // Convert hex to RGB
    const r = parseInt(color.substr(1, 2), 16) / 255;
    const g = parseInt(color.substr(3, 2), 16) / 255;
    const b = parseInt(color.substr(5, 2), 16) / 255;

    // Calculate relative luminance
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    return luminance >= CONSTANTS.MIN_COLOR_LUMINANCE && luminance <= CONSTANTS.MAX_COLOR_LUMINANCE;
  },

  /**
   * Setup country allocation UI
   */
  setupCountryAllocation() {
    const container = document.getElementById('country-allocation');
    if (!container || !GameState.countries) return;

    container.innerHTML = '<h3>Allocate Countries</h3>';

    const countryList = document.createElement('div');
    countryList.className = 'country-list';

    GameState.countries.forEach((country, countryName) => {
      const item = document.createElement('div');
      item.className = 'country-item';

      const label = document.createElement('label');
      label.textContent = countryName;

      const select = document.createElement('select');
      select.innerHTML = `
        <option value="">Neutral</option>
        <option value="Red">Red</option>
        <option value="Blue">Blue</option>
      `;
      select.addEventListener('change', (e) => {
        this.countryAllocation[countryName] = e.target.value || null;
      });

      item.appendChild(label);
      item.appendChild(select);
      countryList.appendChild(item);

      // Initialize allocation
      this.countryAllocation[countryName] = null;
    });

    container.appendChild(countryList);
  },

  /**
   * Start the game
   */
  startGame() {
    const seedInput = document.getElementById('seed-input');
    const seed = seedInput ? parseInt(seedInput.value) : Date.now();

    const redColor = document.getElementById('red-color');
    const blueColor = document.getElementById('blue-color');

    // Set team colors
    if (redColor) GameState.teams.Red.color = redColor.value;
    if (blueColor) GameState.teams.Blue.color = blueColor.value;

    // Assign countries
    GameState.assignCountries(this.countryAllocation);

    // Hide launch screen
    const launchScreen = document.getElementById('launch-screen');
    if (launchScreen) launchScreen.style.display = 'none';

    // Show game UI
    const gameUI = document.getElementById('game-ui');
    if (gameUI) gameUI.style.display = 'flex';

    // Initialize AI bot
    AIBot.initialize('Blue');

    // Start game loop
    MainLoop.start();

    // Initial render
    Renderer.render();

    this.currentScreen = 'game';
    this.updateGameUI();

    console.log('Game started with seed:', seed);
  },

  /**
   * Setup game UI elements
   */
  setupGameUI() {
    // Pause button
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        MainLoop.togglePause();
        pauseBtn.textContent = GameState.isPaused ? 'Resume' : 'Pause';
      });
    }

    // Speed buttons
    document.getElementById('speed-1x')?.addEventListener('click', () => MainLoop.setSpeed(1));
    document.getElementById('speed-2x')?.addEventListener('click', () => MainLoop.setSpeed(2));
    document.getElementById('speed-4x')?.addEventListener('click', () => MainLoop.setSpeed(4));

    // Save/Load buttons
    document.getElementById('save-btn')?.addEventListener('click', () => SaveLoad.saveGame());
    document.getElementById('load-btn')?.addEventListener('click', () => SaveLoad.loadGame());

    // Close city popup
    document.getElementById('close-popup-btn')?.addEventListener('click', () => this.hideCityPopup());

    // Update UI periodically
    setInterval(() => this.updateGameUI(), 1000);
  },

  /**
   * Update game UI displays
   */
  updateGameUI() {
    if (this.currentScreen !== 'game') return;

    // Update team stats
    for (const teamName in GameState.teams) {
      const team = GameState.teams[teamName];
      const prefix = teamName.toLowerCase();

      this.updateElement(`${prefix}-production`, `${team.productionPerMinute.toFixed(2)}M/min`);
      this.updateElement(`${prefix}-accumulated`, `${team.productionAccumulated.toFixed(2)}M`);
      this.updateElement(`${prefix}-cities`, team.cities.length);

      const fighters = team.aircraft.filter(a => a.type === 'fighter' && a.hp > 0).length;
      const bombers = team.aircraft.filter(a => a.type === 'bomber' && a.hp > 0).length;
      this.updateElement(`${prefix}-aircraft`, `${fighters}F / ${bombers}B`);
    }

    // Update game time
    const minutes = Math.floor(GameState.elapsedSeconds / 60);
    const seconds = Math.floor(GameState.elapsedSeconds % 60);
    this.updateElement('game-time', `${minutes}:${seconds.toString().padStart(2, '0')}`);

    // Update seed display
    this.updateElement('seed-display', GameState.seed);
  },

  /**
   * Update element text content
   * @param {string} id - Element ID
   * @param {string} value - New value
   */
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  },

  /**
   * Show city popup
   * @param {object} city - City to show
   */
  showCityPopup(city) {
    this.selectedCity = city;
    const popup = document.getElementById('city-popup');
    if (!popup) return;

    popup.style.display = 'block';

    // Update city info
    document.getElementById('popup-city-name').textContent = city.name;
    document.getElementById('popup-city-country').textContent = city.country;
    document.getElementById('popup-city-owner').textContent = city.owner || 'Neutral';
    document.getElementById('popup-city-hp').textContent = city.hp.toFixed(1);

    const production = city.owner ? ProductionSystem.getCityProduction(city, city.owner) : 0;
    document.getElementById('popup-city-production').textContent = production.toFixed(2) + 'M/min';

    // Aircraft counts
    const aircraft = GameState.getAircraftAtCity(city.id);
    const fighters = aircraft.filter(a => a.type === 'fighter').length;
    const bombers = aircraft.filter(a => a.type === 'bomber').length;
    document.getElementById('popup-aircraft-count').textContent = `${fighters}F / ${bombers}B`;

    // Airbase controls (only if owned by player)
    const airbaseControls = document.getElementById('popup-airbase-controls');
    if (city.owner === this.playerTeam) {
      airbaseControls.style.display = 'block';

      const buildAirbaseBtn = document.getElementById('build-airbase-btn');
      if (city.hasAirbase) {
        buildAirbaseBtn.style.display = 'none';
      } else {
        buildAirbaseBtn.style.display = 'block';
        buildAirbaseBtn.onclick = () => {
          if (ProductionSystem.buildAirbase(city.id, this.playerTeam)) {
            alert(`Started building airbase at ${city.name}`);
            this.showCityPopup(city);
          }
        };
      }

      const setDeliveryBtn = document.getElementById('set-delivery-btn');
      if (city.hasAirbase && city.airbase && city.airbase.complete) {
        setDeliveryBtn.style.display = 'block';
        setDeliveryBtn.onclick = () => {
          if (ProductionSystem.setDeliveryPoint(city.id, this.playerTeam)) {
            alert(`Set ${city.name} as delivery point`);
            this.showCityPopup(city);
          }
        };
      } else {
        setDeliveryBtn.style.display = 'none';
      }

      const setBomberTargetBtn = document.getElementById('set-bomber-target-btn');
      if (city.hasAirbase && city.airbase && city.airbase.complete) {
        setBomberTargetBtn.style.display = 'block';
        setBomberTargetBtn.onclick = () => {
          this.showTargetSelector(city);
        };
      } else {
        setBomberTargetBtn.style.display = 'none';
      }
    } else {
      airbaseControls.style.display = 'none';
    }
  },

  /**
   * Hide city popup
   */
  hideCityPopup() {
    const popup = document.getElementById('city-popup');
    if (popup) popup.style.display = 'none';
    this.selectedCity = null;
  },

  /**
   * Show target selector for bomber orders
   * @param {object} airbaseCity - Airbase city
   */
  showTargetSelector(airbaseCity) {
    // Simple implementation: prompt for target
    // In a full implementation, this would highlight reachable targets on the globe

    const bombers = GameState.getBombersAtCity(airbaseCity.id);
    if (bombers.length === 0) {
      alert('No bombers at this airbase');
      return;
    }

    // Find longest range bomber
    const maxRange = Math.max(...bombers.map(b => {
      const template = GameState.getTemplate(b.templateId);
      return template ? template.rangePoints * CONSTANTS.RANGE_KM_PER_POINT : 0;
    }));

    // Get targets in range
    const targets = GameState.cities.filter(c => {
      if (c.owner === airbaseCity.owner) return false; // Don't target own cities

      const distance = MapUtils.greatCircleDistance(
        airbaseCity.lat, airbaseCity.lon,
        c.lat, c.lon
      );

      return distance <= maxRange;
    });

    if (targets.length === 0) {
      alert('No targets in range');
      return;
    }

    // Create simple selector
    const targetName = prompt(`Enter target city name (range: ${maxRange}km):\n\n` +
      targets.map(t => t.name).join(', '));

    if (!targetName) return;

    const target = targets.find(t => t.name.toLowerCase() === targetName.toLowerCase());
    if (target) {
      ProductionSystem.setBomberOrders(airbaseCity.id, target.id);
      alert(`Set bomber target to ${target.name}`);
      this.showCityPopup(airbaseCity);
    } else {
      alert('Target not found or not in range');
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIControls;
}
