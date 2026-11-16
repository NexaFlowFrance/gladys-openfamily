// -----------------------------------------------------------------------------
// The members of the family, as far as this integration needs them: finding
// the one a typed first name stands for, and naming who a task is assigned to.
// Pure.
// -----------------------------------------------------------------------------

/** A name as it is compared: no case, no accent, no outer space. */
export const plainName = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

/**
 * The member a typed name stands for: the one named so, or else the only one
 * whose first name it is ("Léa" for "Léa Martin"). Undefined when nobody is,
 * or when a first name alone cannot tell two members apart.
 */
export function findMember(members, name) {
  const wanted = plainName(name);
  if (!wanted) return undefined;
  const list = (members ?? []).filter((member) => member && typeof member.name === 'string');
  const named = list.find((member) => plainName(member.name) === wanted);
  if (named) return named;
  const first = list.filter((member) => plainName(member.name).split(/\s+/)[0] === wanted);
  return first.length === 1 ? first[0] : undefined;
}

/** Who a task is assigned to, by name: "Léa, Tom"; '' for nobody. */
export const assignees = (task) =>
  (Array.isArray(task?.assigned_to_members) ? task.assigned_to_members : [])
    .map((member) => (typeof member?.name === 'string' ? member.name.trim() : ''))
    .filter(Boolean)
    .join(', ');
