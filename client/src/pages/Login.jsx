import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRegistering) {
        if (!name.trim()) {
          toast.error('Please enter your name');
          setLoading(false);
          return;
        }
        await register(name.trim(), email.trim(), password);
        toast.success('Account created successfully!');
      } else {
        await login(email.trim(), password);
        toast.success('Welcome back to Room-314!');
      }
      navigate('/pos');
    } catch (err) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-lg border border-navy-200 shadow-sm p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Room-314</h1>
          <p className="text-sm text-navy-500 mt-1">Smart Kirana POS & Inventory Management</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <Input
              label="Full Name"
              type="text"
              placeholder="e.g. Sujay Barui"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}

          <Input
            label="Email Address"
            type="email"
            placeholder="e.g. owner@room314.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" variant="primary" fullWidth loading={loading} className="mt-2">
            {isRegistering ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-navy-600">
          {isRegistering ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setIsRegistering(false)}
                className="text-teal-600 hover:text-teal-700 font-medium"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              New shop partner?{' '}
              <button
                type="button"
                onClick={() => setIsRegistering(true)}
                className="text-teal-600 hover:text-teal-700 font-medium"
              >
                Register
              </button>
            </p>
          )}
        </div>

        {/* Login Credentials hint */}
        <div className="mt-8 pt-6 border-t border-navy-100 text-xs text-navy-500 space-y-2">
          <p className="font-medium text-navy-700">Quick Staff Login:</p>
          <div
            onClick={() => {
              setEmail('staff@room314.com');
              setPassword('staff123');
              setIsRegistering(false);
            }}
            className="flex justify-between items-center bg-amber-50/60 hover:bg-amber-50 p-2.5 rounded-lg border border-amber-200 cursor-pointer transition"
            title="Click to fill Staff credentials"
          >
            <div>
              <span className="font-semibold text-amber-900 block">Store Cashier / Staff</span>
              <span className="text-amber-700 font-mono text-[11px]">staff@room314.com</span>
            </div>
            <span className="font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[11px] font-semibold">staff123</span>
          </div>
          <p className="text-[11px] text-navy-400 text-center pt-1">
            Staff can make sales and returns. Store Owner / Administrator credentials must be entered manually.
          </p>
        </div>
      </div>
    </div>
  );
}

