import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import DataFailureBanner from './components/DataFailureBanner.jsx';

// Initialize Sentry for proactive error monitoring only if a valid DSN is supplied
if (import.meta.env.VITE_SENTRY_DSN && !import.meta.env.VITE_SENTRY_DSN.includes('placeholder')) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.2,
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Fora do App: o aviso precisa aparecer também nas telas de carregamento,
          login e verificação, que têm returns antecipados. */}
      <DataFailureBanner />
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
