const STATUSES = ['paid', 'pending', 'failed'];

export function filterByStatus(rows, status) {
  if (!status) return rows;
  if (!STATUSES.includes(status)) throw new Error(`unknown status: ${status}`);
  return rows.filter((row) => row.status === status);
}
