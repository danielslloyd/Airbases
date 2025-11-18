// Renderer - Draw cities, airbases, raids, and country coloring on the globe
// Compatible with D3 v3

const Renderer = {
  svg: null,
  projection: null,
  path: null,
  cityLayer: null,
  raidLayer: null,
  countryLayer: null,
  rangeCircleLayer: null,
  raidAnimationLayer: null,
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
    this.rangeCircleLayer = svg.append('g').attr('class', 'range-circle-layer');
    this.raidLayer = svg.append('g').attr('class', 'raid-layer');
    this.raidAnimationLayer = svg.append('g').attr('class', 'raid-animation-layer');
    this.cityLayer = svg.append('g').attr('class', 'city-layer');

    console.log('Renderer initialized');
  },

  /**
   * Render everything
   */
  render() {
    if (!this.svg) return;

    this.renderCountries();
    this.renderRangeCircles();
    this.renderCities();
    this.renderRaids();
    this.renderRaidAnimations();
  },

  /**
   * Render country coloring and hatching based on team control
   */
  renderCountries() {
    const self = this;
    if (!this.countryLayer || !GameState.geoData) return;

    // Get or create defs for patterns
    let defs = this.svg.select('defs');
    if (defs.empty()) {
      defs = this.svg.insert('defs', ':first-child');
    }

    // Create hash patterns for contested countries
    const patterns = ['Red', 'Blue'];
    patterns.forEach(function(teamName) {
      const patternId = 'hash-' + teamName;
      if (defs.select('#' + patternId).empty()) {
        const pattern = defs.append('pattern')
          .attr('id', patternId)
          .attr('width', 8)
          .attr('height', 8)
          .attr('patternUnits', 'userSpaceOnUse')
          .attr('patternTransform', 'rotate(45)');

        pattern.append('rect')
          .attr('width', 8)
          .attr('height', 8)
          .attr('fill', CONSTANTS.LAND_COLOR);

        pattern.append('line')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', 0)
          .attr('y2', 8)
          .attr('stroke', GameState.teams[teamName].color)
          .attr('stroke-width', 3)
          .attr('stroke-opacity', 0.5);
      }
    });

    // Get features from geoData
    const features = GameState.geoData.features || [];

    // Bind country data
    const countryPaths = this.countryLayer.selectAll('.country-fill')
      .data(features, function(d) {
        return d.properties.name || d.properties.NAME || d.id;
      });

    // Enter
    countryPaths.enter()
      .append('path')
      .attr('class', 'country-fill');

    // Update all country paths
    this.countryLayer.selectAll('.country-fill').each(function(feature) {
      const pathEl = d3.select(this);
      const countryName = feature.properties.name || feature.properties.NAME;

      // Get country control status
      const controller = GameState.getCountryController(countryName);
      const contested = GameState.isCountryContested(countryName);

      // Determine fill color/pattern
      let fill = CONSTANTS.LAND_COLOR; // Default neutral
      let opacity = 1;

      if (controller) {
        // Fully controlled by a team
        fill = GameState.teams[controller].color;
        opacity = 0.3;
      } else if (contested) {
        // Contested - use hash pattern
        // Find which team has more cities
        const country = GameState.countries.get(countryName);
        if (country) {
          let redCount = 0, blueCount = 0;
          country.cities.forEach(function(c) {
            if (c.owner === 'Red') redCount++;
            else if (c.owner === 'Blue') blueCount++;
          });
          const dominantTeam = redCount > blueCount ? 'Red' : 'Blue';
          fill = 'url(#hash-' + dominantTeam + ')';
          opacity = 1;
        }
      }

      pathEl.attr('d', self.path(feature))
        .style('fill', fill)
        .style('fill-opacity', opacity)
        .style('stroke', 'none')
        .style('pointer-events', 'none');
    });

    // Exit
    countryPaths.exit().remove();
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

    // Add HP bar background
    entering.append('rect')
      .attr('class', 'hp-bar-bg')
      .attr('x', -15)
      .attr('y', -20)
      .attr('width', 30)
      .attr('height', 4)
      .attr('rx', 1)
      .style('fill', '#333');

    // Add HP bar fill
    entering.append('rect')
      .attr('class', 'hp-bar-fill')
      .attr('x', -15)
      .attr('y', -20)
      .attr('width', 15)
      .attr('height', 4)
      .attr('rx', 1);

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

      // Update delivery point square (circumcentered on airbase circle)
      const square = group.select('.delivery-square');
      if (city.hasAirbase && city.airbase && city.airbase.deliveryPoint) {
        const size = CONSTANTS.DELIVERY_SQUARE_SIZE;
        square.style('display', null)
          .attr('x', -size / 2)
          .attr('y', -size / 2)
          .attr('width', size)
          .attr('height', size)
          .style('fill', 'none')
          .style('stroke', city.owner ? GameState.teams[city.owner].color : '#999')
          .style('stroke-width', 2);
      } else {
        square.style('display', 'none');
      }

      // Update HP bar
      const hpBarBg = group.select('.hp-bar-bg');
      const hpBarFill = group.select('.hp-bar-fill');

      // Only show HP bar if city is owned
      if (city.owner) {
        hpBarBg.style('display', null);
        hpBarFill.style('display', null);

        // Calculate fill width based on HP (-100 to +100 mapped to 0 to 30)
        const hpNormalized = (city.hp + 100) / 200; // 0 to 1
        const fillWidth = hpNormalized * 30;

        // Color based on HP
        let fillColor = '#4caf50'; // Green for positive
        if (city.hp < 0) fillColor = '#f44336'; // Red for negative
        else if (city.hp < 50) fillColor = '#ff9800'; // Orange for low positive

        hpBarFill
          .attr('width', Math.max(0, fillWidth))
          .style('fill', fillColor);
      } else {
        hpBarBg.style('display', 'none');
        hpBarFill.style('display', 'none');
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
  },

  /**
   * Render range circles for all airbases with bomber orders
   */
  renderRangeCircles() {
    const self = this;
    if (!this.rangeCircleLayer) return;

    // Collect all airbases with orders
    const airbasesWithOrders = [];
    GameState.cities.forEach(function(city) {
      if (city.hasAirbase && city.airbase && city.airbase.complete && city.airbase.orders) {
        // Get max bomber range at this airbase (or default range if no bombers)
        const bombers = GameState.getBombersAtCity(city.id);
        let maxRange;
        if (bombers.length > 0) {
          maxRange = Math.max.apply(null, bombers.map(function(b) {
            const template = GameState.getTemplate(b.templateId);
            return template ? template.rangePoints * CONSTANTS.RANGE_KM_PER_POINT : 0;
          }));
        } else {
          // No bombers - use default bomber range to show potential coverage
          maxRange = DEFAULT_TEMPLATES.bomber.rangePoints * CONSTANTS.RANGE_KM_PER_POINT;
        }
        airbasesWithOrders.push({
          city: city,
          range: maxRange,
          isSelected: self.selectedCity && self.selectedCity.id === city.id
        });
      }
    });

    // Bind data
    const circles = this.rangeCircleLayer.selectAll('.bomber-range-circle')
      .data(airbasesWithOrders, function(d) { return d.city.id; });

    // Enter
    circles.enter()
      .append('path')
      .attr('class', 'bomber-range-circle')
      .style('fill', 'none')
      .style('pointer-events', 'none');

    // Update
    this.rangeCircleLayer.selectAll('.bomber-range-circle').each(function(d) {
      const pathEl = d3.select(this);

      // Generate circle points
      const circlePoints = self.generateRangeCirclePoints(d.city, d.range, 64);
      const projectedPoints = circlePoints.map(function(p) {
        return self.projection([p.lon, p.lat]);
      }).filter(function(p) { return p !== null; });

      if (projectedPoints.length < 3) {
        pathEl.style('display', 'none');
        return;
      }

      const lineGenerator = d3.svg.line()
        .x(function(p) { return p[0]; })
        .y(function(p) { return p[1]; })
        .interpolate('linear');

      const opacity = d.isSelected ? 0.6 : 0.2;
      const strokeWidth = d.isSelected ? 2 : 1;

      pathEl.style('display', null)
        .attr('d', lineGenerator(projectedPoints) + 'Z')
        .style('stroke', GameState.teams[d.city.owner].color)
        .style('stroke-width', strokeWidth)
        .style('opacity', opacity)
        .style('stroke-dasharray', d.isSelected ? 'none' : '3,3');
    });

    // Exit
    circles.exit().remove();
  },

  /**
   * Generate points for a range circle on the globe
   */
  generateRangeCirclePoints(center, radiusKm, numPoints) {
    const points = [];
    const R = 6371;
    const angularDistance = radiusKm / R;

    for (var i = 0; i <= numPoints; i++) {
      const bearing = (i / numPoints) * 2 * Math.PI;
      const lat1 = center.lat * Math.PI / 180;
      const lon1 = center.lon * Math.PI / 180;

      const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(angularDistance) +
        Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
      );

      const lon2 = lon1 + Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
        Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
      );

      points.push({
        lat: lat2 * 180 / Math.PI,
        lon: lon2 * 180 / Math.PI
      });
    }

    return points;
  },

  /**
   * Render animated triangles for active raids
   */
  renderRaidAnimations() {
    const self = this;
    if (!this.raidAnimationLayer) return;

    // Bind raid data
    const triangles = this.raidAnimationLayer.selectAll('.raid-triangle')
      .data(GameState.activeRaids, function(d) { return d.id; });

    // Enter
    triangles.enter()
      .append('polygon')
      .attr('class', 'raid-triangle')
      .attr('points', '0,-6 4,6 -4,6');

    // Update
    this.raidAnimationLayer.selectAll('.raid-triangle').each(function(raid) {
      const tri = d3.select(this);
      const fromCity = GameState.getCity(raid.fromCityId);
      const toCity = GameState.getCity(raid.toCityId);

      if (!fromCity || !toCity) {
        tri.style('display', 'none');
        return;
      }

      // Calculate position along path based on progress
      const progress = raid.progress || 0;
      const returning = raid.returning || false;
      const actualProgress = returning ? 1 - progress : progress;

      // Interpolate position
      const lat = fromCity.lat + (toCity.lat - fromCity.lat) * actualProgress;
      const lon = fromCity.lon + (toCity.lon - fromCity.lon) * actualProgress;

      const projected = self.projection([lon, lat]);
      if (!projected) {
        tri.style('display', 'none');
        return;
      }

      // Check visibility
      const rotation = self.projection.rotate();
      const centerLon = -rotation[0];
      const centerLat = -rotation[1];
      const toRad = Math.PI / 180;
      const cosAngle = Math.sin(centerLat * toRad) * Math.sin(lat * toRad) +
                       Math.cos(centerLat * toRad) * Math.cos(lat * toRad) *
                       Math.cos((lon - centerLon) * toRad);

      if (cosAngle < 0) {
        tri.style('display', 'none');
        return;
      }

      // Calculate rotation angle toward target
      const dx = toCity.lon - fromCity.lon;
      const dy = toCity.lat - fromCity.lat;
      let angle = Math.atan2(dx, dy) * 180 / Math.PI;
      if (returning) angle += 180;

      tri.style('display', null)
        .attr('transform', 'translate(' + projected[0] + ',' + projected[1] + ') rotate(' + angle + ')')
        .style('fill', GameState.teams[raid.team].color)
        .style('stroke', '#fff')
        .style('stroke-width', 1);
    });

    // Exit
    triangles.exit().remove();
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Renderer;
}
