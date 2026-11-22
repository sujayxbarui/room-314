import { formatCurrency, formatDateTime } from '../../utils/formatters';

export default function ReceiptPreview({ sale }) {
  if (!sale) return null;

  const items = sale.items || [];
  const subtotal = sale.subtotal !== undefined
    ? sale.subtotal
    : items.reduce((sum, item) => sum + (item.unit_price || item.price || 0) * item.quantity, 0);

  return (
    <div className="receipt-print font-mono text-sm space-y-3 bg-navy-50/50 p-4 rounded-lg border border-navy-200 text-left">
      <div className="text-center">
        <h2 className="text-base font-bold text-navy-900">Room-314</h2>
        <p className="text-xs text-navy-500">Your Neighbourhood Store</p>
      </div>

      <div className="border-t border-dashed border-navy-300 pt-2">
        <div className="flex justify-between text-xs text-navy-600">
          <span>Receipt #{sale.receipt_number || sale.id}</span>
          <span>{formatDateTime(sale.sale_date || sale.created_at || sale.date)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-navy-300 pt-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-navy-500">
              <th className="text-left py-1">Item</th>
              <th className="text-center py-1">Qty</th>
              <th className="text-right py-1">Price</th>
              <th className="text-right py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const price = item.unit_price !== undefined ? item.unit_price : item.price || 0;
              const total = item.line_total !== undefined ? item.line_total : price * item.quantity;
              const name = item.product_name_snapshot || item.product_name || item.name || 'Item';

              return (
                <tr key={idx} className="text-navy-700">
                  <td className="py-0.5 text-left max-w-[120px] truncate">{name}</td>
                  <td className="py-0.5 text-center">{item.quantity}</td>
                  <td className="py-0.5 text-right">{formatCurrency(price)}</td>
                  <td className="py-0.5 text-right font-medium">{formatCurrency(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-dashed border-navy-300 pt-2 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-navy-600">Subtotal</span>
          <span className="text-navy-700">{formatCurrency(subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between">
            <span className="text-navy-600">Discount</span>
            <span className="text-red-600">-{formatCurrency(sale.discount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm text-navy-800 pt-1 border-t border-dashed border-navy-300">
          <span>Total</span>
          <span>{formatCurrency(sale.total || sale.total_amount)}</span>
        </div>
        <div className="flex justify-between text-navy-500">
          <span>Payment</span>
          <span className="capitalize">{sale.payment_method}</span>
        </div>
        {sale.payment_method === 'cash' && sale.amount_paid && (
          <>
            <div className="flex justify-between text-navy-500">
              <span>Paid</span>
              <span>{formatCurrency(sale.amount_paid)}</span>
            </div>
            <div className="flex justify-between text-navy-500">
              <span>Change</span>
              <span>{formatCurrency(sale.amount_paid - (sale.total || sale.total_amount))}</span>
            </div>
          </>
        )}
      </div>

      {(sale.customer_name || sale.customer_phone) && (
        <div className="border-t border-dashed border-navy-300 pt-2 text-xs text-navy-500">
          {sale.customer_name && <p>Customer: {sale.customer_name}</p>}
          {sale.customer_phone && <p>Phone: {sale.customer_phone}</p>}
        </div>
      )}

      <div className="text-center text-xs text-navy-500 pt-2 border-t border-dashed border-navy-300">
        <p>Thank you for shopping at Room-314!</p>
      </div>
    </div>
  );
}
