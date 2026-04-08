import { useState, useMemo, useEffect } from 'react';
import { ScoreCards } from './ScoreCards';
import { ScoreChart } from './ScoreChart';
import { Suggestions } from './Suggestions';
import { ScreenshotViewer } from './ScreenshotViewer';
import { RunAuditButton } from './RunAuditButton';
import { AuditProgressInline } from './AuditProgressInline';
import { getScreenshotUrl, getFullReport, getAuditStatus, type Module, type Url, type Audit, type AuditStatus } from '../lib/api';
import { RefreshCw, Clock, ExternalLink, Image, Folder, ChevronDown, FileJson, X, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';

interface DashboardProps {
  modules: Module[];
  urls: Url[];
  audits: (Audit & { url: Url })[];
  onRefresh: () => void;
}

export function Dashboard({ modules, urls, audits, onRefresh }: DashboardProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(
    modules[0]?.id || null
  );
  const [selectedUrlId, setSelectedUrlId] = useState<string | null>(null);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [jsonReport, setJsonReport] = useState<object | null>(null);
  const [loadingReport, setLoadingReport] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [auditProgress, setAuditProgress] = useState<AuditStatus | null>(null);
  const [progressDismissed, setProgressDismissed] = useState(false);

  // Poll for audit status
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const status = await getAuditStatus();
        // Show progress if there's an active audit
        if (status.inProgress && status.urls && status.urls.length > 0) {
          setAuditProgress(status);
          setProgressDismissed(false); // Reset dismissed state when new audit starts
        } else if (status.urls && status.urls.length > 0 && !progressDismissed) {
          // Show completed results only if not dismissed
          setAuditProgress(status);
        } else if (!status.inProgress && progressDismissed) {
          setAuditProgress(null);
        }
      } catch {
        // Ignore polling errors
      }
    };

    // Initial poll
    pollStatus();

    // Poll every second
    const interval = setInterval(pollStatus, 1000);
    return () => clearInterval(interval);
  }, [progressDismissed]);

  const handleViewReport = async (auditId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingReport(auditId);
    setReportError(null);
    try {
      const report = await getFullReport(auditId);
      setJsonReport(report);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Failed to load report');
    } finally {
      setLoadingReport(null);
    }
  };

  const selectedModule = modules.find((m) => m.id === selectedModuleId);
  
  const moduleUrls = useMemo(() => {
    return urls.filter((u) => u.module_id === selectedModuleId);
  }, [urls, selectedModuleId]);

  const activeModuleUrls = useMemo(() => {
    return moduleUrls.filter((u) => u.is_active);
  }, [moduleUrls]);

  const selectedUrl = selectedUrlId 
    ? urls.find((u) => u.id === selectedUrlId) 
    : moduleUrls[0];

  const urlAudits = useMemo(() => {
    if (!selectedUrl) return [];
    return audits.filter((a) => a.url_id === selectedUrl.id);
  }, [audits, selectedUrl]);

  const latestAudit = urlAudits[0];

  // Calculate module-level stats
  const moduleStats = useMemo(() => {
    const moduleAudits = audits.filter((a) => 
      moduleUrls.some((u) => u.id === a.url_id)
    );
    
    const latestByUrl = new Map<string, Audit & { url: Url }>();
    for (const audit of moduleAudits) {
      if (!latestByUrl.has(audit.url_id)) {
        latestByUrl.set(audit.url_id, audit);
      }
    }
    
    const latestAudits = Array.from(latestByUrl.values());
    
    const avg = (key: keyof Audit) => {
      const values = latestAudits
        .map((a) => a[key] as number | null)
        .filter((v): v is number => v !== null);
      return values.length > 0 
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) 
        : null;
    };

    return {
      avgPerformance: avg('performance_score'),
      avgAccessibility: avg('accessibility_score'),
      avgBestPractices: avg('best_practices_score'),
      avgSeo: avg('seo_score'),
      avgPwa: avg('pwa_score'),
      urlCount: moduleUrls.length,
      auditedCount: latestAudits.length,
    };
  }, [audits, moduleUrls]);

  const handleSelectAudit = (auditId: string) => {
    setSelectedAuditId(auditId === selectedAuditId ? null : auditId);
  };

  if (modules.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Folder className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          No modules yet
        </h2>
        <p className="text-gray-600 mb-4">
          Create a module and add URLs to start tracking Lighthouse scores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Module & URL Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <select
              value={selectedModuleId || ''}
              onChange={(e) => {
                setSelectedModuleId(e.target.value);
                setSelectedUrlId(null);
                setSelectedAuditId(null);
              }}
              className="appearance-none pl-10 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.name}
                </option>
              ))}
            </select>
            <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {moduleUrls.length > 0 && (
            <select
              value={selectedUrl?.id || ''}
              onChange={(e) => {
                setSelectedUrlId(e.target.value);
                setSelectedAuditId(null);
              }}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {moduleUrls.map((url) => (
                <option key={url.id} value={url.id}>
                  {url.name || url.url}
                </option>
              ))}
            </select>
          )}

          {selectedUrl && (
            <a
              href={selectedUrl.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-blue-600 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <RunAuditButton 
            urlId={selectedUrl?.id}
            moduleName={selectedUrl?.name || selectedUrl?.url}
            onAuditComplete={onRefresh}
            disabled={!selectedUrl?.is_active || !selectedModule?.is_active}
          />
          {activeModuleUrls.length > 1 && (
            <RunAuditButton 
              moduleId={selectedModuleId || undefined}
              moduleName={`All ${activeModuleUrls.length} URLs`}
              onAuditComplete={onRefresh}
              disabled={!selectedModule?.is_active}
            />
          )}
          <button
            onClick={onRefresh}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Module Overview */}
      {selectedModule && (
        <div 
          className="bg-white rounded-xl border border-gray-200 p-4"
          style={{ borderLeftColor: selectedModule.color, borderLeftWidth: '4px' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">{selectedModule.name}</h2>
              {selectedModule.description && (
                <p className="text-sm text-gray-500">{selectedModule.description}</p>
              )}
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{moduleStats.urlCount}</div>
                <div className="text-gray-500">URLs</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(moduleStats.avgPerformance)}`}>
                  {moduleStats.avgPerformance ?? '-'}
                </div>
                <div className="text-gray-500">Avg Perf</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(moduleStats.avgAccessibility)}`}>
                  {moduleStats.avgAccessibility ?? '-'}
                </div>
                <div className="text-gray-500">Avg A11y</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(moduleStats.avgSeo)}`}>
                  {moduleStats.avgSeo ?? '-'}
                </div>
                <div className="text-gray-500">Avg SEO</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Latest Audit Info */}
      {latestAudit && (
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Last audit: {format(new Date(latestAudit.created_at), 'PPp')}
          </span>
          {latestAudit.screenshot_path && (
            <button
              onClick={() => setScreenshotUrl(getScreenshotUrl(latestAudit.screenshot_path))}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
            >
              <Image className="w-4 h-4" />
              View Screenshot
            </button>
          )}
        </div>
      )}

      {/* Current Audit Progress - shown below View Screenshot, above Score Cards */}
      {auditProgress && auditProgress.urls && auditProgress.urls.length > 0 && (
        <AuditProgressInline 
          progress={auditProgress} 
          onDismiss={() => setProgressDismissed(true)}
        />
      )}

      {/* Score Cards */}
      {moduleUrls.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No URLs in this module. Add URLs in the Modules tab.</p>
        </div>
      ) : latestAudit ? (
        <ScoreCards audit={latestAudit} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No audits yet for this URL. Click "Run Audit" to start.</p>
        </div>
      )}

      {/* Historical Chart */}
      {selectedUrl && urlAudits.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Score History - {selectedUrl.name || selectedUrl.url}
          </h3>
          <ScoreChart urlId={selectedUrl.id} />
        </div>
      )}

      {/* Audit History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Audit History</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {urlAudits.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No audits yet
            </div>
          ) : (
            urlAudits.slice(0, 10).map((audit) => (
              <div key={audit.id}>
                <button
                  onClick={() => handleSelectAudit(audit.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">
                      {format(new Date(audit.created_at), 'PPp')}
                    </span>
                    {audit.status === 'failed' && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                        Failed
                      </span>
                    )}
                    {audit.status === 'running' && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full animate-pulse">
                        Running...
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                    <ScoreBadge label="Perf" score={audit.performance_score} />
                    <ScoreBadge label="A11y" score={audit.accessibility_score} />
                    <ScoreBadge label="BP" score={audit.best_practices_score} />
                    <ScoreBadge label="SEO" score={audit.seo_score} />
                    <button
                      onClick={(e) => handleViewReport(audit.id, e)}
                      disabled={loadingReport === audit.id}
                      className="ml-2 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="View Full JSON Report"
                    >
                      {loadingReport === audit.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileJson className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </button>
                {selectedAuditId === audit.id && (
                  <div className="px-6 pb-4">
                    <Suggestions auditId={audit.id} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Screenshot Modal */}
      {screenshotUrl && (
        <ScreenshotViewer
          url={screenshotUrl}
          onClose={() => setScreenshotUrl(null)}
        />
      )}

      {/* JSON Report Modal */}
      {jsonReport && (
        <JsonReportViewer
          report={jsonReport}
          onClose={() => setJsonReport(null)}
        />
      )}

      {/* Report Error Toast */}
      {reportError && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <span>{reportError}</span>
          <button onClick={() => setReportError(null)} className="p-1 hover:bg-red-200 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function JsonReportViewer({ report, onClose }: { report: object; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(report, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileJson className="w-5 h-5 text-blue-600" />
            Full Lighthouse Report
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy JSON
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <pre className="text-xs font-mono text-gray-800 bg-gray-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
            {jsonString}
          </pre>
        </div>
      </div>
    </div>
  );
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 90) return 'text-green-600';
  if (score >= 50) return 'text-orange-600';
  return 'text-red-600';
}

function ScoreBadge({ label, score }: { label: string; score: number | null }) {
  const getColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-400';
    if (score >= 90) return 'bg-green-100 text-green-700';
    if (score >= 50) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`px-2 py-0.5 rounded text-sm font-medium ${getColor(score)}`}>
        {score ?? '-'}
      </div>
    </div>
  );
}
