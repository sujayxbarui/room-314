/**
 * WhatsApp receipt link generation service.
 */

/**
 * Format a sale as a clean text receipt for WhatsApp sharing.
 * @param {object} sale - Complete sale object with items
 * @param {object} shopInfo - { name, phone, address }
 * @returns {string} Formatted receipt text
 */
function generateReceiptText(sale, shopInfo) {
  const lines = [];

  // Header
  lines.push(`🏪 *${shopInfo.name || 'Room-314'}*`);
  if (shopInfo.address) {
    lines.push(`📍 ${shopInfo.address}`);
  }
  if (shopInfo.phone) {
    lines.push(`📞 ${shopInfo.phone}`);
  }
  lines.push('─'.repeat(30));

  // Receipt info
  lines.push(`🧾 Receipt: *${sale.receipt_number}*`);
  const saleDate = new Date(sale.sale_date || sale.created_at);
  lines.push(`📅 ${saleDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${saleDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
  lines.push('─'.repeat(30));

  // Items
  lines.push('*Items:*');
  if (sale.items && sale.items.length > 0) {
    for (const item of sale.items) {
      const name = item.product_name_snapshot || item.current_product_name || 'Item';
      const qty = item.quantity;
      const price = parseFloat(item.unit_price).toFixed(2);
      const total = parseFloat(item.line_total).toFixed(2);

      if (qty === 1) {
        lines.push(`  • ${name} — ₹${total}`);
      } else {
        lines.push(`  • ${name} × ${qty} @ ₹${price} — ₹${total}`);
      }

      if (item.discount > 0) {
        lines.push(`    Discount: -₹${parseFloat(item.discount).toFixed(2)}`);
      }
    }
  }

  lines.push('─'.repeat(30));

  // Totals
  if (sale.discount > 0) {
    lines.push(`Subtotal: ₹${parseFloat(sale.subtotal).toFixed(2)}`);
    lines.push(`Discount: -₹${parseFloat(sale.discount).toFixed(2)}`);
  }
  lines.push(`*Total: ₹${parseFloat(sale.total).toFixed(2)}*`);

  // Payment
  const method = (sale.payment_method || 'cash').toUpperCase();
  lines.push(`💳 Payment: ${method}`);

  if (sale.payment_method === 'cash' && sale.change_due > 0) {
    lines.push(`Paid: ₹${parseFloat(sale.amount_paid).toFixed(2)}`);
    lines.push(`Change: ₹${parseFloat(sale.change_due).toFixed(2)}`);
  }

  lines.push('─'.repeat(30));
  lines.push('🙏 Thank you for shopping with us!');
  lines.push('Visit again! 😊');

  return lines.join('\n');
}

/**
 * Format an Indian phone number with country code.
 * @param {string} phone
 * @returns {string}
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';

  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // If starts with 0, remove leading 0
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // If 10 digits, add 91 prefix (Indian number)
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }

  // If already has 91 prefix with 12 digits total, keep as is
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return cleaned;
  }

  return cleaned;
}

/**
 * Generate a wa.me share link with pre-filled text.
 * @param {string} phone - Customer phone number
 * @param {string} text - Message text
 * @returns {string} WhatsApp share URL
 */
function generateShareLink(phone, text) {
  const formattedPhone = formatPhoneNumber(phone);
  const encodedText = encodeURIComponent(text);

  if (formattedPhone) {
    return `https://wa.me/${formattedPhone}?text=${encodedText}`;
  }

  // Without phone number — opens WhatsApp with text, user picks contact
  return `https://wa.me/?text=${encodedText}`;
}

module.exports = { generateReceiptText, generateShareLink, formatPhoneNumber };
