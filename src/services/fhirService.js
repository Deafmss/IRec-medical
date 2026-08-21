import { getEntryDate } from '../utils/clinicalDate';

/**
 * FHIR/HL7 Service for iRec
 * Serializes database records into international standard FHIR JSON resources.
 */

/**
 * Maps a clinical profile to a FHIR Patient Resource
 * @param {Object} profile - The client-side clinical profile object
 * @returns {Object} FHIR Patient resource
 */
export const exportPatientToFHIR = (profile) => {
  if (!profile) return null;

  // Map gender
  let fhirGender = 'unknown';
  if (profile.gender) {
    const g = profile.gender.toLowerCase();
    if (g.includes('masc') || g === 'm') fhirGender = 'male';
    else if (g.includes('fem') || g === 'f') fhirGender = 'female';
    else fhirGender = 'other';
  }

  // Nome. A versao anterior fazia `familyName = nameParts[0]` e
  // `givenNames = nameParts.slice(1)`: "Maria Silva Santos" virava
  // family "Maria", given ["Silva","Santos"]. O sobrenome e o ULTIMO nome — e
  // essa inversao quebra exatamente a interoperabilidade que o FHIR existe para
  // prover.
  const nameParts = profile.name
    ? profile.name.trim().split(/\s+/).filter(Boolean)
    : ['Paciente'];
  const familyName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
  const givenNames = nameParts.length > 1 ? nameParts.slice(0, -1) : [];

  // Sem `identifier`, o recurso nao casa com nenhum sistema brasileiro — a RNDS
  // exige CNS, e o CPF e o identificador minimo. A versao anterior nao tinha
  // nenhum dos dois.
  const identifiers = [];
  const cpfDigits = String(profile.cpf || '').replace(/\D/g, '');
  if (cpfDigits.length === 11) {
    identifiers.push({
      use: "official",
      system: "https://estruturante.saude.gov.br/fhir/sid/cpf",
      value: cpfDigits
    });
  }
  const cnsDigits = String(profile.cns || '').replace(/\D/g, '');
  if (cnsDigits.length === 15) {
    identifiers.push({
      use: "official",
      system: "https://estruturante.saude.gov.br/fhir/sid/cns",
      value: cnsDigits
    });
  }

  const fhirPatient = {
    resourceType: "Patient",
    id: profile.id,
    identifier: identifiers.length > 0 ? identifiers : undefined,
    active: true,
    name: [
      {
        use: "official",
        text: profile.name,
        family: familyName,
        given: givenNames.length > 0 ? givenNames : undefined
      }
    ],
    gender: fhirGender,
    birthDate: profile.birthDate ? profile.birthDate : undefined,
    telecom: profile.phone ? [
      {
        system: "phone",
        value: profile.phone,
        use: "mobile"
      }
    ] : [],
    address: profile.cep ? [
      {
        use: "home",
        type: "physical",
        line: [
          [
            profile.street || '',
            profile.number ? `, ${profile.number}` : '',
            profile.complement ? ` - ${profile.complement}` : ''
          ].join('').trim()
        ],
        // `neighborhood` nao existe em FHIR Address; o campo correto e `district`.
        district: profile.neighborhood || undefined,
        city: profile.city || undefined,
        state: profile.state || undefined,
        postalCode: profile.cep || undefined,
        country: "BR"
      }
    ] : [],
    extension: [
      {
        url: "https://irec.com/fhir/StructureDefinition/has-diabetes",
        valueBoolean: !!profile.hasDiabetes
      },
      {
        url: "https://irec.com/fhir/StructureDefinition/has-hypertension",
        valueBoolean: !!profile.hasHypertension
      },
      {
        url: "https://irec.com/fhir/StructureDefinition/is-smoker",
        valueBoolean: !!profile.isSmoker
      }
    ]
  };

  return fhirPatient;
};

/**
 * Maps a wound entry to a FHIR Observation Resource
 * @param {Object} profile - The client-side clinical profile object
 * @param {Object} entry - A single wound entry log
 * @returns {Object} FHIR Observation resource
 */
export const exportObservationToFHIR = (profile, entry) => {
  if (!entry || !profile) return null;

  // Data. `new Date(entry.date)` sobre "20/08/2026" e Invalid Date, e
  // `.toISOString()` nesse caso lanca RangeError — derrubando a exportacao
  // inteira. O parser dedicado interpreta pt-BR e ISO, e devolve null quando nao
  // da, caindo para created_at.
  const dataRegistro = getEntryDate(entry);
  const effectiveDate = (dataRegistro || new Date()).toISOString();

  const fhirObservation = {
    resourceType: "Observation",
    id: `observation-wound-${entry.id || 'new'}`,
    status: "final",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "exam",
            "display": "Exam"
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: "72274-4",
          "display": "Wound assessment panel"
        }
      ],
      text: `Avaliação de Lesão - ${entry.type}`
    },
    subject: {
      reference: `Patient/${profile.id}`,
      display: profile.name
    },
    effectiveDateTime: effectiveDate,
    valueString: `Tipo: ${entry.type}, Localização: ${entry.anatomicalLocation || 'Não especificado'}, Estágio: ${entry.lesionStage || 'Não especificado'}`,
    component: [
      {
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "39106-0",
              "display": "Wound length"
            }
          ],
          text: "Comprimento"
        },
        valueQuantity: {
          value: Number(entry.aiLengthCm) || 0,
          unit: "cm",
          system: "http://unitsofmeasure.org",
          code: "cm"
        }
      },
      {
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "39125-0",
              "display": "Wound width"
            }
          ],
          text: "Largura"
        },
        valueQuantity: {
          value: Number(entry.aiWidthCm) || 0,
          unit: "cm",
          system: "http://unitsofmeasure.org",
          code: "cm"
        }
      },
      {
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "34125-9",
              "display": "Wound area"
            }
          ],
          text: "Área da Ferida"
        },
        valueQuantity: {
          value: Number(entry.aiAreaCm2) || 0,
          unit: "cm2",
          system: "http://unitsofmeasure.org",
          code: "cm2"
        }
      },
      {
        code: {
          text: "Intensidade da Dor"
        },
        valueInteger: Number.isFinite(Number(entry.pain)) ? Number(entry.pain) : 0
      },
      {
        code: {
          text: "Exsudato"
        },
        valueString: entry.exudate || 'Ausente'
      },
      {
        code: {
          text: "Odor da Lesão"
        },
        valueBoolean: !!entry.odor
      },
      {
        code: {
          text: "Sinais de Infecção"
        },
        valueString: entry.infectionSigns || 'Ausente'
      },
      {
        code: {
          text: "Evolução Clínica"
        },
        valueString: entry.clinicalEvolution || 'Estável'
      },
      {
        code: {
          text: "Desfecho Clínico"
        },
        valueString: entry.clinicalOutcome || 'Tratamento em andamento'
      }
    ],
    note: entry.doctorNotes ? [
      {
        text: entry.doctorNotes
      }
    ] : []
  };

  return fhirObservation;
};

/**
 * Combines patient and wound records into a FHIR Bundle
 * @param {Object} profile - The client-side clinical profile object
 * @param {Array} entries - History of wound entries
 * @returns {Object} FHIR Bundle resource
 */
export const exportFHIRBundle = (profile, entries = []) => {
  if (!profile) return null;

  const patientResource = exportPatientToFHIR(profile);
  const observationResources = entries.map(entry => exportObservationToFHIR(profile, entry)).filter(Boolean);

  const bundle = {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: [
      {
        fullUrl: `Patient/${profile.id}`,
        resource: patientResource
      },
      ...observationResources.map(obs => ({
        fullUrl: `${obs.resourceType}/${obs.id}`,
        resource: obs
      }))
    ]
  };

  return bundle;
};
