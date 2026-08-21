# Ronda 2026-08-21 — estado das correções

Branch `fix/ronda-2026-08-21`. Um commit por grupo de correção, revertível
individualmente. Relatórios de origem: [`RONDA-2026-08-21.md`](RONDA-2026-08-21.md)
(1ª passagem, 35 itens) e [`RONDA-2026-08-21-B.md`](RONDA-2026-08-21-B.md)
(2ª passagem, 65 itens novos).

## Medições

| | Antes | Agora |
|---|---|---|
| Testes | 23 | **294** |
| Arquivos de teste | 9 | 22 |
| ESLint | 0 erros, 10 avisos | 0 erros, 9 avisos |
| Verificação de tipos | não existia | `npm run typecheck` passa |
| `npm audit` | 3 HIGH | **0** |
| Portão `verificar-catalogo` | 29 checagens, 1 aprovava errado | 31 checagens, todas com dentes |
| Sourcemap publicado | 4,2 MB no servidor | `hidden` |

## ⚠️ Ação necessária sua — as migrações não foram aplicadas

Quatro migrações estão escritas e conferidas, mas **eu não as apliquei**. Alterar
o banco de produção é irreversível e precisa da sua autorização e de teste em
staging. Ordem obrigatória:

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1 | `20260821000100_criar_appointments_e_vitals_telemetry.sql` | Cria as duas tabelas que **não existem** em produção |
| 2 | `20260821000400_colunas_clinicas_descartadas.sql` | Colunas para Braden, severidade e proveniência |
| 3 | `20260821000200_aprovar_clinicos_existentes.sql` | Anistia de transição (no-op em produção) |
| 4 | `20260821000300_rls_e_storage.sql` | **RLS em 11 tabelas + policies de storage** |

```bash
cd "C:\manus projects\Irec" && npx supabase db push
```

A de número 4 é a que fecha a exposição dos prontuários. Ela **depende** das
mudanças de código já commitadas (a view `clinicians_directory`): aplicar o SQL
sem o código deixa o diretório de profissionais vazio, e aplicar o código sem o
SQL deixa o diretório vazio também. Vão juntas.

Depois de aplicar a nº 4, arquivos antigos na raiz dos buckets precisam ser
movidos para `<patient_id>/` com a service role — as policies novas exigem a
pasta do paciente.

---

## Corrigido

### P0

| Item | O que era | Estado |
|---|---|---|
| 1 | Nenhuma tabela com RLS — 9.789 registros de auditoria e 15 perfis clínicos legíveis anonimamente | migração escrita · **aplicar** |
| 2 | Buckets acessíveis pela anon key; foto de ferida baixável sem login | migração escrita · **aplicar** |
| 3 | `isVerifiedClinician = true` desligava o portão de CRM/COREN | ✅ |
| 4 | Assinatura ICP-Brasil fabricada: serial e autoridade inventados, PIN aceito vazio | ✅ |
| 5 | Edge Function com CORS `*` e sem JWT — proxy de LLM aberto | ✅ |
| 36 | `appointments` e `vitals_telemetry` não existem no banco | migração escrita · **aplicar** |
| 37 | Toda foto de ferida com URL quebrada (400) | ✅ |
| 38 | Enfermeiro emitindo receituário de medicamento | ✅ |
| 39 | Zero verificação de alergia na prescrição | ✅ |
| 40 | AndroidManifest só com `INTERNET` — vídeo e foto não funcionam no APK | ✅ |
| 41 | `Info.plist` sem descrições de uso — crash no iOS | ✅ |
| 43 | Cartão marcado como pago sem cobrar nada | ✅ |
| 44 | Código PIX inválido — nenhum banco lia o QR | ✅ |

### P1

| Item | O que era | Estado |
|---|---|---|
| 6 | `btoa()` como hash de senha | ✅ |
| 7 | PHI sobrando no dispositivo após logout | ✅ |
| 8 | Backdoor "teste" na lista de verificados | ✅ |
| 9 | Injeção de prompt via campo do paciente | ✅ |
| 13 | Sourcemaps de 4,2 MB publicados | ✅ |
| 14 | Injeção em filtro PostgREST | ✅ |
| 15 | `role` e `verification_status` no controle do cliente | migração escrita · **aplicar** |
| 45 | Câmera ligada após sair da telemedicina | ✅ |
| 46 | Microfone do Modo Fácil sem `.start()` | ✅ |
| 48 | Tela de erro em Tailwind, sem Tailwind no projeto | ✅ |
| 49 | Notificação de SOS impossível de dispensar; botão que não discava | ✅ |
| 50 | Braden e classificação de risco coletados e descartados | ✅ + migração |
| 51 | Limiares de Braden errados; padrão afirmava "sem risco" | ✅ |
| 52 | "não tem sangramento" classificado como Crítico | ✅ |
| 53 | Datas em pt-BR = `Invalid Date`; aviso de ordem invertida nunca disparava | ✅ |
| 55 | Falha de leitura indistinguível de "sem registros" | ✅ |
| 58 | Segunda foto apagava a prévia da primeira | ✅ |
| 61 | Hospitais e telefones fixos no código | ✅ |
| 62 | O portão de verificação aprovava algo não corrigido | ✅ |
| 63 | Três definições de admin; painel abria com `currentUser` nulo | ✅ |
| 66 | FHIR com nome invertido, sem identificador, campo inválido | ✅ |
| — | Métricas e depoimentos fabricados no diretório de profissionais | ✅ |

### P2/P3

| Item | Estado |
|---|---|
| 18 · sem verificação de tipos | ✅ `typecheck` + `@ts-check` em 10 módulos |
| 22 · colisão de agendamento sem constraint | ✅ na migração |
| 26 · 3 vulnerabilidades HIGH | ✅ 0 |
| 32 · `"name": "temp-vite"` | ✅ |
| 67 · `CACHE_NAME` fixo | ✅ |
| 69 · `allowBackup="true"` | ✅ |
| 71 · arquivos na raiz do bucket | ✅ |

---

## Aberto

Em ordem de prioridade.

### Precisa de decisão ou contratação

| Item | Por quê |
|---|---|
| 12 · WebRTC sem TURN | Exige contratar/subir servidor TURN. Sem isso, chamada não conecta em CGNAT — cenário dominante no Brasil |
| 42 · TCLE afirma "criptografia de ponta a ponta" e omite o processamento por IA | Texto jurídico: precisa de revisão de quem responde pela plataforma. **Só faz sentido reescrever depois de aplicar a RLS**, senão o texto novo também fica falso |
| 54 · Percentual de cicatrização sobre medida sem escala | Ou remover a métrica, ou exigir marcador de escala na foto. Decisão de produto |
| 59 · Web Speech API envia áudio da consulta ao Google | Ou declarar no TCLE, ou trocar por reconhecimento local |

### Trabalho de código pendente

| Item | O que falta |
|---|---|
| 10 · Auditoria em `localStorage`, e dois sistemas paralelos | Unificar numa tabela append-only. A RLS da migração já deixa `audit_logs` somente-inserção; falta migrar os pontos que usam `auditLogger.js` |
| 11 · Exclusão LGPD não envia nada | Precisa de tabela de solicitações e notificação |
| 56 · Horários de consulta fixos no código | Precisa de agenda de disponibilidade por profissional |
| 57 · Markdown não renderizado; TTS lê os asteriscos | Adicionar renderizador e limpar o texto antes da fala |
| 60 · WebRTC sem fila de candidatos ICE nem *perfect negotiation* | Causa de "às vezes a chamada não conecta" |
| 64 · 134 labels sem associação; login inacessível a leitor de tela | Mecânico, mas extenso |
| 65 · 826 linhas de componentes inalcançáveis com lint silenciado | Decidir por componente: usar ou remover |
| 16 · 3 dos 4 testes E2E quebrados e fora do CI | Login no `beforeEach` + adicionar ao workflow |
| 17 · Cobertura ainda baixa nos fluxos de tela | 294 testes cobrem serviços; falta teste de componente |
| 19 · Schema não versionado por completo | `supabase db pull` para trazer o que não está nas migrações |
| 20 · Bundle de 1,3 MB sem code splitting | |
| 21 · Polling onde há Realtime | Chat de teleconsulta com latência de 15 s |
| 23 · 38 `console.log` em produção | |
| 24 · APK com bundle defasado | `npx cap sync` no pipeline |
| 25 · 88 `alert()` bloqueantes | Precisa de componente de notificação |
| 47 · Título invisível no Modo Fácil em tema escuro; 503 cores literais | Tokens de tema |
| 68 · Recarregamento automático no meio do uso | Trocar por aviso |
| 70 · `addWoundEntry` adivinha a própria assinatura | |
| 72–100 | Ver `RONDA-2026-08-21-B.md` |

### Achados novos, desta rodada de correção

Apareceram enquanto eu corrigia, e estão registrados aqui porque nenhum
relatório anterior os tinha:

1. **A coluna `coren` não existe.** Produção responde 400 para `select=coren`.
   CRM e COREN são gravados os dois em `crm`. Todos os `doc.coren` espalhados
   pelo front eram sempre `undefined`.

2. **`consultation_fee`, `bio` e `education` existem no banco e não eram
   lidos** no diretório. Por isso o preço configurado pelo profissional nunca
   chegava ao agendamento — `BookingModal` caía no valor fixo de 250/130 — e a
   apresentação escrita no perfil nunca aparecia. Corrigido no `mapDirectoryRow`.

3. **`clean_database_v3.sql` define `role CHECK (role IN ('patient','doctor'))`**
   — sem `'nurse'` nem `'admin'`. Não existe nenhum perfil com `role='nurse'`
   em produção. Se o CHECK estiver lá, **o cadastro de enfermeiro falha no
   insert** e o erro é engolido por um `console.warn` em `signUpUser`. A
   migração de RLS já usa `('patient','doctor','nurse')` no trigger; o CHECK da
   tabela precisa ser conferido e ampliado.

4. **`getPatientAppointments` tinha o mesmo antipadrão** de
   `getDoctorAppointments` (`if (!error && data && data.length > 0)`), que
   trata consulta com erro e agenda vazia da mesma forma. Corrigido nos dois.

5. **O QR do PIX é renderizado por `api.qrserver.com`** — o payload, com a
   chave do recebedor e o valor, é enviado a um terceiro, e não funciona
   offline. Exige uma dependência de geração local de QR.

6. **`Promise.allSettled` descartava anexos em silêncio** em
   `addWoundEntry`: o usuário via "triagem salva" sem os exames que anexou.
   Agora a falha é reportada.
