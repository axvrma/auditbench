import { useState } from 'react';
import { Key, Plus, Trash2, Edit2, Eye, EyeOff, ChevronDown, ChevronRight, Save, X } from 'lucide-react';
import { addCredential, updateCredential, deleteCredential, type Credential } from '../lib/api';

interface CredentialManagerProps {
  credentials: Credential[];
  onRefresh: () => void;
}

export function CredentialManager({ credentials, onRefresh }: CredentialManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Set<string>>(new Set());
  
  const [name, setName] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [usernameSelector, setUsernameSelector] = useState('');
  const [passwordSelector, setPasswordSelector] = useState('');
  const [submitSelector, setSubmitSelector] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName('');
    setAuthUrl('');
    setUsername('');
    setPassword('');
    setUsernameSelector('');
    setPasswordSelector('');
    setSubmitSelector('');
    setError(null);
    setEditingId(null);
    setShowForm(false);
  };

  const startEditing = (cred: Credential) => {
    setEditingId(cred.id);
    setName(cred.name);
    setAuthUrl(cred.auth_url || '');
    setUsername(cred.username);
    setPassword(cred.password);
    setUsernameSelector(cred.username_selector || '');
    setPasswordSelector(cred.password_selector || '');
    setSubmitSelector(cred.submit_selector || '');
    setShowForm(true);
    setExpandedId(cred.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password.trim()) {
      setError('Name, username, and password are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = {
        name: name.trim(),
        auth_url: authUrl.trim() || undefined,
        username: username.trim(),
        password: password,
        username_selector: usernameSelector.trim() || undefined,
        password_selector: passwordSelector.trim() || undefined,
        submit_selector: submitSelector.trim() || undefined,
      };

      if (editingId) {
        await updateCredential(editingId, params);
      } else {
        await addCredential(params);
      }
      
      resetForm();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete these credentials? URLs using them will lose authentication.')) return;
    
    try {
      await deleteCredential(id);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const togglePassword = (id: string) => {
    setShowPasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Key className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Credential Manager</h2>
            <p className="text-sm text-gray-500">Save credentials once, use across multiple URLs</p>
          </div>
        </div>
        
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Credentials
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              {editingId ? 'Edit Credentials' : 'Add New Credentials'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Credential Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Production Admin, Staging User"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username / Email *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPasswords.has('form') ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={() => togglePassword('form')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.has('form') ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Login Page URL (optional)
              </label>
              <input
                type="url"
                value={authUrl}
                onChange={(e) => setAuthUrl(e.target.value)}
                placeholder="https://example.com/login"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Override the URL's login page if different from the target URL
              </p>
            </div>
          </div>

          <details className="border border-gray-200 rounded-lg">
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50">
              Advanced Selectors (optional)
            </summary>
            <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-200">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Username Field Selector
                </label>
                <input
                  type="text"
                  value={usernameSelector}
                  onChange={(e) => setUsernameSelector(e.target.value)}
                  placeholder='input[type="email"], #username'
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Password Field Selector
                </label>
                <input
                  type="text"
                  value={passwordSelector}
                  onChange={(e) => setPasswordSelector(e.target.value)}
                  placeholder='input[type="password"]'
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Submit Button Selector
                </label>
                <input
                  type="text"
                  value={submitSelector}
                  onChange={(e) => setSubmitSelector(e.target.value)}
                  placeholder='button[type="submit"]'
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </details>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : editingId ? 'Update' : 'Save Credentials'}
            </button>
          </div>
        </form>
      )}

      {/* Credentials List */}
      <div className="space-y-3">
        {credentials.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Key className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No saved credentials yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Add credentials here to use them across multiple URLs
            </p>
          </div>
        ) : (
          credentials.map((cred) => (
            <div
              key={cred.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === cred.id ? null : cred.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedId === cred.id ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Key className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{cred.name}</div>
                    <div className="text-sm text-gray-500">{cred.username}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(cred);
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(cred.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandedId === cred.id && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50">
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-500">Username</dt>
                      <dd className="font-mono text-gray-900">{cred.username}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Password</dt>
                      <dd className="font-mono text-gray-900 flex items-center gap-2">
                        {showPasswords.has(cred.id) ? cred.password : '••••••••'}
                        <button
                          onClick={() => togglePassword(cred.id)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords.has(cred.id) ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </dd>
                    </div>
                    {cred.auth_url && (
                      <div className="col-span-2">
                        <dt className="text-gray-500">Login URL</dt>
                        <dd className="font-mono text-gray-900 truncate">{cred.auth_url}</dd>
                      </div>
                    )}
                    {(cred.username_selector || cred.password_selector || cred.submit_selector) && (
                      <div className="col-span-2 pt-2 border-t border-gray-200">
                        <dt className="text-gray-500 mb-2">Custom Selectors</dt>
                        <dd className="space-y-1 font-mono text-xs text-gray-700">
                          {cred.username_selector && (
                            <div>Username: {cred.username_selector}</div>
                          )}
                          {cred.password_selector && (
                            <div>Password: {cred.password_selector}</div>
                          )}
                          {cred.submit_selector && (
                            <div>Submit: {cred.submit_selector}</div>
                          )}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
