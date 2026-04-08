import { Loader2, CheckCircle, XCircle, Clock, X } from 'lucide-react';
import type { AuditStatus, UrlProgress } from '../lib/api';

interface AuditProgressInlineProps {
  progress: AuditStatus;
  onDismiss?: () => void;
}

export function AuditProgressInline({ progress, onDismiss }: AuditProgressInlineProps) {
  const progressPercent = progress.total > 0 
    ? Math.round((progress.completed / progress.total) * 100) 
    : 0;

  const isComplete = !progress.inProgress && progress.completed === progress.total;

  return (
    <div className={`rounded-xl border overflow-hidden ${isComplete ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
      {/* Compact Header with Progress */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {progress.inProgress ? (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            )}
            <span className="font-medium text-gray-900 text-sm">
              {isComplete ? 'Audit Complete' : 'Auditing...'}
            </span>
            <span className="text-sm text-gray-600">
              {progress.completed}/{progress.total} URLs
            </span>
            
            {/* Progress Bar - inline */}
            <div className="flex-1 max-w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-blue-600'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className={`text-sm font-medium ${isComplete ? 'text-green-600' : 'text-blue-600'}`}>
              {progressPercent}%
            </span>
          </div>

          {/* Dismiss button - only show when complete */}
          {isComplete && onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* URL Status List - compact */}
        <div className="mt-2 flex flex-wrap gap-2">
          {progress.urls.map((urlProgress) => (
            <UrlBadge key={urlProgress.id} urlProgress={urlProgress} />
          ))}
        </div>
      </div>
    </div>
  );
}

function UrlBadge({ urlProgress }: { urlProgress: UrlProgress }) {
  const getStatusStyle = () => {
    switch (urlProgress.status) {
      case 'pending':
        return 'bg-gray-100 text-gray-600';
      case 'running':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
    }
  };

  const getStatusIcon = () => {
    switch (urlProgress.status) {
      case 'pending':
        return <Clock className="w-3 h-3" />;
      case 'running':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3" />;
      case 'failed':
        return <XCircle className="w-3 h-3" />;
    }
  };

  const hasScores = urlProgress.status === 'completed' && urlProgress.scores;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle()}`}>
      {getStatusIcon()}
      <span>{urlProgress.name}</span>
      {hasScores && (
        <span className="text-xs opacity-75">
          P:{urlProgress.scores?.performance ?? '-'}
        </span>
      )}
    </div>
  );
}
