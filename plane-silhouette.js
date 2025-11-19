// Plane Silhouette SVG Generator
// Generates dynamic plane silhouettes based on plane stats

const PlaneSilhouette = {
  // Base SVG dimensions
  baseWidth: 32,
  baseHeight: 16,

  // Generate a fighter silhouette (Spitfire-inspired)
  generateFighter(template, color = '#5af') {
    const { rangePoints = 50, offense = 30, defense = 30 } = template;

    // Normalize stats to 0-1 range (stats are 1-100)
    const rangeNorm = (rangePoints - 10) / 90;  // 10-100 range
    const offenseNorm = (offense - 1) / 99;
    const defenseNorm = (defense - 1) / 99;

    // Calculate modifications
    const wingScale = 0.8 + rangeNorm * 0.4;      // Range affects wing size (0.8-1.2)
    const gunSize = 0.5 + offenseNorm * 1.0;      // Offense affects gun size (0.5-1.5)
    const armorWidth = 0.8 + defenseNorm * 0.4;   // Defense affects fuselage thickness (0.8-1.2)

    // Base Spitfire silhouette (side view, simplified)
    // Center at 16, 8 (middle of 32x16)
    const fuselageY = 8;
    const fuselageLength = 20;
    const fuselageHeight = 2.5 * armorWidth;

    // Fuselage path (elliptical body)
    const fuselage = `
      M 6 ${fuselageY}
      Q 4 ${fuselageY - fuselageHeight} 8 ${fuselageY - fuselageHeight}
      L 22 ${fuselageY - fuselageHeight * 0.8}
      Q 26 ${fuselageY - fuselageHeight * 0.3} 26 ${fuselageY}
      Q 26 ${fuselageY + fuselageHeight * 0.3} 22 ${fuselageY + fuselageHeight * 0.8}
      L 8 ${fuselageY + fuselageHeight}
      Q 4 ${fuselageY + fuselageHeight} 6 ${fuselageY}
      Z
    `;

    // Wings (elliptical, scaled by range)
    const wingSpan = 6 * wingScale;
    const wingChord = 4;
    const wingX = 14;
    const wings = `
      M ${wingX} ${fuselageY - fuselageHeight * 0.5}
      Q ${wingX - 1} ${fuselageY - wingSpan} ${wingX + wingChord * 0.3} ${fuselageY - wingSpan}
      Q ${wingX + wingChord} ${fuselageY - wingSpan * 0.8} ${wingX + wingChord} ${fuselageY - fuselageHeight * 0.5}
      Z
      M ${wingX} ${fuselageY + fuselageHeight * 0.5}
      Q ${wingX - 1} ${fuselageY + wingSpan} ${wingX + wingChord * 0.3} ${fuselageY + wingSpan}
      Q ${wingX + wingChord} ${fuselageY + wingSpan * 0.8} ${wingX + wingChord} ${fuselageY + fuselageHeight * 0.5}
      Z
    `;

    // Tail
    const tailHeight = 3 * armorWidth;
    const tail = `
      M 6 ${fuselageY - fuselageHeight}
      L 3 ${fuselageY - tailHeight - 1}
      L 5 ${fuselageY - tailHeight - 1}
      L 7 ${fuselageY - fuselageHeight}
      Z
    `;

    // Horizontal stabilizer
    const stabSpan = 2;
    const stabilizer = `
      M 5 ${fuselageY - stabSpan}
      L 3 ${fuselageY - stabSpan - 1}
      L 3 ${fuselageY + stabSpan + 1}
      L 5 ${fuselageY + stabSpan}
      Z
    `;

    // Guns (scaled by offense) - wing-mounted
    const guns = [];
    if (gunSize > 0.3) {
      const gunLength = 3 * gunSize;
      const gunY1 = fuselageY - wingSpan * 0.6;
      const gunY2 = fuselageY + wingSpan * 0.6;
      guns.push(`
        M ${wingX + wingChord - 1} ${gunY1}
        L ${wingX + wingChord + gunLength} ${gunY1}
        L ${wingX + wingChord + gunLength} ${gunY1 + 0.5}
        L ${wingX + wingChord - 1} ${gunY1 + 0.5}
        Z
        M ${wingX + wingChord - 1} ${gunY2 - 0.5}
        L ${wingX + wingChord + gunLength} ${gunY2 - 0.5}
        L ${wingX + wingChord + gunLength} ${gunY2}
        L ${wingX + wingChord - 1} ${gunY2}
        Z
      `);
    }

    // Propeller
    const prop = `
      M 25.5 ${fuselageY - 3}
      L 26.5 ${fuselageY - 3}
      L 26.5 ${fuselageY + 3}
      L 25.5 ${fuselageY + 3}
      Z
    `;

    return this._createSVG([fuselage, wings, tail, stabilizer, ...guns, prop], color);
  },

  // Generate a bomber silhouette (B-17-inspired)
  generateBomber(template, color = '#fa5') {
    const { rangePoints = 50, offense = 30, defense = 20 } = template;

    // Normalize stats to 0-1 range
    const rangeNorm = (rangePoints - 10) / 90;
    const offenseNorm = (offense - 1) / 99;
    const defenseNorm = (defense - 1) / 99;

    // Calculate modifications
    const wingScale = 0.8 + rangeNorm * 0.4;        // Range affects wing size
    const fuselageScale = 0.8 + offenseNorm * 0.4;  // Offense affects fuselage (bomb load)
    const turretSize = 0.5 + defenseNorm * 1.0;     // Defense affects turret size

    const fuselageY = 8;
    const fuselageHeight = 3 * fuselageScale;

    // Fuselage (longer, thicker body)
    const fuselage = `
      M 4 ${fuselageY}
      Q 2 ${fuselageY - fuselageHeight} 6 ${fuselageY - fuselageHeight}
      L 24 ${fuselageY - fuselageHeight * 0.7}
      Q 28 ${fuselageY - fuselageHeight * 0.2} 28 ${fuselageY}
      Q 28 ${fuselageY + fuselageHeight * 0.2} 24 ${fuselageY + fuselageHeight * 0.7}
      L 6 ${fuselageY + fuselageHeight}
      Q 2 ${fuselageY + fuselageHeight} 4 ${fuselageY}
      Z
    `;

    // Wings (larger, scaled by range) - B-17 had very long wings
    const wingSpan = 7 * wingScale;
    const wingChord = 5;
    const wingX = 12;
    const wings = `
      M ${wingX} ${fuselageY - fuselageHeight * 0.4}
      L ${wingX - 2} ${fuselageY - wingSpan}
      Q ${wingX + 1} ${fuselageY - wingSpan - 0.5} ${wingX + wingChord} ${fuselageY - wingSpan * 0.7}
      L ${wingX + wingChord} ${fuselageY - fuselageHeight * 0.4}
      Z
      M ${wingX} ${fuselageY + fuselageHeight * 0.4}
      L ${wingX - 2} ${fuselageY + wingSpan}
      Q ${wingX + 1} ${fuselageY + wingSpan + 0.5} ${wingX + wingChord} ${fuselageY + wingSpan * 0.7}
      L ${wingX + wingChord} ${fuselageY + fuselageHeight * 0.4}
      Z
    `;

    // Engines on wings (4 engines like B-17)
    const engineSize = 1.5;
    const engines = `
      M ${wingX + 1} ${fuselageY - wingSpan * 0.4 - engineSize}
      L ${wingX + 3} ${fuselageY - wingSpan * 0.4 - engineSize}
      L ${wingX + 3} ${fuselageY - wingSpan * 0.4 + engineSize}
      L ${wingX + 1} ${fuselageY - wingSpan * 0.4 + engineSize}
      Z
      M ${wingX + 1} ${fuselageY + wingSpan * 0.4 - engineSize}
      L ${wingX + 3} ${fuselageY + wingSpan * 0.4 - engineSize}
      L ${wingX + 3} ${fuselageY + wingSpan * 0.4 + engineSize}
      L ${wingX + 1} ${fuselageY + wingSpan * 0.4 + engineSize}
      Z
      M ${wingX - 1} ${fuselageY - wingSpan * 0.7 - engineSize * 0.8}
      L ${wingX + 1} ${fuselageY - wingSpan * 0.7 - engineSize * 0.8}
      L ${wingX + 1} ${fuselageY - wingSpan * 0.7 + engineSize * 0.8}
      L ${wingX - 1} ${fuselageY - wingSpan * 0.7 + engineSize * 0.8}
      Z
      M ${wingX - 1} ${fuselageY + wingSpan * 0.7 - engineSize * 0.8}
      L ${wingX + 1} ${fuselageY + wingSpan * 0.7 - engineSize * 0.8}
      L ${wingX + 1} ${fuselageY + wingSpan * 0.7 + engineSize * 0.8}
      L ${wingX - 1} ${fuselageY + wingSpan * 0.7 + engineSize * 0.8}
      Z
    `;

    // Tail (larger vertical stabilizer)
    const tailHeight = 4 * fuselageScale * 0.8;
    const tail = `
      M 4 ${fuselageY - fuselageHeight}
      L 2 ${fuselageY - tailHeight - 2}
      L 4 ${fuselageY - tailHeight - 2}
      L 6 ${fuselageY - fuselageHeight}
      Z
    `;

    // Horizontal stabilizer (larger)
    const stabSpan = 3;
    const stabilizer = `
      M 4 ${fuselageY - stabSpan}
      L 2 ${fuselageY - stabSpan - 1.5}
      L 2 ${fuselageY + stabSpan + 1.5}
      L 4 ${fuselageY + stabSpan}
      Z
    `;

    // Gun turrets (scaled by defense)
    const turrets = [];
    if (turretSize > 0.3) {
      const tSize = 1.2 * turretSize;
      // Top turret
      turrets.push(`
        M 14 ${fuselageY - fuselageHeight - tSize * 0.3}
        A ${tSize} ${tSize} 0 1 1 14 ${fuselageY - fuselageHeight - tSize * 0.3 - 0.01}
        Z
      `);
      // Tail turret
      turrets.push(`
        M 3 ${fuselageY}
        A ${tSize * 0.8} ${tSize * 0.8} 0 1 1 3 ${fuselageY - 0.01}
        Z
      `);
      // Nose turret (chin turret)
      turrets.push(`
        M 26 ${fuselageY + fuselageHeight * 0.3}
        A ${tSize * 0.7} ${tSize * 0.7} 0 1 1 26 ${fuselageY + fuselageHeight * 0.3 - 0.01}
        Z
      `);
    }

    return this._createSVG([fuselage, wings, engines, tail, stabilizer, ...turrets], color);
  },

  // Create the final SVG element
  _createSVG(paths, color) {
    const pathData = paths.join(' ');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.baseWidth} ${this.baseHeight}"
      width="${this.baseWidth}" height="${this.baseHeight}"
      style="vertical-align: middle;">
      <path d="${pathData}" fill="${color}" fill-opacity="0.9" stroke="${color}" stroke-width="0.3"/>
    </svg>`;
  },

  // Generate silhouette based on template type
  generate(template, color) {
    if (!template) return '';

    if (template.type === 'fighter') {
      return this.generateFighter(template, color || '#5af');
    } else if (template.type === 'bomber') {
      return this.generateBomber(template, color || '#fa5');
    }

    return '';
  },

  // Generate a simple preview for the template (smaller size)
  generatePreview(template, color, width = 24, height = 12) {
    const svg = this.generate(template, color);
    return svg.replace(
      `width="${this.baseWidth}" height="${this.baseHeight}"`,
      `width="${width}" height="${height}"`
    );
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlaneSilhouette;
}
