import { useState, useEffect } from 'react';
import { runAudit, getAuditStatus } from '../lib/api';
import { Play, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface RunAuditButtonProps {
  urlId?: string;
  moduleId?: string;
  moduleName?: string;
  onAuditComplete?: () => void;
}

export function RunAuditButton({ urlId, moduleId, moduleName, onAuditComplete }: RunAuditButtonProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string>('');

  // Poll for audit status
  useEffect(() => {
    if (status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const auditStatus = await getAuditStatus();
        
        if (auditStatus.total > 0) {
          setProgressText(`${auditStatus.completed}/${auditStatus.total}`);
        }
        
        if (!auditStatus.inProgress) {
          setStatus('success');
          setMessage('Audit completed!');
          onAuditComplete?.();
          setTimeout(() => {
            setStatus('idle');
            setMessage(null);
            setProgressText('');
          }, 2000);
        }
      } catch {
        // Server might be busy, keep polling
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status, onAuditComplete]);

  const triggerAudit = async () => {
    setStatus('running');
    setMessage('Starting audit...');
    setProgressText('');

    try {
      const result = await runAudit(urlId, moduleId);
      setProgressText(`0/${result.urls.length}`);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to start audit');
      setTimeout(() => {
        setStatus('idle');
        setMessage(null);
        setProgressText('');
      }, 3000);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={triggerAudit}
        disabled={status === 'running'}
        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
          status === 'running'
            ? 'bg-blue-100 text-blue-700 cursor-wait'
            : status === 'success'
            ? 'bg-green-100 text-green-700'
            : status === 'error'
            ? 'bg-red-100 text-red-700'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {status === 'running' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {progressText || 'Starting...'}
          </>
        ) : status === 'success' ? (
          <>
            <CheckCircle className="w-4 h-4" />
            Done
          </>
        ) : status === 'error' ? (
          <>
            <XCircle className="w-4 h-4" />
            Error
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Run Audit{moduleName ? ` (${moduleName})` : ''}
          </>
        )}
      </button>

      {message && status === 'error' && (
        <div className="absolute top-full left-0 mt-2 p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700 z-10 shadow-lg max-w-xs">
          {message}
        </div>
      )}
    </div>
  );
}
