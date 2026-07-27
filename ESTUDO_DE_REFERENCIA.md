# 📚 Guia de Estudo e Referências de Arquitetura: iRec

Este documento mapeia os melhores projetos open-source do GitHub para servirem de referência de arquitetura, código e UX para o **iRec**.

---

## 🏛️ Projetos de Referência do GitHub

### 1. Medplum (`medplum/medplum`)
* **Repositório:** [https://github.com/medplum/medplum](https://github.com/medplum/medplum)
* **Tecnologias:** React, TypeScript, GraphQL, PostgreSQL/Supabase, FHIR.
* **O que estudar a fundo:**
  * **Prontuário Eletrônico:** Estrutura de armazenamento de dados clínicos de pacientes.
  * **Módulo de Telemedicina:** Como o estado da consulta ao vivo e a troca de dados entre médico e paciente são gerenciados.
  * **Segurança e Privacidade:** Práticas de conformidade com dados de saúde (HIPAA / LGPD).

### 2. Fasten Health (`fastenhealth/fasten-onprem`)
* **Repositório:** [https://github.com/fastenhealth/fasten-onprem](https://github.com/fastenhealth/fasten-onprem)
* **Tecnologias:** React, TypeScript, Go.
* **O que estudar a fundo:**
  * **Linha do Tempo Clínica:** Visualização gráfica do histórico de exames e consultas do paciente.
  * **Integração de Laudos:** Apresentação clara de documentos médicos e arquivos de resultados.

---

### 3. ⭐ Destaque Especial: Cal.com (`calcom/cal.com`)
* **Repositório:** [https://github.com/calcom/cal.com](https://github.com/calcom/cal.com)
* **Por que é essencial para o iRec:** O iRec lida diretamente com consultas de telemedicina e atendimentos médicos, onde **agendamentos futuros, pontualidade e confirmação** são críticos.
* **O que estudar no Cal.com para aplicar no iRec:**
  1. **Agendamentos Futuros e Recorrência:** Como estruturar consultas únicas, recorrentes ou retornos médicos sem conflitos de horário.
  2. **Pontualidade e Lembretes:** Implementação de regras de notificação (E-mail, WhatsApp, Push) X minutos antes da consulta para zerar o índice de faltas (*no-show*).
  3. **Tolerância de Atrasos e Sala de Espera Virtual:** Lógica para gerenciar a entrada do paciente na sala de telemedicina, lidando com pequenos atrasos do médico ou do paciente de forma transparente.
  4. **Fuso Horário Automático:** Garantir que o horário agendado seja convertido automaticamente caso médico e paciente estejam em estados/fusos diferentes.

---

## 💡 Pontos de Melhoria Diretos para o iRec

1. **Gestão de Agendamentos Futuros:**
   * Implementar fluxo de reagendamento simples em 1 clique pelo paciente/médico.
   * Adicionar status claro de consulta: `Agendado`, `Confirmado`, `Em Espera`, `Em Atendimento`, `Concluído`, `Ausente`.
2. **Lembretes Automáticos:**
   * Adicionar sistema de envio de alertas automáticos 24h e 1h antes da consulta de telemedicina.
3. **Prontuário Integrado:**
   * Permitir que o médico anote prescrições e evoluções durante a própria chamada de telemedicina.
