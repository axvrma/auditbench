import type { Audit } from '../lib/api';
import { Gauge, Accessibility, Shield, Search, Smartphone } from 'lucide-react';

interface ScoreCardsProps {
  audit: Audit;
}

interface ScoreConfig {
  key: keyof Pick<Audit, 'performance_score' | 'accessibility_score' | 'best_practices_score' | 'seo_score' | 'pwa_score'>;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const SCORES: ScoreConfig[] = [
  { key: 'performance_score', label: 'Performance', icon: <Gauge className="w-6 h-6" />, description: 'Loading speed and responsiveness' },
  { key: 'accessibility_score', label: 'Accessibility', icon: <Accessibility className="w-6 h-6" />, description: 'Usability for all users' },
  { key: 'best_practices_score', label: 'Best Practices', icon: <Shield className="w-6 h-6" />, description: 'Web development standards' },
  { key: 'seo_score', label: 'SEO', icon: <Search className="w-6 h-6" />, description: 'Search engine optimization' },
  { key: 'pwa_score', label: 'PWA', icon: <Smartphone className="w-6 h-6" />, description: 'Progressive Web App features' },
];

export function ScoreCards({ audit }: ScoreCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {SCORES.map(({ key, label, icon, description }) => (
        <ScoreCard key={key} label={label} score={audit[key]} icon={icon} description={description} />
      ))}
    </div>
  );
}

function ScoreCard({ label, score, icon, description }: { label: string; score: number | null; icon: React.ReactNode; description: string }) {
  const getScoreColor = (score: number | null) => {
    if (score === null) return { bg: 'bg-gray-100', text: 'text-gray-400' };
    if (score >= 90) return { bg: 'bg-green-50', text: 'text-green-600' };
    if (score >= 50) return { bg: 'bg-orange-50', text: 'text-orange-600' };
    return { bg: 'bg-red-50', text: 'text-red-600' };
  };

  const colors = getScoreColor(score);
  const percentage = score ?? 0;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center">
      <div className="relative w-24 h-24 mb-3">
        <svg className="w-24 h-24 transform -rotate-90">
          <circle cx="48" cy="48" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="48"
            cy="48"
            r="40"
            fill="none"
            stroke={score === null ? '#9ca3af' : score >= 90 ? '#22c55e' : score >= 50 ? '#f97316' : '#ef4444'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${colors.text}`}>{score ?? '-'}</span>
        </div>
      </div>
      <div className={`p-2 rounded-lg ${colors.bg} mb-2`}>
        <span className={colors.text}>{icon}</span>
      </div>
      <h3 className="font-semibold text-gray-900 text-center">{label}</h3>
      <p className="text-xs text-gray-500 text-center mt-1">{description}</p>
    </div>
  );
}
