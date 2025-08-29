export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

export class RateLimitManager {
  private primaryLimit: RateLimitInfo = {
    limit: 5000,
    remaining: 5000,
    reset: new Date(),
    used: 0
  };
  
  private requestTimes: number[] = [];
  private windowMs = 60000; // 1 minute window for secondary rate limit
  private maxRequestsPerWindow = 300; // Allow more requests per minute
  
  updateFromHeaders(headers: any): void {
    if (headers['x-ratelimit-limit']) {
      this.primaryLimit.limit = parseInt(headers['x-ratelimit-limit']);
    }
    if (headers['x-ratelimit-remaining']) {
      this.primaryLimit.remaining = parseInt(headers['x-ratelimit-remaining']);
    }
    if (headers['x-ratelimit-reset']) {
      this.primaryLimit.reset = new Date(parseInt(headers['x-ratelimit-reset']) * 1000);
    }
    if (headers['x-ratelimit-used']) {
      this.primaryLimit.used = parseInt(headers['x-ratelimit-used']);
    }
  }
  
  async waitIfNeeded(): Promise<void> {
    // Check primary rate limit
    if (this.primaryLimit.remaining < 100) {
      const waitTime = this.primaryLimit.reset.getTime() - Date.now();
      if (waitTime > 0) {
        console.log(`⏳ Rate limit low (${this.primaryLimit.remaining} remaining). Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Check secondary rate limit (burst protection)
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(t => now - t < this.windowMs);
    
    if (this.requestTimes.length >= this.maxRequestsPerWindow) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = (oldestRequest + this.windowMs) - now;
      if (waitTime > 0) {
        console.log(`⏳ Burst limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    this.requestTimes.push(now);
  }
  
  getOptimalDelay(): number {
    // Calculate optimal delay based on remaining rate limit
    const percentRemaining = this.primaryLimit.remaining / this.primaryLimit.limit;
    
    if (percentRemaining > 0.5) {
      return 50; // Minimal delay when we have plenty of quota
    } else if (percentRemaining > 0.2) {
      return 200; // Moderate delay
    } else if (percentRemaining > 0.1) {
      return 500; // Conservative delay
    } else {
      return 1000; // Very conservative when low on quota
    }
  }
  
  canMakeRequests(count: number = 1): boolean {
    return this.primaryLimit.remaining >= count + 100; // Keep 100 as buffer
  }
  
  getStatus(): RateLimitInfo {
    return { ...this.primaryLimit };
  }
}