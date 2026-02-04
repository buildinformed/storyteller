declare interface Queue {
  send(message: unknown): Promise<void>;
}

declare interface MessageBatch<T> {
  messages: Array<{ body: T }>;
}

declare interface R2Bucket {
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

declare interface DurableObjectId {
  toString(): string;
}

declare interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

declare interface DurableObjectState {
  id: DurableObjectId;
  storage: DurableObjectStorage;
}

declare interface DurableObjectStub {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
}

declare interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}
