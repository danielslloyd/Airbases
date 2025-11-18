// UI Controls - Launch screen, left pane, city popup, and other UI elements

const UIControls = {
  currentScreen: 'launch', // 'launch' or 'game'
  countryAllocation: {},
  selectedCity: null,
  playerTeam: 'Red',
  aiTeam: 'Blue',
  team1Name: 'Red',
  team2Name: 'Blue',

  // Named colors for team naming
  namedColors: {
    'Red': [204, 0, 0],
    'Crimson': [220, 20, 60],
    'Maroon': [128, 0, 0],
    'Orange': [255, 165, 0],
    'Gold': [255, 215, 0],
    'Yellow': [255, 255, 0],
    'Lime': [0, 255, 0],
    'Green': [0, 128, 0],
    'Teal': [0, 128, 128],
    'Cyan': [0, 255, 255],
    'Blue': [0, 102, 204],
    'Navy': [0, 0, 128],
    'Purple': [128, 0, 128],
    'Magenta': [255, 0, 255],
    'Pink': [255, 192, 203],
    'Brown': [139, 69, 19],
    'Gray': [128, 128, 128],
    'Silver': [192, 192, 192]
  },

  /**
   * Initialize UI controls
   */
  initialize() {
    this.setupLaunchScreen();
    this.setupGameUI();
  },

  /**
   * Get closest named color for a hex color
   * @param {string} hexColor - Hex color string
   * @returns {string} Name of closest color
   */
  getColorName(hexColor) {
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);

    let closestName = 'Custom';
    let closestDist = Infinity;

    for (const [name, rgb] of Object.entries(this.namedColors)) {
      const dist = Math.sqrt(
        Math.pow(r - rgb[0], 2) +
        Math.pow(g - rgb[1], 2) +
        Math.pow(b - rgb[2], 2)
      );
      if (dist < closestDist) {
        closestDist = dist;
        closestName = name;
      }
    }

    return closestName;
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
   * Setup color pickers with luminance validation and naming
   */
  setupColorPickers() {
    const team1ColorInput = document.getElementById('team1-color');
    const team2ColorInput = document.getElementById('team2-color');
    const team1NameSpan = document.getElementById('team1-name');
    const team2NameSpan = document.getElementById('team2-name');

    const updateTeamName = (input, nameSpan, defaultColor) => {
      if (!this.validateColor(input.value)) {
        alert('Color too dark or too light. Please choose a different color.');
        input.value = defaultColor;
      }
      const name = this.getColorName(input.value);
      nameSpan.textContent = name;
      nameSpan.style.color = input.value;
      return name;
    };

    if (team1ColorInput && team1NameSpan) {
      this.team1Name = this.getColorName(team1ColorInput.value);
      team1NameSpan.textContent = this.team1Name;
      team1NameSpan.style.color = team1ColorInput.value;

      team1ColorInput.addEventListener('change', (e) => {
        this.team1Name = updateTeamName(e.target, team1NameSpan, '#cc0000');
        this.updateCountryAllocationLabels();
      });
    }

    if (team2ColorInput && team2NameSpan) {
      this.team2Name = this.getColorName(team2ColorInput.value);
      team2NameSpan.textContent = this.team2Name;
      team2NameSpan.style.color = team2ColorInput.value;

      team2ColorInput.addEventListener('change', (e) => {
        this.team2Name = updateTeamName(e.target, team2NameSpan, '#0066cc');
        this.updateCountryAllocationLabels();
      });
    }
  },

  /**
   * Validate color luminance
   * @param {string} color - Hex color
   * @returns {boolean} True if valid
   */
  validateColor(color) {
    const r = parseInt(color.substr(1, 2), 16) / 255;
    const g = parseInt(color.substr(3, 2), 16) / 255;
    const b = parseInt(color.substr(5, 2), 16) / 255;
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
    countryList.id = 'country-list';

    GameState.countries.forEach((country, countryName) => {
      const item = document.createElement('div');
      item.className = 'country-item';

      const label = document.createElement('label');
      label.textContent = countryName;

      const select = document.createElement('select');
      select.className = 'country-select';
      select.innerHTML = `
        <option value="">Neutral</option>
        <option value="team1">${this.team1Name}</option>
        <option value="team2">${this.team2Name}</option>
      `;
      select.addEventListener('change', (e) => {
        this.countryAllocation[countryName] = e.target.value || null;
      });

      item.appendChild(label);
      item.appendChild(select);
      countryList.appendChild(item);

      this.countryAllocation[countryName] = null;
    });

    container.appendChild(countryList);
  },

  /**
   * Update country allocation dropdown labels when team names change
   */
  updateCountryAllocationLabels() {
    const selects = document.querySelectorAll('.country-select');
    selects.forEach(select => {
      const options = select.querySelectorAll('option');
      if (options[1]) options[1].textContent = this.team1Name;
      if (options[2]) options[2].textContent = this.team2Name;
    });
  },

  /**
   * Start the game
   */
  startGame() {
    const seedInput = document.getElementById('seed-input');
    const seed = seedInput ? parseInt(seedInput.value) || Date.now() : Date.now();

    const team1Color = document.getElementById('team1-color');
    const team2Color = document.getElementById('team2-color');
    const playerTeamSelect = document.getElementById('player-team-select');

    // Set team colors and names
    GameState.teams.Red.color = team1Color ? team1Color.value : '#cc0000';
    GameState.teams.Red.name = this.team1Name;
    GameState.teams.Blue.color = team2Color ? team2Color.value : '#0066cc';
    GameState.teams.Blue.name = this.team2Name;

    // Determine which team is player vs AI
    const playerIsTeam1 = playerTeamSelect ? playerTeamSelect.value === 'team1' : true;
    this.playerTeam = playerIsTeam1 ? 'Red' : 'Blue';
    this.aiTeam = playerIsTeam1 ? 'Blue' : 'Red';

    GameState.teams.Red.isBot = !playerIsTeam1;
    GameState.teams.Blue.isBot = playerIsTeam1;

    // Convert country allocation from team1/team2 to Red/Blue
    const finalAllocation = {};
    for (const [country, team] of Object.entries(this.countryAllocation)) {
      if (team === 'team1') {
        finalAllocation[country] = 'Red';
      } else if (team === 'team2') {
        finalAllocation[country] = 'Blue';
      } else {
        finalAllocation[country] = null;
      }
    }

    // Assign countries
    GameState.assignCountries(finalAllocation);

    // Hide launch screen
    const launchScreen = document.getElementById('launch-screen');
    if (launchScreen) launchScreen.style.display = 'none';

    // Show game UI
    const gameUI = document.getElementById('game-ui');
    if (gameUI) gameUI.style.display = 'flex';

    // Update team headers with actual names
    const playerHeader = document.getElementById('player-team-header');
    const aiHeader = document.getElementById('ai-team-header');
    if (playerHeader) {
      playerHeader.textContent = `${GameState.teams[this.playerTeam].name} (You)`;
      playerHeader.style.color = GameState.teams[this.playerTeam].color;
    }
    if (aiHeader) {
      aiHeader.textContent = `${GameState.teams[this.aiTeam].name} (AI)`;
      aiHeader.style.color = GameState.teams[this.aiTeam].color;
    }

    // Initialize AI bot
    AIBot.initialize(this.aiTeam);

    // Start game loop
    MainLoop.start();

    // Initial render
    Renderer.render();

    this.currentScreen = 'game';
    this.updateGameUI();

    console.log('Game started with seed:', seed);
    console.log(`Player: ${this.playerTeam} (${GameState.teams[this.playerTeam].name}), AI: ${this.aiTeam} (${GameState.teams[this.aiTeam].name})`);
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

    // Production buttons
    document.getElementById('build-fighter-btn')?.addEventListener('click', () => this.buildUnit('fighter'));
    document.getElementById('build-bomber-btn')?.addEventListener('click', () => this.buildUnit('bomber'));

    // Design UI
    this.setupDesignUI();

    // Update UI periodically
    setInterval(() => this.updateGameUI(), 500);
  },

  /**
   * Setup aircraft design UI
   */
  setupDesignUI() {
    const costInput = document.getElementById('design-cost');
    const pointsDisplay = document.getElementById('design-points');

    if (costInput && pointsDisplay) {
      costInput.addEventListener('input', () => {
        const cost = parseInt(costInput.value) || 1;
        const points = ProductionSystem.calculateDesignPoints(cost);
        pointsDisplay.textContent = `Points available: ${points}`;
      });
    }

    document.getElementById('create-design-btn')?.addEventListener('click', () => this.createDesign());
  },

  /**
   * Build a unit (fighter or bomber)
   * @param {string} type - 'fighter' or 'bomber'
   */
  buildUnit(type) {
    const team = GameState.teams[this.playerTeam];
    const template = team.templates.find(t => t.type === type);

    if (!template) {
      alert(`No ${type} template available`);
      return;
    }

    if (team.productionAccumulated < template.costM) {
      alert(`Not enough production (need ${template.costM}M, have ${team.productionAccumulated.toFixed(2)}M)`);
      return;
    }

    if (ProductionSystem.tryProduceAircraft(this.playerTeam, template.id)) {
      console.log(`Built ${type}`);
    }
  },

  /**
   * Create a custom aircraft design
   */
  createDesign() {
    const type = document.getElementById('design-type').value;
    const cost = parseInt(document.getElementById('design-cost').value) || 1;
    const range = parseInt(document.getElementById('design-range').value) || 30;
    const offense = parseInt(document.getElementById('design-offense').value) || 30;
    const defense = parseInt(document.getElementById('design-defense').value) || 20;
    const name = document.getElementById('design-name').value || 'Custom';

    const minCost = type === 'bomber' ? CONSTANTS.BOMBER_BASE_COST_M : CONSTANTS.FIGHTER_BASE_COST_M;
    if (cost < minCost) {
      alert(`Minimum cost for ${type} is ${minCost}M`);
      return;
    }

    const availablePoints = ProductionSystem.calculateDesignPoints(cost);
    const usedPoints = range + offense + defense;

    if (usedPoints > availablePoints) {
      alert(`Too many points used (${usedPoints} > ${availablePoints})`);
      return;
    }

    const designCost = ProductionSystem.getDesignCost(this.playerTeam);
    const team = GameState.teams[this.playerTeam];

    if (team.productionAccumulated < designCost) {
      alert(`Not enough production to design (need ${designCost.toFixed(2)}M)`);
      return;
    }

    const specs = {
      type: type,
      costM: cost,
      rangePoints: range,
      offense: offense,
      defense: defense,
      name: name
    };

    if (ProductionSystem.startDesign(this.playerTeam, specs)) {
      alert(`Created design: ${name}`);
    }
  },

  /**
   * Update game UI displays
   */
  updateGameUI() {
    if (this.currentScreen !== 'game') return;

    // Update player team stats
    const playerTeamData = GameState.teams[this.playerTeam];
    this.updateElement('player-production', `${playerTeamData.productionPerMinute.toFixed(2)}M/min`);
    this.updateElement('player-accumulated', `${playerTeamData.productionAccumulated.toFixed(2)}M`);
    this.updateElement('player-cities', playerTeamData.cities.length);

    const playerFighters = playerTeamData.aircraft.filter(a => a.type === 'fighter' && a.hp > 0).length;
    const playerBombers = playerTeamData.aircraft.filter(a => a.type === 'bomber' && a.hp > 0).length;
    this.updateElement('player-aircraft', `${playerFighters}F / ${playerBombers}B`);

    // Update AI team stats
    const aiTeamData = GameState.teams[this.aiTeam];
    this.updateElement('ai-production', `${aiTeamData.productionPerMinute.toFixed(2)}M/min`);
    this.updateElement('ai-accumulated', `${aiTeamData.productionAccumulated.toFixed(2)}M`);
    this.updateElement('ai-cities', aiTeamData.cities.length);

    const aiFighters = aiTeamData.aircraft.filter(a => a.type === 'fighter' && a.hp > 0).length;
    const aiBombers = aiTeamData.aircraft.filter(a => a.type === 'bomber' && a.hp > 0).length;
    this.updateElement('ai-aircraft', `${aiFighters}F / ${aiBombers}B`);

    // Update game time
    const minutes = Math.floor(GameState.elapsedSeconds / 60);
    const seconds = Math.floor(GameState.elapsedSeconds % 60);
    this.updateElement('game-time', `${minutes}:${seconds.toString().padStart(2, '0')}`);

    // Update seed display
    this.updateElement('seed-display', GameState.seed);
  },

  /**
   * Update element text content
   */
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  },

  /**
   * Show city popup
   */
  showCityPopup(city) {
    this.selectedCity = city;
    const popup = document.getElementById('city-popup');
    if (!popup) return;

    popup.style.display = 'block';

    document.getElementById('popup-city-name').textContent = city.name;
    document.getElementById('popup-city-country').textContent = city.country;
    document.getElementById('popup-city-owner').textContent = city.owner ? GameState.teams[city.owner].name : 'Neutral';
    document.getElementById('popup-city-hp').textContent = city.hp.toFixed(1);

    const production = city.owner ? ProductionSystem.getCityProduction(city, city.owner) : 0;
    document.getElementById('popup-city-production').textContent = production.toFixed(2) + 'M/min';

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
   */
  showTargetSelector(airbaseCity) {
    const bombers = GameState.getBombersAtCity(airbaseCity.id);
    if (bombers.length === 0) {
      alert('No bombers at this airbase');
      return;
    }

    const maxRange = Math.max(...bombers.map(b => {
      const template = GameState.getTemplate(b.templateId);
      return template ? template.rangePoints * CONSTANTS.RANGE_KM_PER_POINT : 0;
    }));

    const targets = GameState.cities.filter(c => {
      if (c.owner === airbaseCity.owner) return false;
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
