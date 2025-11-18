// Combat System - Probabilistic combat resolution for fighters and bombers

const CombatSystem = {
  /**
   * Resolve fighter vs fighter engagement
   * @param {Array} attackers - Attacking fighter aircraft
   * @param {Array} defenders - Defending fighter aircraft
   * @param {RNG} rng - Random number generator
   * @returns {object} {attackerLosses, defenderLosses}
   */
  resolveFighterVsFighter(attackers, defenders, rng) {
    if (attackers.length === 0 || defenders.length === 0) {
      return { attackerLosses: [], defenderLosses: [] };
    }

    // Calculate total offensive and defensive strengths
    const A_off = attackers.reduce((sum, a) => {
      const template = GameState.getTemplate(a.templateId);
      return sum + (template ? template.offense : 0);
    }, 0);

    const D_def = defenders.reduce((sum, d) => {
      const template = GameState.getTemplate(d.templateId);
      return sum + (template ? template.defense : 0);
    }, 0);

    // Calculate probabilities
    const p_attacker_wins = A_off / (A_off + D_def + CONSTANTS.EPSILON);
    const p_defender_wins = D_def / (A_off + D_def + CONSTANTS.EPSILON);

    // Resolve casualties
    const attackerLosses = [];
    const defenderLosses = [];

    // Defenders take losses
    for (const defender of defenders) {
      if (rng.nextBool(p_attacker_wins)) {
        defender.hp = 0;
        defender.status = 'destroyed';
        defenderLosses.push(defender);
      }
    }

    // Attackers take losses
    for (const attacker of attackers) {
      if (rng.nextBool(p_defender_wins)) {
        attacker.hp = 0;
        attacker.status = 'destroyed';
        attackerLosses.push(attacker);
      }
    }

    if (GameState.debugLogCombat) {
      console.log(`Fighter combat: ${attackers.length} attackers vs ${defenders.length} defenders`);
      console.log(`  Attacker strength: ${A_off}, Defender strength: ${D_def}`);
      console.log(`  Attacker losses: ${attackerLosses.length}, Defender losses: ${defenderLosses.length}`);
    }

    return { attackerLosses, defenderLosses };
  },

  /**
   * Calculate effective defense after escort engagement
   * @param {number} defenderDefense - Total defender defense
   * @param {number} escortOffense - Total escort offense
   * @returns {number} Effective defense
   */
  calculateEffectiveDefense(defenderDefense, escortOffense) {
    return Math.max(0, defenderDefense - escortOffense);
  },

  /**
   * Resolve bomber attack on a city
   * @param {Array} bombers - Bombing aircraft
   * @param {object} targetCity - Target city
   * @param {number} cityDefense - Defensive strength at city
   * @param {RNG} rng - Random number generator
   * @returns {object} {bomberLosses, damageInflicted}
   */
  resolveBomberAttack(bombers, targetCity, cityDefense, rng) {
    if (bombers.length === 0) {
      return { bomberLosses: [], damageInflicted: 0 };
    }

    const bomberLosses = [];
    let totalDamage = 0;

    for (const bomber of bombers) {
      if (bomber.hp === 0) continue; // Already destroyed

      const template = GameState.getTemplate(bomber.templateId);
      if (!template) continue;

      // Calculate damage probability
      const p_damage = template.offense / (template.offense + cityDefense + CONSTANTS.CITY_BASE_DEFENSE);

      // Roll to see if bomber hits
      if (rng.nextBool(p_damage)) {
        // Calculate damage
        const damageHP = CONSTANTS.BOMBER_DAMAGE_BASE + Math.floor(template.offense / CONSTANTS.BOMBER_DAMAGE_SCALE);
        totalDamage += damageHP;
      }

      // Bomber can be shot down by city defenses
      const p_bomber_loss = cityDefense / (template.defense + cityDefense + CONSTANTS.EPSILON);
      if (rng.nextBool(p_bomber_loss)) {
        bomber.hp = 0;
        bomber.status = 'destroyed';
        bomberLosses.push(bomber);
      }
    }

    if (GameState.debugLogCombat) {
      console.log(`Bomber attack on ${targetCity.name}`);
      console.log(`  ${bombers.length} bombers, city defense: ${cityDefense}`);
      console.log(`  Bomber losses: ${bomberLosses.length}, Damage: ${totalDamage} HP`);
    }

    return { bomberLosses, damageInflicted: totalDamage };
  },

  /**
   * Apply damage to a city
   * @param {object} city - Target city
   * @param {number} damage - Damage in HP
   * @param {string} attackerTeam - Attacking team name
   */
  applyCityDamage(city, damage, attackerTeam) {
    // Apply damage (negative HP change)
    city.hp -= damage;

    // Clamp HP
    city.hp = Math.max(CONSTANTS.HP_MIN, Math.min(CONSTANTS.HP_MAX, city.hp));

    // Check for capture
    if (city.hp <= CONSTANTS.HP_MIN) {
      this.captureCity(city, attackerTeam);
    }

    if (GameState.debugLogCombat) {
      console.log(`${city.name} took ${damage} damage, HP now ${city.hp.toFixed(1)}`);
    }
  },

  /**
   * Capture a city
   * @param {object} city - City to capture
   * @param {string} newOwner - New owner team name
   */
  captureCity(city, newOwner) {
    const oldOwner = city.owner;

    // Remove from old owner's cities
    if (oldOwner) {
      const oldTeam = GameState.teams[oldOwner];
      oldTeam.cities = oldTeam.cities.filter(c => c.id !== city.id);
    }

    // Add to new owner's cities
    city.owner = newOwner;
    const newTeam = GameState.teams[newOwner];
    newTeam.cities.push(city);

    // Reset HP to 0
    city.hp = 0;

    // Destroy airbase if it exists
    if (city.hasAirbase) {
      city.hasAirbase = false;
      city.airbase = null;

      // Remove aircraft at this airbase
      const aircraftHere = GameState.getAircraftAtCity(city.id);
      for (const aircraft of aircraftHere) {
        aircraft.hp = 0;
        aircraft.status = 'destroyed';
      }
    }

    if (GameState.debugLogCombat) {
      console.log(`${newOwner} captured ${city.name} from ${oldOwner || 'neutral'}`);
    }
  },

  /**
   * Update HP recovery for all cities (called each tick)
   * @param {number} deltaMs - Time since last update
   */
  updateHPRecovery(deltaMs) {
    const hpRecoveryThisTick = CONSTANTS.HP_RECOVERY_PER_TICK * (deltaMs / CONSTANTS.TICK_MS);

    for (const city of GameState.cities) {
      if (city.hp < CONSTANTS.HP_MAX) {
        city.hp += hpRecoveryThisTick;
        city.hp = Math.min(CONSTANTS.HP_MAX, city.hp);
      }
    }
  },

  /**
   * Get fighters that can defend against a raid path
   * @param {object} raidPath - {fromCity, toCity}
   * @param {string} defenderTeam - Defending team name
   * @returns {Array} Defending fighters
   */
  getDefendingFighters(raidPath, defenderTeam) {
    const defenders = [];

    // Check all defending airbases
    const defenderCities = GameState.getTeamCities(defenderTeam);

    for (const city of defenderCities) {
      if (!city.hasAirbase || !city.airbase || !city.airbase.complete) continue;

      // Get defending fighters (non-escort fighters)
      const fightersHere = GameState.getFightersAtCity(city.id);
      const defendAllocation = 1 - city.airbase.escortAllocation;
      const numDefenders = Math.floor(fightersHere.length * defendAllocation);
      const defendingFighters = fightersHere.slice(0, numDefenders);

      // Check if any have range to intercept the raid path
      for (const fighter of defendingFighters) {
        const template = GameState.getTemplate(fighter.templateId);
        if (!template) continue;

        const rangeKm = template.rangePoints * CONSTANTS.RANGE_KM_PER_POINT;

        // Check if fighter range overlaps raid path
        if (MapUtils.isPathWithinRange(
          raidPath.fromCity.lat, raidPath.fromCity.lon,
          raidPath.toCity.lat, raidPath.toCity.lon,
          city.lat, city.lon,
          rangeKm
        )) {
          defenders.push(fighter);
        }
      }
    }

    return defenders;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CombatSystem;
}
