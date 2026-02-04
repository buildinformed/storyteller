export interface Queue {
  send(message: unknown): Promise<void>;
}

export interface MessageBatch<T> {
  messages: Array<{ body: T }>;
}

export interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | Blob | string,
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
    }
  ): Promise<void>;
}

export interface DurableObjectId {
  name?: string;
  toString(): string;
}

export interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export interface DurableObjectState {
  id: DurableObjectId;
  storage: DurableObjectStorage;
}

export interface DurableObjectStub {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}
