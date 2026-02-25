/**
 * Recipe - Manufacturing recipe template
 */
export interface Recipe {
  /** Unique identifier (CUID) */
  id: string;

  /** Recipe name */
  name: string;

  /** Optional recipe description */
  description?: string;

  /** Base unit of measurement for this recipe */
  baseUnit: string;

  /** When the recipe was created */
  createdAt: Date;

  /** IDs of recipe steps in this recipe */
  stepIds: string[];

  /** IDs of batches using this recipe */
  batchIds: string[];

  /** IDs of units defined for this recipe */
  unitIds: string[];
}
