/**
 * ProgressLog - Record of work completed on a batch step
 */
export interface ProgressLog {
  /** Unique identifier (CUID) */
  id: string;

  /** ID of the batch step this log entry is for */
  batchStepId: string;

  /** ID of the worker who submitted this progress */
  workerId: string;

  /** Quantity of work completed in this entry */
  quantity: number;

  /** Optional note about the work done */
  note?: string;

  /** When this progress log was created */
  createdAt: Date;
}
