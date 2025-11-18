// Renderer - Draw cities, airbases, raids, and country coloring on the globe
// Compatible with D3 v3

const Renderer = {
  svg: null,
  projection: null,
  path: null,
  cityLayer: null,
  raidLayer: null,
  countryLayer: null,
  selectedCity: null,

  /**
   * Initialize renderer with D3 projection and SVG
   * @param {object} svg - D3 SVG selection
   * @param {object} projection - D3 projection
   * @param {object} path - D3 path generator
   */
  initialize(svg, projection, path) {
    this.svg = svg;
    this.projection = projection;
    this.path = path;

    // Create layers
    this.countryLayer = svg.append('g').attr('class', 'country-layer');
    this.raidLayer = svg.append('g').attr('class', 'raid-layer');
    this.cityLayer = svg.append('g').attr('class', 'city-layer');

    console.log('Renderer initialized');
  },

  /**
   * Render everything
   */
  render() {
    if (!this.svg) return;

    this.renderCountries();
    this.renderCities();
    this.renderRaids();
  },

  /**
   * Render country coloring and hatching
   */
  renderCountries() {
    // This would require re-rendering country polygons with team colors
    // For simplicity, we'll skip this in the initial implementation
    // and focus on city rendering
  },

  /**
   * Render cities (dots, rings, airbases)
   */
  renderCities() {
    const self = this;

    // Bind city data
    const cityGroups = this.cityLayer.selectAll('.city-group')
      .data(GameState.cities, function(d) { return d.id; });

    // Enter new cities
    const entering = cityGroups.enter()
      .append('g')
      .attr('class', 'city-group')
      .style('cursor', 'pointer')
      .on('click', function(d) {
        self.onCityClick(d);
      })
      .on('mouseenter', function(d) {
        self.showCityTooltip(d, this);
      })
      .on('mouseleave', function(d) {
        self.hideCityTooltip();
      });

    // Add city dots
    entering.append('circle')
      .attr('class', 'city-dot');

    // Add airbase halo
    entering.append('circle')
      .attr('class', 'airbase-halo')
      .style('display', 'none');

    // Add delivery point square
    entering.append('rect')
      .attr('class', 'delivery-square')
      .style('display', 'none');

    // Add capture ring
    entering.append('circle')
      .attr('class', 'capture-ring')
      .style('display', 'none');

    // Update all cities (D3 v3 style - reselect after enter)
    this.cityLayer.selectAll('.city-group').each(function(city) {
      const group = d3.select(this);
      const projected = self.projection([city.lon, city.lat]);

      if (!projected) {
        group.style('display', 'none');
        return;
      }

      // Check if city is on the visible side of the globe
      // Get rotation center and check angular distance
      const rotation = self.projection.rotate();
      const centerLon = -rotation[0];
      const centerLat = -rotation[1];

      // Calculate angular distance from center (simplified great circle check)
      const toRad = Math.PI / 180;
      const lat1 = centerLat * toRad;
      const lat2 = city.lat * toRad;
      const dLon = (city.lon - centerLon) * toRad;

      // Cosine of angular distance
      const cosAngle = Math.sin(lat1) * Math.sin(lat2) +
                       Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLon);

      // If cosAngle < 0, the point is on the far side (> 90 degrees away)
      if (cosAngle < 0) {
        group.style('display', 'none');
        return;
      }

      group.style('display', null);
      group.attr('transform', 'translate(' + projected[0] + ', ' + projected[1] + ')');

      // Update city dot
      const dot = group.select('.city-dot');
      const radius = city.isPlaceholder ? CONSTANTS.CITY_DOT_RADIUS_PLACEHOLDER : CONSTANTS.CITY_DOT_RADIUS;

      if (city.hp >= 0) {
        // Normal city dot
        dot.style('display', null)
          .attr('r', radius)
          .style('fill', city.owner ? GameState.teams[city.owner].color : '#999')
          .style('stroke', '#fff')
          .style('stroke-width', 1);

        group.select('.capture-ring').style('display', 'none');
      } else {
        // Being captured - show ring instead of dot
        dot.style('display', 'none');

        // Determine capturing team (the opposite of current owner, or first enemy)
        const capturingTeam = self.getCapturingTeam(city);

        const ring = group.select('.capture-ring');
        ring.style('display', null)
          .attr('r', radius + 2)
          .style('fill', 'none')
          .style('stroke', capturingTeam ? GameState.teams[capturingTeam].color : '#f00')
          .style('stroke-width', CONSTANTS.CAPTURE_RING_WIDTH)
          .style('stroke-dasharray', '2,2');
      }

      // Update airbase halo
      const halo = group.select('.airbase-halo');
      if (city.hasAirbase && city.airbase && city.airbase.complete) {
        halo.style('display', null)
          .attr('r', CONSTANTS.AIRBASE_HALO_RADIUS)
          .style('fill', 'none')
          .style('stroke', city.owner ? GameState.teams[city.owner].color : '#999')
          .style('stroke-width', 2)
          .style('opacity', 0.6);
      } else {
        halo.style('display', 'none');
      }

      // Update delivery point square
      const square = group.select('.delivery-square');
      if (city.hasAirbase && city.airbase && city.airbase.deliveryPoint) {
        const size = CONSTANTS.DELIVERY_SQUARE_SIZE;
        square.style('display', null)
          .attr('x', -size / 2)
          .attr('y', CONSTANTS.AIRBASE_HALO_RADIUS + 3)
          .attr('width', size)
          .attr('height', size)
          .style('fill', city.owner ? GameState.teams[city.owner].color : '#999')
          .style('stroke', '#fff')
          .style('stroke-width', 1);
      } else {
        square.style('display', 'none');
      }
    });

    // Remove old cities
    cityGroups.exit().remove();
  },

  /**
   * Determine which team is capturing a city (for ring color)
   * @param {object} city - City being captured
   * @returns {string|null} Team name
   */
  getCapturingTeam(city) {
    // Check recent raids to this city
    for (const raid of GameState.activeRaids) {
      if (raid.toCityId === city.id) {
        return raid.team;
      }
    }

    // Default: opposite of current owner
    if (city.owner === 'Red') return 'Blue';
    if (city.owner === 'Blue') return 'Red';
    return 'Red'; // Default to Red for neutral
  },

  /**
   * Render active raids as polylines
   */
  renderRaids() {
    const self = this;

    const raidPaths = this.raidLayer.selectAll('.raid-path')
      .data(GameState.activeRaids, function(d) { return d.id; });

    // Enter
    raidPaths.enter()
      .append('path')
      .attr('class', 'raid-path')
      .style('fill', 'none')
      .style('stroke-width', 2)
      .style('stroke-dasharray', '5,5')
      .style('opacity', 0.7);

    // Update all raid paths (D3 v3 style)
    this.raidLayer.selectAll('.raid-path').each(function(raid) {
      const pathEl = d3.select(this);
      const fromCity = GameState.getCity(raid.fromCityId);
      const toCity = GameState.getCity(raid.toCityId);

      if (!fromCity || !toCity) {
        pathEl.style('display', 'none');
        return;
      }

      // Sample great circle path
      const pathPoints = MapUtils.sampleGreatCirclePath(
        fromCity.lat, fromCity.lon,
        toCity.lat, toCity.lon,
        20
      );

      // Project points
      const projectedPoints = pathPoints.map(function(p) {
        return self.projection([p.lon, p.lat]);
      }).filter(function(p) { return p !== null; });

      if (projectedPoints.length === 0) {
        pathEl.style('display', 'none');
        return;
      }

      // Create line
      const lineGenerator = d3.svg.line()
        .x(function(d) { return d[0]; })
        .y(function(d) { return d[1]; })
        .interpolate('linear');

      pathEl.style('display', null)
        .attr('d', lineGenerator(projectedPoints))
        .style('stroke', GameState.teams[raid.team].color);
    });

    // Exit
    raidPaths.exit().remove();
  },

  /**
   * Handle city click
   * @param {object} city - Clicked city
   */
  onCityClick(city) {
    this.selectedCity = city;

    // Center globe on city (if rotation function available)
    if (typeof centerOnCity === 'function') {
      centerOnCity(city);
    }

    // Show city popup (if UI controls available)
    if (typeof UIControls !== 'undefined') {
      UIControls.showCityPopup(city);
    }

    console.log('Clicked city:', city.name);
  },

  /**
   * Show city tooltip
   * @param {object} city - City to show tooltip for
   * @param {Element} element - DOM element
   */
  showCityTooltip(city, element) {
    // Create tooltip if it doesn't exist
    var tooltip = d3.select('#city-tooltip');
    if (tooltip.empty()) {
      tooltip = d3.select('body').append('div')
        .attr('id', 'city-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', '#fff')
        .style('padding', '8px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('z-index', 1000);
    }

    // Get production
    const production = city.owner ? ProductionSystem.getCityProduction(city, city.owner) : 0;

    // Get aircraft counts
    const aircraft = GameState.getAircraftAtCity(city.id);
    const fighters = aircraft.filter(function(a) { return a.type === 'fighter'; }).length;
    const bombers = aircraft.filter(function(a) { return a.type === 'bomber'; }).length;

    // Build tooltip content
    var content = '<strong>' + city.name + '</strong><br/>';
    content += 'Country: ' + city.country + '<br/>';
    content += 'Owner: ' + (city.owner || 'Neutral') + '<br/>';
    content += 'HP: ' + city.hp.toFixed(1) + '<br/>';
    content += 'Production: ' + production.toFixed(2) + 'M/min<br/>';
    if (aircraft.length > 0) {
      content += 'Aircraft: ' + fighters + 'F / ' + bombers + 'B';
    }

    tooltip.html(content)
      .style('display', 'block')
      .style('left', (d3.event.pageX + 10) + 'px')
      .style('top', (d3.event.pageY + 10) + 'px');
  },

  /**
   * Hide city tooltip
   */
  hideCityTooltip() {
    d3.select('#city-tooltip').style('display', 'none');
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Renderer;
}
