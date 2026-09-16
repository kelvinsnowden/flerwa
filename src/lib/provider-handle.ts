/**
 * The public storefront URL segment for a provider: their account
 * username when they've set one, falling back to providers.slug
 * otherwise. Centralized so every place that links to a provider's own
 * storefront (dashboard, copy-link button, etc.) upgrades to the
 * username automatically once set, without a migration or redirect.
 */
export function providerHandle(provider: { slug: string }, username?: string | null): string {
  return username || provider.slug;
}
