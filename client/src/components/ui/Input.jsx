import { forwardRef } from 'react';

const Input = forwardRef(function Input(
  {
    label,
    error,
    icon: Icon,
    className = '',
    type = 'text',
    ...props
  },
  ref
) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-navy-700">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="w-4 h-4 text-navy-400" />
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={`
            block w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm
            text-navy-800 placeholder-navy-400
            focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500
            disabled:bg-navy-50 disabled:text-navy-500 disabled:cursor-not-allowed
            transition-colors duration-150
            ${Icon ? 'pl-10' : ''}
            ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
          `}
          {...props}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
});

export default Input;
