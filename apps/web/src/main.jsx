import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.jsx'
import { installErrorListeners } from './crash/errors.js'
import { startErrorReporter } from './crash/reporter.js'

installErrorListeners()
startErrorReporter()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
