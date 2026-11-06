// R2 storage budget shared by the photo upload guard and the admin
// usage readout. R2's free allowance is 10 GB of storage per month and
// Cloudflare bills any overage — there is no hard spending cap on the
// account, so the ceiling has to live in app code. The default budget
// is 9 GB (90% of the free tier); the gap absorbs ledger drift and
// concurrent uploads that both pass the check before either records
// its object. Deployments may override it with the R2_BUDGET_BYTES
// environment variable (bytes, as a number or numeric string).
export const DEFAULT_R2_BUDGET_BYTES = 9000000000;

export function r2BudgetBytes(env) {
  const override = Number(env && env.R2_BUDGET_BYTES);
  return override > 0 ? override : DEFAULT_R2_BUDGET_BYTES;
}
