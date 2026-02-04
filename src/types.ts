export type StepType =
  | 'generate_story'
  | 'generate_images'
  | 'generate_tts'
  | 'generate_music'
  | 'assemble_video';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface StoryOptions {
  provider: 'mock' | 'openai' | 'anthropic' | 'template';
  prompt: string;
}

export interface ImageOptions {
  provider: 'mock' | 'sdxl' | 'cloudflare' | 'r2';
  count: number;
  style?: string;
}

export interface TTSOptions {
  provider: 'mock' | 'openai' | 'elevenlabs' | 'cloudflare' | 'r2';
  voice?: string;
}

export interface MusicOptions {
  provider: 'mock' | 'aiva' | 'stock' | 'r2';
  mood?: string;
}

export interface VideoOptions {
  provider: 'mock' | 'external' | 'webcodecs' | 'manifest';
}

export interface JobConfig {
  story: StoryOptions;
  images: ImageOptions;
  tts: TTSOptions;
  music: MusicOptions;
  video: VideoOptions;
}

export interface JobArtifacts {
  story?: { textKey: string };
  images?: { keys: string[] };
  tts?: { keys: string[] };
  music?: { key: string };
  video?: { key?: string; manifestKey?: string };
}

export interface JobState {
  jobId: string;
  status: JobStatus;
  currentStep: StepType | null;
  config: JobConfig;
  artifacts: JobArtifacts;
  stepStatus: Record<StepType, StepStatus>;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface QueueMessage {
  jobId: string;
  step: StepType;
  attempt?: number;
}

export const STEP_ORDER: StepType[] = [
  'generate_story',
  'generate_images',
  'generate_tts',
  'generate_music',
  'assemble_video',
];

export function buildDefaultConfig(): JobConfig {
  return {
    story: {
      provider: 'mock',
      prompt: 'a curious explorer',
    },
    images: {
      provider: 'mock',
      count: 5,
      style: 'cinematic',
    },
    tts: {
      provider: 'mock',
      voice: 'neutral',
    },
    music: {
      provider: 'mock',
      mood: 'uplifting',
    },
    video: {
      provider: 'mock',
    },
  };
}
