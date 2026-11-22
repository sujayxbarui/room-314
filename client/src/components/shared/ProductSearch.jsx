import { useState, useEffect, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import StockBadge from './StockBadge';

export default function ProductSearch({ onSelect, autoFocus = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    api.get('/products/search', { q: debouncedQuery })
      .then((data) => {
        const products = data.products || data || [];
        setResults(products);
        setIsOpen(products.length > 0);
        setSelectedIndex(-1);
      })
      .catch(() => {
        setResults([]);
        setIsOpen(false);
      })
      .finally(() => setIsLoading(false));
  }, [debouncedQuery]);

  const handleSelect = useCallback(
    (product) => {
      onSelect(product);
      setQuery('');
      setResults([]);
      setIsOpen(false);
      setSelectedIndex(-1);
      inputRef.current?.focus();
    },
    [onSelect]
  );

  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        setQuery('');
        setIsOpen(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const item = dropdownRef.current.children[selectedIndex];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search products... (name, brand)"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-navy-200 bg-white text-sm
            text-navy-800 placeholder-navy-400 focus:outline-none focus:ring-2 focus:ring-teal-500
            focus:border-teal-500 transition-colors"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-navy-200 rounded-lg shadow-lg z-20 max-h-72 overflow-y-auto"
        >
          {results.map((product, idx) => (
            <button
              key={product.id}
              onClick={() => handleSelect(product)}
              className={`
                w-full px-4 py-2.5 flex items-center justify-between text-left text-sm
                transition-colors border-b border-navy-50 last:border-b-0
                ${selectedIndex === idx ? 'bg-teal-50' : 'hover:bg-navy-50'}
                ${product.stock <= 0 ? 'opacity-60' : ''}
              `}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-navy-800 truncate">
                  {product.name}
                  {product.brand && (
                    <span className="text-navy-400 font-normal ml-1">
                      — {product.brand}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-navy-600 font-medium">
                    {formatCurrency(product.selling_price)}
                  </span>
                  <StockBadge stock={product.stock} threshold={product.low_stock_threshold} compact />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
