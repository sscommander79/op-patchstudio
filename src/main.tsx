import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/carbon.scss'
import './index.css'
import App from './App.tsx'
import { markDocumentBuild } from './utils/buildIdentity'

// Lets tests and people confirm which build a tab is actually running.
markDocumentBuild()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
