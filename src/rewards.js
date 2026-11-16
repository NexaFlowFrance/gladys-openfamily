// -----------------------------------------------------------------------------
// The reward points of the family, as the widget and the scene action read
// them. Pure.
//
// OpenFamily gives them with GET /api/rewards/summary: { members: [{ id, name,
// balance, streak, pending_count, has_activity }] }. That route is not in the
// OpenAPI document that describes the stable API of OpenFamily, so nothing
// here trusts its shape: a field that is missing or of another type reads as
// zero, a summary that is not one reads as nobody.
// -----------------------------------------------------------------------------

const whole = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
};

/**
 * Every member of the family with their points, as { id, name, points,
 * streak, pending, active }. `streak` is the number of days in a row with a
 * task done, `pending` the tasks done that a parent has not approved yet,
 * `active` whether the member ever earned or spent a point.
 */
export function memberPoints(summary) {
  return (Array.isArray(summary?.members) ? summary.members : [])
    .filter((member) => member && typeof member.name === 'string' && member.name.trim())
    .map((member) => {
      const points = whole(member.balance);
      return {
        id: String(member.id),
        name: member.name.trim(),
        points,
        streak: Math.max(0, whole(member.streak)),
        pending: Math.max(0, whole(member.pending_count)),
        active: Boolean(member.has_activity) || points !== 0,
      };
    });
}

/**
 * The members worth a place on the family's card: the ones who play, most
 * points first. A parent who never earned a point is not shown at zero.
 */
export const scoreboard = (members) =>
  members
    .filter((member) => member.active)
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
