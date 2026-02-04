import type { R2Bucket } from './cf-types';
import { JobArtifacts, JobConfig, StepType } from './types';

export interface StepEnv {
  ARTIFACTS: R2Bucket;
}

function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function putText(bucket: R2Bucket, key: string, text: string): Promise<void> {
  await bucket.put(key, textToBytes(text), {
    httpMetadata: { contentType: 'text/plain; charset=utf-8' },
  });
}

async function putJson(bucket: R2Bucket, key: string, value: unknown): Promise<void> {
  await bucket.put(key, textToBytes(JSON.stringify(value, null, 2)), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

async function putBinary(bucket: R2Bucket, key: string, size: number, contentType: string): Promise<void> {
  await bucket.put(key, randomBytes(size), {
    httpMetadata: { contentType },
  });
}

async function mockGenerateStory(bucket: R2Bucket, jobId: string, config: JobConfig): Promise<JobArtifacts> {
  const storyText = `Once upon a time, ${config.story.prompt} embarked on a journey through the clouds.`;
  const key = `${jobId}/story/story.txt`;
  await putText(bucket, key, storyText);
  return { story: { textKey: key } };
}

async function mockGenerateImages(bucket: R2Bucket, jobId: string, config: JobConfig): Promise<JobArtifacts> {
  const keys: string[] = [];
  for (let i = 0; i < config.images.count; i += 1) {
    const key = `${jobId}/images/frame_${i + 1}.jpg`;
    await putBinary(bucket, key, 1024, 'image/jpeg');
    keys.push(key);
  }
  return { images: { keys } };
}

async function mockGenerateTTS(bucket: R2Bucket, jobId: string): Promise<JobArtifacts> {
  const key = `${jobId}/audio/narration.mp3`;
  await putBinary(bucket, key, 2048, 'audio/mpeg');
  return { tts: { keys: [key] } };
}

async function mockGenerateMusic(bucket: R2Bucket, jobId: string): Promise<JobArtifacts> {
  const key = `${jobId}/music/theme.mp3`;
  await putBinary(bucket, key, 2048, 'audio/mpeg');
  return { music: { key } };
}

async function mockAssembleVideo(
  bucket: R2Bucket,
  jobId: string,
  config: JobConfig,
  artifacts: JobArtifacts
): Promise<JobArtifacts> {
  if (config.video.provider === 'manifest') {
    const manifestKey = `${jobId}/video/manifest.json`;
    await putJson(bucket, manifestKey, {
      jobId,
      artifacts,
      generatedAt: new Date().toISOString(),
    });
    return { video: { manifestKey } };
  }

  const videoKey = `${jobId}/video/final.mp4`;
  await putBinary(bucket, videoKey, 4096, 'video/mp4');
  return { video: { key: videoKey } };
}

export async function runStep(
  step: StepType,
  jobId: string,
  config: JobConfig,
  artifacts: JobArtifacts,
  env: StepEnv
): Promise<JobArtifacts> {
  switch (step) {
    case 'generate_story':
      return await mockGenerateStory(env.ARTIFACTS, jobId, config);
    case 'generate_images':
      return await mockGenerateImages(env.ARTIFACTS, jobId, config);
    case 'generate_tts':
      return await mockGenerateTTS(env.ARTIFACTS, jobId);
    case 'generate_music':
      return await mockGenerateMusic(env.ARTIFACTS, jobId);
    case 'assemble_video':
      return await mockAssembleVideo(env.ARTIFACTS, jobId, config, artifacts);
    default:
      throw new Error(`Unknown step: ${step}`);
  }
}
