import { Menu, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Header({ onMenuToggle }) {
  const navigate = useNavigate();

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-navy-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="p-1.5 rounded-md text-navy-600 hover:bg-navy-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-navy-800">Room-314</h1>
        </div>
        <button
          onClick={() => navigate('/pos')}
          className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          New Sale
        </button>
      </div>
    </header>
  );
}
