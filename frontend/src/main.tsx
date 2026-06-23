import React from 'react'
import ReactDOM from 'react-dom/client'
import EmbeddedApp from './components/EmbeddedApp'
import './styles.css'
import './tds-theme.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EmbeddedApp />
  </React.StrictMode>,
)
