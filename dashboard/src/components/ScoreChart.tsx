import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getAuditHistory } from '../lib/api';
import { format } from 'date-fns';

interface ScoreChartProps {
  urlId: string;
}

interface ChartData {
  date: string;
  fullDate: string;
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
}

export function ScoreChart({ urlId }: ScoreChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const audits = await getAuditHistory(urlId);
        
        const chartData: ChartData[] = audits.map((audit) => ({
          date: format(new Date(audit.created_at), 'MMM d'),
          fullDate: format(new Date(audit.created_at), 'PPp'),
          performance: audit.performance_score,
          accessibility: audit.accessibility_score,
          bestPractices: audit.best_practices_score,
          seo: audit.seo_score,
        }));
        setData(chartData);
      } catch (error) {
        console.error('Failed to load audit history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [urlId]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        Not enough data for chart (need at least 2 audits)
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''}
          />
          <Legend wrapperStyle={{ paddingTop: '16px' }} iconType="circle" iconSize={8} />
          <Line type="monotone" dataKey="performance" name="Performance" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} />
          <Line type="monotone" dataKey="accessibility" name="Accessibility" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
          <Line type="monotone" dataKey="bestPractices" name="Best Practices" stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7', r: 3 }} />
          <Line type="monotone" dataKey="seo" name="SEO" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
