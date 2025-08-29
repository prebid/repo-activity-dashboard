import { RateLimitManager } from './rateLimitManager.js';

interface QueuedRequest<T> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  priority: number;
  retries: number;
}

export class RequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private activeRequests = 0;
  private maxConcurrent: number;
  private rateLimitManager: RateLimitManager;
  private processing = false;
  
  constructor(maxConcurrent: number = 3, rateLimitManager: RateLimitManager) {
    this.maxConcurrent = maxConcurrent;
    this.rateLimitManager = rateLimitManager;
  }
  
  async add<T>(
    execute: () => Promise<T>,
    priority: number = 0,
    id: string = Math.random().toString()
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id,
        execute,
        resolve,
        reject,
        priority,
        retries: 0
      };
      
      // Insert based on priority (higher priority first)
      const insertIndex = this.queue.findIndex(r => r.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }
      
      this.processQueue();
    });
  }
  
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    
    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      if (!this.rateLimitManager.canMakeRequests()) {
        await this.rateLimitManager.waitIfNeeded();
      }
      
      const request = this.queue.shift();
      if (!request) continue;
      
      this.activeRequests++;
      this.executeRequest(request);
    }
    
    this.processing = false;
  }
  
  private async executeRequest<T>(request: QueuedRequest<T>): Promise<void> {
    try {
      // Wait for rate limit if needed
      await this.rateLimitManager.waitIfNeeded();
      
      // Add adaptive delay based on rate limit status
      const delay = this.rateLimitManager.getOptimalDelay();
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const result = await request.execute();
      request.resolve(result);
      
    } catch (error: any) {
      // Handle rate limit errors with retry
      if (error.status === 403 || error.status === 429) {
        if (request.retries < 3) {
          request.retries++;
          console.log(`⚠️ Rate limit hit, retrying request ${request.id} (attempt ${request.retries + 1}/3)`);
          
          // Wait longer before retry
          const backoffTime = Math.min(60000, 1000 * Math.pow(2, request.retries));
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          
          // Re-queue with higher priority
          this.queue.unshift(request);
          this.processQueue();
          return;
        }
      }
      
      request.reject(error);
      
    } finally {
      this.activeRequests--;
      
      // Continue processing queue
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }
  
  getStats(): { queued: number; active: number; maxConcurrent: number } {
    return {
      queued: this.queue.length,
      active: this.activeRequests,
      maxConcurrent: this.maxConcurrent
    };
  }
  
  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
    this.processQueue();
  }
  
  clear(): void {
    this.queue.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
}