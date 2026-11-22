export default function Card({
  children,
  title,
  subtitle,
  action,
  className = '',
  noPadding = false,
}) {
  return (
    <div
      className={`
        bg-white border border-navy-200 shadow-sm rounded-lg
        ${noPadding ? '' : 'p-6'}
        ${className}
      `}
    >
      {(title || action) && (
        <div className={`flex items-center justify-between ${noPadding ? 'px-6 pt-6' : ''} ${title ? 'mb-4' : ''}`}>
          <div>
            {title && (
              <h3 className="text-base font-semibold text-navy-800">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-navy-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
