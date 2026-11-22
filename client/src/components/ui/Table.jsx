import Spinner from './Spinner';

export default function Table({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data found',
  onRowClick,
  rowClassName,
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-navy-500 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-navy-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`
                  px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider
                  ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                `}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-100">
          {data.map((row, idx) => (
            <tr
              key={row.id || idx}
              onClick={() => onRowClick?.(row)}
              className={`
                ${onRowClick ? 'cursor-pointer hover:bg-navy-50' : ''}
                ${rowClassName ? rowClassName(row) : ''}
              `}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`
                    px-4 py-3 text-navy-700
                    ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                  `}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
