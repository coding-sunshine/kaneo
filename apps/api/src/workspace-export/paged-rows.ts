/**
 * Rows of a query read one page at a time, so a large workspace never sits
 * in memory whole. `page` returns up to `size` rows after the cursor.
 */
export async function* pagedRows<Row, Cursor>(
  page: (after: Cursor | null, size: number) => Promise<Row[]>,
  cursor: (row: Row) => Cursor,
  size: number,
): AsyncGenerator<Row> {
  let after: Cursor | null = null;
  for (;;) {
    const rows = await page(after, size);
    yield* rows;
    const last = rows.at(-1);
    if (rows.length < size || !last) return;
    after = cursor(last);
  }
}
