// Portrait drop-in system: put an image named <cardDefId>.png (or .jpg/.webp)
// in src/ui/assets/portraits/ and it appears on that card automatically.
// Cards without a file keep their position-tinted silhouette.
// See PORTRAITS.md for the generation style guide and per-card prompts.

const files = import.meta.glob<string>("./assets/portraits/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
  query: "?url",
});

const byDefId = new Map<string, string>();
for (const [path, url] of Object.entries(files)) {
  const name = path.split("/").pop()!.replace(/\.(png|jpe?g|webp)$/i, "");
  byDefId.set(name, url);
}

export function portraitUrl(defId: string): string | undefined {
  return byDefId.get(defId);
}
