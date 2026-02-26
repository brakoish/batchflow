import type { StepMaterial } from './StepMaterial';

/**
 * StepType - Type of recipe step
 */
export enum StepType {
  CHECK = 'CHECK',
  COUNT = 'COUNT',
}

/**
 * RecipeStep - A step in a manufacturing recipe
 */
export interface RecipeStep {
  /** Unique identifier (CUID) */
  id: string;

  /** ID of the recipe this step belongs to */
  recipeId: string;

  /** Display name of the step */
  name: string;

  /** Execution order within the recipe */
  order: number;

  /** Optional notes/instructions for the step */
  notes?: string;

  /** Type of step (CHECK or COUNT) */
  type: StepType;

  /** ID of the associated recipe unit (optional) */
  unitId?: string;

  /** Materials needed for this step */
  materials?: StepMaterial[];

  /** IDs of batch steps created from this recipe step */
  batchStepIds: string[];
}
