import type { LearningPackage, PackageInput } from '../types/package';

export type PackageRepositoryErrorCode = 'NOT_FOUND' | 'VALIDATION_ERROR' | 'STORAGE_ERROR';

export class PackageRepositoryError extends Error {
  readonly code: PackageRepositoryErrorCode;

  constructor(code: PackageRepositoryErrorCode, message: string) {
    super(message);
    this.name = 'PackageRepositoryError';
    this.code = code;
  }
}

export interface PackageRepository {
  list(): Promise<LearningPackage[]>;
  create(input: PackageInput): Promise<LearningPackage>;
  update(packageId: string, input: PackageInput): Promise<LearningPackage>;
  delete(packageId: string): Promise<void>;
}
