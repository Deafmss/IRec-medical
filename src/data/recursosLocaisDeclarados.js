// @ts-check
/**
 * Recursos de saúde declarados manualmente, para regiões com cobertura
 * incompleta no OpenStreetMap.
 *
 * POR QUE ISTO EXISTE COMO ARQUIVO SEPARADO
 *
 * Esta lista estava embutida em `locationService.js`, no meio da função que
 * busca recursos próximos, e era injetada como resultado real para qualquer
 * usuário dentro de 12 km — nome, endereço e telefone. Numa emergência, um
 * telefone desatualizado ou um endereço antigo manda o paciente para o lugar
 * errado. Dado clínico crítico versionado como código-fonte, sem data e sem
 * origem declarada.
 *
 * Aqui é declarado, datado e com origem. A interface exibe a data de
 * verificação junto com o resultado, para o paciente saber o que está vendo.
 *
 * REGRA: `verificadoEm` tem de ser reconferido a cada 6 meses. A checagem
 * REC-1 em `scripts/verificar-catalogo.mjs` reprova o build quando a data
 * passa de 180 dias.
 *
 * A correção definitiva é mover isto para uma tabela no Supabase, para dar
 * para arrumar um telefone sem fazer deploy. Enquanto não houver, o arquivo
 * datado é o mínimo aceitável.
 */

/** Última conferência da lista abaixo. Formato ISO, AAAA-MM-DD. */
export const VERIFICADO_EM = '2026-08-21';

/** De onde a informação veio. */
export const FONTE = 'Levantamento local da equipe iRec (nao verificado junto ao CNES)';

/** Prazo para reconferência, em dias. */
export const VALIDADE_DIAS = 180;

export const RECURSOS_DECLARADOS = [
  {
    cidade: 'Itapuranga',
    estado: 'GO',
    centro: { lat: -15.5605889, lon: -49.9489571 },
    raioKm: 12,
    hospitais: [
    {
      id: 'itapuranga_hosp_sf',
      name: 'Hospital São Francisco',
      lat: -15.562111,
      lon: -49.949483,
      address: 'Rua João do Couto Rosa, 249, Centro - Itapuranga/GO',
      phone: '(62) 3312-1154'
    },
    {
      id: 'itapuranga_hosp_muni',
      name: 'Hospital Municipal de Itapuranga (HMI)',
      lat: -15.564264,
      lon: -49.947838,
      address: 'Av. Olavo Bilac Marinho, 645, Centro - Itapuranga/GO',
      phone: '(62) 3312-1190'
    },
    {
      id: 'itapuranga_hosp_sc',
      name: 'Hospital Santa Casa do Povo',
      lat: -15.560800,
      lon: -49.937400,
      address: 'Av. Agoncílio da Silva Moreira, S/N, Parque Alvorada - Itapuranga/GO',
      phone: '(62) 3312-1200'
    }
    ],
    farmacias: [
    {
      id: 'itapuranga_pharm_nr1',
      name: 'Drogarias Nossa Rede (São Pedro)',
      lat: -15.561260,
      lon: -49.947018,
      address: 'Rua 48, 1020, Centro - Itapuranga/GO',
      phone: '(62) 3312-1500'
    },
    {
      id: 'itapuranga_pharm_fil',
      name: 'Drogaria Filadélfia',
      lat: -15.562400,
      lon: -49.948500,
      address: 'Rua 45, 899, Centro - Itapuranga/GO',
      phone: '(62) 3312-1800'
    },
    {
      id: 'itapuranga_pharm_sp',
      name: 'Farmácia São Pedro',
      lat: -15.561900,
      lon: -49.947800,
      address: 'Rua 45, 1668, Centro - Itapuranga/GO',
      phone: '(62) 3312-2000'
    }
    ]
  }
];

/** Dias desde a última conferência. */
export const diasDesdeVerificacao = (hoje = new Date()) => {
  const ref = new Date(VERIFICADO_EM + 'T00:00:00Z');
  return Math.floor((hoje.getTime() - ref.getTime()) / 86400000);
};

/** Verdadeiro quando a lista passou do prazo de reconferência. */
export const estaVencido = (hoje = new Date()) => diasDesdeVerificacao(hoje) > VALIDADE_DIAS;
