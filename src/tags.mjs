export const tagLabel = tag => tag.replaceAll('_', ' ');
export const tagSlug = tag => tag.toLowerCase().replaceAll('_', '-');

// Validate drafts too, so publishing cannot unexpectedly change a tag's identity.
export function validateTags(documents) {
  const spellings = new Map();
  for (const doc of documents) {
    for (const tag of doc.tags) {
      const slug = tagSlug(tag);
      const existing = spellings.get(slug);
      if (existing && existing.tag !== tag) {
        throw new Error(`${doc.source}: tag "${tag}" conflicts with "${existing.tag}" in ${existing.source}; both use /tags/${slug}/. Use exactly the same spelling.`);
      }
      if (!existing) spellings.set(slug, { tag, source: doc.source });
    }
  }
}
