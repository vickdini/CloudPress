import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { openExternalUrl } from './utils'

// Intercept all external web links to open in the user's default browser
document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement)?.closest('a');
  if (target && target.href && (target.href.startsWith('http://') || target.href.startsWith('https://'))) {
    e.preventDefault();
    openExternalUrl(target.href);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
