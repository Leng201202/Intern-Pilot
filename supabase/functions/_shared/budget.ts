export function createRequestBudget(maximum: number): () => boolean {
  let used = 0;
  return () => {
    if (used >= maximum) return false;
    used += 1;
    return true;
  };
}
