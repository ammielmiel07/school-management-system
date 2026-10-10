export function componentStats(items: { id: number; max_score: string }[], scores: Record<number, string> = {}, weight: number) {
  const total = items.reduce((sum, item) => sum + Number(scores[item.id] || 0), 0);
  const maxTotal = items.reduce((sum, item) => sum + Number(item.max_score), 0);
  const ps = maxTotal > 0 ? total / maxTotal * 100 : 0;
  return { total, maxTotal, ps, ws: ps * Number(weight) / 100 };
}
