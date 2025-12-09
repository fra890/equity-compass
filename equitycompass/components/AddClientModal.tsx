import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { STATE_TAX_RATES } from '../utils/calculations';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, taxBracket: number, state: string, filingStatus: 'single' | 'married_joint', income: number, customState?: number, customLtcg?: number) => void;
  initialData?: { 
    name: string; 
    taxBracket: number; 
    state: string;
    filingStatus?: 'single' | 'married_joint';
    estimatedIncome?: number;
    customStateTaxRate?: number;
    customLtcgTaxRate?: number;
  };
}

export const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [name, setName] = useState('');
  const [taxBracket, setTaxBracket] = useState(37);
  const [state, setState] = useState('CA');
  const [filingStatus, setFilingStatus] = useState<'single' | 'married_joint'>('married_joint');
  const [estimatedIncome, setEstimatedIncome] = useState<number>(250000);
  
  // Custom Overrides
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customStateTax, setCustomStateTax] = useState<string>('');
  const [customLtcgTax, setCustomLtcgTax] = useState<string>('');

  useEffect(() => {
    if (isOpen && initialData) {
      setName(initialData.name);
      setTaxBracket(initialData.taxBracket);
      setState(initialData.state || 'CA');
      setFilingStatus(initialData.filingStatus || 'married_joint');
      setEstimatedIncome(initialData.estimatedIncome || 250000);
      setCustomStateTax(initialData.customStateTaxRate?.toString() || '');
      setCustomLtcgTax(initialData.customLtcgTaxRate?.toString() || '');
    } else if (isOpen) {
      setName('');
      setTaxBracket(37);
      setState('CA');
      setFilingStatus('married_joint');
      setEstimatedIncome(250000);
      setCustomStateTax('');
      setCustomLtcgTax('');
      setShowAdvanced(false);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(
        name, 
        taxBracket, 
        state, 
        filingStatus,
        estimatedIncome,
        customStateTax ? parseFloat(customStateTax) : undefined,
        customLtcgTax ? parseFloat(customLtcgTax) : undefined
    );
    if (!initialData) {
      setName('');
    }
    onClose();
  };

  const states = Object.keys(STATE_TAX_RATES);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tidemark-navy/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 m-4 border border-slate-100 animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-tidemark-navy">
            {initialData ? 'Edit Client Details' : 'Add New Client'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Client Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tidemark-blue focus:border-tidemark-blue outline-none transition-all"
              placeholder="e.g. John Doe"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Filing Status</label>
              <select
                value={filingStatus}
                onChange={(e) => setFilingStatus(e.target.value as 'single' | 'married_joint')}
                className="w-full px-4 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tidemark-blue outline-none"
              >
                <option value="single">Single</option>
                <option value="married_joint">Married Filing Jointly</option>
              </select>
            </div>
             <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Est. Income ($)</label>
              <input
                  type="number"
                  required
                  min="0"
                  value={estimatedIncome}
                  onChange={(e) => setEstimatedIncome(parseFloat(e.target.value))}
                  className="w-full px-4 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tidemark-blue outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-4 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tidemark-blue focus:border-tidemark-blue outline-none"
              >
                {states.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Fed Ord. Tax (%)</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxBracket}
                  onChange={(e) => setTaxBracket(parseFloat(e.target.value))}
                  className="w-full px-4 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tidemark-blue focus:border-tidemark-blue outline-none pr-8 transition-all"
                />
                <span className="absolute right-3 top-2.5 text-slate-500 font-medium">%</span>
              </div>
            </div>
          </div>
          
          <div className="pt-2">
            <button 
                type="button" 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-sm font-medium text-tidemark-blue hover:text-tidemark-navy transition-colors"
            >
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Advanced Tax Settings (Overrides)
            </button>
            
            {showAdvanced && (
                <div className="grid grid-cols-2 gap-4 mt-3 animate-in fade-in slide-in-from-top-2">
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">State Tax Override (%)</label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={customStateTax}
                            onChange={(e) => setCustomStateTax(e.target.value)}
                            placeholder={((STATE_TAX_RATES[state] || 0) * 100).toFixed(2)}
                            className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-tidemark-blue outline-none text-sm"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">LTCG Tax Override (%)</label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={customLtcgTax}
                            onChange={(e) => setCustomLtcgTax(e.target.value)}
                            placeholder={taxBracket > 32 ? "20" : "15"}
                            className="w-full px-3 py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-tidemark-blue outline-none text-sm"
                        />
                     </div>
                     <p className="col-span-2 text-[10px] text-slate-400">
                         Leave blank to use system defaults based on State and Tax Bracket.
                     </p>
                </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {initialData ? 'Save Changes' : 'Create Client'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};