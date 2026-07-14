// A simple structured table for financials/metrics content. Takes plain data so
// MDX stays declarative: <DataTable columns={[...]} rows={[[...],[...]]} />
export function DataTable({
  columns,
  rows,
  caption,
}: {
  columns: string[];
  rows: (string | number)[][];
  caption?: string;
}) {
  return (
    <div className="not-prose my-8 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-zinc-300 dark:border-zinc-700">
            {columns.map((c, i) => (
              <th
                key={i}
                className={`py-2 px-3 text-xs uppercase tracking-wide text-zinc-400 font-semibold ${i === 0 ? "text-left" : "text-right"}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-zinc-100 dark:border-zinc-800/60">
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className={`py-2 px-3 ${ci === 0 ? "text-left font-medium" : "text-right tabular-nums text-zinc-600 dark:text-zinc-300"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {caption && <p className="text-xs text-zinc-400 mt-2">{caption}</p>}
    </div>
  );
}
