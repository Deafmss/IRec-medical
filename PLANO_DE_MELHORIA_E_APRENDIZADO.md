# 📋 Plano de Aprendizado e Melhoria Contínua: iRec

Este documento contém as **instruções técnicas de estudo e arquitetura** extraídas das maiores referências open-source do GitHub para evoluir o **iRec** para um nível enterprise (*production-grade*).

---

## 🎯 Objetivo de Evolução
Elevar o **iRec** (React + Supabase + Capacitor) de um protótipo para uma **plataforma completa de saúde e telemedicina**, com extrema estabilidade em chamadas de vídeo, notificações automáticas, segurança clínica e agendamentos inteligentes.

---

## 📚 Projetos do GitHub para Estudo & Aprendizado

### 1. Medplum (`medplum/medplum`)
* **URL:** `https://github.com/medplum/medplum`
* **Conceitos a Aprender e Aplicar:**
  * **Prontuário Médico Seguro:** Estruturação de dados clínicos, prescrições e laudos.
  * **Criptografia e Auditoria:** Criptografia de dados sensíveis em repouso no Supabase e registro detalhado de quem acessou cada prontuário (logs de auditoria).

### 2. TRTC Web & React Native WebRTC (`react-native-webrtc/react-native-webrtc`)
* **URL:** `https://github.com/react-native-webrtc/react-native-webrtc`
* **Conceitos a Aprender e Aplicar:**
  * **Vídeo Adaptativo:** Ajuste automático de qualidade de vídeo quando a rede 4G/5G do paciente/médico estiver instável.
  * **Gerenciador de Dispositivos:** Seleção dinâmica de câmeras e microfones no celular (Capacitor) e no navegador.

### 3. Novu (`novuhq/novu`)
* **URL:** `https://github.com/novuhq/novu`
* **Conceitos a Aprender e Aplicar:**
  * **Notificações Multi-canal:** Envio automático de lembretes via WhatsApp, E-mail e Push Notifications no aplicativo mobile.

### 4. Cal.com (`calcom/cal.com`)
* **URL:** `https://github.com/calcom/cal.com`
* **Conceitos a Aprender e Aplicar:**
  * **Gestão de Agendamentos Futuros:** Prevenção de choques de horário, confirmação automática em 1 clique pelo WhatsApp e sala de espera virtual para telemedicina.

---

## 🛠️ Roteiro de Implementação Passo a Passo

1. **Fase 1 - Agendamentos & Alertas (Inspirado no Cal.com e Novu):**
   * Criar estados de consulta: `Agendado`, `Confirmado`, `Em Espera`, `Em Atendimento`, `Concluído`.
   * Configurar envio de lembrete 24h e 1h antes da consulta.
2. **Fase 2 - Segurança & Prontuário (Inspirado no Medplum):**
   * Adicionar criptografia nos campos de historico_medico do Supabase.
   * Criar tabela de auditoria `log_acessos_prontuario`.
3. **Fase 3 - Telemedicina Robusta (Inspirado no WebRTC):**
   * Adicionar reconexão automática na sala de chamada de vídeo.
