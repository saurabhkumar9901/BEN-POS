"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "#fbf9f3",
  border: "1px solid #11120f",
  borderRadius: 0,
  fontSize: 12,
  fontFamily: "monospace",
};

export function DepoMixChart({ cdslQty, nsdlQty }: { cdslQty: number; nsdlQty: number }) {
  const data = [
    { name: "CDSL", value: Number(cdslQty) || 0 },
    { name: "NSDL", value: Number(nsdlQty) || 0 },
  ];
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="#11120f">
          <Cell fill="#ff7a3d" />
          <Cell fill="#5b7cff" />
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toLocaleString("en-IN"), "qty"]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ConcentrationChart({
  top10,
  top50,
  top100,
}: {
  top10: number;
  top50: number;
  top100: number;
}) {
  const data = [
    { band: "Top 10", pct: Number(top10) || 0 },
    { band: "Top 50", pct: Number(top50) || 0 },
    { band: "Top 100", pct: Number(top100) || 0 },
  ];
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#c9c4b8" />
        <XAxis dataKey="band" tick={{ fill: "#6f716a", fontSize: 12 }} />
        <YAxis tick={{ fill: "#6f716a", fontSize: 12 }} unit="%" />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [`${Number(v).toFixed(1)}%`, "share"]}
        />
        <Bar dataKey="pct" fill="#11120f" radius={0} />
      </BarChart>
    </ResponsiveContainer>
  );
}
