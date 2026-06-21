import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ShopifyAppProvider } from './components/ShopifyAppProvider'
import App from './App'
import EmbeddedApp from './components/EmbeddedApp'
import './styles.css'

const params = new URLSearchParams(window.location.search)
const isEmbedded = !!(params.get('shop') && params.get('host'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isEmbedded ? (
      <EmbeddedApp />
    ) : (
      <BrowserRouter>
        <ShopifyAppProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ShopifyAppProvider>
      </BrowserRouter>
    )}
  </React.StrictMode>,
)
