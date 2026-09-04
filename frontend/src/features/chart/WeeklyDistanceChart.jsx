import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import './WeeklyDistanceChart.css'

export default function WeeklyDistanceChart({ weeks = 11, initialSport = 'running' }) {
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

        const { data, error: rpcError } = await supabase.rpc('weekly_distance_wrapper', { sport, weeks })
        if (rpcError) throw rpcError

        console.debug('WeeklyDistanceChart rpc raw', { sport, weeks, raw: data })

        console.debug('WeeklyDistanceChart env', {
          SUPABASE_URL: import.meta.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY_MASKED: (import.meta.env.SUPABASE_PUBLISHABLE_KEY || '').replace(/.(?=.{4})/g, '*')
        })

        const mapped = (Array.isArray(data) ? data : []).map((r) => {
          const weekStartRaw = r.week_start ?? r.weekStart ?? r.week ?? ''
          let weekStart = ''
          try {
            const d = new Date(weekStartRaw)
            weekStart = (!Number.isNaN(d) && d.toString() !== 'Invalid Date') ? d.toISOString().split('T')[0] : String(weekStartRaw)
          } catch (e) {
            weekStart = String(weekStartRaw)
          }

          const distanceRaw = r.distance_km ?? r.distance ?? r.distanceKm ?? 0
          let distance = 0
          if (typeof distanceRaw === 'string') {
            const cleaned = distanceRaw.replace(/,/g, '')
            distance = parseFloat(cleaned) || 0
          } else if (typeof distanceRaw === 'number') {
            distance = distanceRaw
          } else {
            distance = Number(distanceRaw) || 0
          }

          return { weekStart, distance: Number.isFinite(distance) ? distance : 0 }
        })

        if (!cancelled) setData(mapped)

        console.debug('WeeklyDistanceChart mapped', { sport, weeks, mapped })
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
    const distances = data.map((d) => (typeof d.distance === 'number' ? d.distance : parseFloat(d.distance) || 0))
    max = Math.max(...distances)
    if (!Number.isFinite(max) || max === 0) max = 0
    points = data.map((d, i) => {
      const value = typeof d.distance === 'number' ? d.distance : parseFloat(d.distance) || 0
      const x = padding.left + (i / Math.max(1, data.length - 1)) * innerW
      const y = padding.top + (max > 0 ? (1 - value / max) * innerH : padding.top + innerH / 2)
      const chartLabel = d.weekStart ? new Date(d.weekStart).toLocaleDateString('en-US', { month: 'short' }) : ''
      return { x, y, label: chartLabel, value }
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

        {!loading && !error && points && points.length > 0 && (() => {
          const allZero = points.every((p) => p.value === 0)
          if (allZero) {
            return (
              <div style={{ marginTop: 8, color: 'var(--color-text-muted)', fontSize: 12 }}>
                <div>Data appears to be all zeros — raw values:</div>
                <pre style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{JSON.stringify(data, null, 2)}</pre>
              </div>
            )
          }
          return null
        })()}

        {!loading && !error && points && points.length > 0 && (
          <svg className="weekly-distance-svg" width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weekly distance">
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

            {(() => {
              const groups = {}
              points.forEach((p) => {
                const k = p.label || ''
                if (!groups[k]) groups[k] = { xs: [], label: k }
                groups[k].xs.push(p.x)
              })
              const orderedKeys = []
              points.forEach((p) => {
                if (!orderedKeys.includes(p.label)) orderedKeys.push(p.label)
              })
              return orderedKeys.map((k, idx) => {
                if (!k) return null
                const xs = groups[k].xs
                const avgX = xs.reduce((a, b) => a + b, 0) / xs.length
                return (
                  <g key={`lab-${k}-${idx}`} transform={`translate(${avgX}, ${height - padding.bottom + 20})`}>
                    <text className="weekly-distance-axis-text" x={0} y={0} textAnchor="middle">
                      {k}
                    </text>
                  </g>
                )
              })
            })()}

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
