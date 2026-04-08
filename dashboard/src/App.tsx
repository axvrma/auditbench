import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { ModuleManager } from './components/ModuleManager';
import { CredentialManager } from './components/CredentialManager';
import { 
  getModules, 
  getUrls, 
  getLatestAudits,
  getCredentials,
  type Module,
  type Url, 
  type Audit,
  type Credential
} from './lib/api';
import { LayoutGrid, BarChart3, AlertCircle, RefreshCw, Key } from 'lucide-react';

type Tab = 'dashboard' | 'modules' | 'credentials';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [modules, setModules] = useState<Module[]>([]);
  const [urls, setUrls] = useState<Url[]>([]);
  const [audits, setAudits] = useState<(Audit & { url: Url })[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverOnline, setServerOnline] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      setServerOnline(true);

      const [modulesData, urlsData, auditsData, credentialsData] = await Promise.all([
        getModules(),
        getUrls(),
        getLatestAudits(),
        getCredentials(),
      ]);
      setModules(modulesData);
      setUrls(urlsData);
      setAudits(auditsData);
      setCredentials(credentialsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      if (message.includes('fetch') || message.includes('network')) {
        setServerOnline(false);
        setError('Cannot connect to server. Make sure the server is running on port 4001.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDataChange = () => {
    loadData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">
                Lighthouse Dashboard
              </h1>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                serverOnline 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {serverOnline ? 'Connected' : 'Offline'}
              </span>
            </div>

            <nav className="flex gap-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('modules')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'modules'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Modules
              </button>
              <button
                onClick={() => setActiveTab('credentials')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'credentials'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Key className="w-4 h-4" />
                Credentials
                {credentials.length > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-purple-200 text-purple-700 rounded-full">
                    {credentials.length}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!serverOnline && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">Server Not Running</p>
              <p className="text-red-700 text-sm mt-1">
                Start the server with: <code className="bg-red-100 px-2 py-0.5 rounded">cd server && npm run dev</code>
              </p>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {error && serverOnline && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {loading && modules.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : activeTab === 'dashboard' ? (
          <Dashboard 
            modules={modules}
            urls={urls} 
            audits={audits} 
            onRefresh={loadData}
          />
        ) : activeTab === 'modules' ? (
          <ModuleManager 
            modules={modules}
            urls={urls}
            credentials={credentials}
            onDataChange={handleDataChange}
          />
        ) : (
          <CredentialManager
            credentials={credentials}
            onRefresh={handleDataChange}
          />
        )}
      </main>
    </div>
  );
}

export default App;
