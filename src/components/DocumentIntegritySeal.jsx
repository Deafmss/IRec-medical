import { LEGAL_NOTICE_NO_ICP } from '../services/documentIntegrity';

/**
 * Rodapé de autenticidade do documento clínico impresso.
 *
 * Substitui dois blocos duplicados e divergentes — um em DoctorDashboard, outro
 * em PatientDocuments — que afirmavam:
 *
 *   "🛡️ ASSINATURA DIGITAL VALIDADA (ICP-BRASIL)
 *    Este documento foi assinado eletronicamente por Dr(a). X utilizando
 *    infraestrutura de chaves públicas credenciada pela Medida Provisória
 *    nº 2.200-2/2001."
 *
 * Nada disso acontecia. Não havia chave privada, certificado, PKCS#7 nem cadeia
 * de confiança — só um resumo SHA-256 do conteúdo, mais um número de série e uma
 * autoridade certificadora inventados. Invocar a MP 2.200-2 num documento que
 * não passou por certificado é declaração falsa num documento médico.
 *
 * O que sobrou é o que existe de verdade: um selo interno de integridade, com o
 * aviso de que o documento NÃO tem valor legal de assinatura digital.
 */
export default function DocumentIntegritySeal({ doc }) {
  const conteudo = doc?.content || {};
  // `isIntegritySealed` é o campo novo; `isSigned` é o antigo, mantido na
  // leitura para os documentos já emitidos continuarem exibindo o selo.
  const selado = Boolean(conteudo.isIntegritySealed ?? conteudo.isSigned);
  const hash = conteudo.integrity?.hash || conteudo.signatureDetails?.hash || null;

  return (
    <div style={{ fontSize: '11px', lineHeight: 1.45, color: '#4b5563' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 'bold',
          fontSize: '11px',
          marginBottom: '4px',
          color: '#b45309'
        }}
      >
        <span aria-hidden="true">⚠️</span> DOCUMENTO SEM ASSINATURA DIGITAL ICP-BRASIL
      </div>

      {LEGAL_NOTICE_NO_ICP}

      {selado && hash && (
        <div style={{ marginTop: '4px' }}>
          Selo interno de integridade (resumo SHA-256 do conteúdo, para detectar
          alteração posterior):
          <div
            style={{
              fontFamily: 'monospace',
              fontWeight: 'bold',
              color: '#1f2937',
              marginTop: '2px',
              wordBreak: 'break-all'
            }}
          >
            {hash}
          </div>
        </div>
      )}

      {selado && !hash && (
        <div style={{ marginTop: '4px' }}>
          O selo de integridade não pôde ser calculado neste documento.
        </div>
      )}
    </div>
  );
}
