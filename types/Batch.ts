/**
 * BatchStatus - Status of a production batch
 */
export enum BatchStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * Batch - A production run of a recipe
 */
export interface Batch {
  /** Unique identifier (CUID) */
  id: string;

  /** ID of the recipe being produced */
  recipeId: string;

  /** Display name for this batch */
  name: string;

  /** Target quantity to produce */
  targetQuantity: number;

  /** Base unit of measurement (e.g., "units", "kg") */
  baseUnit: string;

  /** Current status of the batch */
  status: BatchStatus;

  /** When the batch was started */
  startDate: Date;

  /** When the batch was completed (null if still active) */
  completedDate: Date | null;

  /** When the batch was created */
  createdAt: Date;

  /** IDs of the batch steps in this batch */
  stepIds: string[];

  /** IDs of worker assignments to this batch */
  assignmentIds: string[];
}
