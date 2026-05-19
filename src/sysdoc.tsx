import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import SysdocApp from './components/sysdoc/SysdocApp'
import './components/sysdoc/sysdoc.css'

createRoot(document.getElementById('sysdoc-root')!).render(
  <StrictMode>
    <SysdocApp />
  </StrictMode>
)
