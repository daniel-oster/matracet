import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/paper.css'
import './laget.css'
import LagetApp from './LagetApp'
import ToastHost from '../components/ToastHost'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { LAGET_PUSH, registerServiceWorker } from '../lib/push'

registerServiceWorker(LAGET_PUSH)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LagetApp />
      <ToastHost />
    </ErrorBoundary>
  </StrictMode>,
)
