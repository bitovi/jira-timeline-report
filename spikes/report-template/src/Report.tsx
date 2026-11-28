import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { loadRolledUp, type RolledUpIssue } from '@bitovi/report-sdk';

type Row = { key: string; summary: string; percent: number; due: string };

function toRow(issue: RolledUpIssue): Row {
  const { completedWorkingDays, totalWorkingDays } = issue.completionRollup;
  return {
    key: issue.key,
    summary: issue.summary,
    percent: totalWorkingDays ? Math.round((completedWorkingDays / totalWorkingDays) * 100) : 0,
    due: issue.rollupDates.due ? issue.rollupDates.due.toISOString().slice(0, 10) : '—',
  };
}

export function Report() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRolledUp('work')
      .then((issues) => {
        const initiatives = issues.filter((i) => i.type === 'Initiative').map(toRow);
        setRows(initiatives);
        document.body.dataset.rendered = String(initiatives.length);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        document.body.dataset.rendered = 'error';
      });
  }, []);

  if (error) return <p style={{ color: '#ae2a19' }}>Error: {error}</p>;
  if (!rows) return <p>Loading…</p>;

  return (
    <div style={{ font: '13px system-ui, sans-serif', padding: 12 }}>
      <h1 style={{ fontSize: 16 }}>Initiative progress ({rows.length})</h1>
      <BarChart width={640} height={260} data={rows}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="key" />
        <YAxis unit="%" domain={[0, 100]} />
        <Tooltip />
        <Bar dataKey="percent" fill="#0c66e4" isAnimationActive={false} />
      </BarChart>
      <table>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.key}</td>
              <td>{r.summary}</td>
              <td>{r.percent}%</td>
              <td>{r.due}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
