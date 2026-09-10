/**
 * GitHub already hosts a reliable avatar for every org/user at a stable, first-party
 * URL — no third-party favicon service or extra tracking domain needed.
 */
export function ownerAvatarUrl(repo: string | undefined, size = 64): string | null {
  if (!repo) return null;
  const owner = repo.split('/')[0];
  if (!owner) return null;
  return `https://github.com/${owner}.png?size=${size}`;
}
