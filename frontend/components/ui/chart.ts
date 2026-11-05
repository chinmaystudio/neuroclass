/**
 * Chart colours and tooltip styling from the design tokens (they switch with
 * the theme). Use with Recharts: <Bar fill={CHART.primary} />.
 */
export const CHART = {
  primary: 'var(--nc-primary)',
  success: 'var(--nc-success)',
  warning: 'var(--nc-warning)',
  danger: 'var(--nc-danger)',
  neutral: 'var(--nc-ink-3)',
  grid: 'var(--nc-line-2)',
  axis: 'var(--nc-ink-2)',
  /** Ordered series palette: blue, green, amber, red, grey. */
  series: ['var(--nc-primary)', 'var(--nc-success)', 'var(--nc-warning)', 'var(--nc-danger)', 'var(--nc-ink-3)'],
  tooltip: {
    contentStyle: { background: 'var(--nc-surface)', border: '1px solid var(--nc-line)', borderRadius: 8, color: 'var(--nc-ink)', fontSize: 13, boxShadow: 'var(--shadow-raised)' },
    labelStyle: { color: 'var(--nc-ink)', fontWeight: 600 },
    itemStyle: { color: 'var(--nc-ink-2)' },
    cursor: { fill: 'var(--nc-surface-2)' },
  },
  tick: { fontSize: 12, fill: 'var(--nc-ink-2)' },
} as const;
