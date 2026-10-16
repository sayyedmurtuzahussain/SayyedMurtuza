// Seeded Pseudo-Random Number Generator using Mulberry32
// Provides deterministic sequences so Sim A and Sim B receive identical random streams
export class PRNG {
  constructor(seed = 42) {
    this.initialSeed = seed >>> 0;
    this.state = this.initialSeed;
  }

  // Returns pseudo-random float in [0, 1)
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns random float between min (inclusive) and max (exclusive)
  range(min, max) {
    return min + this.next() * (max - min);
  }

  // Returns random integer between min and max (inclusive)
  rangeInt(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // Resets generator to original or new seed
  reset(seed = this.initialSeed) {
    this.initialSeed = seed >>> 0;
    this.state = this.initialSeed;
  }
}
