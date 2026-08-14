import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/** Catches any render-time exception in the tree below it (there was previously no error
 *  boundary anywhere in the app, so any such exception unmounted straight to a white screen —
 *  see docs/quality-review-2026-08.md, finding F4). The reload button appends the same
 *  `?_r=<timestamp>` cache-buster Hub.hardRefresh() uses, since a home-screen-installed PWA
 *  can be serving a stale bundle that reliably re-triggers the same crash (see CLAUDE.md's
 *  "iOS Add to Home Screen" lesson) — a plain reload alone wouldn't escape that. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[matracet] uncaught render error:', error, info.componentStack)
  }

  handleReload = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('_r', Date.now().toString())
    window.location.href = url.toString()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-loading app-load-error">
          <p>Något gick fel. Ladda om appen.</p>
          <button type="button" onClick={this.handleReload}>Ladda om</button>
        </div>
      )
    }
    return this.props.children
  }
}
