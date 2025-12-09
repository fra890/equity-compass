import React, { useState, useMemo } from 'react';
import { Client, Grant, VestingEvent, PlannedExercise } from '../types';
import { GrantForm } from './GrantForm';
import { AddClientModal } from './AddClientModal';
import { ISOPlanner } from './ISOPlanner';
import { Button } from './Button';
import { ArrowLeft, Plus, DollarSign, PieChart, TrendingUp, AlertTriangle, Settings, Coins, Building, Download, Printer, CheckCircle, Lock, Edit2, Trash2, X } from 'lucide-react';
import { generateVestingSchedule, getQuarterlyProjections, formatCurrency, formatNumber, formatPercent, getEffectiveRates, getGrantStatus } from '../utils/calculations';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line } from 'recharts';

interface ClientDetailProps {
  client: Client;
  onBack: () => void;
  onUpdateClient: (updatedClient: Client) => void;
}

type Tab = 'overview' | 'iso-planning';

export const ClientDetail: React.FC<ClientDetailProps> = ({ client, onBack, onUpdateClient }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [editingGrant, setEditingGrant] = useState<Grant | null>(null);
  const [showEditClient, setShowEditClient] = useState(false);
  const [simulateSellAll, setSimulateSellAll] = useState(false);

  // --- Calculations ---
  const allEvents = useMemo(() => {
    let events: VestingEvent[] = [];
    client.grants.forEach(grant => {
      const grantEvents = generateVestingSchedule(grant, client, simulateSellAll);
      events = [...events, ...grantEvents];
    });
    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [client, simulateSellAll]);

  const upcomingEvents = useMemo(() => getQuarterlyProjections(allEvents), [allEvents]);
  const hasISOs = client.grants.some(g => g.type === 'ISO');

  // Calculate Unvested RSU Value specifically
  const unvestedRSUValue = useMemo(() => {
     return client.grants
        .filter(g => g.type === 'RSU')
        .reduce((sum, g) => {
             const status = getGrantStatus(g, []); 
             return sum + (status.unvested * g.currentPrice);
        }, 0);
  }, [client.grants]);

  // Aggregate stats
  const summary = useMemo(() => {
    // vestingSummary no longer includes hypothetical ISO AMT (it is 0 in calculation now)
    const vestingSummary = upcomingEvents.reduce((acc, curr) => ({
      gross: acc.gross + curr.grossValue,
      taxGap: acc.taxGap + curr.taxGap,
      shares: acc.shares + curr.shares,
      netValue: acc.netValue + curr.netValue,
      amtExposure: acc.amtExposure // This will be 0 for ISOs now
    }), { gross: 0, taxGap: 0, shares: 0, netValue: 0, amtExposure: 0 });

    const plannedSummary = (client.plannedExercises || []).reduce((acc, curr) => ({
        amtExposure: acc.amtExposure + curr.amtExposure,
        cost: acc.cost + curr.estimatedCost
    }), { amtExposure: 0, cost: 0 });

    return {
        ...vestingSummary,
        // The total AMT Exposure is now strictly derived from PLANNED exercises + 0 from vesting.
        amtExposure: vestingSummary.amtExposure + plannedSummary.amtExposure,
        plannedExerciseCost: plannedSummary.cost
    };
  }, [upcomingEvents, client.plannedExercises]);

  // --- Handlers ---

  const handleSaveGrant = (grantData: Omit<Grant, 'id' | 'lastUpdated'>) => {
    if (editingGrant) {
      // Edit Mode
      const updatedGrants = client.grants.map(g => 
        g.id === editingGrant.id 
          ? { ...grantData, id: editingGrant.id, lastUpdated: new Date().toISOString() } 
          : g
      );
      onUpdateClient({ ...client, grants: updatedGrants });
      setEditingGrant(null);
    } else {
      // Create Mode
      const newGrant: Grant = {
        ...grantData,
        id: crypto.randomUUID(),
        lastUpdated: new Date().toISOString()
      };
      onUpdateClient({ ...client, grants: [...client.grants, newGrant] });
    }
    setShowGrantForm(false);
  };

  const handleEditGrantClick = (grant: Grant) => {
    setEditingGrant(grant);
    setShowGrantForm(true);
  };

  const handleDeleteGrant = (grantId: string) => {
    if (window.confirm("Are you sure you want to delete this grant? This action cannot be undone.")) {
      const updatedGrants = client.grants.filter(g => g.id !== grantId);
      onUpdateClient({ ...client, grants: updatedGrants });
    }
  };

  const handleEditClientSave = (name: string, taxBracket: number, state: string, filingStatus: 'single' | 'married_joint', income: number, customState?: number, customLtcg?: number) => {
    onUpdateClient({ 
        ...client, 
        name, 
        taxBracket, 
        state,
        filingStatus,
        estimatedIncome: income,
        customStateTaxRate: customState, 
        customLtcgTaxRate: customLtcg 
    });
  };

  const handleSavePlan = (plan: PlannedExercise) => {
      onUpdateClient({
          ...client,
          plannedExercises: [...(client.plannedExercises || []), plan]
      });
  };

  const downloadCSV = () => {
    const rows = [];
    
    // Header
    rows.push([`EQUITY REPORT: ${client.name.toUpperCase()}`]);
    rows.push([`Generated: ${new Date().toLocaleDateString()}`]);
    rows.push([]);

    // Section 1: Grant Summary
    rows.push(['SECTION 1: ACTIVE GRANTS SUMMARY']);
    rows.push(['Type', 'Ticker', 'Company', 'Shares', 'Current Price', 'Strike Price', 'Grant Date', 'Value']);
    client.grants.forEach(g => {
        rows.push([
            g.type,
            g.ticker,
            g.companyName,
            g.totalShares,
            g.currentPrice,
            g.strikePrice || '',
            g.grantDate,
            g.totalShares * g.currentPrice
        ]);
    });
    rows.push([]);

    // Section 2: Vesting Schedule (All Events - Past & Future)
    rows.push(['SECTION 2: FULL VESTING SCHEDULE']);
    rows.push(['Status', 'Date', 'Type', 'Shares Vesting', 'Gross Value', 'Shares Sold to Cover', 'Withholding ($)', 'Net Shares', 'Net Value', 'Tax Gap']);
    allEvents.forEach(e => {
        rows.push([
            e.isPast ? 'VESTED' : 'FUTURE',
            e.date,
            e.grantType,
            e.shares,
            e.grossValue.toFixed(2),
            e.sharesSoldToCover.toFixed(2),
            e.withholdingAmount.toFixed(2),
            e.netShares.toFixed(2),
            e.netValue.toFixed(2),
            e.taxGap.toFixed(2)
        ]);
    });
    rows.push([]);

    // Section 3: Planned Exercises
    rows.push(['SECTION 3: PLANNED ISO EXERCISES']);
    rows.push(['Grant', 'Date', 'Shares', 'Strike Price', 'FMV at Exercise', 'Est. Cost', 'AMT Exposure']);
    (client.plannedExercises || []).forEach(p => {
        rows.push([
            p.grantTicker,
            p.exerciseDate,
            p.shares,
            p.exercisePrice,
            p.fmvAtExercise,
            p.estimatedCost.toFixed(2),
            p.amtExposure.toFixed(2)
        ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${client.name.replace(/\s+/g, '_')}_Full_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReport = () => {
    alert("Preparing Report... Please select 'Save as PDF' as the destination in the print dialog that follows.");
    setTimeout(() => {
        window.print();
    }, 500);
  };

  const chartData = upcomingEvents.map(e => ({
    date: e.date,
    grossValue: e.grossValue,
    netValue: e.netValue,
    withholding: e.withholdingAmount,
    taxGap: e.taxGap,
    fedTax: e.taxBreakdown.fed,
    stateTax: e.taxBreakdown.state,
    // amtExposure is now 0 for ISOs in 'e', so we don't chart it here. 
    // This is correct as we only want to show mandatory tax liability in this chart.
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 text-white p-3 rounded-lg shadow-xl border border-slate-700 text-xs z-50">
          <p className="font-bold mb-1 border-b border-slate-600 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
             <div key={index} className="flex justify-between items-center gap-4 mb-0.5">
               <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: entry.color}}></div>
                  <span className="opacity-80 text-slate-200">{entry.name}</span>
               </div>
               <span className="font-medium font-mono">{formatCurrency(entry.value)}</span>
             </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const { stateRate, fedLtcgRate } = getEffectiveRates(client);

  return (
    <div className="space-y-8 print:space-y-4 print:p-0 print:m-0 print:w-full">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white rounded-full transition-colors text-slate-500 border border-transparent hover:border-slate-200">
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-3">
               <h1 className="text-3xl font-bold text-tidemark-navy tracking-tight">{client.name}</h1>
               <button onClick={() => setShowEditClient(true)} className="text-slate-400 hover:text-tidemark-blue transition-colors">
                 <Settings size={18} />
               </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 mt-2">
              <span className="bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-medium shadow-sm">
                Fed Ord: {client.taxBracket}%
              </span>
              <span className={`px-2 py-0.5 rounded border font-medium shadow-sm ${client.customStateTaxRate ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                State ({client.state}): {formatPercent(stateRate)} {client.customStateTaxRate && '(Custom)'}
              </span>
              <span className={`px-2 py-0.5 rounded border font-medium shadow-sm ${client.customLtcgTaxRate ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                Fed LTCG: {formatPercent(fedLtcgRate)} {client.customLtcgTaxRate && '(Custom)'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
             <Button variant="secondary" onClick={printReport} className="gap-2 hidden md:flex">
                <Printer size={18} />
                Print / Save PDF
             </Button>
             <Button variant="secondary" onClick={downloadCSV} className="gap-2 hidden md:flex">
                <Download size={18} />
                Full CSV Export
             </Button>
             <Button onClick={() => { setEditingGrant(null); setShowGrantForm(true); }} className="gap-2 shadow-md shadow-indigo-100">
               <Plus size={20} />
               Add Grant
             </Button>
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="hidden print:block mb-6 border-b border-slate-200 pb-4">
          <div className="flex justify-between items-start">
             <div>
                <h1 className="text-2xl font-bold text-tidemark-navy">Equity Analysis Report</h1>
                <h2 className="text-lg text-slate-700 font-semibold">{client.name}</h2>
             </div>
             <div className="text-right">
                <p className="text-sm text-slate-500">Generated on {new Date().toLocaleDateString()}</p>
                <p className="text-xs text-slate-400">EquityCompass Advisors</p>
             </div>
          </div>
      </div>

      {/* Grant Form Modal (Previously inline) */}
      {showGrantForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tidemark-navy/40 backdrop-blur-sm p-4 overflow-y-auto print:hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 p-8 animate-in fade-in zoom-in duration-200 relative">
             <button onClick={() => { setShowGrantForm(false); setEditingGrant(null); }} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
             </button>
             <div className="flex items-center gap-3 mb-6">
                 <div className="p-2 bg-tidemark-blue/10 rounded-lg">
                    {editingGrant ? <Edit2 className="text-tidemark-blue" size={20} /> : <Plus className="text-tidemark-blue" size={20} />}
                 </div>
                 <h3 className="text-xl font-bold text-tidemark-navy">{editingGrant ? 'Edit Grant Details' : 'Add New Grant'}</h3>
             </div>
             
             <GrantForm 
               onSave={handleSaveGrant} 
               onCancel={() => { setShowGrantForm(false); setEditingGrant(null); }} 
               initialData={editingGrant || undefined}
             />
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-1 bg-slate-200/50 p-1 rounded-xl w-fit print:hidden">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-white text-tidemark-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Vesting Overview
        </button>
        <button
          onClick={() => setActiveTab('iso-planning')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'iso-planning' ? 'bg-white text-tidemark-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          ISO Planning
        </button>
      </div>

      {activeTab === 'iso-planning' ? (
        <div className="print:block">
            <ISOPlanner client={client} grants={client.grants} onSavePlan={handleSavePlan} />
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in print:space-y-6">
            {/* Scenario Planning Engine - Hidden on print as it's interactive */}
            <div className="bg-gradient-to-r from-tidemark-navy to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden print:hidden">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                    <Coins className="text-yellow-400" size={20} />
                    Strategy: {simulateSellAll ? 'Sell All & Diversify' : 'Sell-to-Cover (Standard)'}
                    </h3>
                    <p className="text-slate-300 text-sm opacity-90">
                        {simulateSellAll 
                         ? "Liquidation of all shares at vest to diversify portfolio. Tax gap paid from proceeds." 
                         : "Selling only enough shares to cover statutory withholding. Holding remainder."}
                    </p>
                </div>
                
                <div className="bg-slate-700/50 p-1 rounded-lg flex items-center border border-slate-600/50">
                    <button
                    onClick={() => setSimulateSellAll(false)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${!simulateSellAll ? 'bg-white text-slate-900 shadow-md' : 'text-slate-300 hover:text-white'}`}
                    >
                    Sell-to-Cover
                    </button>
                    <button
                    onClick={() => setSimulateSellAll(true)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${simulateSellAll ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-300 hover:text-white'}`}
                    >
                    Sell All
                    </button>
                </div>
                </div>
            </div>

            {/* Print Only Strategy Summary */}
            <div className="hidden print:block p-4 border border-slate-300 rounded-lg bg-slate-50 break-inside-avoid">
                 <h3 className="font-bold text-slate-800 text-sm">Modeling Assumptions</h3>
                 <p className="text-xs text-slate-600 mt-1">
                    Strategy: {simulateSellAll ? 'Sell All & Diversify' : 'Sell-to-Cover (Standard)'}. 
                    Assumes federal tax rate of {client.taxBracket}% and state rate of {formatPercent(stateRate)}.
                 </p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 print:grid-cols-4 print:gap-4 break-inside-avoid">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:p-4 print:border-slate-300 print:shadow-none">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg print:hidden">
                        <DollarSign size={22} />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Proj. Vesting</h4>
                    </div>
                    <p className="text-3xl font-bold text-tidemark-navy">{formatCurrency(summary.gross)}</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium print:hidden">Next 12 Months</p>
                </div>
                
                {/* Unvested RSU Value Card */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:p-4 print:border-slate-300 print:shadow-none">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg print:hidden">
                        <Lock size={22} />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Unvested RSUs</h4>
                    </div>
                    <p className="text-3xl font-bold text-slate-700">{formatCurrency(unvestedRSUValue)}</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium print:hidden">Total pipeline</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:p-4 print:border-slate-300 print:shadow-none">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg print:hidden">
                        <AlertTriangle size={22} />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Tax Gap</h4>
                    </div>
                    <p className="text-3xl font-bold text-amber-600">{formatCurrency(summary.taxGap)}</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium print:hidden">Due April 15</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:p-4 print:border-slate-300 print:shadow-none">
                    <div className="flex items-center gap-3 mb-3">
                         <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg print:hidden">
                         <TrendingUp size={22} />
                         </div>
                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                            AMT Exp.
                        </h4>
                    </div>
                    <p className={`text-3xl font-bold text-purple-600`}>
                        {formatCurrency(summary.amtExposure)}
                    </p>
                     <p className="text-xs text-slate-400 mt-1 font-medium print:hidden">From Planned Exercises Only</p>
                </div>
            </div>

            {/* Planned Exercises Section */}
            {(client.plannedExercises || []).length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 print:border-slate-300 print:p-4 break-inside-avoid print:shadow-none">
                    <h3 className="font-bold text-tidemark-navy mb-4 flex items-center gap-2">
                        <CheckCircle size={20} className="text-emerald-500 print:hidden" />
                        Planned Exercises
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
                         {(client.plannedExercises || []).map(plan => (
                             <div key={plan.id} className="border border-slate-100 bg-slate-50 rounded-lg p-4 text-sm print:bg-white print:border-slate-300">
                                 <div className="flex justify-between font-bold text-slate-800 mb-2">
                                     <span>{plan.grantTicker} ISO</span>
                                     <span>{formatNumber(plan.shares)} Shares</span>
                                 </div>
                                 <div className="space-y-1 text-slate-600 text-xs">
                                     <div className="flex justify-between">
                                         <span>Est. Cost:</span>
                                         <span>{formatCurrency(plan.estimatedCost)}</span>
                                     </div>
                                      <div className="flex justify-between">
                                         <span>AMT Exposure:</span>
                                         <span className="text-purple-600 font-medium">{formatCurrency(plan.amtExposure)}</span>
                                     </div>
                                 </div>
                             </div>
                         ))}
                    </div>
                </div>
            )}

            {/* Charts (Hidden on Print if complex, but kept here for now as requested) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-base font-bold text-tidemark-navy mb-6 flex items-center gap-2">
                    <PieChart size={18} className="text-emerald-500"/> 
                    Distribution Analysis (Sell-to-Cover)
                    </h3>
                    <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} />
                            <YAxis tick={{fontSize: 11, fill: '#64748b'}} tickFormatter={(val) => `$${val/1000}k`} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend iconType="circle" wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                            <Bar dataKey="netValue" name="Net Value (Kept)" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} maxBarSize={40} />
                            <Bar dataKey="withholding" name="Sold to Cover" stackId="a" fill="#64748b" maxBarSize={40} />
                            <Bar dataKey="taxGap" name="Tax Gap" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-base font-bold text-tidemark-navy mb-6 flex items-center gap-2">
                    <Building size={18} className="text-tidemark-blue"/>
                    Tax Liability Breakdown
                    </h3>
                    <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} />
                            <YAxis tick={{fontSize: 11, fill: '#64748b'}} tickFormatter={(val) => `$${val/1000}k`} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend iconType="circle" wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                            <Bar dataKey="fedTax" name="Federal Tax" stackId="a" fill="#00558C" radius={[0, 0, 4, 4]} maxBarSize={40} />
                            <Bar dataKey="stateTax" name={`State (${client.state || 'Other'})`} stackId="a" fill="#1B365D" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            {/* Removed ISO AMT Line to prevent confusion with potential vs actual exercise */}
                        </BarChart>
                    </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Grants List & Schedule */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block">
                {/* Left: Active Grants */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full print:hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Building size={18} className="text-slate-400" />
                        Active Grants
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100 overflow-y-auto max-h-[500px] custom-scrollbar">
                        {client.grants.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-sm">No grants recorded yet.</div>
                        ) : (
                        client.grants.map(grant => (
                            <div key={grant.id} className="p-5 hover:bg-slate-50 transition-colors group relative">
                                <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleEditGrantClick(grant); }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                        title="Edit Grant"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteGrant(grant.id); }}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                        title="Delete Grant"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-slate-800 text-lg">{grant.ticker || 'N/A'}</span>
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded uppercase ${grant.type === 'ISO' ? 'bg-purple-100 text-purple-700' : 'bg-tidemark-blue/10 text-tidemark-navy'}`}>
                                    {grant.type}
                                    </span>
                                </div>
                                <div className="text-sm font-medium text-slate-600 mb-3">{grant.companyName}</div>
                                
                                <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-500">
                                    <div>Price: <span className="font-medium text-slate-700">{formatCurrency(grant.currentPrice)}</span></div>
                                    {grant.type === 'ISO' && <div>Strike: <span className="font-medium text-slate-700">{formatCurrency(grant.strikePrice || 0)}</span></div>}
                                    <div>Total: <span className="font-medium text-slate-700">{formatNumber(grant.totalShares)}</span></div>
                                    <div>Rate: <span className="font-medium text-slate-700">{grant.withholdingRate || 22}%</span></div>
                                </div>
                            </div>
                        ))
                        )}
                    </div>
                </div>

                {/* Right: Detailed Table */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full print:col-span-3 print:border-slate-300 print:shadow-none print:h-auto break-inside-avoid">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center print:bg-white print:border-b-2 print:border-slate-300">
                        <h3 className="font-bold text-slate-800">Upcoming Vesting Schedule</h3>
                    </div>
                    <div className="overflow-x-auto flex-1 custom-scrollbar print:overflow-visible">
                        <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 bg-slate-50 uppercase tracking-wider font-semibold border-b border-slate-100 print:bg-white print:text-black">
                            <tr>
                            <th className="px-4 py-4 print:py-2">Date</th>
                            <th className="px-4 py-4 print:py-2">Shares</th>
                            <th className="px-4 py-4 text-right print:py-2">Gross</th>
                            <th className="px-4 py-4 text-center print:py-2">Withholding</th>
                            <th className="px-4 py-4 text-right bg-slate-50 text-slate-600 print:bg-white print:text-black print:py-2">Sold to Cover</th>
                            <th className="px-4 py-4 text-right bg-emerald-50/50 text-emerald-900 border-x border-emerald-100/50 print:bg-white print:text-black print:border-none print:py-2">Net Shares</th>
                            <th className="px-4 py-4 text-right bg-emerald-50/50 text-emerald-700 border-r border-emerald-100/50 print:bg-white print:text-black print:border-none print:py-2">Net Value</th>
                            <th className="px-4 py-4 text-right print:py-2">Tax Gap</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                            {upcomingEvents.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                No upcoming vesting events found in the next 12 months.
                                </td>
                            </tr>
                            ) : (
                            upcomingEvents.map((event, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors print:break-inside-avoid">
                                <td className="px-4 py-3 font-medium text-slate-900">
                                    {event.date}
                                    <div className="text-[10px] text-slate-400 uppercase print:text-black">{event.grantType}</div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 print:text-black">{formatNumber(event.shares)}</td>
                                <td className="px-4 py-3 text-right text-slate-600 font-medium print:text-black">{formatCurrency(event.grossValue)}</td>
                                <td className="px-4 py-3 text-center">
                                    <div className="text-xs text-slate-500 print:text-black">{event.electedWithholdingRate}%</div>
                                    <div className="text-[10px] text-slate-400 print:hidden">({formatCurrency(event.withholdingAmount)})</div>
                                </td>
                                <td className="px-4 py-3 text-right bg-slate-50/50 text-slate-500 font-mono print:bg-white print:text-black">
                                    -{formatNumber(Math.round(event.sharesSoldToCover))}
                                </td>
                                <td className="px-4 py-3 text-right bg-emerald-50/30 text-emerald-900 font-medium border-x border-emerald-100/30 print:bg-white print:text-black print:border-none">
                                    {formatNumber(event.netShares)}
                                </td>
                                <td className="px-4 py-3 text-right bg-emerald-50/30 text-emerald-700 font-bold border-r border-emerald-100/30 print:bg-white print:text-black print:border-none">
                                    {formatCurrency(event.netValue)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {event.grantType === 'ISO' ? (
                                    <div className="flex flex-col items-end">
                                        <span className="text-slate-400 text-xs print:text-black">Unexercised</span>
                                    </div>
                                    ) : (
                                    event.taxGap > 0 ? (
                                        <span className="text-amber-600 font-medium text-xs print:text-black">+{formatCurrency(event.taxGap)}</span>
                                    ) : (
                                        <span className="text-emerald-600 text-xs font-medium print:text-black">Covered</span>
                                    )
                                    )}
                                </td>
                                </tr>
                            ))
                            )}
                        </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Compliance Footer (Print Only) */}
      <div className="hidden print:block mt-8 pt-6 border-t border-slate-300">
         <p className="text-[10px] text-slate-500 text-justify leading-relaxed">
            <strong>Compliance Disclosure:</strong> Securities offered through EquityCompass Capital Markets, Member FINRA/SIPC. 
            Investment advisory services offered through EquityCompass Advisors, a registered investment adviser. 
            This report is generated by the EquityCompass platform for informational and planning purposes only. 
            It is based on information provided by the client and third-party sources deemed reliable but not guaranteed. 
            The projections, estimates, and tax calculations herein are hypothetical in nature, do not reflect actual investment results, 
            and are not guarantees of future performance. Market data and stock prices are delayed. 
            This report does not constitute tax, legal, or accounting advice. Clients should consult with their own 
            qualified tax advisor, estate planner, or attorney regarding their specific financial situation and before making any investment decisions.
            Past performance is not indicative of future results.
         </p>
      </div>

      <AddClientModal 
        isOpen={showEditClient} 
        onClose={() => setShowEditClient(false)} 
        onSave={handleEditClientSave}
        initialData={{ 
            name: client.name, 
            taxBracket: client.taxBracket, 
            state: client.state || 'CA',
            filingStatus: client.filingStatus,
            estimatedIncome: client.estimatedIncome,
            customStateTaxRate: client.customStateTaxRate,
            customLtcgTaxRate: client.customLtcgTaxRate
        }}
      />
    </div>
  );
};