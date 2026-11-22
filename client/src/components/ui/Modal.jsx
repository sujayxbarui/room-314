import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}) {
  const handleEscape = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-navy-900/50 transition-opacity"
        onClick={onClose}
      />
      <div
        className={`
          relative bg-white rounded-lg shadow-lg w-full ${sizeClasses[size]}
          transform transition-all duration-200
          max-h-[90vh] overflow-y-auto
        `}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-navy-200">
            <h2 className="text-lg font-semibold text-navy-800">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-navy-400 hover:text-navy-600 hover:bg-navy-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
