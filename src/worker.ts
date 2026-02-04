import { JobStateMachine } from './durable-object';

export interface Env {
  jobStateMachine: DurableObjectNamespace;
  media_steps: Queue;
  storyteller_artifacts: R2Bucket;
}

export { JobStateMachine };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/start' && request.method === 'POST') {
      const body = await request.json();
      const state = env.jobStateMachine.idFromName(body.jobId);
      const stub = env.jobStateMachine.get(state);
      
      return stub.fetch('/start', request);
    } else if (url.pathname === '/status' && request.method === 'GET') {
      const jobId = url.searchParams.get('jobId');
      if (!jobId) {
        return new Response('jobId is required', { status: 400 });
      }
      
      const state = env.jobStateMachine.idFromName(jobId);
      const stub = env.jobStateMachine.get(state);
      
      return stub.fetch('/status');
    } else {
      return new Response('Not found', { status: 404 });
    }
  },
  async queue(batch: any, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const body = message.body as {
        jobId?: string;
        step?: string;
        payload?: unknown;
      };

      if (!body?.jobId) {
        console.warn('Queue message missing jobId', body);
        continue;
      }

      const state = env.jobStateMachine.idFromName(body.jobId);
      const stub = env.jobStateMachine.get(state);

      await stub.fetch(
        'https://internal/complete',
        new Request('https://internal/complete', {
          method: 'POST',
          body: JSON.stringify({
            step: body.step,
            payload: body.payload,
          }),
        })
      );
    }
  },
};
