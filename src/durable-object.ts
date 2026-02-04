export interface Env {
  jobStateMachine: DurableObjectNamespace;
  media_steps: Queue;
  storyteller_artifacts: R2Bucket;
}

interface WorkflowState {
  jobId: string;
  status: 'pending' | 'generating_story' | 'generating_images' | 'generating_audio' | 'generating_music' | 'animating' | 'assembling' | 'completed' | 'failed';
  config: {
    storyPrompt: string;
    numImages: number;
    voice: string;
    musicStyle: string;
    animate: boolean;
  };
  artifacts: {
    storyText?: string;
    images?: string[];
    audio?: string[];
    music?: string;
    video?: string;
  };
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export class JobStateMachine {
  private state: WorkflowState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = {
      jobId: state.id.name,
      status: 'pending',
      config: {} as any,
      artifacts: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'POST' && url.pathname === '/start') {
      return this.handleStart(request);
    } else if (method === 'POST' && url.pathname === '/complete') {
      return this.handleComplete(request);
    } else if (method === 'GET' && url.pathname === '/status') {
      return this.handleStatus();
    } else {
      return new Response('Not found', { status: 404 });
    }
  }

  private async handleStart(request: Request): Promise<Response> {
    const body = await request.json();
    this.state.config = body.config;
    this.state.status = 'pending';
    this.state.updatedAt = Date.now();

    // Send first step to queue
    await this.state.env.media_steps.send({
      jobId: this.state.jobId,
      step: 'generate_story',
      payload: body.config,
    });

    return Response.json({ status: 'started', jobId: this.state.jobId });
  }

  private async handleComplete(request: Request): Promise<Response> {
    const body = await request.json();
    this.state.artifacts = { ...this.state.artifacts, ...body.artifacts };
    this.state.status = body.artifacts.video ? 'completed' : 'assembling';
    this.state.updatedAt = Date.now();

    // If video is ready, send to queue for final assembly
    if (body.artifacts.video) {
      await this.state.env.media_steps.send({
        jobId: this.state.jobId,
        step: 'assemble_video',
        payload: { videoUrl: body.artifacts.video },
      });
    }

    return Response.json({ status: 'updated', jobId: this.state.jobId });
  }

  private async handleStatus(): Promise<Response> {
    return Response.json({
      jobId: this.state.jobId,
      status: this.state.status,
      config: this.state.config,
      artifacts: this.state.artifacts,
      error: this.state.error,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
    });
  }

  // Called by queue consumers to update state
  async updateState(updates: Partial<WorkflowState>): Promise<void> {
    Object.assign(this.state, updates);
    this.state.updatedAt = Date.now();
  }

  async setState(state: WorkflowState): Promise<void> {
    this.state = state;
    this.state.updatedAt = Date.now();
  }

  getState(): WorkflowState {
    return { ...this.state };
  }
}
