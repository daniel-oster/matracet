import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/paper.css'
import './livet.css'
import LivetApp from './LivetApp'
import { ErrorBoundary } from '../components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LivetApp />
    </ErrorBoundary>
  </StrictMode>,
)
