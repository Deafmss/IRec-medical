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

  // Build name array
  const nameParts = profile.name ? profile.name.trim().split(' ') : ['Paciente'];
  const givenNames = nameParts.slice(1);
  const familyName = nameParts[0];

  const fhirPatient = {
    resourceType: "Patient",
    id: profile.id,
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
        neighborhood: profile.neighborhood || undefined,
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

  // Format date
  let effectiveDate = new Date().toISOString();
  if (entry.date) {
    try {
      const parts = entry.date.split('/');
      if (parts.length === 3) {
        // DD/MM/YYYY to YYYY-MM-DD
        effectiveDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString();
      } else {
        effectiveDate = new Date(entry.date).toISOString();
      }
    } catch {
      effectiveDate = new Date().toISOString();
    }
  }

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
          text: "Área da Ferida (IA)"
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
        valueInteger: entry.pain || 0
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
