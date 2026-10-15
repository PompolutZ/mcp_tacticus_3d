import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.jsx'
import { installErrorListeners } from './crash/errors.js'
import { startErrorReporter } from './crash/reporter.js'
import { playerColorVars } from './sideColors.js'
import { uiColorVars } from './uiColors.js'

installErrorListeners()
startErrorReporter()
for (const [name, value] of Object.entries({ ...playerColorVars(), ...uiColorVars() })) {
  document.documentElement.style.setProperty(name, value)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
