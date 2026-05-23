import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import SysdocApp from './components/sysdoc/SysdocApp'
import './components/sysdoc/sysdoc.css'

const container = document.getElementById('sysdoc-root')!
const app = <StrictMode><SysdocApp /></StrictMode>

// Use hydrateRoot when the server has pre-rendered content (production build),
// createRoot in dev where the container starts empty.
if (container.hasChildNodes()) {
  hydrateRoot(container, app)
} else {
  createRoot(container).render(app)
}
