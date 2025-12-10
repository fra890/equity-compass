import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Button } from './Button';
import { TrendingUp, AlertCircle, Lock } from 'lucide-react';

export const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-tidemark-navy rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-tidemark-blue/20">
            <TrendingUp size={32} />
          </div>
          <h1 className="text-3xl font-bold text-tidemark-navy tracking-tight">EquityCompass</h1>
          <p className="text-slate-500 mt-2">Advisor Portal Access</p>
        </div>

        <div className="bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-8">
            <h2 className="text-xl font-semibold text-slate-800 mb-6">
              {isLogin ? 'Sign In to Dashboard' : 'Create Advisor Account'}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-tidemark-blue outline-none transition-all"
                  placeholder="advisor@firm.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-tidemark-blue outline-none transition-all"
                    placeholder="••••••••"
                  />
                  <Lock className="absolute right-3 top-3 text-slate-400" size={16} />
                </div>
              </div>

              <Button type="submit" isLoading={loading} className="w-full justify-center py-3 text-base">
                {isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
          </div>
          
          <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-600">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-tidemark-blue font-semibold hover:underline"
              >
                {isLogin ? 'Register' : 'Log In'}
              </button>
            </p>
          </div>
        </div>
        
        <p className="text-center text-xs text-slate-400 mt-8">
          &copy; {new Date().getFullYear()} EquityCompass. Internal Office Use Only.
        </p>
      </div>
    </div>
  );
};