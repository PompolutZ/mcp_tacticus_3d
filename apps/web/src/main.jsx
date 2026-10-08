import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useGLTF } from '@react-three/drei'
import './index.css'
import Root from './Root.jsx'

// Draco decoder is served from public/draco, not from the default Google CDN
useGLTF.setDecoderPath('/draco/')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
