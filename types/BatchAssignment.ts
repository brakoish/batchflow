/**
 * BatchAssignment - Links a worker to a batch they are assigned to work on
 */
export interface BatchAssignment {
  /** Unique identifier (CUID) */
  id: string;

  /** ID of the batch being worked on */
  batchId: string;

  /** ID of the worker assigned to this batch */
  workerId: string;

  /** When the assignment was created */
  createdAt: Date;
}
