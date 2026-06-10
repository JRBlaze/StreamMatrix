export const VALID_THEMES = new Set(["system", "dark", "light"]);

export function normalizeTheme(theme) {
  return VALID_THEMES.has(theme) ? theme : "system";
}

export function parseStreamInputs(value) {
  return value
    .split(/[\n,]+/)
    .map((input) => input.trim())
    .filter(Boolean);
}

export function moveStream(streams, sourceId, targetId) {
  const sourceIndex = streams.findIndex((stream) => stream.id === sourceId);
  const targetIndex = streams.findIndex((stream) => stream.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return null;
  }

  const [stream] = streams.splice(sourceIndex, 1);
  streams.splice(targetIndex, 0, stream);
  return { sourceIndex, targetIndex };
}
