import type { Academy, AcademyInput, AcademyStatus } from '../types/academy';

export type AcademyRepositoryErrorCode = 'NOT_FOUND' | 'VALIDATION_ERROR' | 'DUPLICATE' | 'STORAGE_ERROR';

export class AcademyRepositoryError extends Error {
  readonly code: AcademyRepositoryErrorCode;

  constructor(code: AcademyRepositoryErrorCode, message: string) {
    super(message);
    this.name = 'AcademyRepositoryError';
    this.code = code;
  }
}

export interface AcademyRepository {
  list(): Promise<Academy[]>;
  get(academyId: string): Promise<Academy>;
  create(input: AcademyInput): Promise<Academy>;
  update(academyId: string, input: AcademyInput): Promise<Academy>;
  updateStatus(academyId: string, status: AcademyStatus): Promise<Academy>;
}
