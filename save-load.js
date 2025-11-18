// Save/Load System - Game state persistence

const SaveLoad = {
  STORAGE_KEY: 'airwar_save',

  /**
   * Save game state to localStorage
   * @returns {boolean} True if saved successfully
   */
  saveGame() {
    try {
      const saveData = {
        version: 1,
        timestamp: Date.now(),
        seed: GameState.seed,
        rngState: GameState.rng.getState(),
        tickCount: GameState.tickCount,
        elapsedSeconds: GameState.elapsedSeconds,
        speedMultiplier: GameState.speedMultiplier,

        // Teams
        teams: {},

        // Cities
        cities: GameState.cities.map(city => ({
          id: city.id,
          owner: city.owner,
          hp: city.hp,
          hasAirbase: city.hasAirbase,
          airbase: city.airbase,
          queuedProduction: city.queuedProduction
        })),

        // Aircraft
        aircraft: GameState.aircraft.map(a => ({
          id: a.id,
          type: a.type,
          templateId: a.templateId,
          locationCityId: a.locationCityId,
          status: a.status,
          hp: a.hp,
          owner: a.owner
        })),

        // Templates (custom ones only)
        customTemplates: GameState.templates.filter(t =>
          !t.id.includes('default')
        ),

        // Active raids
        activeRaids: GameState.activeRaids.map(r => ({
          id: r.id,
          fromCityId: r.fromCityId,
          toCityId: r.toCityId,
          team: r.team,
          bomberIds: r.bombers.map(b => b.id),
          escortIds: r.escorts.map(e => e.id),
          distance: r.distance,
          progress: r.progress,
          startTime: r.startTime,
          status: r.status,
          hasEngagedDefenders: r.hasEngagedDefenders
        }))
      };

      // Save team data
      for (const teamName in GameState.teams) {
        const team = GameState.teams[teamName];
        saveData.teams[teamName] = {
          color: team.color,
          productionAccumulated: team.productionAccumulated,
          deliveryPointCityId: team.deliveryPointCity ? team.deliveryPointCity.id : null,
          isBot: team.isBot
        };
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saveData));
      console.log('Game saved successfully');
      return true;
    } catch (error) {
      console.error('Failed to save game:', error);
      return false;
    }
  },

  /**
   * Load game state from localStorage
   * @returns {boolean} True if loaded successfully
   */
  loadGame() {
    try {
      const savedData = localStorage.getItem(this.STORAGE_KEY);
      if (!savedData) {
        console.log('No saved game found');
        return false;
      }

      const data = JSON.parse(savedData);

      // Restore RNG state
      GameState.rng.setState(data.rngState);
      GameState.tickCount = data.tickCount;
      GameState.elapsedSeconds = data.elapsedSeconds;
      GameState.speedMultiplier = data.speedMultiplier;

      // Restore team data
      for (const teamName in data.teams) {
        const teamData = data.teams[teamName];
        const team = GameState.teams[teamName];
        if (team) {
          team.color = teamData.color;
          team.productionAccumulated = teamData.productionAccumulated;
          team.isBot = teamData.isBot;
        }
      }

      // Restore cities
      for (const cityData of data.cities) {
        const city = GameState.getCity(cityData.id);
        if (city) {
          city.owner = cityData.owner;
          city.hp = cityData.hp;
          city.hasAirbase = cityData.hasAirbase;
          city.airbase = cityData.airbase;
          city.queuedProduction = cityData.queuedProduction;
        }
      }

      // Rebuild team city lists
      for (const teamName in GameState.teams) {
        GameState.teams[teamName].cities = GameState.getTeamCities(teamName);
      }

      // Restore delivery points
      for (const teamName in data.teams) {
        const teamData = data.teams[teamName];
        if (teamData.deliveryPointCityId) {
          GameState.teams[teamName].deliveryPointCity = GameState.getCity(teamData.deliveryPointCityId);
        }
      }

      // Restore custom templates
      for (const templateData of data.customTemplates) {
        if (!GameState.templates.find(t => t.id === templateData.id)) {
          GameState.templates.push(templateData);
        }
      }

      // Restore aircraft
      GameState.aircraft = [];
      for (const teamName in GameState.teams) {
        GameState.teams[teamName].aircraft = [];
      }

      for (const aircraftData of data.aircraft) {
        const aircraft = {
          id: aircraftData.id,
          type: aircraftData.type,
          templateId: aircraftData.templateId,
          locationCityId: aircraftData.locationCityId,
          status: aircraftData.status,
          hp: aircraftData.hp,
          owner: aircraftData.owner
        };

        GameState.aircraft.push(aircraft);
        if (GameState.teams[aircraft.owner]) {
          GameState.teams[aircraft.owner].aircraft.push(aircraft);
        }
      }

      // Restore active raids (simplified - may need full reconstruction)
      GameState.activeRaids = [];
      // Note: Full raid restoration would require rebuilding aircraft references

      console.log('Game loaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to load game:', error);
      return false;
    }
  },

  /**
   * Export game state as JSON file
   */
  exportGame() {
    this.saveGame(); // Save to localStorage first

    const saveData = localStorage.getItem(this.STORAGE_KEY);
    if (!saveData) {
      alert('No save data to export');
      return;
    }

    const blob = new Blob([saveData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airwar_save_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('Game exported');
  },

  /**
   * Import game state from JSON file
   * @param {File} file - File to import
   */
  importGame(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        localStorage.setItem(this.STORAGE_KEY, data);
        this.loadGame();
        console.log('Game imported');

        // Reload page to apply changes
        if (confirm('Game imported. Reload page to apply?')) {
          location.reload();
        }
      } catch (error) {
        console.error('Failed to import game:', error);
        alert('Failed to import game file');
      }
    };
    reader.readAsText(file);
  },

  /**
   * Clear saved game
   */
  clearSave() {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('Save cleared');
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SaveLoad;
}
