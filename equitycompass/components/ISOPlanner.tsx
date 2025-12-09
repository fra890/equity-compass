import React, { useState, useEffect, useMemo } from 'react';
import { Client, Grant, PlannedExercise } from '../types';
import { calculateISOScenarios, formatCurrency, formatPercent, getGrantStatus, formatNumber, calculateAMTRoom, getEffectiveRates } from '../utils/calculations';
import { Info, CheckCircle, Save, TrendingUp, Lock, Unlock, MinusCircle, AlertTriangle, Wallet, ArrowRight, DollarSign, CalendarClock } from 'lucide-react';
import { Button } from './Button';

interface ISOPlannerProps {
  client: Client;
  grants: Grant[];
  onSavePlan: (plan: PlannedExercise) => void;
}

type StrategyMode = 'buy_hold' | 'cashless';

export const ISOPlanner: React.FC<ISOPlannerProps> = ({ client, grants, onSavePlan }) => {
  const isoGrants = grants.filter(g => g.type === 'ISO');
  const [selectedGrantId, setSelectedGrantId] = useState<string>(isoGrants[0]?.id || '');
  const [sharesToExercise, setSharesToExercise] = useState<number>(0);
  const [futurePrice, setFuturePrice] = useState<number>(0);
  const [isSaved, setIsSaved] = useState(false);
  const [strategyMode, setStrategyMode] = useState<StrategyMode>('buy_hold');

  const selectedGrant = isoGrants.find(g => g.id === selectedGrantId);

  // Stats for the specific selected grant
  const grantStatus = useMemo(() => {
     if (!selectedGrant) return null;
     return getGrantStatus(selectedGrant, client.plannedExercises || []);
  }, [selectedGrant, client.plannedExercises]);

  useEffect(() => {
    if (selectedGrant && grantStatus) {
        setFuturePrice(selectedGrant.currentPrice * 1.1);
        // Default to remaining available, capped at 1000 or full available
        const defaultShares = Math.min(1000, grantStatus.available);
        setSharesToExercise(defaultShares > 0 ? defaultShares : 0);
    }
  }, [selectedGrant?.id, grantStatus?.available]); 

  // AMT Optimization Logic
  const amtStats = useMemo(() => calculateAMTRoom(client), [client]);
  const currentSpread = selectedGrant ? (selectedGrant.currentPrice - (selectedGrant.strikePrice || 0)) * sharesToExercise : 0;
  const isAmtDanger = currentSpread > amtStats.room;

  const handleSave = () => {
    if (!selectedGrant) return;
    if (sharesToExercise > (grantStatus?.available || 0)) {
        alert("You cannot exercise more shares than are currently available.");
        return;
    }

    // For cashless, the exercise price is effectively paid by sale, but we still record the event
    const plan: PlannedExercise = {
        id: crypto.randomUUID(),
        grantId: selectedGrant.id,
        grantTicker: selectedGrant.ticker,
        shares: sharesToExercise,
        exerciseDate: new Date().toISOString().split('T')[0],
        exercisePrice: selectedGrant.strikePrice || 0,
        fmvAtExercise: selectedGrant.currentPrice,
        type: 'ISO',
        // If cashless, AMT exposure is technically 0 because it's a disqualifying disposition in same year
        // But we track the spread for record keeping.
        amtExposure: strategyMode === 'buy_hold' ? (selectedGrant.currentPrice - (selectedGrant.strikePrice || 0)) * sharesToExercise : 0,
        estimatedCost: sharesToExercise * (selectedGrant.strikePrice || 0)
    };
    onSavePlan(plan);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  if (isoGrants.length === 0) {
    return (
        <div className="p-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <h3 className="text-slate-500 font-medium">No ISO Grants found for this client.</h3>
            <p className="text-slate-400 text-sm mt-1">Add an ISO/Option grant to use the planning tools.</p>
        </div>
    );
  }

  if (!selectedGrant || !grantStatus) return null;

  // --- Calculations for Buy & Hold ---
  const qualifiedScenario = calculateISOScenarios(
      sharesToExercise, 
      selectedGrant.strikePrice || 0, 
      selectedGrant.currentPrice, 
      futurePrice, 
      client, 
      true
  );

  const disqualifiedScenario = calculateISOScenarios(
      sharesToExercise, 
      selectedGrant.strikePrice || 0, 
      selectedGrant.currentPrice, 
      selectedGrant.currentPrice, 
      client, 
      false
  );

  const netDifference = qualifiedScenario.netProfit - disqualifiedScenario.netProfit;

  // --- Calculations for Cashless ---
  const { stateRate } = getEffectiveRates(client);
  const totalProceeds = sharesToExercise * selectedGrant.currentPrice;
  const totalCost = sharesToExercise * (selectedGrant.strikePrice || 0);
  const grossProfit = totalProceeds - totalCost;
  // Cashless is always Ordinary Income (Disqualified)
  const estimatedTaxRate = (client.taxBracket / 100) + stateRate;
  const estimatedTaxes = grossProfit * estimatedTaxRate;
  const netCash = grossProfit - estimatedTaxes;

  const inputClass = "w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-tidemark-blue outline-none font-medium";

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            
            {/* Top Bar with Detailed Share Counts */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6 border-b border-slate-100 pb-6">
                <div>
                    <h3 className="text-lg font-bold text-tidemark-navy flex items-center gap-2">
                        ISO Exercise Modeler
                    </h3>
                    <p className="text-sm text-slate-500">Plan execution strategy for your options.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                     <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-md border border-slate-200 text-xs text-slate-500" title="Total shares granted but not yet vested">
                        <Lock size={14} className="text-slate-400" />
                        Unvested: <span className="font-bold text-slate-700">{formatNumber(grantStatus.unvested)}</span>
                    </div>
                     <div className="flex items-center gap-2 px-3 py-1.5 bg-tidemark-blue/10 rounded-md border border-tidemark-blue/20 text-xs text-tidemark-navy" title="Shares vested and ready to exercise">
                        <Unlock size={14} className="text-tidemark-blue" />
                        Available: <span className="font-bold text-tidemark-blue text-sm">{formatNumber(grantStatus.available)}</span>
                    </div>
                </div>
            </div>

            {/* Strategy Toggle */}
            <div className="flex justify-center mb-8">
                <div className="bg-slate-100 p-1 rounded-lg flex">
                    <button
                        onClick={() => setStrategyMode('buy_hold')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${strategyMode === 'buy_hold' ? 'bg-white text-tidemark-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <TrendingUp size={16} />
                        Buy & Hold (Maximize Gains)
                    </button>
                    <button
                        onClick={() => setStrategyMode('cashless')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${strategyMode === 'cashless' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Wallet size={16} />
                        Cashless Exercise (Get Liquidity)
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: Controls */}
                <div className="lg:col-span-1 space-y-5">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Select Grant</label>
                        <select 
                            value={selectedGrantId}
                            onChange={(e) => setSelectedGrantId(e.target.value)}
                            className={inputClass}
                        >
                            {isoGrants.map(g => (
                                <option key={g.id} value={g.id}>{g.ticker} - {formatCurrency(g.strikePrice || 0)} Strike</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Shares to Exercise</label>
                         <div className="flex items-center gap-2">
                            <input 
                                type="number"
                                min="0"
                                max={grantStatus.available}
                                value={sharesToExercise}
                                onChange={(e) => setSharesToExercise(parseFloat(e.target.value))}
                                className={inputClass}
                            />
                            <button 
                                onClick={() => setSharesToExercise(grantStatus.available)}
                                className="text-xs font-bold text-tidemark-blue hover:text-tidemark-navy underline whitespace-nowrap"
                            >
                                Max
                            </button>
                         </div>
                         <div className="mt-2 text-xs text-slate-500 flex justify-between">
                             <span>Cost to Exercise:</span>
                             <span className="font-bold text-slate-800">{formatCurrency(sharesToExercise * (selectedGrant.strikePrice || 0))}</span>
                         </div>
                    </div>

                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Current FMV</label>
                        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-sm font-bold">
                            {formatCurrency(selectedGrant.currentPrice)}
                        </div>
                    </div>
                    
                    {strategyMode === 'buy_hold' && (
                        <div className="animate-fade-in">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Projected Sale Price</label>
                            <input 
                                type="number"
                                min="0"
                                value={futurePrice}
                                onChange={(e) => setFuturePrice(parseFloat(e.target.value))}
                                className={inputClass}
                            />
                        </div>
                    )}

                    <Button onClick={handleSave} className={`w-full gap-2 ${isSaved ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`} disabled={sharesToExercise <= 0 || sharesToExercise > grantStatus.available}>
                        {isSaved ? <CheckCircle size={18} /> : <Save size={18} />}
                        {isSaved ? 'Plan Saved' : 'Save Plan'}
                    </Button>
                </div>

                {/* Right Column: Analysis */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* MODE: BUY & HOLD */}
                    {strategyMode === 'buy_hold' && (
                        <div className="animate-fade-in space-y-6">
                            {/* AMT Breakeven Visualizer */}
                            <div className={`rounded-xl border p-5 ${isAmtDanger ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-tidemark-navy flex items-center gap-2">
                                        <CalendarClock size={18} className={isAmtDanger ? 'text-purple-600' : 'text-slate-400'} />
                                        AMT Optimization (2026 Sunset Rules)
                                    </h4>
                                    <div className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                                        Filing: {client.filingStatus === 'married_joint' ? 'MFJ' : 'Single'}
                                    </div>
                                </div>
                                
                                <div className="space-y-1 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Current Bargain Element (Spread):</span>
                                        <span className="font-bold text-slate-900">{formatCurrency(currentSpread)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Estimated AMT Room (Safe Harbor):</span>
                                        <span className="font-bold text-emerald-600">{formatCurrency(amtStats.room)}</span>
                                    </div>
                                    <div className="pt-2 mt-2 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate-400">
                                        <div className="flex justify-between">
                                            <span>Base Income (Est):</span>
                                            <span>{formatCurrency(amtStats.baseIncome)}</span>
                                        </div>
                                         <div className="flex justify-between">
                                            <span>+ Proj. RSU Income ({new Date().getFullYear()}):</span>
                                            <span className="text-slate-600 font-medium">{formatCurrency(amtStats.projectedRSUIncome)}</span>
                                        </div>
                                         <div className="flex justify-between">
                                            <span>- {amtStats.isItemizing ? 'Itemized (State Tax)' : 'Standard'} Deduction:</span>
                                            <span className="text-slate-600 font-medium">({formatCurrency(amtStats.effectiveDeduction)})</span>
                                        </div>
                                         <div className="flex justify-between">
                                            <span>- Personal Exemptions:</span>
                                            <span className="text-slate-600 font-medium">({formatCurrency(amtStats.personalExemptions)})</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative h-4 bg-white rounded-full overflow-hidden border border-slate-200 mt-4">
                                    <div 
                                        className={`absolute left-0 top-0 h-full transition-all duration-500 ${isAmtDanger ? 'bg-purple-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.min(100, (currentSpread / (amtStats.room * 1.2 || 1)) * 100)}%` }}
                                    ></div>
                                    <div 
                                        className="absolute top-0 w-0.5 h-full bg-slate-900 z-10" 
                                        style={{ left: `${Math.min(100, (amtStats.room / (amtStats.room * 1.2 || 1)) * 100)}%` }}
                                        title="AMT Breakeven Point"
                                    ></div>
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">
                                    <span>$0</span>
                                    <span>AMT Breakeven</span>
                                </div>

                                {isAmtDanger ? (
                                    <div className="mt-3 flex gap-2 items-start text-xs text-purple-700 bg-purple-100 p-2 rounded">
                                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                        <p>Warning: This exercise exceeds the estimated AMT break-even point for 2026. The TCJA sunset (State Taxes not deductible for AMT) lowers the threshold significantly.</p>
                                    </div>
                                ) : (
                                    <p className="mt-3 text-xs text-slate-500">
                                        You can likely exercise this amount without triggering AMT, assuming deductions align.
                                    </p>
                                )}
                            </div>

                            {/* Compare Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="font-bold text-tidemark-gray text-sm">Sell Immediately</h4>
                                        <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Disqualified</span>
                                    </div>
                                    <div className="text-right mb-3">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Net Profit</div>
                                        <div className="text-xl font-bold text-tidemark-gray">{formatCurrency(disqualifiedScenario.netProfit)}</div>
                                    </div>
                                    <div className="pt-3 border-t border-slate-100 space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Total Tax</span>
                                            <span className="text-red-500 font-medium">{formatCurrency(disqualifiedScenario.taxes.totalTax)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="border border-tidemark-blue/30 rounded-xl p-4 bg-sky-50/30 shadow-sm ring-1 ring-tidemark-blue/10">
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="font-bold text-tidemark-navy text-sm">Hold 1 Year</h4>
                                        <span className="text-[10px] font-bold uppercase bg-tidemark-blue text-white px-2 py-0.5 rounded-full">Qualified</span>
                                    </div>
                                    <div className="text-right mb-3">
                                        <div className="text-[10px] text-tidemark-blue uppercase font-bold">Net Profit</div>
                                        <div className="text-xl font-bold text-tidemark-navy">{formatCurrency(qualifiedScenario.netProfit)}</div>
                                    </div>
                                    <div className="pt-3 border-t border-sky-100 space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Total Tax</span>
                                            <span className="text-tidemark-navy font-medium">{formatCurrency(qualifiedScenario.taxes.totalTax)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Net Difference Bubble */}
                            {netDifference !== 0 && (
                                <div className={`p-3 rounded-lg border flex items-center justify-center gap-2 text-sm font-bold ${
                                    netDifference > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
                                }`}>
                                    <TrendingUp size={16} />
                                    {netDifference > 0 ? 'Benefit of Holding:' : 'Cost of Holding:'} 
                                    <span>{formatCurrency(Math.abs(netDifference))}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* MODE: CASHLESS (LIQUIDITY) */}
                    {strategyMode === 'cashless' && (
                         <div className="animate-fade-in bg-slate-50 rounded-xl border border-slate-200 p-6">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Wallet className="text-emerald-600" size={20} />
                                Cashless Breakdown
                            </h4>

                            <div className="space-y-4">
                                {/* Step 1: Gross Proceeds */}
                                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-emerald-100 p-2 rounded-full text-emerald-600 font-bold text-xs">1</div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase">Total Sale Proceeds</p>
                                            <p className="text-xs text-slate-400">({formatNumber(sharesToExercise)} shares × {formatCurrency(selectedGrant.currentPrice)})</p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-slate-800">{formatCurrency(totalProceeds)}</span>
                                </div>

                                {/* Connector */}
                                <div className="flex justify-center -my-2 relative z-10">
                                     <div className="bg-slate-200 p-1 rounded-full"><ArrowRight className="rotate-90 text-slate-400" size={14} /></div>
                                </div>

                                {/* Step 2: Pay Strike */}
                                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg opacity-80">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-slate-100 p-2 rounded-full text-slate-500 font-bold text-xs">2</div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase">Less: Exercise Cost</p>
                                            <p className="text-xs text-slate-400">Paid to company (Strike {formatCurrency(selectedGrant.strikePrice || 0)})</p>
                                        </div>
                                    </div>
                                    <span className="font-medium text-red-500">-{formatCurrency(totalCost)}</span>
                                </div>
                                
                                {/* Connector */}
                                <div className="flex justify-center -my-2 relative z-10">
                                     <div className="bg-slate-200 p-1 rounded-full"><ArrowRight className="rotate-90 text-slate-400" size={14} /></div>
                                </div>

                                {/* Step 3: Pay Taxes */}
                                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg opacity-80">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-slate-100 p-2 rounded-full text-slate-500 font-bold text-xs">3</div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase">Less: Est. Taxes</p>
                                            <p className="text-xs text-slate-400">Fed + State (~{formatPercent(estimatedTaxRate)}) on Profit</p>
                                        </div>
                                    </div>
                                    <span className="font-medium text-red-500">-{formatCurrency(estimatedTaxes)}</span>
                                </div>

                                <div className="border-t border-slate-200 my-2"></div>

                                {/* Result */}
                                <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-emerald-500 p-2 rounded-full text-white">
                                            <DollarSign size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm text-emerald-900 font-bold uppercase">Net Cash to Client</p>
                                            <p className="text-xs text-emerald-700">Estimated take-home liquidity</p>
                                        </div>
                                    </div>
                                    <span className="text-2xl font-bold text-emerald-700">{formatCurrency(netCash)}</span>
                                </div>

                                <div className="flex gap-2 items-start p-3 bg-amber-50 text-amber-800 rounded-lg text-xs border border-amber-100">
                                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                    <p>
                                        <strong>Note:</strong> Cashless exercises are Disqualifying Dispositions. 
                                        You lose ISO tax benefits, and the profit is taxed as Ordinary Income. 
                                        However, no upfront cash is required from the client.
                                    </p>
                                </div>
                            </div>
                         </div>
                    )}

                </div>
            </div>
        </div>
    </div>
  );
};