import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.jsx'
import { installErrorListeners } from './crash/errors.js'
import { startErrorReporter } from './crash/reporter.js'
import { track } from './analytics/track.js'
import { playerColorVars } from './sideColors.js'
import { uiColorVars } from './uiColors.js'

installErrorListeners()
startErrorReporter()
track('app_open')
for (const [name, value] of Object.entries({ ...playerColorVars(), ...uiColorVars() })) {
  document.documentElement.style.setProperty(name, value)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
