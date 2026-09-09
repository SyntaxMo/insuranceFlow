export function generateClaimNumber(now = new Date()): string {
  const year = now.getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CLM-${year}-${random}`;
}
