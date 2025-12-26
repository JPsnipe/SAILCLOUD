import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import './App.css'
import { BoatDetailPage } from './pages/BoatDetailPage'
import { BoatListPage } from './pages/BoatListPage'
import { PhotoMeasurePage } from './pages/PhotoMeasurePage'
import { ComparePage } from './pages/ComparePage'

function App() {
  const [appVersion, setAppVersion] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    window.sailcloud
      .ping()
      .then((res) => {
        if (!cancelled) setAppVersion(res.version)
      })
      .catch(() => {
        if (!cancelled) setAppVersion('')
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function preventDefault(e: DragEvent) {
      e.preventDefault()
    }

    window.addEventListener('dragover', preventDefault)
    window.addEventListener('drop', preventDefault)
    return () => {
      window.removeEventListener('dragover', preventDefault)
      window.removeEventListener('drop', preventDefault)
    }
  }, [])

  if (!window.sailcloud) {
    return (
      <div className="app-shell" style={{ display: 'grid', placeItems: 'center', height: '100vh', textAlign: 'center' }}>
        <div className="card">
          <h1 className="h1">Missing Electron Bridge</h1>
          <p className="muted">
            SailCloud requires the Electron environment to access your files and boat data.<br />
            Please run the application using <code>npm run dev</code> or <code>npm run proto</code>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="row">
          <Link to="/" className="app-title">SailCloud Desktop</Link>
          <nav className="app-nav">
            <Link to="/" className="app-nav-link">Boats</Link>
            <Link to="/compare" className="app-nav-link">Compare</Link>
          </nav>
        </div>
        {appVersion ? <div className="app-meta">v{appVersion}</div> : null}
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<BoatListPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/boats/:boatId" element={<BoatDetailPage />} />
          <Route path="/boats/:boatId/photos/:photoId" element={<PhotoMeasurePage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
