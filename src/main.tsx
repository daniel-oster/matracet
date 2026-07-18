import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/paper.css'
import App from './App'
import ToastHost from './components/ToastHost'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ToastHost />
  </StrictMode>,
)
