import { Component } from 'react';
import * as Sentry from '@sentry/react';

/**
 * Captura erros de renderização em toda a árvore abaixo dele.
 *
 * Sem isso, qualquer exceção durante o render derruba a aplicação inteira e o
 * usuário vê uma tela branca — sem mensagem, sem recuperação e sem registro.
 *
 * LGPD: este projeto manipula dado sensível de saúde. O relatório de erro envia
 * apenas a mensagem técnica e o componente de origem. Nunca inclua props,
 * estado ou qualquer conteúdo de tela, porque isso carregaria nome de paciente,
 * prontuário ou diagnóstico para fora da aplicação.
 */
class ErrorBoundary extends Component {
  state = { erro: null };

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    // Só a mensagem e a pilha de componentes. Nada de dado de tela.
    Sentry.captureException(erro, {
      tags: { boundary: this.props.nome ?? 'raiz' },
      extra: { componentStack: info?.componentStack },
    });
  }

  tentarNovamente = () => {
    this.setState({ erro: null });
  };

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div
        role="alert"
        className="flex min-h-screen items-center justify-center bg-[#070D18] px-4"
      >
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#0066FF]/10">
            <svg
              className="h-7 w-7 text-[#0066FF]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              />
            </svg>
          </div>

          <h1 className="text-xl font-semibold text-slate-100">
            Algo não carregou como esperado
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            A tela encontrou um problema e foi interrompida. Nenhum dado seu foi
            perdido. Você pode tentar de novo ou voltar ao início.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              onClick={this.tentarNovamente}
              className="rounded-lg bg-[#0066FF] px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#0066FF]/90 active:scale-[0.98]"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-300 transition-all duration-300 hover:border-[#0066FF]/50 hover:text-white active:scale-[0.98]"
            >
              Ir para o início
            </button>
          </div>

          {import.meta.env.DEV && (
            <pre className="mt-6 overflow-x-auto rounded-lg bg-black/40 p-3 text-left text-xs text-rose-300">
              {this.state.erro.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
