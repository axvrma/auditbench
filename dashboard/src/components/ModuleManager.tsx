import { useState } from 'react';
import {
  addModule,
  updateModule,
  deleteModule,
  addUrl,
  updateUrl,
  deleteUrl,
  type Module,
  type Url,
  type Credential,
} from '../lib/api';
import {
  Plus,
  Trash2,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  Globe,
  Folder,
  FolderOpen,
  Key,
  Settings,
  Play,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { runAudit, getAuditStatus } from '../lib/api';

interface ModuleManagerProps {
  modules: Module[];
  urls: Url[];
  credentials: Credential[];
  onDataChange: () => void;
}

const MODULE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

export function ModuleManager({ modules, urls, credentials, onDataChange }: ModuleManagerProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(modules.map(m => m.id)));
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleDesc, setNewModuleDesc] = useState('');
  const [newModuleColor, setNewModuleColor] = useState(MODULE_COLORS[0]);
  const [addingUrlToModule, setAddingUrlToModule] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'none' | 'saved' | 'custom'>('none');
  
  // URL form state
  const [newUrlValue, setNewUrlValue] = useState('');
  const [newUrlName, setNewUrlName] = useState('');
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>('');
  const [newAuthUrl, setNewAuthUrl] = useState('');
  const [newAuthUsername, setNewAuthUsername] = useState('');
  const [newAuthPassword, setNewAuthPassword] = useState('');
  const [newAuthUsernameSelector, setNewAuthUsernameSelector] = useState('');
  const [newAuthPasswordSelector, setNewAuthPasswordSelector] = useState('');
  const [newAuthSubmitSelector, setNewAuthSubmitSelector] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningModuleId, setRunningModuleId] = useState<string | null>(null);
  const [moduleAuditStatus, setModuleAuditStatus] = useState<'idle' | 'running' | 'success'>('idle');

  const handleRunModuleAudit = async (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRunningModuleId(moduleId);
    setModuleAuditStatus('running');
    
    try {
      await runAudit(undefined, moduleId);
      
      // Poll for completion (progress is shown inline in Dashboard)
      const pollInterval = setInterval(async () => {
        const auditStatus = await getAuditStatus();
        
        if (!auditStatus.inProgress) {
          clearInterval(pollInterval);
          setModuleAuditStatus('success');
          onDataChange();
          setTimeout(() => {
            setRunningModuleId(null);
            setModuleAuditStatus('idle');
          }, 2000);
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run module audit');
      setRunningModuleId(null);
      setModuleAuditStatus('idle');
    }
  };

  const resetUrlForm = () => {
    setNewUrlValue('');
    setNewUrlName('');
    setSelectedCredentialId('');
    setNewAuthUrl('');
    setNewAuthUsername('');
    setNewAuthPassword('');
    setNewAuthUsernameSelector('');
    setNewAuthPasswordSelector('');
    setNewAuthSubmitSelector('');
    setShowAdvanced(false);
    setAuthMode('none');
    setAddingUrlToModule(null);
    setEditingUrlId(null);
  };

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleName.trim()) return;

    try {
      setLoading(true);
      setError(null);
      await addModule(newModuleName.trim(), newModuleDesc.trim() || undefined, newModuleColor);
      setNewModuleName('');
      setNewModuleDesc('');
      setNewModuleColor(MODULE_COLORS[(modules.length + 1) % MODULE_COLORS.length]);
      onDataChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add module');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm('Delete this module and all its URLs?')) return;

    try {
      await deleteModule(id);
      onDataChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete module');
    }
  };

  const handleToggleModule = async (module: Module) => {
    try {
      await updateModule(module.id, { is_active: !module.is_active });
      onDataChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update module');
    }
  };

  const handleAddUrl = async (moduleId: string) => {
    if (!newUrlValue.trim()) return;

    try {
      setLoading(true);
      await addUrl({
        url: newUrlValue.trim(),
        module_id: moduleId,
        name: newUrlName.trim() || undefined,
        credential_id: authMode === 'saved' ? selectedCredentialId || undefined : undefined,
        auth_url: authMode === 'custom' ? newAuthUrl.trim() || undefined : undefined,
        auth_username: authMode === 'custom' ? newAuthUsername.trim() || undefined : undefined,
        auth_password: authMode === 'custom' ? newAuthPassword || undefined : undefined,
        auth_username_selector: authMode === 'custom' ? newAuthUsernameSelector.trim() || undefined : undefined,
        auth_password_selector: authMode === 'custom' ? newAuthPasswordSelector.trim() || undefined : undefined,
        auth_submit_selector: authMode === 'custom' ? newAuthSubmitSelector.trim() || undefined : undefined,
      });
      resetUrlForm();
      onDataChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add URL');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUrlAuth = async (urlId: string) => {
    try {
      setLoading(true);
      
      if (authMode === 'none') {
        await updateUrl(urlId, {
          credential_id: null,
          auth_url: null,
          auth_username: null,
          auth_password: null,
          auth_username_selector: null,
          auth_password_selector: null,
          auth_submit_selector: null,
        });
      } else if (authMode === 'saved') {
        await updateUrl(urlId, {
          credential_id: selectedCredentialId || null,
          auth_url: null,
          auth_username: null,
          auth_password: null,
          auth_username_selector: null,
          auth_password_selector: null,
          auth_submit_selector: null,
        });
      } else {
        await updateUrl(urlId, {
          credential_id: null,
          auth_url: newAuthUrl.trim() || null,
          auth_username: newAuthUsername.trim() || null,
          auth_password: newAuthPassword || null,
          auth_username_selector: newAuthUsernameSelector.trim() || null,
          auth_password_selector: newAuthPasswordSelector.trim() || null,
          auth_submit_selector: newAuthSubmitSelector.trim() || null,
        });
      }
      
      resetUrlForm();
      onDataChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUrl = async (url: Url) => {
    try {
      await updateUrl(url.id, { is_active: !url.is_active });
      onDataChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update URL');
    }
  };

  const handleDeleteUrl = async (id: string) => {
    if (!confirm('Delete this URL and all its audits?')) return;

    try {
      await deleteUrl(id);
      onDataChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete URL');
    }
  };

  const startEditingCredentials = (url: Url) => {
    setEditingUrlId(url.id);
    
    if (url.credential_id) {
      setAuthMode('saved');
      setSelectedCredentialId(url.credential_id);
    } else if (url.auth_username) {
      setAuthMode('custom');
      setNewAuthUrl(url.auth_url || '');
      setNewAuthUsername(url.auth_username || '');
      setNewAuthPassword(url.auth_password || '');
      setNewAuthUsernameSelector(url.auth_username_selector || '');
      setNewAuthPasswordSelector(url.auth_password_selector || '');
      setNewAuthSubmitSelector(url.auth_submit_selector || '');
    } else {
      setAuthMode('none');
    }
    setShowAdvanced(true);
  };

  const getCredentialName = (credId: string | null) => {
    if (!credId) return null;
    return credentials.find(c => c.id === credId)?.name || 'Unknown';
  };

  const getUrlsForModule = (moduleId: string) => urls.filter((u) => u.module_id === moduleId);

  return (
    <div className="space-y-6">
      {/* Add Module Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Module</h2>
        <form onSubmit={handleAddModule} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Module Name</label>
              <input
                type="text"
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                placeholder="E-Commerce"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={newModuleDesc}
                onChange={(e) => setNewModuleDesc(e.target.value)}
                placeholder="Main e-commerce pages"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex gap-2">
                {MODULE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewModuleColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      newModuleColor === color ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Folder className="w-4 h-4" />
            {loading ? 'Creating...' : 'Create Module'}
          </button>
        </form>
      </div>

      {/* Modules List */}
      <div className="space-y-4">
        {modules.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Folder className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No modules yet</h3>
            <p className="text-gray-500">Create a module to organize your URLs</p>
          </div>
        ) : (
          modules.map((module) => {
            const moduleUrls = getUrlsForModule(module.id);
            const isExpanded = expandedModules.has(module.id);

            return (
              <div
                key={module.id}
                className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${!module.is_active ? 'opacity-60' : ''}`}
              >
                {/* Module Header */}
                <div
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleModule(module.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: module.color }} />
                    {isExpanded ? <FolderOpen className="w-5 h-5 text-gray-500" /> : <Folder className="w-5 h-5 text-gray-500" />}
                    <div>
                      <h3 className="font-semibold text-gray-900">{module.name}</h3>
                      {module.description && <p className="text-sm text-gray-500">{module.description}</p>}
                    </div>
                    <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {moduleUrls.length} URL{moduleUrls.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {moduleUrls.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={(e) => handleRunModuleAudit(module.id, e)}
                          disabled={runningModuleId === module.id}
                          className={`px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                            runningModuleId === module.id
                              ? moduleAuditStatus === 'success'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          title={`Run audit for all ${moduleUrls.length} URLs in this module`}
                        >
                          {runningModuleId === module.id ? (
                            moduleAuditStatus === 'success' ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" />
                                Done
                              </>
                            ) : (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Running...
                              </>
                            )
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              Run All ({moduleUrls.length})
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => handleToggleModule(module)}
                      className={`p-1 rounded ${module.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                    >
                      {module.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                    </button>
                    <button
                      onClick={() => handleDeleteModule(module.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Module URLs */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {moduleUrls.length === 0 ? (
                      <div className="px-6 py-8 text-center text-gray-500">No URLs in this module yet</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {moduleUrls.map((url) => (
                          <div key={url.id}>
                            <div className={`px-6 py-3 pl-14 flex items-center justify-between ${!url.is_active ? 'bg-gray-50 opacity-60' : ''}`}>
                              <div className="flex items-center gap-3 min-w-0">
                                <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 truncate">{url.name || url.url}</span>
                                    <a href={url.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600">
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                    {url.credential_id && (
                                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded flex items-center gap-1" title={`Using: ${getCredentialName(url.credential_id)}`}>
                                        <Key className="w-3 h-3" />
                                        {getCredentialName(url.credential_id)}
                                      </span>
                                    )}
                                    {!url.credential_id && url.auth_username && (
                                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded flex items-center gap-1">
                                        <Key className="w-3 h-3" />
                                        Custom Auth
                                      </span>
                                    )}
                                  </div>
                                  {url.name && <p className="text-xs text-gray-500 truncate">{url.url}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded">{url.schedule}</span>
                                <button
                                  onClick={() => startEditingCredentials(url)}
                                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                  title="Configure credentials"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleUrl(url)}
                                  className={`p-1 rounded ${url.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                >
                                  {url.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteUrl(url.id)}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            
                            {/* Edit Credentials Form */}
                            {editingUrlId === url.id && (
                              <div className="px-6 py-4 pl-14 bg-gray-50 border-t border-gray-200">
                                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                  <Key className="w-4 h-4 text-purple-600" />
                                  Authentication Settings
                                </h4>
                                <div className="space-y-4">
                                  {/* Auth Mode Selector */}
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setAuthMode('none')}
                                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                        authMode === 'none' 
                                          ? 'bg-gray-900 text-white border-gray-900' 
                                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                                      }`}
                                    >
                                      No Auth
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setAuthMode('saved')}
                                      disabled={credentials.length === 0}
                                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                        authMode === 'saved' 
                                          ? 'bg-purple-600 text-white border-purple-600' 
                                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 disabled:opacity-50'
                                      }`}
                                    >
                                      Use Saved Credentials
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setAuthMode('custom')}
                                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                        authMode === 'custom' 
                                          ? 'bg-amber-600 text-white border-amber-600' 
                                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                                      }`}
                                    >
                                      Custom Credentials
                                    </button>
                                  </div>

                                  {/* Saved Credentials Selector */}
                                  {authMode === 'saved' && (
                                    <div className="p-3 bg-purple-50 rounded-lg">
                                      <label className="block text-sm font-medium text-purple-700 mb-2">
                                        Select Saved Credentials
                                      </label>
                                      <select
                                        value={selectedCredentialId}
                                        onChange={(e) => setSelectedCredentialId(e.target.value)}
                                        className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                      >
                                        <option value="">Choose credentials...</option>
                                        {credentials.map((cred) => (
                                          <option key={cred.id} value={cred.id}>
                                            {cred.name} ({cred.username})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  {/* Custom Credentials Form */}
                                  {authMode === 'custom' && (
                                    <div className="p-3 bg-amber-50 rounded-lg space-y-3">
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <input
                                          type="text"
                                          value={newAuthUrl}
                                          onChange={(e) => setNewAuthUrl(e.target.value)}
                                          placeholder="Login URL (optional)"
                                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <input
                                          type="text"
                                          value={newAuthUsername}
                                          onChange={(e) => setNewAuthUsername(e.target.value)}
                                          placeholder="Username / Email"
                                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <input
                                          type="password"
                                          value={newAuthPassword}
                                          onChange={(e) => setNewAuthPassword(e.target.value)}
                                          placeholder="Password"
                                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                      </div>
                                      
                                      <button
                                        type="button"
                                        onClick={() => setShowAdvanced(!showAdvanced)}
                                        className="text-sm text-blue-600 hover:text-blue-800"
                                      >
                                        {showAdvanced ? 'Hide' : 'Show'} advanced selectors
                                      </button>
                                      
                                      {showAdvanced && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                          <input
                                            type="text"
                                            value={newAuthUsernameSelector}
                                            onChange={(e) => setNewAuthUsernameSelector(e.target.value)}
                                            placeholder="Username selector (CSS)"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                          <input
                                            type="text"
                                            value={newAuthPasswordSelector}
                                            onChange={(e) => setNewAuthPasswordSelector(e.target.value)}
                                            placeholder="Password selector (CSS)"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                          <input
                                            type="text"
                                            value={newAuthSubmitSelector}
                                            onChange={(e) => setNewAuthSubmitSelector(e.target.value)}
                                            placeholder="Submit button selector (CSS)"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleUpdateUrlAuth(url.id)}
                                      disabled={loading}
                                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      Save Settings
                                    </button>
                                    <button
                                      onClick={resetUrlForm}
                                      className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add URL Form */}
                    {addingUrlToModule === module.id ? (
                      <div className="px-6 py-4 pl-14 bg-gray-50 border-t border-gray-100">
                        <div className="space-y-3">
                          <div className="flex gap-3">
                            <input
                              type="url"
                              value={newUrlValue}
                              onChange={(e) => setNewUrlValue(e.target.value)}
                              placeholder="https://example.com"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                            <input
                              type="text"
                              value={newUrlName}
                              onChange={(e) => setNewUrlName(e.target.value)}
                              placeholder="Name (optional)"
                              className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Key className="w-3 h-3" />
                            {showAdvanced ? 'Hide' : 'Add'} authentication
                          </button>
                          
                          {showAdvanced && (
                            <div className="space-y-3">
                              {/* Auth Mode Selector */}
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setAuthMode('saved')}
                                  disabled={credentials.length === 0}
                                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                    authMode === 'saved' 
                                      ? 'bg-purple-600 text-white border-purple-600' 
                                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 disabled:opacity-50'
                                  }`}
                                >
                                  Use Saved ({credentials.length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAuthMode('custom')}
                                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                    authMode === 'custom' 
                                      ? 'bg-amber-600 text-white border-amber-600' 
                                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  Enter Custom
                                </button>
                              </div>

                              {/* Saved Credentials Selector */}
                              {authMode === 'saved' && (
                                <div className="p-3 bg-purple-50 rounded-lg">
                                  <select
                                    value={selectedCredentialId}
                                    onChange={(e) => setSelectedCredentialId(e.target.value)}
                                    className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                  >
                                    <option value="">Choose credentials...</option>
                                    {credentials.map((cred) => (
                                      <option key={cred.id} value={cred.id}>
                                        {cred.name} ({cred.username})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Custom Credentials Form */}
                              {authMode === 'custom' && (
                                <div className="p-3 bg-amber-50 rounded-lg space-y-3">
                                  <p className="text-xs text-amber-700">For pages requiring login, enter credentials below:</p>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input
                                      type="text"
                                      value={newAuthUrl}
                                      onChange={(e) => setNewAuthUrl(e.target.value)}
                                      placeholder="Login URL (optional)"
                                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                      type="text"
                                      value={newAuthUsername}
                                      onChange={(e) => setNewAuthUsername(e.target.value)}
                                      placeholder="Username / Email"
                                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                      type="password"
                                      value={newAuthPassword}
                                      onChange={(e) => setNewAuthPassword(e.target.value)}
                                      placeholder="Password"
                                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddUrl(module.id)}
                              disabled={loading}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                            >
                              Add URL
                            </button>
                            <button
                              onClick={resetUrlForm}
                              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingUrlToModule(module.id)}
                        className="w-full px-6 py-3 pl-14 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 border-t border-gray-100"
                      >
                        <Plus className="w-4 h-4" />
                        Add URL to this module
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
