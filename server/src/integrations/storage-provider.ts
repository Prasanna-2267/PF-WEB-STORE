export interface UploadIntent {
  academyId: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
}

export interface StorageProvider {
  createUploadUrl(intent: UploadIntent): Promise<{ uploadUrl: string; expiresAt: Date; headers: Record<string, string> }>;
  createDownloadUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
  statObject(objectKey: string): Promise<{ sizeBytes: number; mimeType: string; checksumSha256?: string }>;
  deleteObject(objectKey: string): Promise<void>;
  copyObject(sourceObjectKey: string, destinationObjectKey: string): Promise<void>;
  putObject?(objectKey: string, body: Buffer, mimeType: string, checksumSha256: string): Promise<void>;
}

// A provider is intentionally not selected here. Startup/provider wiring must supply
// a real implementation; API handlers return STORAGE_PROVIDER_NOT_CONFIGURED until then.
