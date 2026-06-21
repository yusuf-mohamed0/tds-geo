import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Articles from './pages/Articles'
import ArticleDetail from './pages/ArticleDetail'
import Clients from './pages/Clients'
import Webhooks from './pages/Webhooks'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import ApiKeys from './pages/ApiKeys'
import Plugins from './pages/Plugins'
import Prompts from './pages/Prompts'
import ApiUsage from './pages/ApiUsage'
import Chat from './pages/Chat'
import Config from './pages/Config'
import Improvements from './pages/Improvements'
import Admin from './pages/Admin'
import EditorialWorkflow from './pages/EditorialWorkflow'
import PipelineDashboard from './pages/PipelineDashboard'
import BrandVoice from './pages/BrandVoice'
import FactChecking from './pages/FactChecking'
import CmsConnections from './pages/CmsConnections'
import CostOptimization from './pages/CostOptimization'
import Observability from './pages/Observability'
import WorkerPerformance from './pages/WorkerPerformance'
import QueueDashboard from './pages/QueueDashboard'
import ContentIntelligence from './pages/ContentIntelligence'
import AiEvaluation from './pages/AiEvaluation'
import Security from './pages/Security'
import Pexels from './pages/Pexels'
import ShopifyWelcome from './pages/ShopifyWelcome'
import CopywriterDashboard from './pages/CopywriterDashboard'
import OnboardShopify from './pages/OnboardShopify'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>
  }

  return (
    <ToastProvider>
    <Routes>
      <Route path="/welcome" element={<ShopifyWelcome />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="articles" element={<Articles />} />
        <Route path="articles/:id" element={<ArticleDetail />} />
        <Route path="pipeline" element={<PipelineDashboard />} />
        <Route path="editorial" element={<EditorialWorkflow />} />
        <Route path="copywriter" element={<CopywriterDashboard />} />
        <Route path="brand-voice" element={<BrandVoice />} />
        <Route path="fact-check" element={<FactChecking />} />
        <Route path="cms" element={<CmsConnections />} />
        <Route path="cost" element={<CostOptimization />} />
        <Route path="observability" element={<Observability />} />
        <Route path="worker-performance" element={<WorkerPerformance />} />
        <Route path="queue" element={<QueueDashboard />} />
        <Route path="content-intel" element={<ContentIntelligence />} />
        <Route path="evaluation" element={<AiEvaluation />} />
        <Route path="security" element={<Security />} />
        <Route path="pexels" element={<Pexels />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/onboard" element={<OnboardShopify />} />
        <Route path="webhooks" element={<Webhooks />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="api-usage" element={<ApiUsage />} />
        <Route path="settings" element={<Settings />} />
        <Route path="api-keys" element={<ApiKeys />} />
        <Route path="plugins" element={<Plugins />} />
        <Route path="prompts" element={<Prompts />} />
        <Route path="chat" element={<Chat />} />
        <Route path="config" element={<Config />} />
        <Route path="improvements" element={<Improvements />} />
        <Route path="admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ToastProvider>
  )
}
