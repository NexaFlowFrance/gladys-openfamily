// -----------------------------------------------------------------------------
// OpenFamily's meal plan, as the widget and the scene action read it. Pure.
//
// A planned meal is { date: 'YYYY-MM-DD', meal_type, recipe: { name } | null,
// custom_meal }: a recipe of the family, or a few words typed in its place.
// OpenFamily stores the meal types under their French names, whatever the
// language of the family.
// -----------------------------------------------------------------------------

/** The meal types of OpenFamily, in the order of the day, and their key here. */
export const MEAL_TYPES = {
  'Petit-déjeuner': 'breakfast',
  Déjeuner: 'lunch',
  Dîner: 'dinner',
  Snack: 'snack',
};
const ORDER = Object.values(MEAL_TYPES);
const rank = (meal) => (meal.type ? ORDER.indexOf(meal.type) : ORDER.length);

/** What is planned: the recipe, or what the family typed. */
export const mealName = (plan) => String(plan?.recipe?.name || plan?.custom_meal || '').trim();

/**
 * The meals planned on `day` ('YYYY-MM-DD'), in the order of the day, as
 * { type, label, name }. `type` is breakfast, lunch, dinner or snack; a meal
 * type this integration does not know has none, keeps the `label` OpenFamily
 * gives it, and comes last.
 */
export function dayMeals(plans, day) {
  return (Array.isArray(plans) ? plans : [])
    .filter((plan) => typeof plan?.date === 'string' && plan.date.slice(0, 10) === day)
    .map((plan) => ({
      type: MEAL_TYPES[plan.meal_type] ?? '',
      label: String(plan.meal_type ?? '').trim(),
      name: mealName(plan),
    }))
    .filter((meal) => meal.name)
    .sort((a, b) => rank(a) - rank(b));
}
