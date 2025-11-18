// Main Game Loop - Tick loop, raid dispatching, and game progression

const MainLoop = {
  intervalHandle: null,
  lastDispatchTimes: new Map(), // airbase city ID -> last dispatch time

  /**
   * Start the game loop
   */
  start() {
    if (this.intervalHandle) {
      this.stop();
    }

    // Calculate effective tick interval based on speed
    const effectiveTickMs = CONSTANTS.TICK_MS / GameState.speedMultiplier;

    this.intervalHandle = setInterval(() => {
      this.tick();
    }, effectiveTickMs);

    console.log('Game loop started');
  },

  /**
   * Stop the game loop
   */
  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log('Game loop stopped');
    }
  },

  /**
   * Main game tick
   */
  tick() {
    if (GameState.isPaused) return;

    // Update time
    GameState.updateTime();

    // Update production
    ProductionSystem.updateProduction(CONSTANTS.TICK_MS);

    // Process airbase builds
    ProductionSystem.processAirbaseBuilds(CONSTANTS.TICK_MS);

    // Update HP recovery
    CombatSystem.updateHPRecovery(CONSTANTS.TICK_MS);

    // Process raid dispatches
    this.processDispatchSchedules();

    // Move aircraft and resolve combat
    this.moveAircraft(CONSTANTS.TICK_MS);
    this.resolveInAirEncounters();
    this.resolveArrivals();

    // Update AI bot
    for (const teamName in GameState.teams) {
      if (GameState.teams[teamName].isBot) {
        AIBot.update(GameState.elapsedSeconds);
      }
    }

    // Render update (if renderer is available)
    if (typeof Renderer !== 'undefined') {
      Renderer.render();
    }
  },

  /**
   * Process raid dispatch schedules
   */
  processDispatchSchedules() {
    const dispatchInterval = CONSTANTS.RAID_DISPATCH_INTERVAL_S;

    for (const city of GameState.cities) {
      if (!city.hasAirbase || !city.airbase || !city.airbase.complete) continue;
      if (!city.airbase.orders) continue;

      const cityId = city.id;

      // Check if it's time to dispatch
      const lastDispatch = this.lastDispatchTimes.get(cityId) || 0;
      const timeSinceDispatch = GameState.elapsedSeconds - lastDispatch;

      if (timeSinceDispatch >= dispatchInterval) {
        this.dispatchRaid(city);
        this.lastDispatchTimes.set(cityId, GameState.elapsedSeconds);
      }
    }
  },

  /**
   * Dispatch a raid from an airbase
   * @param {object} airbaseCity - City with airbase
   */
  dispatchRaid(airbaseCity) {
    if (!airbaseCity.airbase.orders) return;

    const targetCityId = airbaseCity.airbase.orders.targetCityId;
    const targetCity = GameState.getCity(targetCityId);
    if (!targetCity) return;

    // Get all bombers at airbase
    const bombers = GameState.getBombersAtCity(airbaseCity.id).filter(b => b.status === 'idle');
    if (bombers.length === 0) return;

    // Get escort fighters based on allocation
    const fighters = GameState.getFightersAtCity(airbaseCity.id).filter(f => f.status === 'idle');
    const numEscorts = Math.floor(fighters.length * airbaseCity.airbase.escortAllocation);

    // Sort fighters by range (prefer longer range for escort)
    const sortedFighters = fighters.sort((a, b) => {
      const templateA = GameState.getTemplate(a.templateId);
      const templateB = GameState.getTemplate(b.templateId);
      const rangeA = templateA ? templateA.rangePoints : 0;
      const rangeB = templateB ? templateB.rangePoints : 0;
      return rangeB - rangeA;
    });

    const escorts = sortedFighters.slice(0, numEscorts);

    // Calculate raid distance
    const distance = MapUtils.greatCircleDistance(
      airbaseCity.lat, airbaseCity.lon,
      targetCity.lat, targetCity.lon
    );

    // Create raid
    const raid = {
      id: `raid-${GameState.raidIdCounter++}`,
      fromCityId: airbaseCity.id,
      toCityId: targetCityId,
      team: airbaseCity.owner,
      bombers: bombers,
      escorts: escorts,
      distance: distance,
      progress: 0, // 0 to 1
      speed: 500, // km per minute (arbitrary)
      durationMinutes: distance / 500,
      startTime: GameState.elapsedSeconds,
      status: 'enroute', // 'enroute', 'engaging', 'attacking', 'returning', 'completed'
      hasEngagedDefenders: false
    };

    // Mark aircraft as on raid
    for (const bomber of bombers) {
      bomber.status = 'onRaid';
    }
    for (const escort of escorts) {
      escort.status = 'onRaid';
    }

    GameState.activeRaids.push(raid);

    if (GameState.debugLogCombat) {
      console.log(`${airbaseCity.owner} dispatched raid from ${airbaseCity.name} to ${targetCity.name}`);
      console.log(`  ${bombers.length} bombers, ${escorts.length} escorts, ${distance.toFixed(0)} km`);
    }
  },

  /**
   * Move aircraft (update raid progress)
   * @param {number} deltaMs - Time delta
   */
  moveAircraft(deltaMs) {
    const deltaMinutes = deltaMs / 60000;

    for (const raid of GameState.activeRaids) {
      if (raid.status === 'completed') continue;

      // Update progress
      if (raid.status === 'enroute' || raid.status === 'engaging') {
        raid.progress += deltaMinutes / raid.durationMinutes;
        raid.progress = Math.min(1, raid.progress);
      }
    }
  },

  /**
   * Resolve in-air encounters with defenders
   */
  resolveInAirEncounters() {
    for (const raid of GameState.activeRaids) {
      if (raid.status !== 'enroute') continue;
      if (raid.hasEngagedDefenders) continue;

      // Check if raid is at 50% progress (midpoint engagement)
      if (raid.progress >= 0.5) {
        this.resolveDefenderEngagement(raid);
        raid.hasEngagedDefenders = true;
      }
    }
  },

  /**
   * Resolve defender engagement for a raid
   * @param {object} raid - Raid object
   */
  resolveDefenderEngagement(raid) {
    const fromCity = GameState.getCity(raid.fromCityId);
    const toCity = GameState.getCity(raid.toCityId);

    // Get defending team
    const defenderTeam = toCity.owner;
    if (!defenderTeam) return; // No defenders for neutral cities

    // Get defending fighters
    const defenders = CombatSystem.getDefendingFighters(
      { fromCity, toCity },
      defenderTeam
    );

    if (defenders.length === 0) return;

    // Resolve escort vs defenders
    const escorts = raid.escorts.filter(e => e.hp > 0);

    if (escorts.length > 0) {
      const result = CombatSystem.resolveFighterVsFighter(escorts, defenders, GameState.rng);

      if (GameState.debugLogCombat) {
        console.log(`Raid ${raid.id}: ${escorts.length} escorts vs ${defenders.length} defenders`);
        console.log(`  Escort losses: ${result.attackerLosses.length}, Defender losses: ${result.defenderLosses.length}`);
      }
    }

    // Surviving defenders attack bombers
    const survivingDefenders = defenders.filter(d => d.hp > 0);
    if (survivingDefenders.length > 0) {
      // Calculate total defender offense
      const defenderOffense = survivingDefenders.reduce((sum, d) => {
        const template = GameState.getTemplate(d.templateId);
        return sum + (template ? template.offense : 0);
      }, 0);

      // Bombers can be shot down
      const bombers = raid.bombers.filter(b => b.hp > 0);
      for (const bomber of bombers) {
        const template = GameState.getTemplate(bomber.templateId);
        if (!template) continue;

        const p_bomber_loss = defenderOffense / (template.defense + defenderOffense + CONSTANTS.EPSILON);
        if (GameState.rng.nextBool(p_bomber_loss * 0.3)) { // 30% of calculated probability
          bomber.hp = 0;
          bomber.status = 'destroyed';

          if (GameState.debugLogCombat) {
            console.log(`  Bomber ${bomber.id} shot down by defenders`);
          }
        }
      }
    }
  },

  /**
   * Resolve raid arrivals at targets
   */
  resolveArrivals() {
    const completedRaids = [];

    for (const raid of GameState.activeRaids) {
      if (raid.status === 'completed') continue;

      // Check if raid has arrived
      if (raid.progress >= 1.0 && raid.status !== 'attacking') {
        raid.status = 'attacking';
        this.resolveRaidAttack(raid);
        completedRaids.push(raid);
      }
    }

    // Remove completed raids and return aircraft
    for (const raid of completedRaids) {
      raid.status = 'completed';

      // Return surviving aircraft to base
      const fromCity = GameState.getCity(raid.fromCityId);
      if (fromCity) {
        for (const bomber of raid.bombers) {
          if (bomber.hp > 0) {
            bomber.status = 'idle';
            bomber.locationCityId = fromCity.id;
          }
        }
        for (const escort of raid.escorts) {
          if (escort.hp > 0) {
            escort.status = 'idle';
            escort.locationCityId = fromCity.id;
          }
        }
      }
    }

    // Clean up completed raids
    GameState.activeRaids = GameState.activeRaids.filter(r => r.status !== 'completed');
  },

  /**
   * Resolve raid attack on target city
   * @param {object} raid - Raid object
   */
  resolveRaidAttack(raid) {
    const targetCity = GameState.getCity(raid.toCityId);
    if (!targetCity) return;

    // Get surviving bombers
    const survivingBombers = raid.bombers.filter(b => b.hp > 0);
    if (survivingBombers.length === 0) {
      if (GameState.debugLogCombat) {
        console.log(`Raid ${raid.id} arrived with no surviving bombers`);
      }
      return;
    }

    // Calculate city defense (defending fighters at the city)
    const defendingFighters = GameState.getFightersAtCity(targetCity.id);
    const cityDefense = defendingFighters.reduce((sum, f) => {
      const template = GameState.getTemplate(f.templateId);
      return sum + (template ? template.defense : 0);
    }, 0);

    // Resolve bomber attack
    const result = CombatSystem.resolveBomberAttack(
      survivingBombers,
      targetCity,
      cityDefense,
      GameState.rng
    );

    // Apply damage
    if (result.damageInflicted > 0) {
      CombatSystem.applyCityDamage(targetCity, result.damageInflicted, raid.team);
    }

    if (GameState.debugLogCombat) {
      console.log(`Raid ${raid.id} attacked ${targetCity.name}`);
      console.log(`  ${survivingBombers.length} bombers, ${result.damageInflicted} damage, ${result.bomberLosses.length} bomber losses`);
    }
  },

  /**
   * Pause/unpause the game
   */
  togglePause() {
    GameState.isPaused = !GameState.isPaused;
    console.log(`Game ${GameState.isPaused ? 'paused' : 'resumed'}`);
  },

  /**
   * Set game speed
   * @param {number} multiplier - Speed multiplier (1, 2, 4)
   */
  setSpeed(multiplier) {
    GameState.speedMultiplier = multiplier;

    // Restart loop with new speed
    if (this.intervalHandle) {
      this.stop();
      this.start();
    }

    console.log(`Game speed set to ${multiplier}x`);
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MainLoop;
}
