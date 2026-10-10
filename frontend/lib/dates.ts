// School events use calendar dates; preserve their day when the browser changes timezone.
export function schoolDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}
