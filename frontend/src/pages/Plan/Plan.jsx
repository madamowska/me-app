import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import {
  getWorkoutPlans,
  setCurrentWorkoutPlan,
} from '../../features/plan/api'
import './Plan.css'

function formatWeek(weekStart, weekEnd) {
  const start = new Date(`${weekStart}T00:00:00Z`)
  const end = new Date(`${weekEnd}T00:00:00Z`)
  const dateOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' }
  return `${start.toLocaleDateString(undefined, dateOptions)} – ${end.toLocaleDateString(undefined, {
    ...dateOptions,
    year: 'numeric',
  })}`
}

export default function Plan() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuFocused, setMenuFocused] = useState(false)
  const [selectingPlanId, setSelectingPlanId] = useState(null)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getWorkoutPlans()
      .then((loadedPlans) => {
        if (!cancelled) setPlans(loadedPlans)
      })
      .catch((error) => {
        if (!cancelled && error.status !== 503) {
          setMessage(error.message || 'Could not load saved plans.')
          setIsError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSetCurrent(planId) {
    setSelectingPlanId(planId)
    setMessage('')
    setIsError(false)
    try {
      const currentPlan = await setCurrentWorkoutPlan(planId)
      setPlans((current) => current.map((plan) => ({
        ...plan,
        is_current: plan.id === currentPlan.id,
      })))
    } catch (error) {
      setMessage(error.message || 'Could not set the current plan.')
      setIsError(true)
    } finally {
      setSelectingPlanId(null)
    }
  }

  return (
    <main className="plan-page">
      <div className="plan-page-shell">
        <header className="plan-page-header plan-list-page-header">
          <p className="plan-eyebrow">Training</p>
          <h1>Plan</h1>
        </header>

        <section className="saved-plans" aria-labelledby="saved-plans-title">
          <div className="plan-section-heading">
            <h2 id="saved-plans-title">Saved plans</h2>
          </div>
          {message && (
            <p className={`plan-message${isError ? ' plan-message--error' : ''}`} role={isError ? 'alert' : 'status'}>
              {message}
            </p>
          )}
          {loading ? (
            <p className="saved-plans-empty" role="status">Loading saved plans…</p>
          ) : plans.length === 0 ? (
            <p className="saved-plans-empty">No saved plans.</p>
          ) : (
            <div className="saved-plan-list">
              {plans.map((plan) => (
                <article className={`saved-plan-card${plan.is_current ? ' saved-plan-card--current' : ''}`} key={plan.id}>
                  <div className="saved-plan-info">
                    <div className="saved-plan-title-row">
                      <h3>{plan.title}</h3>
                      {plan.is_current && <span className="saved-plan-badge">Current</span>}
                    </div>
                    <p>{formatWeek(plan.week_start, plan.week_end)}</p>
                    <p className="saved-plan-summary">{plan.plan_data?.summary || 'No overview added.'}</p>
                  </div>
                  <div className="saved-plan-actions">
                    <Button
                      onClick={() => navigate(`/plan/create?planId=${encodeURIComponent(plan.id)}`)}
                      disabled={selectingPlanId !== null}
                    >
                      Edit
                    </Button>
                    {!plan.is_current && (
                      <Button
                        variant="accent"
                        onClick={() => handleSetCurrent(plan.id)}
                        disabled={selectingPlanId !== null}
                      >
                        {selectingPlanId === plan.id ? 'Setting…' : 'Set as current'}
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div
        className={`plan-create-menu${menuOpen ? ' plan-create-menu--open' : ''}`}
        onMouseEnter={() => setMenuOpen(true)}
        onMouseLeave={() => setMenuOpen(false)}
        onFocusCapture={() => setMenuFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setMenuFocused(false)
        }}
      >
        <div className="plan-create-options" role="menu">
          <button type="button" role="menuitem" onClick={() => navigate('/plan/create?mode=manual')}>
            Create manually
          </button>
          <button type="button" role="menuitem" onClick={() => navigate('/plan/create?mode=generate')}>
            Generate with LM Studio
          </button>
        </div>
        <button
          type="button"
          className="plan-create-trigger"
          aria-label="Add workout plan"
          aria-expanded={menuOpen || menuFocused}
          aria-haspopup="menu"
          onClick={() => setMenuOpen(true)}
        >
          +
        </button>
      </div>
    </main>
  )
}
