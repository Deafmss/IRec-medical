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
 *
 * Estilo: `style` inline e variáveis CSS, como o resto do projeto. A versão
 * anterior deste arquivo estava escrita em classes utilitárias do Tailwind, que
 * **não existe neste projeto** — não está no package.json, não há
 * tailwind.config, não há @tailwind no CSS. Medido no navegador, todas as
 * classes eram inertes: `display: block` em vez de flex, `min-height: 0px` em
 * vez de 100vh, fundo transparente, botão com o cinza padrão do navegador. A
 * tela que o usuário vê quando algo já deu errado aparecia crua.
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
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          boxSizing: 'border-box',
          backgroundColor: 'var(--bg-primary, #0f172a)',
          fontFamily: 'var(--font-primary, system-ui, sans-serif)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: 'var(--bg-secondary, #1e293b)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
            borderRadius: '20px',
            padding: '32px 28px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg, 0 20px 40px rgba(0,0,0,0.35))',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 20px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(2, 132, 199, 0.12)',
              fontSize: '28px',
            }}
          >
            ⚠️
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: '19px',
              fontWeight: 700,
              color: 'var(--text-primary, #f1f5f9)',
              fontFamily: 'var(--font-display, inherit)',
            }}
          >
            Algo não carregou como esperado
          </h1>

          <p
            style={{
              margin: '10px 0 0',
              fontSize: '13.5px',
              lineHeight: 1.6,
              color: 'var(--text-secondary, #94a3b8)',
            }}
          >
            Esta tela foi interrompida por um erro. O que você já havia salvo continua
            no seu prontuário, mas <strong>informação digitada e ainda não salva foi
            perdida</strong>. Você pode tentar de novo ou voltar ao início.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '10px',
              marginTop: '26px',
            }}
          >
            <button
              type="button"
              onClick={this.tentarNovamente}
              style={{
                backgroundColor: 'var(--primary, #0284c7)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '11px 20px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Tentar novamente
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = '/';
              }}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-secondary, #cbd5e1)',
                border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                borderRadius: '10px',
                padding: '11px 20px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Ir para o início
            </button>
          </div>

          {import.meta.env.DEV && (
            <pre
              style={{
                marginTop: '22px',
                padding: '12px',
                borderRadius: '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                color: '#fda4af',
                fontSize: '11.5px',
                textAlign: 'left',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.erro.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
