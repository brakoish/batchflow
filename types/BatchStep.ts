/**
 * StepStatus - Status of a batch step in the workflow
 */
export enum StepStatus {
  LOCKED = 'LOCKED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

/**
 * StepType - Type of step measurement
 */
export enum StepType {
  CHECK = 'CHECK',
  COUNT = 'COUNT',
}

/**
 * BatchStep - Individual step within a batch production run
 */
export interface BatchStep {
  /** Unique identifier (CUID) */
  id: string;

  /** ID of the parent batch */
  batchId: string;

  /** ID of the source recipe step */
  recipeStepId: string;

  /** Display name for this step */
  name: string;

  /** Execution order within the batch */
  order: number;

  /** Type of step (CHECK or COUNT) */
  type: StepType;

  /** Label for the unit of measurement */
  unitLabel: string;

  /** Ratio for unit conversion */
  unitRatio: number;

  /** Target quantity to complete */
  targetQuantity: number;

  /** Quantity completed so far */
  completedQuantity: number;

  /** Current status of the step */
  status: StepStatus;

  /** IDs of progress logs for this step */
  progressLogIds: string[];
}
