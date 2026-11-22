import { Plus, Minus, X } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export default function CartItem({ item, onIncrement, onDecrement, onRemove, onUpdateQuantity }) {
  const { product, quantity } = item;
  const lineTotal = product.selling_price * quantity;

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 border-b border-navy-100 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-navy-800 truncate">{product.name}</p>
        <p className="text-xs text-navy-500">{formatCurrency(product.selling_price)}</p>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onDecrement(product.id)}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-navy-200 text-navy-600 hover:bg-navy-100 transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input
          type="number"
          value={quantity}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= 0) {
              onUpdateQuantity(product.id, val);
            }
          }}
          className="w-10 h-7 text-center text-sm border border-navy-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
          min="0"
        />
        <button
          onClick={() => onIncrement(product.id)}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-navy-200 text-navy-600 hover:bg-navy-100 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-sm font-semibold text-navy-800 w-20 text-right">
        {formatCurrency(lineTotal)}
      </p>

      <button
        onClick={() => onRemove(product.id)}
        className="p-1 rounded-md text-navy-400 hover:text-red-600 hover:bg-red-50 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
