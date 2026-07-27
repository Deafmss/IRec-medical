# Graph Report - Irec  (2026-07-27)

## Corpus Check
- 65 files · ~2,273,113 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 355 nodes · 712 edges · 34 communities (27 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- supabaseService.js
- App.jsx
- package.json
- DoctorDashboard.jsx
- devDependencies
- AppDelegate
- Telemedicine.jsx
- Dashboard.jsx
- 🆕 Recursos Premium & Acessibilidade (Fase 10)
- followPatient
- DoctorDashboardAnalytics.jsx
- React + Vite
- processador_treinamento.py
- manifest.json
- ExampleInstrumentedTest.java
- ExampleUnitTest.java
- gradlew
- MainActivity.java
- Package.swift
- sw.js
- index.ts
- iRec Development Rules & Guidelines
- CapApp-SPM/README.md
- 🏛️ Projetos de Referência do GitHub

## God Nodes (most connected - your core abstractions)
1. `DoctorDashboard()` - 17 edges
2. `🆕 Recursos Premium & Acessibilidade (Fase 10)` - 16 edges
3. `AdminDashboard()` - 14 edges
4. `Telemedicine()` - 14 edges
5. `getLocalProfile()` - 14 edges
6. `updateClinicalProfile()` - 14 edges
7. `getLocalUsers()` - 12 edges
8. `getRecommendedMaterials()` - 12 edges
9. `speakNaturalText()` - 12 edges
10. `AppDelegate` - 10 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `checkCallStatus()`  [EXTRACTED]
  src/App.jsx → src/services/supabaseService.js
- `App()` --calls--> `checkIncomingCalls()`  [EXTRACTED]
  src/App.jsx → src/services/supabaseService.js
- `App()` --calls--> `getAllProfiles()`  [EXTRACTED]
  src/App.jsx → src/services/supabaseService.js
- `App()` --calls--> `getWoundEntries()`  [EXTRACTED]
  src/App.jsx → src/services/supabaseService.js
- `App()` --calls--> `updateCallStatus()`  [EXTRACTED]
  src/App.jsx → src/services/supabaseService.js

## Import Cycles
- None detected.

## Communities (34 total, 7 thin omitted)

### Community 0 - "supabaseService.js"
Cohesion: 0.10
Nodes (46): AdminDashboard(), AdminReports(), ALL_SPECIALTIES, Login(), Telemedicine(), analyzeTelemedicineTranscript(), addRecommendedMaterial(), checkCallStatus() (+38 more)

### Community 1 - "App.jsx"
Cohesion: 0.14
Nodes (18): App(), AccessibleDashboard(), getRandomNoisePhrase(), NOISE_FALLBACK_PHRASES, AccessibleTelemedicineView(), AccessibleUploadView(), MyNetworkPortal(), PermissionsGuideModal() (+10 more)

### Community 2 - "package.json"
Cohesion: 0.09
Nodes (22): @capacitor/android, @capacitor/core, @capacitor/ios, dependencies, @capacitor/android, @capacitor/core, @capacitor/ios, react (+14 more)

### Community 3 - "DoctorDashboard.jsx"
Cohesion: 0.12
Nodes (28): ClinicalTriage(), generateLocalFallbackAnalysis(), GLOSSARY_DB, COMMON_CID10, DoctorDashboard(), exportFHIRBundle(), exportObservationToFHIR(), exportPatientToFHIR() (+20 more)

### Community 4 - "devDependencies"
Cohesion: 0.10
Nodes (21): @capacitor/cli, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, devDependencies, @capacitor/cli (+13 more)

### Community 5 - "AppDelegate"
Cohesion: 0.13
Nodes (13): Any, Bool, Capacitor, AppDelegate, NSUserActivity, UIApplication, UIApplicationDelegate, UIKit (+5 more)

### Community 6 - "Telemedicine.jsx"
Cohesion: 0.22
Nodes (13): AI_RESPONSES, AIChatAssistant(), detectTopicFromText(), EXAM_RESPONSES, SUGGESTIONS, ALL_SPECIALTIES, UserProfileModal(), createAuditLog() (+5 more)

### Community 7 - "Dashboard.jsx"
Cohesion: 0.14
Nodes (15): ClinicalHistory(), Dashboard(), generateDynamicTasks(), LocalResourcesPanel(), PatientDocuments(), deg2rad(), fetchNearbyHealthcareResources(), geocodeAddress() (+7 more)

### Community 8 - "🆕 Recursos Premium & Acessibilidade (Fase 10)"
Cohesion: 0.06
Nodes (34): 10. Unificação da Rede de Enfermagem (`NursesNetwork.jsx` & `App.jsx`), 11. Design de Ficha Clínica Centralizada e Flutuante (`SpecialistDirectory.jsx` & `NursesNetwork.jsx`), 12. Reordenação e Agrupamento dos Diretórios (`App.jsx`), 13. Otimização do Guia de Protocolos Clínicos para Médicos (`App.jsx` & `ProtocolGuide.jsx` & `DoctorDashboard.jsx` & `geminiService.js`), 14. Otimização da Inicialização do App & Proteção Contra Loading Infinito (`App.jsx` & `supabaseService.js`), 15. Sistema de Venda e Recomendação de Insumos com Links de Afiliados (`AdminPartners.jsx` & `DoctorDashboard.jsx` & `ProtocolGuide.jsx` & `supabaseService.js`), 1. Chat Flutuante / Expresso Global (`Telemedicine.jsx`), 1. Correção do Travamento da Imagem de Análise (`ClinicalTriage.jsx`) (+26 more)

### Community 9 - "followPatient"
Cohesion: 0.29
Nodes (9): BookingModal(), getNursePremiumDetails(), NursesNetwork(), getDoctorPremiumDetails(), SpecialistDirectory(), createAppointment(), followPatient(), saveLocalAppointments() (+1 more)

### Community 10 - "DoctorDashboardAnalytics.jsx"
Cohesion: 0.18
Nodes (13): AdminPartners(), DateRangePicker(), DoctorDashboardAnalytics(), DoctorPartners(), formatMaterialsForView(), ProtocolGuide(), deleteRecommendedMaterial(), getAssignedPatients() (+5 more)

### Community 11 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + Vite

### Community 12 - "processador_treinamento.py"
Cohesion: 0.40
Nodes (12): analisar_imagem_via_gemini(), chunk_texto(), enviar_bytes_gemini(), iniciar_upload_gemini(), ler_docx_puro(), obter_embedding(), obter_estado_arquivo_gemini(), obter_gemini_key() (+4 more)

### Community 13 - "manifest.json"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, short_name, shortcuts (+2 more)

### Community 14 - "ExampleInstrumentedTest.java"
Cohesion: 0.60
Nodes (3): ExampleInstrumentedTest, Test, RunWith

### Community 16 - "gradlew"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 33 - "🏛️ Projetos de Referência do GitHub"
Cohesion: 0.29
Nodes (6): 1. Medplum (`medplum/medplum`), 2. Fasten Health (`fastenhealth/fasten-onprem`), 3. ⭐ Destaque Especial: Cal.com (`calcom/cal.com`), 📚 Guia de Estudo e Referências de Arquitetura: iRec, 💡 Pontos de Melhoria Diretos para o iRec, 🏛️ Projetos de Referência do GitHub

## Knowledge Gaps
- **85 isolated node(s):** `UIKit`, `Capacitor`, `PackageDescription`, `name`, `private` (+80 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `UIKit`, `Capacitor`, `PackageDescription` to the rest of the system?**
  _85 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `supabaseService.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0992313067784766 - nodes in this community are weakly interconnected._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `DoctorDashboard.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12310606060606061 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._