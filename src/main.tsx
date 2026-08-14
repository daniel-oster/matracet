import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/paper.css'
import App from './App'
import ToastHost from './components/ToastHost'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <ToastHost />
    </ErrorBoundary>
  </StrictMode>,
)
