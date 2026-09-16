import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './polyfills'
import './index.css'
import App from './App.tsx'
import ParticleProvider from './wallet/ParticleProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ParticleProvider>
      <App />
    </ParticleProvider>
  </StrictMode>,
)
