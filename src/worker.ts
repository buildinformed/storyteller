import type { DurableObjectNamespace, MessageBatch, Queue, R2Bucket } from './cf-types';
import { JobController, JobStateMachine } from './durable-object';
import { runStep } from './steps';
import { buildDefaultConfig, JobState, QueueMessage, StepType } from './types';

export interface Env {
  JOBS: DurableObjectNamespace;
  STEP_QUEUE: Queue;
  ARTIFACTS: R2Bucket;
}

export { JobController, JobStateMachine };

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function isStepType(value: string): value is StepType {
  return (
    value === 'generate_story' ||
    value === 'generate_images' ||
    value === 'generate_tts' ||
    value === 'generate_music' ||
    value === 'assemble_video'
  );
}

async function getJobState(env: Env, jobId: string): Promise<JobState> {
  const state = env.JOBS.idFromName(jobId);
  const stub = env.JOBS.get(state);
  const response = await stub.fetch('https://internal/status');
  if (!response.ok) {
    throw new Error(`Failed to fetch job status for ${jobId}`);
  }
  return (await response.json()) as JobState;
}

async function completeStep(
  env: Env,
  jobId: string,
  payload: { step: StepType; artifacts?: unknown; error?: string }
): Promise<void> {
  const state = env.JOBS.idFromName(jobId);
  const stub = env.JOBS.get(state);
  await stub.fetch('https://internal/complete', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/jobs' && request.method === 'POST') {
      let body: any = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }

      const jobId = body?.jobId ?? crypto.randomUUID();
      const config = body?.config ?? buildDefaultConfig();

      const state = env.JOBS.idFromName(jobId);
      const stub = env.JOBS.get(state);
      await stub.fetch('https://internal/init', {
        method: 'POST',
        body: JSON.stringify({ jobId, config }),
      });

      return jsonResponse({ jobId });
    }

    if (url.pathname.startsWith('/jobs/') && request.method === 'GET') {
      const jobId = url.pathname.split('/')[2];
      if (!jobId) {
        return new Response('jobId is required', { status: 400 });
      }

      const state = env.JOBS.idFromName(jobId);
      const stub = env.JOBS.get(state);
      return stub.fetch('https://internal/status');
    }

    if (url.pathname.startsWith('/jobs/') && request.method === 'POST') {
      const parts = url.pathname.split('/');
      const jobId = parts[2];
      const action = parts[3];
      if (action !== 'debug-run') {
        return new Response('Not found', { status: 404 });
      }

      const step = url.searchParams.get('step');
      if (!jobId || !step || !isStepType(step)) {
        return new Response('jobId and step are required', { status: 400 });
      }

      try {
        const job = await getJobState(env, jobId);
        const artifacts = await runStep(step, jobId, job.config, job.artifacts, {
          ARTIFACTS: env.ARTIFACTS,
        });

        await completeStep(env, jobId, { step, artifacts });
        return jsonResponse({ status: 'ok', jobId, step });
      } catch (error) {
        await completeStep(env, jobId, {
          step,
          error: error instanceof Error ? error.message : String(error),
        });
        return jsonResponse({ status: 'error', jobId, step }, 500);
      }
    }

    return new Response('Not found', { status: 404 });
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const body = message.body;
      if (!body?.jobId || !body?.step || !isStepType(body.step)) {
        console.warn('Queue message missing jobId/step', body);
        continue;
      }

      try {
        const step = body.step as StepType;
        const job = await getJobState(env, body.jobId);
        const currentStatus = job.stepStatus?.[step];
        if (currentStatus === 'completed') {
          continue;
        }

        const artifacts = await runStep(step, body.jobId, job.config, job.artifacts, {
          ARTIFACTS: env.ARTIFACTS,
        });

        await completeStep(env, body.jobId, {
          step,
          artifacts,
        });
      } catch (error) {
        await completeStep(env, body.jobId, {
          step: body.step as StepType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  },
};
