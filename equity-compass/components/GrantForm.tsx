import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Grant, GrantType } from '../types';
import { fetchStockPrice } from '../services/geminiService';
import { Search, Loader2 } from 'lucide-react';

interface GrantFormProps {
  onSave: (grant: Omit<Grant, 'id' | 'lastUpdated'>) => void;
  onCancel: () => void;
  initialData?: Grant; // Added for edit mode
}

export const GrantForm: React.FC<GrantFormProps> = ({ onSave, onCancel, initialData }) => {
  const [type, setType] = useState<GrantType>('RSU');
  const [ticker, setTicker] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [currentPrice, setCurrentPrice] = useState<string>('');
  const [strikePrice, setStrikePrice] = useState<string>('');
  const [grantDate, setGrantDate] = useState('');
  const [totalShares, setTotalShares] = useState<string>('');
  const [vestingSchedule, setVestingSchedule] = useState<Grant['vestingSchedule']>('standard_4y_1y_cliff');
  const [withholdingRate, setWithholdingRate] = useState<string>('22');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [priceError, setPriceError] = useState('');

  // Pre-fill form if editing
  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setTicker(initialData.ticker);
      setCompanyName(initialData.companyName);
      setCurrentPrice(initialData.currentPrice.toString());
      // Fix: Check for undefined specifically so 0 is not treated as false
      setStrikePrice(initialData.strikePrice !== undefined ? initialData.strikePrice.toString() : '');
      setGrantDate(initialData.grantDate);
      setTotalShares(initialData.totalShares.toString());
      setVestingSchedule(initialData.vestingSchedule);
      // Fix: Check for undefined specifically
      setWithholdingRate(initialData.withholdingRate !== undefined ? initialData.withholdingRate.toString() : '22');
    }
  }, [initialData]);

  const handleTickerBlur = async () => {
    if (!ticker) return;
    
    if (!companyName) setCompanyName(ticker.toUpperCase());
    
    setIsFetchingPrice(true);
    setPriceError('');
    try {
      const data = await fetchStockPrice(ticker);
      setCurrentPrice(data.price.toString());
    } catch (err) {
      console.error(err);
      setPriceError('Could not auto-fetch price. Please enter manually.');
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      type,
      ticker: ticker.toUpperCase(),
      companyName,
      currentPrice: parseFloat(currentPrice),
      strikePrice: type === 'ISO' && strikePrice !== '' ? parseFloat(strikePrice) : undefined,
      grantDate,
      totalShares: parseFloat(totalShares),
      vestingSchedule,
      withholdingRate: type === 'RSU' ? parseFloat(withholdingRate) : undefined
    });
  };

  const inputClass = "w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all";
  const labelClass = "block text-sm font-semibold text-slate-700 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      
      {/* Type Selector */}
      <div>
        <label className={labelClass}>Grant Type</label>
        <div className="flex p-1 bg-slate-100 rounded-lg w-full max-w-xs">
           <button
             type="button"
             onClick={() => setType('RSU')}
             className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${type === 'RSU' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             RSU
           </button>
           <button
             type="button"
             onClick={() => setType('ISO')}
             className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${type === 'ISO' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             ISO / Option
           </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className={labelClass}>Ticker Symbol</label>
          <div className="relative">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className={`${inputClass} uppercase pr-10`}
              placeholder="e.g. TSLA"
            />
            <div className="absolute right-3 top-2.5">
               {isFetchingPrice ? (
                 <Loader2 className="animate-spin text-indigo-500" size={20} />
               ) : (
                 <button type="button" onClick={handleTickerBlur} disabled={!ticker} className="text-slate-400 hover:text-indigo-600 transition-colors">
                    <Search size={20} />
                 </button>
               )}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">Leave blank for private companies.</p>
        </div>
        
        <div>
           <label className={labelClass}>Company Name</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Tesla"
            />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className={labelClass}>Current Share Price ($)</label>
          <input
            type="number"
            required
            step="0.01"
            min="0"
            value={currentPrice}
            onChange={(e) => setCurrentPrice(e.target.value)}
            className={`${inputClass} ${priceError ? 'border-red-300 focus:ring-red-500' : ''}`}
            placeholder="0.00"
          />
          {priceError && <p className="text-xs text-red-500 mt-1">{priceError}</p>}
        </div>

        {type === 'ISO' && (
           <div className="animate-fade-in">
             <label className={labelClass}>Strike Price ($)</label>
             <input
               type="number"
               required
               step="0.01"
               min="0"
               value={strikePrice}
               onChange={(e) => setStrikePrice(e.target.value)}
               className={inputClass}
               placeholder="0.00"
             />
           </div>
        )}
        
        {type === 'RSU' && (
           <div className="animate-fade-in">
             <label className={labelClass}>Elected Withholding (%)</label>
             <div className="relative">
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  value={withholdingRate}
                  onChange={(e) => setWithholdingRate(e.target.value)}
                  className={inputClass}
                  placeholder="22"
                />
                <span className="absolute right-3 top-2.5 text-slate-500 font-medium">%</span>
             </div>
             <p className="text-xs text-slate-500 mt-1">Statutory default is 22%. High income is 37%.</p>
           </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className={labelClass}>Grant Date</label>
          <input
            type="date"
            required
            value={grantDate}
            onChange={(e) => setGrantDate(e.target.value)}
            className={inputClass}
          />
        </div>
        
        <div>
          <label className={labelClass}>Total Shares Granted</label>
          <input
            type="number"
            required
            min="1"
            value={totalShares}
            onChange={(e) => setTotalShares(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Vesting Schedule</label>
        <select
          value={vestingSchedule}
          onChange={(e) => setVestingSchedule(e.target.value as Grant['vestingSchedule'])}
          className={inputClass}
        >
          <option value="standard_4y_1y_cliff">Standard 4-Year (1 Year Cliff)</option>
          <option value="standard_4y_quarterly">Standard 4-Year (Quarterly Immediate)</option>
        </select>
        <p className="text-xs text-slate-500 mt-1">
          {vestingSchedule === 'standard_4y_1y_cliff' 
            ? '25% vests after 1 year, then 1/16th quarterly thereafter.' 
            : '1/16th vests every quarter starting 3 months after grant.'}
        </p>
      </div>

      <div className="flex gap-3 pt-6 border-t border-slate-100 mt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          {initialData ? 'Update Grant' : 'Add Grant'}
        </Button>
      </div>
    </form>
  );
};