import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from './ErrorBoundary.jsx';

function ComponenteQueQuebra({ quebrar }) {
  if (quebrar) throw new Error('falha simulada de renderizacao');
  return <p>conteudo normal</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // O React loga o erro capturado no console. Silenciado para nao
    // poluir a saida do teste — o comportamento testado e o fallback.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza os filhos quando nao ha erro', () => {
    render(
      <ErrorBoundary>
        <ComponenteQueQuebra quebrar={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('conteudo normal')).toBeInTheDocument();
  });

  it('exibe a tela de fallback quando um filho lanca erro', () => {
    render(
      <ErrorBoundary>
        <ComponenteQueQuebra quebrar={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Algo nao carregou como esperado|Algo não carregou como esperado/)).toBeInTheDocument();
  });

  it('nao vaza a mensagem tecnica do erro para o usuario final', () => {
    render(
      <ErrorBoundary>
        <ComponenteQueQuebra quebrar={true} />
      </ErrorBoundary>,
    );

    // Em DEV a mensagem aparece no bloco de depuracao; o que nao pode
    // acontecer e ela virar o texto principal apresentado ao usuario.
    const titulo = screen.getByRole('heading');
    expect(titulo.textContent).not.toContain('falha simulada');
  });

  it('oferece acao de recuperacao ao usuario', async () => {
    render(
      <ErrorBoundary>
        <ComponenteQueQuebra quebrar={true} />
      </ErrorBoundary>,
    );

    const botao = screen.getByRole('button', { name: /tentar novamente/i });
    expect(botao).toBeInTheDocument();

    // O clique limpa o estado de erro. O filho volta a lancar, entao a
    // tela de fallback permanece — o que se verifica aqui e que o botao
    // esta ligado e nao quebra a aplicacao.
    await userEvent.click(botao);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('nao usa classes do Tailwind, que nao existe neste projeto', () => {
    render(
      <ErrorBoundary>
        <ComponenteQueQuebra quebrar={true} />
      </ErrorBoundary>,
    );

    // Todo o arquivo estava escrito em utilitarios do Tailwind. Sem Tailwind no
    // projeto, as classes eram inertes: display block, min-height 0, fundo
    // transparente, botao com o cinza padrao do navegador.
    const alerta = screen.getByRole('alert');
    const comClasse = alerta.querySelectorAll('[class]');
    expect(alerta.getAttribute('class')).toBeNull();
    expect(comClasse.length).toBe(0);
  });

  it('estiliza o container por style inline, como o resto do projeto', () => {
    render(
      <ErrorBoundary>
        <ComponenteQueQuebra quebrar={true} />
      </ErrorBoundary>,
    );

    const alerta = screen.getByRole('alert');
    expect(alerta.style.display).toBe('flex');
    expect(alerta.style.minHeight).toBe('100vh');
    expect(alerta.style.backgroundColor).not.toBe('');
  });

  it('nao afirma que nenhum dado foi perdido', () => {
    render(
      <ErrorBoundary>
        <ComponenteQueQuebra quebrar={true} />
      </ErrorBoundary>,
    );

    // A versao anterior dizia "Nenhum dado seu foi perdido" — falso: um crash
    // no meio do formulario de triagem perde tudo que estava digitado.
    expect(screen.queryByText(/Nenhum dado seu foi perdido/i)).toBeNull();
    expect(screen.getByText(/ainda n[aã]o salva foi/i)).toBeInTheDocument();
  });
});
