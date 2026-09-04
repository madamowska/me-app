import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import './WeeklyDistanceChart.css'

export default function WeeklyDistanceChart({ weeks = 10, initialSport = 'running' }) {
  const [sport, setSport] = useState(initialSport)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        if (!supabase) {
          throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in your .env file.')
        }

        const { data, error: rpcError } = await supabase.rpc('weekly_distance', { sport, weeks })
        if (rpcError) throw rpcError

        const mapped = (Array.isArray(data) ? data : []).map((r) => {
          const weekStart = r.week_start || r.weekStart || r.week || ''
          const distance = r.distance_km ?? r.distance ?? r.distanceKm ?? 0
          return { weekStart, distance: Number(distance || 0) }
        })

        if (!cancelled) setData(mapped)
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [sport, weeks])

  const width = 500
  const height = 160
  const padding = { top: 10, right: 12, bottom: 28, left: 36 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  let points = []
  let max = 1
  if (Array.isArray(data) && data.length > 0) {
    max = Math.max(...data.map((d) => Number(d.distance) || 0))
    if (max === 0) max = 1
    points = data.map((d, i) => {
      const x = padding.left + (i / Math.max(1, data.length - 1)) * innerW
      const y = padding.top + (1 - (Number(d.distance) || 0) / max) * innerH
      const chartLabel = d.weekStart ? new Date(d.weekStart).toLocaleDateString('en-US', { month: 'short' }) : ''
      return { x, y, label: chartLabel, value: Number(d.distance) || 0 }
    })
  }

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')

  return (
    <div className="weekly-distance-chart last-activity-card" aria-label="Weekly distance chart">
      <div className="weekly-distance-header">
        <h4 className="weekly-distance-title">Weekly distance</h4>
        <select
          className="weekly-distance-select"
          value={sport}
          onChange={(e) => setSport(e.target.value)}
        >
          <option value="running">Running</option>
          <option value="cycling">Cycling</option>
          <option value="walking">Walking</option>
        </select>
      </div>

      <div className="weekly-distance-content">
        {loading && <div className="weekly-distance-loading">Loading...</div>}
        {error && <div className="weekly-distance-error">Error: {error}</div>}

        {!loading && !error && (!points || points.length === 0) && (
          <div className="weekly-distance-empty">No data</div>
        )}

        {!loading && !error && points && points.length > 0 && (
          <svg className="weekly-distance-svg" width={width} height={height} role="img" aria-label="Weekly distance">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = padding.top + (1 - t) * innerH
              const value = Math.round(t * max)
              return (
                <g key={t}>
                  <line className="weekly-distance-grid" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
                  <text className="weekly-distance-axis-text" x={padding.left - 8} y={y + 4} textAnchor="end">
                    {value}
                  </text>
                </g>
              )
            })}

            {points.map((p, i) => (
              <g key={i} transform={`translate(${p.x}, ${height - padding.bottom + 14})`}>
                <text className="weekly-distance-axis-text" x={0} y={0} textAnchor="middle">
                  {p.label}
                </text>
              </g>
            ))}

            <path className="weekly-distance-line" d={pathD} />
            {points.map((p, i) => (
              <g key={i}>
                <circle className="weekly-distance-point" cx={p.x} cy={p.y} r={3} />
                <title>{`${p.label}: ${p.value} km`}</title>
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  )
}
