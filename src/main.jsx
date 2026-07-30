import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[iRec GlobalErrorBoundary] Erro global capturado:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏥</div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 8px 0' }}>iRec Saúde - Atendimento Clínico</h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '420px', margin: '0 0 20px 0' }}>
            O aplicativo se recuperou automaticamente. Clique abaixo para carregar sua sessão com segurança.
          </p>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.clear();
                window.location.reload();
              }
            }}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 28px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
            }}
          >
            🔄 INICIAR NOVA SESSÃO LIMPA
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
)
