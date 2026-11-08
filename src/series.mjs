// Index lightweight metadata once. Shared entry arrays never contain article bodies.
export function indexSeries(documents, includeDrafts = false) {
  const groups = new Map();
  for (const doc of documents) {
    if (doc.kind !== 'post' || !doc.series) continue;
    const { id, title, part } = doc.series;
    let group = groups.get(id);
    if (!group) {
      group = { title, source: doc.source, allParts: new Map(), parts: new Map() };
      groups.set(id, group);
    }
    if (group.title !== title) throw new Error(`${doc.source}: series ${id} title differs from ${group.source}`);
    if (group.allParts.has(part)) throw new Error(`${doc.source}: duplicate part ${part} in series ${id} (also ${group.allParts.get(part).source})`);
    group.allParts.set(part, { source: doc.source });
    if (!includeDrafts && doc.unlisted) continue;
    const isHidden = (doc.draft || doc.unlisted) && !includeDrafts;
    group.parts.set(part, { source: doc.source, part, title: doc.title, route: isHidden ? null : doc.route, url: isHidden ? null : doc.url });
  }
  const byRoute = new Map();
  for (const group of groups.values()) {
    const entries = [...group.parts.values()].sort((a, b) => a.part - b.part)
      .map(({ source, ...entry }) => entry);
    // A gap means the full sequence is not yet defined; show only the part number.
    const total = entries.every((entry, index) => entry.part === index + 1) ? entries.length : null;
    const published = entries.filter(entry => entry.url);
    published.forEach((entry, index) => {
      byRoute.set(entry.route, { title: group.title, entries, total,
        previous: published[index - 1] ?? null, next: published[index + 1] ?? null });
    });
  }
  return byRoute;
}
