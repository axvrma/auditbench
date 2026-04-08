import { useState, useEffect } from 'react';
import { getSuggestions, type Suggestion } from '../lib/api';
import { AlertTriangle, Clock, HardDrive, ChevronDown, ChevronUp } from 'lucide-react';

interface SuggestionsProps {
  auditId: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  'best-practices': 'Best Practices',
  seo: 'SEO',
  pwa: 'PWA',
};

const CATEGORY_COLORS: Record<string, string> = {
  performance: 'bg-green-100 text-green-700',
  accessibility: 'bg-blue-100 text-blue-700',
  'best-practices': 'bg-purple-100 text-purple-700',
  seo: 'bg-orange-100 text-orange-700',
  pwa: 'bg-pink-100 text-pink-700',
};

export function Suggestions({ auditId }: SuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        setLoading(true);
        const data = await getSuggestions(auditId);
        setSuggestions(data);
      } catch (error) {
        console.error('Failed to load suggestions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, [auditId]);

  if (loading) {
    return <div className="py-4 text-center text-gray-500">Loading suggestions...</div>;
  }

  if (suggestions.length === 0) {
    return <div className="py-4 text-center text-gray-500">No improvement suggestions found.</div>;
  }

  const categories = [...new Set(suggestions.map((s) => s.category))];
  const filteredSuggestions = filter === 'all' ? suggestions : suggestions.filter((s) => s.category === filter);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatMs = (ms: number): string => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms)}ms`;
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          Improvement Suggestions ({filteredSuggestions.length})
        </h4>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {filteredSuggestions.map((suggestion) => (
          <div key={suggestion.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === suggestion.id ? null : suggestion.id)}
              className="w-full px-4 py-3 flex items-start justify-between text-left hover:bg-gray-50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${CATEGORY_COLORS[suggestion.category] || 'bg-gray-100 text-gray-700'}`}>
                    {CATEGORY_LABELS[suggestion.category] || suggestion.category}
                  </span>
                  {suggestion.score !== null && (
                    <span className={`text-xs ${suggestion.score < 0.5 ? 'text-red-600' : suggestion.score < 0.9 ? 'text-orange-600' : 'text-green-600'}`}>
                      {Math.round(suggestion.score * 100)}%
                    </span>
                  )}
                </div>
                <p className="font-medium text-gray-900 text-sm">{suggestion.title}</p>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  {suggestion.savings_ms > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Save {formatMs(suggestion.savings_ms)}
                    </span>
                  )}
                  {suggestion.savings_bytes > 0 && (
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      Save {formatBytes(suggestion.savings_bytes)}
                    </span>
                  )}
                </div>
              </div>
              {expandedId === suggestion.id ? (
                <ChevronUp className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
              )}
            </button>
            {expandedId === suggestion.id && suggestion.description && (
              <div className="px-4 pb-3 pt-0 border-t border-gray-100">
                <p className="text-sm text-gray-600 mt-3">{suggestion.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
