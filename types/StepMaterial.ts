/**
 * StepMaterial - Material needed for a recipe step
 */
export interface StepMaterial {
  /** Unique identifier (CUID) */
  id: string;

  /** ID of the recipe step this material belongs to */
  recipeStepId: string;

  /** Name of the material (e.g., "Labels", "Flower") */
  name: string;

  /** Quantity needed per unit of production */
  quantityPerUnit: number;

  /** Unit of measurement for this material */
  unit: string;
}
