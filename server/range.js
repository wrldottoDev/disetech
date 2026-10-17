/**
 * Parses a single-range `Range: bytes=…` header against a file of `size` bytes.
 *
 * @returns {{start: number, end: number} | null | false}
 *   null  — no usable range header: serve the whole file (200)
 *   false — a range that cannot be satisfied (416)
 */
export function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!match || (!match[1] && !match[2])) return null;

  const last = size - 1;
  // "bytes=-500" is a suffix: the last 500 bytes
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), last) : last;
  return start > end || start > last ? false : { start, end };
}
