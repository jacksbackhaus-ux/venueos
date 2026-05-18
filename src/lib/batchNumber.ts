/**
 * Batch number format: "<Title Cased Product> - 003"
 * Falls back to the legacy batch_code when recipe_number is missing
 * (existing rows produced before recipe numbers were introduced).
 */
export function formatBatchNumber(productName: string | null | undefined, recipeNumber: number | null | undefined): string | null {
  if (!productName || recipeNumber == null || isNaN(Number(recipeNumber))) return null;
  const trimmed = productName.trim();
  const titled = trimmed
    .split(/\s+/)
    .map(w => w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)
    .join(' ');
  const padded = String(Math.max(0, Math.floor(Number(recipeNumber)))).padStart(3, '0');
  return `${titled} - ${padded}`;
}

export function displayBatchNumber(
  productName: string | null | undefined,
  recipeNumber: number | null | undefined,
  fallbackBatchCode: string | null | undefined,
): string {
  return formatBatchNumber(productName, recipeNumber) ?? (fallbackBatchCode ?? '—');
}
