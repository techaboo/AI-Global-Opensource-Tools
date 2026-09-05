## Type of change

- [ ] Add a new catalog entry in `src/data/tools.ts`
- [ ] Update an existing catalog entry
- [ ] Fix / docs / other (describe below)

## Tool entry (add or edit)

Paste the object you added or changed in [`src/data/tools.ts`](../src/data/tools.ts). One typed object per tool, single line preferred so `scripts/fetch-stars.mjs` can pick up `id` + `repo`.

```ts
{
  id: 'unique-kebab-id',          // required, stable, unique
  name: 'Tool Name',              // required
  org: 'Organization',            // required
  cat: 'agents',                  // required — must be a Category.id from CATEGORIES
  tagline: 'One-line pitch',      // required
  desc: 'One or two sentences.',  // required
  license: 'MIT',                 // required
  lang: 'TypeScript',             // required — primary language
  stars: 0,                       // required — snapshot star count (CI refreshes live)
  repo: 'owner/name',             // optional but strongly recommended for live sync
  tags: ['agents', 'rag'],        // required — lowercase kebab tags
  hot: false,                     // optional
  status: 'active',               // required — 'active' | 'maintenance' | 'archived'
  year: 2026,                     // required — first public release year
}
```

### Checklist

- [ ] `id` is unique and does not collide with an existing entry
- [ ] `cat` matches an id in `CATEGORIES` (see README category list)
- [ ] `repo` is `owner/name` (no `https://github.com/` prefix) when a public GitHub repo exists
- [ ] Description is factual and not marketing copy
- [ ] `npm run lint` and `npm run build` pass if you changed TypeScript

## Notes

<!-- Why this tool belongs, sources for star/license claims, etc. -->
