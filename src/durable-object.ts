import type { DurableObjectState, Queue } from './cf-types';
import {
  buildDefaultConfig,
  JobState,
  STEP_ORDER,
  StepType,
} from './types';

export interface Env {
  STEP_QUEUE: Queue;
}

export class JobController {
  private readonly state: DurableObjectState;
  private readonly env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'POST' && url.pathname === '/init') {
      return this.handleInit(request);
    }

    if (method === 'POST' && url.pathname === '/complete') {
      return this.handleComplete(request);
    }

    if (method === 'GET' && url.pathname === '/status') {
      return this.handleStatus();
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleInit(request: Request): Promise<Response> {
    const body = await request.json();
    const job = await this.loadState();

    if (job.status === 'running') {
      return Response.json({ status: 'already-running', jobId: job.jobId }, { status: 409 });
    }

    const config = body?.config ?? buildDefaultConfig();
    const now = Date.now();

    const updated: JobState = {
      ...job,
      status: 'running',
      config,
      currentStep: STEP_ORDER[0],
      stepStatus: STEP_ORDER.reduce((acc, step) => {
        acc[step] = 'pending';
        return acc;
      }, {} as JobState['stepStatus']),
      error: undefined,
      createdAt: job.createdAt || now,
      updatedAt: now,
    };

    await this.saveState(updated);
    await this.enqueueStep(updated.jobId, updated.currentStep);

    return Response.json({ status: 'started', jobId: updated.jobId });
  }

  private async handleComplete(request: Request): Promise<Response> {
    const body = await request.json();
    const job = await this.loadState();
    const step = body?.step as StepType | undefined;

    if (!step) {
      return new Response('step is required', { status: 400 });
    }

    const now = Date.now();
    const artifacts = { ...job.artifacts, ...body.artifacts };
    const stepStatus = { ...job.stepStatus };

    if (body?.error) {
      stepStatus[step] = 'failed';
      const failed: JobState = {
        ...job,
        status: 'failed',
        error: String(body.error),
        artifacts,
        stepStatus,
        updatedAt: now,
      };
      await this.saveState(failed);
      return Response.json({ status: 'failed', jobId: job.jobId });
    }

    stepStatus[step] = 'completed';
    const nextStep = this.nextStep(step);

    const updated: JobState = {
      ...job,
      artifacts,
      stepStatus,
      currentStep: nextStep,
      status: nextStep ? 'running' : 'completed',
      updatedAt: now,
    };

    await this.saveState(updated);

    if (nextStep) {
      await this.enqueueStep(updated.jobId, nextStep);
    }

    return Response.json({ status: updated.status, jobId: updated.jobId });
  }

  private async handleStatus(): Promise<Response> {
    const job = await this.loadState();
    return Response.json(job);
  }

  private nextStep(step: StepType): StepType | null {
    const index = STEP_ORDER.indexOf(step);
    if (index < 0 || index >= STEP_ORDER.length - 1) {
      return null;
    }
    return STEP_ORDER[index + 1];
  }

  private async enqueueStep(jobId: string, step: StepType | null): Promise<void> {
    if (!step) {
      return;
    }
    await this.env.STEP_QUEUE.send({ jobId, step });
  }

  private async loadState(): Promise<JobState> {
    const stored = await this.state.storage.get<JobState>('job');
    if (stored) {
      return stored;
    }

    const now = Date.now();
    return {
      jobId: this.state.id.toString(),
      status: 'pending',
      currentStep: null,
      config: buildDefaultConfig(),
      artifacts: {},
      stepStatus: STEP_ORDER.reduce((acc, step) => {
        acc[step] = 'pending';
        return acc;
      }, {} as JobState['stepStatus']),
      createdAt: now,
      updatedAt: now,
    };
  }

  private async saveState(job: JobState): Promise<void> {
    await this.state.storage.put('job', job);
  }
}
