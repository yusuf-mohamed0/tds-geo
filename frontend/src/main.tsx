import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ShopifyAppProvider } from './components/ShopifyAppProvider'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ShopifyAppProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ShopifyAppProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
