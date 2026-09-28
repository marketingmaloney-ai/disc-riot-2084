/** Which optional generated assets ship with this build (from public/assets/manifest.json). */
let manifest: Promise<Set<string>> | null = null;

function load(): Promise<Set<string>> {
  manifest ??= fetch('assets/manifest.json')
    .then((r) => (r.ok ? r.json() : { files: [] }))
    .then((j: { files: string[] }) => new Set(j.files))
    .catch(() => new Set<string>());
  return manifest;
}

export async function hasAsset(url: string): Promise<boolean> {
  return (await load()).has(url);
}
