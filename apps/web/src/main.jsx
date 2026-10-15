import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.jsx'
import { installErrorListeners } from './crash/errors.js'
import { startErrorReporter } from './crash/reporter.js'
import { playerColorVars } from './sideColors.js'

installErrorListeners()
startErrorReporter()
for (const [name, value] of Object.entries(playerColorVars())) {
  document.documentElement.style.setProperty(name, value)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
