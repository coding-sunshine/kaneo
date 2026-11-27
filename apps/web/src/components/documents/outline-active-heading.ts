/** How far below the top of the scroller a heading still counts as in view. */
export const OUTLINE_OFFSET = 96;

/**
 * The heading whose section is in view: the last one that has reached the
 * top of the scroller, or the first when none has yet.
 */
export function activeHeadingIndex(tops: number[], offset = OUTLINE_OFFSET) {
  let active = 0;
  tops.forEach((top, index) => {
    if (top <= offset) active = index;
  });
  return active;
}
