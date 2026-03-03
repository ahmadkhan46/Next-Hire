// Simple in-memory queue for development without Redis
import { EventEmitter } from 'events';

interface Job<T = any> {
  id: string;
  name: string;
  data: T;
  state: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  returnvalue?: any;
  failedReason?: string;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

class MemoryQueue<T = any> extends EventEmitter {
  private jobs = new Map<string, Job<T>>();
  private waiting: string[] = [];
  private active: string[] = [];
  private completed: string[] = [];
  private failed: string[] = [];
  private processing = false;

  async add(name: string, data: T): Promise<Job<T>> {
    const job: Job<T> = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      data,
      state: 'waiting',
      progress: 0,
      attemptsMade: 0,
      timestamp: Date.now(),
    };

    this.jobs.set(job.id, job);
    this.waiting.push(job.id);
    this.emit('added', job);

    // Start processing if not already
    if (!this.processing) {
      this.processNext();
    }

    return job;
  }

  async getJob(jobId: string): Promise<Job<T> | null> {
    return this.jobs.get(jobId) || null;
  }

  async getWaitingCount(): Promise<number> {
    return this.waiting.length;
  }

  async getActiveCount(): Promise<number> {
    return this.active.length;
  }

  async getCompletedCount(): Promise<number> {
    return this.completed.length;
  }

  async getFailedCount(): Promise<number> {
    return this.failed.length;
  }

  private async processNext() {
    if (this.waiting.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const jobId = this.waiting.shift()!;
    const job = this.jobs.get(jobId);

    if (!job) {
      this.processNext();
      return;
    }

    this.active.push(jobId);
    job.state = 'active';
    job.processedOn = Date.now();

    this.emit('active', job);

    // Process will be handled by worker
    // This is just the queue management
  }

  async updateProgress(jobId: string, progress: number) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = progress;
      this.emit('progress', job, progress);
    }
  }

  async complete(jobId: string, result: any) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.state = 'completed';
    job.returnvalue = result;
    job.finishedOn = Date.now();
    job.progress = 100;

    const index = this.active.indexOf(jobId);
    if (index > -1) this.active.splice(index, 1);
    this.completed.push(jobId);

    this.emit('completed', job);
    this.processNext();
  }

  async fail(jobId: string, error: Error) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.state = 'failed';
    job.failedReason = error.message;
    job.finishedOn = Date.now();

    const index = this.active.indexOf(jobId);
    if (index > -1) this.active.splice(index, 1);
    this.failed.push(jobId);

    this.emit('failed', job, error);
    this.processNext();
  }
}

// Create memory queues
export const memoryQueues = {
  bulkImport: new MemoryQueue(),
  resumeParse: new MemoryQueue(),
};

// Export for compatibility
export { MemoryQueue };
