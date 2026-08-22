import { forwardRef } from 'react'
import './Hero.css'

const Hero = forwardRef(function Hero({ onDashboardClick }, ref) {
  return (
    <section className="hero">
      <div className="orbit-system" ref={ref}>
        <div className="orbit orbit-1"></div>
        <div className="orbit orbit-2"></div>
        <div className="orbit orbit-3"></div>
        <div className="orbit orbit-4"></div>

        <button type="button" className="center-label" onClick={onDashboardClick}>
          me
        </button>
      </div>
    </section>
  )
})

export default Hero
