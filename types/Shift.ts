/**
 * ShiftStatus - Shift status enumeration
 */
export enum ShiftStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

/**
 * Shift - Work shift tracking for workers
 */
export interface Shift {
  /** Unique identifier (CUID) */
  id: string;

  /** ID of the worker assigned to this shift */
  workerId: string;

  /** Current status of the shift */
  status: ShiftStatus;

  /** When the shift started */
  startedAt: Date;

  /** When the shift ended (null if still active) */
  endedAt: Date | null;

  /** Optional notes about the shift */
  notes: string | null;

  /** When the shift record was created */
  createdAt: Date;
}
