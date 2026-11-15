import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AXIS = { stroke: "#4b5b8a", fontSize: 11 } as const;
const TIP = { contentStyle: { background: "#0a1230", border: "1px solid #2a3a78", borderRadius: 8, color: "#e6edf7" }, labelStyle: { color: "#9fb0d6" } } as const;

export interface Series {
  key: string;
  label: string;
  color: string;
  yAxisId?: "left" | "right";
}

type Row = Record<string, string | number | undefined>;

function Wrap({ label, height, children }: { label: string; height: number; children: React.ReactElement }) {
  // role=img + aria-label gives screen-reader users a summary; the History page offers the raw table.
  return (
    <div role="img" aria-label={label} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function TrendLines({ data, series, label, height = 220, domain }: { data: Row[]; series: Series[]; label: string; height?: number; domain?: [number | string, number | string] }) {
  const dual = series.some((s) => s.yAxisId === "right");
  return (
    <Wrap label={label} height={height}>
      <LineChart data={data} margin={{ top: 8, right: dual ? 8 : 12, left: -14, bottom: 0 }}>
        <CartesianGrid stroke="#1e2b5a" strokeDasharray="3 3" />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis yAxisId="left" domain={domain} {...AXIS} />
        {dual && <YAxis yAxisId="right" orientation="right" {...AXIS} />}
        <Tooltip {...TIP} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Line key={s.key} yAxisId={s.yAxisId ?? "left"} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </Wrap>
  );
}

export function TrendBars({ data, dataKey, name, color, label, height = 180 }: { data: Row[]; dataKey: string; name: string; color: string; label: string; height?: number }) {
  return (
    <Wrap label={label} height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
        <CartesianGrid stroke="#1e2b5a" strokeDasharray="3 3" />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} />
        <Tooltip {...TIP} />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </Wrap>
  );
}

export function Sparkline({ data, dataKey, color, label }: { data: Row[]; dataKey: string; color: string; label: string }) {
  return (
    <Wrap label={label} height={64}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#g-${dataKey})`} isAnimationActive={false} />
      </AreaChart>
    </Wrap>
  );
}
