// Deterministic Random Number Generator
// Uses mulberry32 algorithm for reproducible random sequences

class RNG {
  constructor(seed) {
    this.seed = seed >>> 0; // Ensure unsigned 32-bit integer
    this.state = this.seed;
  }

  // Generate next random number in [0, 1)
  next() {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  // Generate random integer in [min, max]
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // Generate random float in [min, max)
  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }

  // Bernoulli trial with probability p
  nextBool(p = 0.5) {
    return this.next() < p;
  }

  // Pick random element from array
  choice(array) {
    if (array.length === 0) return null;
    return array[Math.floor(this.next() * array.length)];
  }

  // Shuffle array in place (Fisher-Yates)
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Reset to initial seed
  reset() {
    this.state = this.seed;
  }

  // Get current state (for serialization)
  getState() {
    return this.state;
  }

  // Set state (for deserialization)
  setState(state) {
    this.state = state >>> 0;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RNG;
}
