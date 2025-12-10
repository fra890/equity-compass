import React, { useState, useEffect } from 'react';
import { Client } from './types';
import { AddClientModal } from './components/AddClientModal';
import { ClientDetail } from './components/ClientDetail';
import { Button } from './components/Button';
import { Login } from './components/Login';
import { Users, LayoutGrid, LogOut, Search, Loader2 } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { getClients, saveClient } from './services/firestoreService';

const App: React.FC = () => {
  // --- Auth State ---
  const { user, logout } = useAuth();
  
  // --- App State ---
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Fetch Clients on Load ---
  useEffect(() => {
    if (user) {
      setIsLoading(true);
      getClients(user.uid)
        .then(data => {
          setClients(data);
        })
        .catch(err => console.error(err))
        .finally(() => setIsLoading(false));
    } else {
      setClients([]);
    }
  }, [user]);

  // --- Handlers ---
  const handleAddClient = async (
    name: string, 
    taxBracket: number, 
    state: string, 
    filingStatus: 'single' | 'married_joint', 
    estimatedIncome: number, 
    customState?: number, 
    customLtcg?: number
  ) => {
    if (!user) return;

    const newClient: Client = {
      id: crypto.randomUUID(),
      name,
      taxBracket,
      state,
      filingStatus,
      estimatedIncome,
      customStateTaxRate: customState,
      customLtcgTaxRate: customLtcg,
      grants: [],
      plannedExercises: []
    };

    // Optimistic Update
    setClients([...clients, newClient]);
    
    // Cloud Save
    await saveClient(user.uid, newClient);
  };

  const handleUpdateClient = async (updatedClient: Client) => {
    if (!user) return;

    // Optimistic Update
    setClients(clients.map(c => c.id === updatedClient.id ? updatedClient : c));
    
    // Cloud Save
    await saveClient(user.uid, updatedClient);
  };

  const handleLogout = async () => {
    try {
      await logout();
      setSelectedClientId(null);
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  // --- Render Login if not authenticated ---
  if (!user) {
    return <Login />;
  }

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900">
      
      {/* Sidebar - HIDDEN ON PRINT */}
      <aside className="w-64 bg-tidemark-navy text-slate-300 flex flex-col fixed h-full z-10 hidden md:flex print:hidden">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-tidemark-blue rounded-lg flex items-center justify-center text-white font-bold">
               EC
             </div>
             <span className="font-bold text-lg text-white tracking-tight">EquityCompass</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setSelectedClientId(null)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${selectedClientId === null ? 'bg-tidemark-blue text-white shadow-lg' : 'hover:bg-slate-800'}`}
          >
            <LayoutGrid size={20} />
            <span className="font-medium">Dashboard</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <div className="bg-slate-800/50 rounded-lg p-4 mb-3">
             <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Advisor</h4>
             <p className="text-sm text-white truncate">{user.email}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 text-sm transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content - MARGIN RESET ON PRINT */}
      <main className="flex-1 md:ml-64 p-8 print:ml-0 print:p-0 print:w-full">
        {selectedClientId && activeClient ? (
          <ClientDetail 
            client={activeClient} 
            onBack={() => setSelectedClientId(null)}
            onUpdateClient={handleUpdateClient}
          />
        ) : (
          <div className="max-w-6xl mx-auto space-y-8 print:hidden">
            {/* Dashboard Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-tidemark-navy">Client Overview</h1>
                <p className="text-slate-500">Manage your portfolio of clients and their equity grants.</p>
              </div>
              <Button onClick={() => setIsAddClientModalOpen(true)} className="gap-2 shadow-lg shadow-tidemark-blue/20">
                <Users size={20} />
                Add New Client
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Search clients by name..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-tidemark-blue outline-none shadow-sm"
              />
            </div>

            {/* Loading State */}
            {isLoading ? (
               <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 size={40} className="animate-spin mb-4 text-tidemark-blue" />
                  <p>Loading Clients from Secure Cloud...</p>
               </div>
            ) : (
                /* Client Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClients.map(client => (
                    <div 
                    key={client.id} 
                    onClick={() => setSelectedClientId(client.id)}
                    className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-tidemark-blue transition-all cursor-pointer group"
                    >
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-tidemark-blue/10 text-tidemark-navy rounded-full flex items-center justify-center font-bold text-xl group-hover:bg-tidemark-blue group-hover:text-white transition-colors">
                        {client.name.charAt(0)}
                        </div>
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded font-medium">
                        {client.taxBracket}% Tax
                        </span>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">{client.name}</h3>
                    <p className="text-slate-500 text-sm mb-4">
                        {client.grants.length} Active Grant{client.grants.length !== 1 ? 's' : ''}
                    </p>
                    
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                        <span className="text-slate-500">View Details</span>
                        <span className="text-tidemark-blue font-medium flex items-center gap-1">
                        Open Portfolio &rarr;
                        </span>
                    </div>
                    </div>
                ))}
                
                {filteredClients.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                    <Users size={48} className="mx-auto mb-3 opacity-50" />
                    <p>No clients found.</p>
                    </div>
                )}
                </div>
            )}
          </div>
        )}
      </main>

      <AddClientModal 
        isOpen={isAddClientModalOpen} 
        onClose={() => setIsAddClientModalOpen(false)}
        onSave={handleAddClient}
      />
    </div>
  );
};

export default App;