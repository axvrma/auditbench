import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Audit } from "../lib/api";
import { categories } from "./ScoreCards";
import { Empty, timestamp } from "./ui";
export function ScoreChart({
  audits,
  onSelect,
}: {
  audits: Audit[];
  onSelect: (audit: Audit) => void;
}) {
  const [category, setCategory] = useState("all");
  const data = [...audits]
    .filter((a) => a.status === "completed")
    .reverse()
    .slice(-1000);
  return (
    <section className="panel trends">
      <header>
        <div>
          <p className="eyebrow">THE BIGGER PICTURE</p>
          <h2>Performance over time</h2>
        </div>
        <select
          aria-label="Trend category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </header>
      {data.length < 2 ? (
        <Empty title="Your next run starts a trend">
          Complete two audits of this website to compare measured scores.
        </Empty>
      ) : (
        <>
          <div
            className="chart"
            role="img"
            aria-label="Lighthouse category scores over time. Select an audit in the history below for exact values."
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                onClick={(state) => {
                  if (
                    state?.activeTooltipIndex != null &&
                    data[state.activeTooltipIndex]
                  )
                    onSelect(data[state.activeTooltipIndex]);
                }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--line)"
                  strokeDasharray="3 4"
                />
                <XAxis
                  dataKey="created_at"
                  tickFormatter={(v) =>
                    new Date(
                      v.includes("T") ? v : v.replace(" ", "T") + "Z",
                    ).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  minTickGap={40}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  labelFormatter={(value) => timestamp(String(value))}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                  }}
                />
                {categories
                  .filter(([key]) => category === "all" || key === category)
                  .map(([key, label, color]) => (
                    <Line
                      key={key}
                      type="linear"
                      dataKey={key}
                      name={label}
                      stroke={color}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            {categories.map(([key, label, color]) => (
              <button
                key={key}
                aria-pressed={category === key}
                onClick={() => setCategory(category === key ? "all" : key)}
              >
                <i style={{ background: color }} />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
