export interface Env {
  jobStateMachine: DurableObjectNamespace;
  media_steps: Queue;
  storyteller_artifacts: R2Bucket;
}

// Mock step handlers
async function mockGenerateStory(config: any): Promise<{ storyText: string }> {
  return {
    storyText: `Once upon a time in a digital realm, there was a brave ${config.storyPrompt} who embarked on an epic journey to discover the secrets of the cloud.`,
  };
}

async function mockGenerateImages(config: any, jobId: string, stepNumber: number): Promise<string[]> {
  const images: string[] = [];
  for (let i = 0; i < config.numImages; i++) {
    const key = `${jobId}/images/segment_${stepNumber}_${i}.jpg`;
    await env.storyteller_artifacts.put(key, new Uint8Array(1024)); // Fake image
    images.push(`https://storyteller-artifacts.r2.dev/${key}`);
  }
  return images;
}

async function mockGenerateAudio(config: any, jobId: string, stepNumber: number): Promise<string[]> {
  const audio: string[] = [];
  for (let i = 0; i < 3; i++) { // 3 segments
    const key = `${jobId}/audio/segment_${stepNumber}_${i}.mp3`;
    await env.storyteller_artifacts.put(key, new Uint8Array(512)); // Fake audio
    audio.push(`https://storyteller-artifacts.r2.dev/${key}`);
  }
  return audio;
}

async function mockGenerateMusic(config: any, jobId: string): Promise<string> {
  const key = `${jobId}/music/theme.mp3`;
  await env.storyteller_artifacts.put(key, new Uint8Array(256)); // Fake music
  return `https://storyteller-artifacts.r2.dev/${key}`;
}

async function mockAnimateImages(config: any, images: string[]): Promise<string[]> {
  // Mock animated images
  return images.map(img => img.replace('.jpg', '_animated.gif'));
}

async function mockAssembleVideo(config: any, artifacts: any): Promise<string> {
  const key = `${artifacts.jobId}/final_video.mp4`;
  await env.storyteller_art
