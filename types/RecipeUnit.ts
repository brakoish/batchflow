/**
 * RecipeUnit - A unit of measurement for a recipe (e.g., box, crate, pallet)
 */
export interface RecipeUnit {
  /** Unique identifier (CUID) */
  id: string;

  /** ID of the recipe this unit belongs to */
  recipeId: string;

  /** Display name of the unit */
  name: string;

  /** Conversion ratio to base unit (e.g., 1 box = 12 units) */
  ratio: number;

  /** Display order for sorting units */
  order: number;

  /** IDs of recipe steps that use this unit */
  stepIds: string[];
}
