import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { getStockStatusBadge } from '../../utils/formatters';

export default function StockBadge({ stock, threshold = 10, compact = false }) {
  const { label, color } = getStockStatusBadge(stock, threshold);

  const config = {
    success: {
      icon: CheckCircle,
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
    },
    danger: {
      icon: XCircle,
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
    },
  };

  const { icon: Icon, bg, text, border } = config[color];

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${text}`}>
        <Icon className="w-3 h-3" />
        {label === 'Low Stock' ? `${stock} left` : label}
      </span>
    );
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-md
        ${bg} ${text} border ${border}
      `}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {label === 'Low Stock' && <span>({stock})</span>}
    </span>
  );
}
