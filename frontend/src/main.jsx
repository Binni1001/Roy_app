import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { MutationIndicator } from './components/MutationIndicator.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MutationIndicator />
    <App />
  </StrictMode>,
)
