export default function Select({
  label,
  options = [],
  error,
  className = '',
  ...props
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-navy-700">
          {label}
        </label>
      )}
      <select
        className={`
          block w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm
          text-navy-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500
          disabled:bg-navy-50 disabled:text-navy-500 disabled:cursor-not-allowed
          transition-colors duration-150
          ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
        `}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
