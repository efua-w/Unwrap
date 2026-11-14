import type { ReactNode } from "react";

// The label and value rows of S02 and S10 (Budget, Join by, Names drawn, Gift day). A description
// list: each row is a term and its value.
export function DetailRows({ rows, zoneLine }: { rows: ReadonlyArray<{ label: string; value: ReactNode }>; zoneLine: string }) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex min-h-row items-center justify-between gap-16 ${i > 0 ? "border-t border-border-subtle" : ""}`}
          >
            <dt className="text-body-sm-regular text-text-muted">{row.label}</dt>
            <dd className="text-right text-body-base-semibold">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-body-sm-regular text-text-muted">{zoneLine}</p>
    </div>
  );
}
