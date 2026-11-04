type AreaBalance = {
  managed: boolean;
  received_cents: string;
  paid_cents: string | null;
  receivable_cents: string;
  payable_cents: string | null;
};
export function studioTotals(rows: AreaBalance[]) {
  const empty = () => ({ received: 0n, paid: 0n, receivable: 0n, payable: 0n });
  const own = empty(),
    managed = empty();
  for (const row of rows) {
    const total = row.managed ? managed : own;
    total.received += BigInt(row.received_cents);
    total.paid += BigInt(row.paid_cents ?? 0);
    total.receivable += BigInt(row.receivable_cents);
    total.payable += BigInt(row.payable_cents ?? 0);
  }
  return { own, managed };
}
