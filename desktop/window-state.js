const MINIMUM_WIDTH = 900;
const MINIMUM_HEIGHT = 620;
const MINIMUM_VISIBLE_AREA = 100;

export function normalizeWindowState(stored, workAreas) {
  const bounds = stored?.bounds;
  if (
    !bounds ||
    !["x", "y", "width", "height"].every((key) => Number.isFinite(bounds[key])) ||
    bounds.width < MINIMUM_WIDTH ||
    bounds.height < MINIMUM_HEIGHT
  ) {
    return {};
  }

  const isVisible = workAreas.some((workArea) => {
    const horizontalOverlap = Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x);
    const verticalOverlap = Math.min(bounds.y + bounds.height, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y);
    return horizontalOverlap >= MINIMUM_VISIBLE_AREA && verticalOverlap >= MINIMUM_VISIBLE_AREA;
  });

  return isVisible ? { bounds, isMaximized: stored.isMaximized === true } : {};
}
