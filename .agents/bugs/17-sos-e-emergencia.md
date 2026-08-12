# 17. SOS e emergência

**30 defeitos** — 0 crítico · 4 alto · 12 médio · 14 baixo

Arquivos tocados por este módulo:

- `src/components/LocalResourcesPanel.jsx`
- `src/components/PermissionsGuideModal.jsx`
- `src/components/SOSEmergencyModal.jsx`
- `src/services/locationService.js`

> Leia `INDEX.md` antes de começar. Um commit por defeito. Ao terminar o módulo, rode a verificação do rodapé e marque as linhas correspondentes em `STATUS.md`.

---

## IREC-0135 · ALTO · `CONFIRMAR-SCHEMA`

**Notificação "fixa" de SOS usa tag divergente da esperada pelo service worker e não é recriada ao ser dispensada**

**Onde:** `src/components/SOSEmergencyModal.jsx:64`

**O defeito:** O modal cria a notificação com `tag: 'irec-sos-persistent'`, mas `public/sw.js` (linha 86) só recria a notificação quando `event.notification.tag === 'irec-sos-persistent-fixed'` — a tag usada em `src/App.jsx` (linhas 206 e 236). Chave de escrita divergente da chave de leitura: a notificação criada pelo modal não é coberta pelo mecanismo de persistência, portanto não é "fixa". Pior: por ter tag diferente da criada por App.jsx, ela não substitui a existente e gera uma SEGUNDA notificação duplicada de SOS na bandeja.

**Como falha:** Paciente toca em "Ativar Notificação Fixa de SOS no Celular", recebe o alert "Notificação fixa de emergência ativada com sucesso!" e vê a notificação. Ao arrastar a notificação sem querer (gesto comum na bandeja), o `notificationclose` do sw.js compara a tag, não bate, e nada é recriado — o atalho de emergência prometido como fixo desaparece para sempre. Se o App.jsx já havia criado a dele, o usuário fica com duas notificações de SOS idênticas.

**Código atual:**

```jsx
// SOSEmergencyModal.jsx:60-66
reg.showNotification('🚨 SOS iRec - Atendimento de Emergência', {
  ...
  tag: 'irec-sos-persistent',
  requireInteraction: true
});
// public/sw.js:86
if (event.notification.tag === 'irec-sos-persistent-fixed') {
```

**Correção sugerida:** Trocar a tag do modal para `'irec-sos-persistent-fixed'` (ou extrair a constante para um módulo compartilhado com o App.jsx e o sw.js).

<details><summary>Verificação feita contra o código</summary>

Verificado por leitura e grep: o modal usa `tag: 'irec-sos-persistent'` (linha 64), enquanto `public/sw.js:86` só recria a notificação quando `event.notification.tag === 'irec-sos-persistent-fixed'`, tag usada em `src/App.jsx:206` e `:236`. Divergência real entre chave de escrita e de leitura: a notificação do modal não é persistida ao ser dispensada e, por ter tag diferente, coexiste com a criada pelo App.jsx (duplicata na bandeja). Reduzo para alto: o recurso prometido quebra, mas os botões de emergência do próprio modal continuam funcionando.

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0136 · ALTO · `CONFIRMADO`

**Botão principal "IR PARA HOSPITAL / UPA MAIS PRÓXIMO" abre o mapa dentro de callback assíncrono do GPS e é bloqueado pelo navegador**

**Onde:** `src/components/SOSEmergencyModal.jsx:167`

**O defeito:** `window.open(directMapsUrl, '_blank')` é chamado dentro do callback de sucesso de `navigator.geolocation.getCurrentPosition` (e também no callback de erro, após timeout de 8s). Nesse ponto a ativação transitória do usuário (user activation) gerada pelo toque já expirou, e Chrome/Safari/WebView Capacitor bloqueiam a abertura de nova aba/janela originada fora de gesto do usuário. O resultado é o botão mais crítico da tela de emergência não fazer absolutamente nada, sem qualquer mensagem de erro (não existe tratamento de popup bloqueado).

**Como falha:** Paciente com dor no peito abre o SOS e toca em "IR PARA HOSPITAL / UPA MAIS PRÓXIMO (GPS REAL)". O navegador exibe/resolve o prompt de GPS (tipicamente >1s, e até 8s com enableHighAccuracy em celular). Quando a coordenada chega, `window.open` é bloqueado pelo bloqueador de pop-ups: nenhuma aba abre, nenhum aviso aparece, o paciente fica olhando a tela achando que o app travou. O mesmo ocorre no ramo de erro (fallback por cidade), que roda ainda mais tarde.

**Código atual:**

```jsx
navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          ...
          window.open(directMapsUrl, '_blank');
        },
        (err) => {
          ...
          window.open(fallbackUrl, '_blank');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
```

**Correção sugerida:** Abrir a aba sincronamente no clique (`const win = window.open('', '_blank')`) e apenas setar `win.location` no callback, tratando `win === null` com mensagem ao usuário.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 162-187: `window.open(directMapsUrl, '_blank')` roda dentro do callback de sucesso de `getCurrentPosition` e `window.open(fallbackUrl, ...)` no callback de erro (timeout 8000). Não há nenhum tratamento para janela bloqueada (o retorno de `window.open` não é testado). A ativação transitória do usuário dura ~5s no Chrome, então quando há prompt de permissão ou fix lento de GPS a abertura é bloqueada. Ajusto de crítico para alto porque o cenário não é universal: com posição em cache o callback resolve em milissegundos, dentro da janela de ativação, e navegadores móveis exibem um indicador de pop-up bloqueado (embora fácil de ignorar).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0176 · ALTO · `CONFIRMADO`

**Estabelecimentos de saúde com nome, endereço e TELEFONE hardcoded no código são injetados e exibidos como resultado real de busca**

**Onde:** `src/services/locationService.js:140`

**O defeito:** Para qualquer coordenada a até 12 km do centro de Itapuranga/GO, a função injeta 3 hospitais e 3 farmácias fixos no código-fonte (nomes, endereços e telefones), misturados aos resultados reais do OpenStreetMap. A UI apresenta esses dados como verificados: o card compacto de LocalResourcesPanel.jsx (linha 140) exibe o rótulo "PRONTO SOCORRO MAIS PRÓXIMO (REAL)" e a lista de farmácias (linha 360) exibe "Farmácias Locais Credenciadas". Não há data de validação, fonte, nem qualquer verificação de que o estabelecimento ainda existe ou que o telefone ainda é válido, e não há credenciamento nenhum.

**Como falha:** Paciente de Itapuranga em emergência abre o dashboard, vê "Hospital São Francisco ... 📞 Tel: (62) 3312-1154" sob o rótulo "(Real)", liga para o número e cai em número inexistente/trocado (ou se desloca até um endereço onde o serviço não funciona mais), porque o dado nunca foi obtido de nenhuma fonte oficial — está cravado no bundle JavaScript. Como esses itens são sempre inseridos primeiro e ordenados por distância, eles aparecem no topo da lista.

**Código atual:**

```jsx
const isItapuranga = getDistance(numLat, numLon, itapurangaCenterLat, itapurangaCenterLon) <= 12;

  if (isItapuranga) {
    const predefinedHospitals = [
      {
        id: "itapuranga_hosp_sf",
        name: "Hospital São Francisco",
        ...
        phone: "(62) 3312-1154"
      },
```

**Correção sugerida:** Mover a lista para uma fonte de dados versionada com campo de origem/data de verificação e rotular esses itens na UI como "cadastro local", removendo os rótulos "(Real)" e "Credenciadas".

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 135-208: para qualquer coordenada a até 12 km do centro de Itapuranga, três hospitais e três farmácias com nome, endereço e telefone cravados no código são inseridos nas listas antes de qualquer consulta ao OSM, e depois ordenados por distância (linhas 436-437). A UI os apresenta como verificados: LocalResourcesPanel.jsx:140 rotula "Pronto Socorro Mais Próximo (Real)" e :360 "Farmácias Locais Credenciadas", sem fonte, data de validação ou qualquer credenciamento. Dado clínico/de contato apresentado como real sem origem verificável é defeito mesmo sendo intencional. Reduzo de crítico para alto: são estabelecimentos aparentemente existentes e o dado muda devagar, mas segue sem verificação em contexto de emergência.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0177 · ALTO · `CONFIRMADO`

**Resultado vazio (falha total de rede/API) é gravado no cache por 3 horas, deixando o paciente sem hospitais mesmo após a conectividade voltar**

**Onde:** `src/services/locationService.js:440`

**O defeito:** O `localStorage.setItem(cacheKey, ...)` no fim de `fetchNearbyHealthcareResources` é executado incondicionalmente, inclusive quando o Overpass falhou em todos os mirrors E o fallback Nominatim falhou, ou seja, quando `result` é `{ hospitals: [], pharmacies: [] }`. A leitura (linhas 119-127) devolve esse resultado vazio por 3 horas sem tentar nada. Não há distinção entre "não existe hospital por perto" e "a busca falhou".

**Como falha:** Paciente abre o dashboard num momento sem sinal (ou com o Overpass fora do ar). Todas as buscas falham e `{hospitals: [], pharmacies: []}` é gravado em `irec_resources_cache_-15.5605_-49.9489`. O sinal volta 1 minuto depois; nas 3 horas seguintes, toda vez que o paciente abrir o painel ou o mapa completo — inclusive durante uma emergência — a tela responde instantaneamente "Nenhum hospital encontrado no raio de busca local." sem sequer tentar nova requisição.

**Código atual:**

```jsx
const result = { hospitals, pharmacies };
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      data: result
    }));
```

**Correção sugerida:** Só gravar o cache quando `hospitals.length > 0 || pharmacies.length > 0` (ou marcar o registro como falha com TTL de poucos minutos).

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 439-447: `localStorage.setItem(cacheKey, { timestamp, data: result })` é executado incondicionalmente no fim de `fetchNearbyHealthcareResources`, sem verificar se `hospitals`/`pharmacies` estão vazios. Não existe nenhuma guarda anterior: o caminho em que todos os mirrors Overpass falham (linhas 273-279) e o reverse geocode do Nominatim também falha (linhas 341-356, deixando `city` vazio e pulando todo o fallback) chega a esse setItem com `{hospitals: [], pharmacies: []}`. A leitura (linhas 118-127) devolve esse vazio por 3 horas sem nova tentativa. Severidade alto mantida: em emergência a tela responde "Nenhum hospital encontrado" instantaneamente mesmo com a rede restabelecida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0297 · MÉDIO · `CONFIRMADO`

**Nenhum dos dois efeitos tem cancelamento: resposta lenta sobrescreve estado mais novo e há setState após unmount**

**Onde:** `src/components/LocalResourcesPanel.jsx:21`

**O defeito:** O efeito de localização (linhas 21-77) e o de busca de recursos (linhas 80-100) executam cadeias assíncronas longas (GPS 4s + geocode + Overpass + Nominatim) e chamam `setCoords`, `setResolvedAddress`, `setGpsActive`, `setHospitals`, `setPharmacies`, `setLoading` e `setError` sem nenhuma flag `cancelled`, `AbortController` ou função de cleanup. Não há proteção contra respostas fora de ordem nem contra atualização depois do desmonte.

**Como falha:** Paciente abre o painel; o GPS falha em 4s e o `geocodeAddress` do endereço cadastrado começa. Nesse intervalo ele toca em "Detectar por GPS" e a segunda tentativa tem sucesso, definindo coords do GPS e o rótulo "GPS do dispositivo (Lat: ...)". Segundos depois o geocode antigo resolve e sobrescreve tudo com as coordenadas do endereço de cadastro, enquanto o botão continua exibindo "GPS Ativo" — a referência mostrada é a do endereço, mas a UI afirma que é o GPS. Se o usuário fechar o modal do mapa antes das requisições terminarem, os setStates ocorrem sobre componente desmontado.

**Código atual:**

```jsx
useEffect(() => {
    async function initLocation() { ... }
    initLocation();
  }, [profileAddressKey]);   // nenhum return de cleanup / flag de cancelamento
```

**Correção sugerida:** Adicionar `let cancelled = false;` com `return () => { cancelled = true; }` em ambos os efeitos e guardar todos os setState atrás de `if (!cancelled)`.

<details><summary>Verificação feita contra o código</summary>

Confirmado: o efeito de localização (linhas 21-77) e o de recursos (linhas 80-100) executam cadeias assíncronas longas (GPS 4s, `geocodeAddress`, `fetchNearbyHealthcareResources`) e nenhum retorna função de cleanup nem usa flag de cancelamento ou AbortController. O cenário de sobrescrita é alcançável: durante os 4s de GPS + geocode o usuário pode acionar `handleUseGps` (linha 103), que seta coords do GPS e `gpsActive`; quando o geocode antigo resolve, as linhas 62-63 sobrescrevem coords e `resolvedAddress` enquanto o botão continua exibindo "GPS Ativo" (linha 175). Reduzo de alto para médio: o dado exibido fica inconsistente, mas não há corrupção persistida e o React 19 não emite mais aviso de setState pós-desmonte.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0298 · MÉDIO · `CONFIRMADO`

**Coleta automática de GPS no mount, duplicada por StrictMode e por duas instâncias simultâneas do painel**

**Onde:** `src/components/LocalResourcesPanel.jsx:32`

**O defeito:** `navigator.geolocation.getCurrentPosition` é chamado no efeito de mount, sem gesto do usuário e sem qualquer aviso/consentimento prévio de rastreamento de localização (o app registra acessos a prontuário em auditLogger mas não registra nem consente a coleta de geolocalização). O efeito não é idempotente e não tem cleanup: com `<StrictMode>` (src/main.jsx linha 19) ele roda duas vezes em desenvolvimento, e Dashboard.jsx monta o componente duas vezes ao abrir o mapa completo (linha 634 em modo compacto + linha 933 dentro do modal), resultando em múltiplas requisições de GPS e cadeias duplicadas de Overpass/Nominatim para o mesmo usuário.

**Como falha:** Paciente abre o dashboard e imediatamente recebe o prompt de localização precisa, sem ter tocado em nada e sem explicação de finalidade. Ao clicar em "Ver Mapa Completo de Hospitais & UPAs", uma segunda instância monta e dispara novo `getCurrentPosition` e nova rodada de até 4 mirrors Overpass + 4 buscas Nominatim em paralelo com a instância compacta.

**Código atual:**

```jsx
navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              ...
            { enableHighAccuracy: true, timeout: 4000 }
          );
```

**Correção sugerida:** Elevar a resolução de localização para um contexto/hook compartilhado entre as instâncias e só disparar o GPS após interação ou aviso explícito de finalidade.

<details><summary>Verificação feita contra o código</summary>

Confirmado: `getCurrentPosition` é chamado no efeito de mount (linhas 32-48), sem gesto do usuário, sem cleanup e sem guarda de idempotência. Dashboard.jsx monta o componente em dois pontos — linha 634 (`compact`, sempre no dashboard) e linha 933 (dentro do modal do mapa) — que coexistem enquanto o modal está aberto, cada um disparando GPS próprio e uma rodada independente de até 4 mirrors Overpass mais 4 buscas Nominatim. Mantenho médio: o prompt do navegador dá algum controle ao usuário, mas o disparo sem contexto e o trabalho de rede duplicado são reais.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0299 · MÉDIO · `CONFIRMADO`

**Listas de hospitais e farmácias não são limpas ao mudar a localização: distâncias exibidas referem-se ao local antigo**

**Onde:** `src/components/LocalResourcesPanel.jsx:84`

**O defeito:** Em `loadResources`, `hospitals` e `pharmacies` só são substituídos após o `await` bem-sucedido. Se as coordenadas mudarem (clique em "Detectar por GPS", atualização do endereço no perfil) a lista anterior continua renderizada durante todo o novo carregamento e, se o novo fetch lançar (catch da linha 91), permanece na tela indefinidamente — agora ao lado de um `resolvedAddress` de outro local, com distâncias calculadas em relação à coordenada antiga.

**Como falha:** Paciente viaja para outra cidade e toca em "Detectar por GPS". O rótulo passa a mostrar "GPS do dispositivo (Lat: -23.55, Lon: -46.63)", mas a busca falha (Overpass fora do ar). A tela continua exibindo os hospitais de Itapuranga com "0,25 km de você" enquanto o paciente está a 800 km de distância, e o botão "Como Chegar" usa `origin` do novo GPS com destino ao hospital antigo.

**Código atual:**

```jsx
const { hospitals: hospList, pharmacies: pharmList } = await fetchNearbyHealthcareResources(coords.lat, coords.lon);
        setHospitals(hospList);
        setPharmacies(pharmList);
```

**Correção sugerida:** Chamar `setHospitals([]); setPharmacies([]);` no início de `loadResources`, junto com `setLoading(true)`.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 80-100: `loadResources` faz `setLoading(true)` e `setError('')` mas não zera `hospitals`/`pharmacies`; eles só mudam após o `await` bem-sucedido (linhas 88-90) e, se o fetch lançar (catch da linha 91), a lista antiga permanece renderizada indefinidamente. Como `resolvedAddress` já foi atualizado no efeito anterior, a tela combina local novo com estabelecimentos e distâncias do local antigo, e os links "Como Chegar" (linhas 326 e 373) usam `origin` novo com destino antigo. Severidade médio mantida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0332 · MÉDIO · `CONFIRMADO`

**Guia Android instrui a tocar no botão de instalar que acabou de falhar — o modal só abre quando esse caminho é impossível**

**Onde:** `src/components/PermissionsGuideModal.jsx:175`

**O defeito:** Em src/App.jsx (linhas 158-169) `handleInstallAppClick` só chama `setShowPermissionsGuideModal(true)` no ramo `else`, isto é, quando `deferredPrompt` é null — exatamente quando o prompt nativo de instalação do PWA NÃO está disponível. Ainda assim, o passo 1 da aba Android manda o usuário "Tocar no botão verde 📲 Instalar App no topo da tela do iRec" e "Confirmar em Instalar", que é o botão cujo clique abriu este modal e que não produz nenhum prompt. Instrução circular, sem saída.

**Como falha:** Paciente no Chrome Android com o PWA já instalado (ou em navegador sem suporte a beforeinstallprompt) toca em "Instalar App": abre o guia, que manda tocar em "Instalar App". Ele repete o ciclo indefinidamente e nunca recebe a orientação correta (menu ⋮ ➔ "Adicionar à tela inicial" ou "o app já está instalado").

**Código atual:**

```jsx
<li>Toque no botão verde <strong>"📲 Instalar App"</strong> no topo da tela do iRec.</li>
                <li>Confirme em <strong>Instalar</strong>.</li>
```

**Correção sugerida:** Substituir o passo 1 da aba Android pelo caminho manual (menu ⋮ ➔ "Adicionar à tela inicial") e informar o caso de app já instalado.

<details><summary>Verificação feita contra o código</summary>

Confirmado dos dois lados: em src/App.jsx:158-170, `handleInstallAppClick` só chama `setShowPermissionsGuideModal(true)` no ramo `else`, ou seja, exatamente quando `deferredPrompt` é null e o prompt nativo não está disponível. Ainda assim o passo 1 da aba Android (linhas 175-176) manda "Toque no botão verde 📲 Instalar App no topo da tela do iRec" e "Confirme em Instalar" — o mesmo botão que abriu o modal e que não produz prompt algum. A locução por voz repete a instrução (linha 17). Instrução circular real; severidade médio mantida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0349 · MÉDIO · `CONFIRMADO`

**GPS de emergência é capturado no mount e nunca utilizado; o app pede a localização duas vezes**

**Onde:** `src/components/SOSEmergencyModal.jsx:8`

**O defeito:** O estado `userGps` é escrito por `setUserGps(...)` no efeito das linhas 10-22 (que dispara `getCurrentPosition` com timeout de 10s ao abrir o modal), mas nunca é lido em nenhum ponto do componente — não aparece no JSX nem em `handleOpenMapsGPS`. A coordenada obtida é descartada e `handleOpenMapsGPS` (linha 167) faz uma SEGUNDA chamada de `getCurrentPosition` independente, com timeout menor (8s). Verificado por busca no arquivo: `userGps` só ocorre nas linhas 8 e 14.

**Como falha:** Paciente abre o SOS; o app pede permissão de GPS e obtém a coordenada com sucesso. Ao tocar em "IR PARA HOSPITAL / UPA", o app pede GPS novamente; se essa segunda tentativa expirar em 8s (comum dentro de casa/prédio), o código cai no fallback genérico por cidade — desprezando a coordenada precisa que já estava em memória. Além disso a coordenada de emergência nunca é mostrada na tela para o paciente repassar ao atendente do SAMU.

**Código atual:**

```jsx
const [userGps, setUserGps] = useState(null);
...
navigator.geolocation.getCurrentPosition(
  (pos) => {
    setUserGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  },
```

**Correção sugerida:** Usar `userGps` como atalho em `handleOpenMapsGPS` (abrir direto se já houver coordenada) e exibi-la no modal, ou remover o estado se não for usado.

<details><summary>Verificação feita contra o código</summary>

Grep no arquivo confirma que `userGps` ocorre apenas nas linhas 8 (declaração) e 14 (`setUserGps` dentro do efeito de mount com timeout 10000). O valor nunca é lido no JSX nem em `handleOpenMapsGPS`, que dispara um segundo `getCurrentPosition` independente com timeout de 8000 (linhas 166-181). Estado morto e requisição de GPS duplicada, com a coordenada precisa já em memória sendo descartada no ramo de erro. Reduzo de alto para médio: é desperdício e perda de robustez, mas a segunda chamada normalmente resolve e o fallback por cidade ainda existe.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0350 · MÉDIO · `CONFIRMADO`

**Endereço físico completo do paciente é montado para a emergência e nunca renderizado**

**Onde:** `src/components/SOSEmergencyModal.jsx:31`

**O defeito:** `fullPhysicalAddress` concatena rua, número, bairro, cidade, estado e CEP do `clinicalProfile`, mas a variável não é usada em nenhum lugar do retorno JSX (confirmado por busca: única ocorrência é a linha 31). As variáveis `street`, `neighborhood` e `cep` também só existem para alimentar essa string morta. A funcionalidade de "mostrar o endereço para informar ao socorrista" foi codificada pela metade.

**Como falha:** Paciente idoso, em pânico, abre o SOS para ligar ao SAMU. O atendente pede o endereço; o paciente não consegue lembrar/ler e a tela do SOS — que tem o endereço cadastrado disponível em memória — não exibe nada. Nenhum dos campos de endereço aparece no modal.

**Código atual:**

```jsx
const fullPhysicalAddress = [street, number, neighborhood, city, state, cep ? `CEP ${cep}` : ''].filter(Boolean).join(', ');
```

**Correção sugerida:** Renderizar `fullPhysicalAddress` em um bloco destacado do modal (com botão de copiar) ou remover a variável e os campos que só a alimentam.

<details><summary>Verificação feita contra o código</summary>

Grep confirma ocorrência única de `fullPhysicalAddress` na linha 31; `neighborhood` (linha 26) e `cep` (linha 29) só existem para alimentar essa string. A variável não aparece em nenhum ponto do JSX. É código morto — uma funcionalidade de exibir o endereço para o socorrista foi iniciada e não concluída. Reduzo de alto para médio: não há regressão nem falha em runtime, apenas ausência de um recurso que o código sugere existir (`city`/`state` seguem em uso no fallback do mapa).

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0351 · MÉDIO · `CONFIRMADO`

**Notificação de SOS do modal é criada sem `actions`, prometendo botões "ligar 192" e "rota da UPA" que não existem**

**Onde:** `src/components/SOSEmergencyModal.jsx:60`

**O defeito:** O corpo da notificação diz "Toque para socorro imediato, ligar 192 ou rota da UPA mais próxima", mas o objeto de opções não contém o array `actions` (ao contrário de src/App.jsx linhas 211-214 e sw.js linha 96). Sem `actions`, os ramos `action === 'call_samu'` e `action === 'open_upa'` do `notificationclick` em public/sw.js (linhas 54-65) são inalcançáveis para essa notificação, e o toque cai no ramo genérico que apenas navega para `/?sos=true`.

**Como falha:** Paciente ativa a notificação pelo modal SOS, vê o texto que promete os atalhos "Ligar 192 (SAMU)" e "Rota UPA", procura os botões na notificação e não encontra nenhum. Ao tocar, apenas o app reabre no modal SOS — a discagem imediata prometida nunca acontece.

**Código atual:**

```jsx
reg.showNotification('🚨 SOS iRec - Atendimento de Emergência', {
  body: 'Toque para socorro imediato, ligar 192 ou rota da UPA mais próxima.',
  icon: '/favicon.png',
  badge: '/favicon.png',
  tag: 'irec-sos-persistent',
  requireInteraction: true
});   // <- nenhum campo actions
```

**Correção sugerida:** Incluir o mesmo array `actions` de App.jsx:211-214 nas opções de `showNotification` do modal.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 60-66: o objeto de opções tem body, icon, badge, tag e requireInteraction, e nenhum campo `actions` — ao contrário de App.jsx:211-214 e sw.js:96-99. O body promete "ligar 192 ou rota da UPA", mas sem `actions` os ramos `call_samu`/`open_upa` do `notificationclick` (sw.js:54+) são inalcançáveis para essa notificação. Reduzo de alto para médio: é texto enganoso e perda de atalho, mas o toque ainda reabre o app no SOS, onde a ligação para o 192 está disponível.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0352 · MÉDIO · `CONFIRMADO`

**Fallback do mapa gera URL de busca sem local quando o perfil não tem cidade/estado**

**Onde:** `src/components/SOSEmergencyModal.jsx:176`

**O defeito:** Quando o GPS falha, o código monta a busca com `cityQuery` derivada de `city`/`state` do `clinicalProfile`. Se ambos estiverem vazios, `cityQuery` é string vazia e a URL final fica `https://www.google.com/maps/search/hospital+pronto+socorro+upa+` (com o `+` pendurado e nenhuma referência geográfica). Não há verificação nem mensagem ao usuário nesse caso.

**Como falha:** Médico, enfermeiro ou paciente recém-cadastrado (o `clinicalProfile` default em App.jsx linha 426 não tem endereço preenchido) aciona o SOS com GPS negado/indisponível. Abre-se uma busca no Google Maps sem coordenada e sem cidade, retornando resultados aleatórios (baseados no IP do provedor, possivelmente em outro estado) apresentados como "hospital mais próximo".

**Código atual:**

```jsx
const cityQuery = (city || state) ? `${city} ${state}`.trim() : '';
          const fallbackUrl = `https://www.google.com/maps/search/hospital+pronto+socorro+upa+${encodeURIComponent(cityQuery)}`;
          window.open(fallbackUrl, '_blank');
```

**Correção sugerida:** Se `cityQuery` estiver vazio, não abrir o mapa e exibir mensagem pedindo para ativar o GPS ou completar o endereço no cadastro.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 176-178 (e repetido em 183-185): `cityQuery` vira string vazia quando `city` e `state` estão vazios, e a URL final fica `https://www.google.com/maps/search/hospital+pronto+socorro+upa+` sem referência geográfica. Não há verificação de `cityQuery` vazio nem mensagem ao usuário. O cenário é alcançável: perfis novos e usuários médico/enfermeiro não têm endereço preenchido, e basta o GPS ser negado para cair nesse ramo. Severidade médio proporcional — o Google ainda devolve algo, porém baseado no IP.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0353 · MÉDIO · `CONFIRMADO`

**Qualquer toque fora do card fecha o modal SOS e cancela silenciosamente a contagem de 3s para a ligação**

**Onde:** `src/components/SOSEmergencyModal.jsx:205`

**O defeito:** O backdrop de tela cheia tem `onClick={() => { triggerVibration(); onClose(); }}`. Como o container interno tem `maxWidth: 560px` e o backdrop cobre 100% da viewport com apenas 16px de padding, um toque em qualquer margem desmonta o modal. Se a contagem anti-clique-acidental (`countdown`) estiver em andamento, o desmonte limpa o `setTimeout` (linha 96) e a ligação para 192/193 nunca acontece, sem nenhum aviso.

**Como falha:** Paciente em crise toca em "📞 192 LIGAR SAMU", aparece "LIGANDO PARA O SAMU (192) EM: 3s". Com a mão tremendo ele encosta na lateral escura da tela: o modal fecha, a contagem morre e a ligação para o SAMU não é feita. O paciente não recebe nenhuma indicação de que a chamada foi abortada.

**Código atual:**

```jsx
}} onClick={() => { triggerVibration(); onClose(); }}>
```

**Correção sugerida:** Ignorar o clique no backdrop enquanto `countdown !== null` (ou pedir confirmação antes de fechar durante a contagem).

<details><summary>Verificação feita contra o código</summary>

Confirmado: o backdrop fixo de tela cheia (linhas 190-205) tem `onClick={() => { triggerVibration(); onClose(); }}` e o container interno (`maxWidth: 560px`) apenas faz `stopPropagation` (linha 227). O efeito da contagem retorna `clearTimeout(timer)` (linha 96), então o desmonte pelo fechamento aborta a ligação sem nenhum aviso — o `tel:` da linha 92 só dispara com `countdown === 0`. Cenário alcançável em tela de emergência com toque impreciso. Severidade médio mantida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0404 · MÉDIO · `CONFIRMAR-SCHEMA`

**Endereço e coordenadas do paciente ficam no localStorage sem expiração e não são apagados no logout**

**Onde:** `src/services/locationService.js:43`

**O defeito:** O cache de geocodificação (`irec_geocode_cache_<id>_<endereço>`, com o endereço completo embutido na própria chave e lat/lon + `display_name` no valor) é gravado sem timestamp nem TTL, e o cache de recursos (`irec_resources_cache_<lat>_<lon>`) guarda a coordenada residencial do paciente. Nenhuma dessas chaves é removida em `handleLogout` (src/App.jsx linhas 652-668, que só apaga `irec_active_user`, `irec_active_tab`, `irec_selected_patient` e as chaves de aba). Em um app de saúde com controle de acesso LGPD (auditLogger), isso é vazamento de dado pessoal entre usuários do mesmo dispositivo.

**Como falha:** Em um tablet compartilhado de UBS, o paciente A usa o app e sai da conta. O paciente B (ou qualquer pessoa com acesso ao aparelho) abre o DevTools/console e lê em `localStorage` a chave `irec_geocode_cache_<id-do-A>_Rua_X_123__Centro__Itapuranga_-_GO_Brasil` com o endereço residencial completo e as coordenadas exatas da casa do paciente A.

**Código atual:**

```jsx
const cacheKey = `irec_geocode_cache_${profile.id || 'guest'}_${query.replace(/\s+/g, '_')}`;
  ...
      localStorage.setItem(cacheKey, JSON.stringify(result));
```

**Correção sugerida:** No `handleLogout`, varrer `Object.keys(localStorage)` e remover as chaves com prefixo `irec_geocode_cache_` e `irec_resources_cache_`, além de adicionar TTL ao cache de geocodificação.

<details><summary>Verificação feita contra o código</summary>

Confirmado dos dois lados: a chave `irec_geocode_cache_${profile.id}_${query...}` (linha 43) embute o endereço completo no próprio nome e o valor guarda lat/lon e `display_name`, gravado sem timestamp nem TTL (linhas 68-72 e 89-93); o cache de recursos (linha 117) guarda a coordenada. E `handleLogout` em src/App.jsx:652-668 remove apenas `irec_active_user`, `irec_active_tab`, `irec_selected_patient` e as quatro chaves de aba — nenhuma chave de localização. Em dispositivo compartilhado o dado do usuário anterior permanece legível. Severidade médio proporcional (exige acesso local ao aparelho).

</details>

> ⚠️ **Antes de aplicar:** confirme o nome real do campo/coluna contra o schema do Supabase. A sugestão acima foi inferida de `src/services/supabaseService.js`, sem acesso ao banco. Se o schema divergir, corrija a sugestão — não aplique às cegas.

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0405 · MÉDIO · `VERIFICAR`

**Abort do cliente em 3s é menor que o timeout de 8s declarado na própria query Overpass**

**Onde:** `src/services/locationService.js:235`

**O defeito:** A query é montada com `[out:json][timeout:8]`, autorizando o servidor a levar até 8 segundos, mas `fetchFromMirror` aborta a requisição em 3000 ms. Em regiões com muitos elementos (capitais, raio de 7 km, 6 cláusulas `nwr`) o Overpass rotineiramente responde entre 3 e 8 segundos, de modo que todos os mirrors são abortados sempre e o resultado real do Overpass nunca é aproveitado — o código cai perpetuamente no fallback pobre do Nominatim.

**Como falha:** Paciente em São Paulo abre o painel de recursos locais. Os 4 mirrors Overpass são abortados em 3s (log "All Overpass parallel interpreter queries failed or timed out"), e a lista é preenchida apenas por buscas textuais do Nominatim ("hospital, São Paulo"), que retornam poucos e imprecisos resultados, com telefone "192 / Não informado" para todos.

**Código atual:**

```jsx
const query = `[out:json][timeout:8];(...
...
const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
```

**Correção sugerida:** Alinhar os dois valores (ex.: `[timeout:6]` na query e `abort()` em 7000 ms), mantendo o abort do cliente maior que o timeout declarado ao servidor.

<details><summary>Verificação feita contra o código</summary>

A incoerência é real e verificada: a query da linha 211 declara `[out:json][timeout:8]` e `fetchFromMirror` aborta em `setTimeout(() => controller.abort(), 3000)` na linha 235 — os 5 segundos extras autorizados ao servidor nunca podem ser usados. Porém a afirmação de que "todos os mirrors são abortados sempre" não é verificável estaticamente: são 4 mirrors em paralelo via `Promise.any` (linha 274), e alguns (kumi.systems) costumam responder abaixo de 3s. O impacto depende da latência real do serviço e da densidade da região, daí PLAUSÍVEL.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0406 · MÉDIO · `CONFIRMADO`

**Telefone ausente é substituído pela string "192 / Não informado", exibida como número do hospital**

**Onde:** `src/services/locationService.js:305`

**O defeito:** Quando o OSM/Nominatim não traz telefone, o campo recebe a string literal `'192 / Não informado'` (linhas 305 e 403), que LocalResourcesPanel.jsx renderiza cru no lugar do telefone: `📞 Tel: {hosp.phone}` (linhas 147, 324 e 371). O resultado é um "telefone" que não é um telefone, num contexto em que o usuário vai tentar discar.

**Como falha:** Paciente vê o card "Hospital Municipal — 📞 Tel: 192 / Não informado", entende que aquele é o telefone do hospital e tenta digitar/copiar "192 / Não informado" no discador, ou liga para o 192 (SAMU) achando estar ligando para a recepção do hospital.

**Código atual:**

```jsx
const phone = el.tags.phone || el.tags['contact:phone'] || '192 / Não informado';
```

**Correção sugerida:** Guardar `phone: null` quando não houver telefone e omitir a linha `📞 Tel:` na UI (ou exibir "Telefone não informado" sem o número 192).

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 305 (Overpass) e 403 (fallback Nominatim, onde o telefone é sempre essa string), e na renderização crua `📞 Tel: {hosp.phone}` em LocalResourcesPanel.jsx:147, :324 e :371. O usuário lê um campo rotulado como telefone contendo um texto que não é telefone, num contexto em que vai tentar discar, e o "192" embutido induz a ligar para o SAMU achando ligar para a recepção do hospital. Severidade médio mantida.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0505 · BAIXO · `CONFIRMADO`

**No modo compacto o erro é engolido e a falha de localização aparece como "nenhum hospital encontrado"**

**Onde:** `src/components/LocalResourcesPanel.jsx:136`

**O defeito:** O bloco `if (compact)` retorna um card que nunca renderiza o estado `error`, apesar de os efeitos preencherem essa mensagem. Qualquer falha (GPS negado, geocode nulo, exceção no fetch) resulta na mesma frase genérica "Nenhum hospital encontrado no raio de busca local.", que afirma um fato falso sobre a rede de saúde em vez de reportar a falha real.

**Como falha:** Paciente negou a permissão de localização e não tem endereço no cadastro. No dashboard, sob o rótulo "PRONTO SOCORRO MAIS PRÓXIMO (REAL)", ele lê "Nenhum hospital encontrado no raio de busca local." e conclui que não existe pronto-socorro na sua região, quando o problema é apenas a localização não resolvida — e não há botão nem instrução para corrigir.

**Código atual:**

```jsx
if (compact) {
    const closestHospital = hospitals[0];
    return (
      <div ...>
        ...
        ) : (
          <p ...>Nenhum hospital encontrado no raio de busca local.</p>
        )}
```

**Correção sugerida:** No bloco `if (compact)`, renderizar `error` quando presente, com um botão para tentar novamente ou completar o endereço.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 136-154: o retorno do modo compacto renderiza apenas três estados (carregando, hospital mais próximo, ou a frase fixa "Nenhum hospital encontrado no raio de busca local.") e em nenhum momento lê o estado `error`, embora os efeitos o preencham nas linhas 65, 70 e 93. Sob o rótulo "Pronto Socorro Mais Próximo (Real)" (linha 140), uma falha de GPS/geocode é comunicada como afirmação factual sobre a inexistência de pronto-socorro, sem ação corretiva oferecida. Severidade baixo apropriada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0506 · BAIXO · `CONFIRMADO`

**Coordenadas precisas do paciente são enviadas ao Google em query string, via iframe e links, sem consentimento**

**Onde:** `src/components/LocalResourcesPanel.jsx:280`

**O defeito:** O `src` do iframe embute a latitude/longitude exata do paciente (`maps.google.com/maps?q=hospitais+{lat},{lon}...&output=embed`) e é carregado automaticamente assim que a localização é resolvida, sem interação do usuário. Os links de rota também levam `origin={coords.lat},{coords.lon}` (linhas 326 e 373) e os botões de busca levam `center=` (linhas 343, 390, 424, 433). O iframe não define `referrerPolicy` nem `sandbox`, e nenhuma dessas transferências de dado pessoal de localização a terceiro é informada ou consentida.

**Como falha:** Ao abrir o dashboard, sem clicar em nada, a residência (ou a posição em tempo real) do paciente é transmitida ao Google em parâmetro de URL, junto com o Referer da aplicação de saúde, ficando registrada nos logs do terceiro — tratamento de dado pessoal de geolocalização vinculado a contexto de saúde sem base legal explícita no app.

**Código atual:**

```jsx
src={
              googleEmbedQuery === 'hospital'
                ? `https://maps.google.com/maps?q=hospitais+${coords.lat},${coords.lon}&t=&z=${mapZoom}&ie=UTF8&iwloc=&output=embed`
                : `https://maps.google.com/maps?q=farmacias+${coords.lat},${coords.lon}&t=&z=${mapZoom}&ie=UTF8&iwloc=&output=embed`
            }
```

**Correção sugerida:** Adicionar `referrerPolicy="no-referrer"` (e `sandbox`) ao iframe e informar no painel que a localização é enviada ao Google Maps.

<details><summary>Verificação feita contra o código</summary>

O código é como descrito: `src` do iframe embute `${coords.lat},${coords.lon}` (linhas 279-281) sem `referrerPolicy` nem `sandbox`, e os links de rota levam `origin=` (linhas 326 e 373) e os de busca `center=` (linhas 343, 390 e seguintes). Mas o cenário está errado num ponto decisivo: o bloco `if (compact)` retorna antes (linhas 136-154), então o iframe só existe no painel completo, que Dashboard.jsx:933 renderiza dentro do modal aberto deliberadamente pelo usuário — não "ao abrir o dashboard, sem clicar em nada". Por isso reduzo de médio para baixo: resta a ausência de `referrerPolicy` e de aviso de compartilhamento com terceiro.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0507 · BAIXO · `CONFIRMADO`

**Bloco `<style>` com keyframes `spin` é código morto injetado em escopo global a cada mount**

**Onde:** `src/components/LocalResourcesPanel.jsx:300`

**O defeito:** O componente injeta `@keyframes spin` mas nenhum elemento do arquivo usa `animation` (verificado por busca: `spin` só ocorre na linha 301, e não há nenhuma propriedade `animation` no arquivo). Sobrou de um spinner removido; o `<style>` sem escopo é reinserido no documento a cada montagem do painel (que ocorre duas vezes simultaneamente quando o modal do mapa está aberto).

**Como falha:** Nenhum indicador de carregamento gira; o usuário só vê o texto "Buscando hospitais..." durante os até 15 s de cadeia de requisições, sem feedback visual de progresso, enquanto regras `@keyframes` duplicadas são acumuladas no documento.

**Código atual:**

```jsx
<style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
```

**Correção sugerida:** Remover o bloco `<style>` ou aplicar `animation: spin 1s linear infinite` a um elemento de carregamento real.

<details><summary>Verificação feita contra o código</summary>

Grep no arquivo confirma que `spin` só aparece na linha 301 e que não há nenhuma propriedade `animation` — o `@keyframes` é código morto, reinserido no documento a cada montagem (duas montagens simultâneas com o modal do mapa aberto). Reduzo a avaliação de impacto: o "cenário de falha" descrito é apenas a ausência de spinner, isto é, estilo/limpeza, sem consequência funcional. Mantenho baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0526 · BAIXO · `CONFIRMADO`

**Detecção de iOS por user agent falha em iPad (iPadOS 13+) e abre o guia na aba errada**

**Onde:** `src/components/PermissionsGuideModal.jsx:5`

**O defeito:** `/iPhone|iPad|iPod/i.test(navigator.userAgent)` não identifica iPads a partir do iPadOS 13, cujo Safari envia por padrão um user agent de desktop ("Macintosh; Intel Mac OS X") sem a palavra "iPad". Consequentemente `isIOSDevice` é false e o modal abre na aba "Android", exibindo passos que não existem no iPad.

**Como falha:** Paciente idoso usando iPad abre o guia de permissões e recebe a instrução "Vá nas Configurações ⚙️ ➔ Aplicativos ➔ Chrome / iRec" e "Toque no botão verde Instalar App" — caminhos inexistentes no iPadOS. Ele não consegue liberar câmera/microfone para a teleconsulta nem instalar o app, e a explicação por voz repete a mesma orientação errada.

**Código atual:**

```jsx
const isIOSDevice = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const [activeTab, setActiveTab] = useState(isIOSDevice ? 'ios' : 'android');
```

**Correção sugerida:** Detectar iPadOS com `/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)`.

<details><summary>Verificação feita contra o código</summary>

Confirmado na linha 5: `/iPhone|iPad|iPod/i.test(navigator.userAgent)` sem checagem complementar de `navigator.maxTouchPoints`, e o resultado define a aba inicial na linha 6. O Safari do iPadOS 13+ envia por padrão UA de "Macintosh; Intel Mac OS X", então `isIOSDevice` é false e o guia abre em Android, exibindo passos inexistentes (linhas 174-187) — o mesmo padrão frágil se repete em App.jsx:175. Reduzo de médio para baixo: o modal tem seletor de abas visível (linhas 74+), então o usuário pode corrigir com um toque; é um padrão inicial errado, não um beco sem saída.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0527 · BAIXO · `CONFIRMADO`

**Botão de fechar do guia de permissões não tem nome acessível e o diálogo não tem role, foco ou Esc**

**Onde:** `src/components/PermissionsGuideModal.jsx:65`

**O defeito:** O botão de fechar tem como conteúdo apenas o caractere "×" e nenhum `aria-label`/`title`, portanto é anunciado como "times"/"multiplicação" ou simplesmente "botão" por leitores de tela. Além disso o overlay não tem `role="dialog"`/`aria-modal`, não move o foco para o modal, não prende o foco e não fecha com Escape; o backdrop também não fecha ao clique (diferente do padrão dos outros modais do app), então o único caminho é encontrar um dos dois botões.

**Como falha:** Usuário com leitor de tela abre o guia de permissões, navega por Tab e encontra um botão sem nome; o foco continua percorrendo o conteúdo atrás do modal e Escape não faz nada. Sem enxergar o "×", ele não sabe como sair da sobreposição que cobre toda a tela (z-index 999999).

**Código atual:**

```jsx
<button
            onClick={() => { triggerVibration(); onClose(); }}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '26px', cursor: 'pointer' }}
          >
            ×
          </button>
```

**Correção sugerida:** Adicionar `aria-label="Fechar"` ao botão × e `role="dialog" aria-modal="true"` com foco inicial e handler de Escape no overlay.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 65-70: o botão contém apenas o caractere "×" e não tem `aria-label` nem `title`. O overlay (linhas 22-36) não tem `role="dialog"`, `aria-modal`, `onClick` de fechar nem handler de teclado, e o componente não tem nenhum `useEffect` (só `useState` na linha 6), logo não move nem prende o foco e não trata Escape. Existe, porém, um segundo botão de fechar rotulado ao final do modal (linhas 193+), o que atenua o risco de aprisionamento. Severidade baixo apropriada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0537 · BAIXO · `VERIFICAR`

**Ativação da notificação pode travar para sempre em `serviceWorker.ready`, escondendo o botão sem criar notificação alguma**

**Onde:** `src/components/SOSEmergencyModal.jsx:57`

**O defeito:** `setNotificationActivated(true)` é executado ANTES do `await navigator.serviceWorker.ready`. Essa promise nunca rejeita: se nenhum service worker estiver registrado (origem sem HTTPS, dev server sem PWA, aba com SW desregistrado, iOS Safari fora do modo standalone), ela simplesmente nunca resolve. O código a seguir (`reg.showNotification` e o `alert` de sucesso) jamais executa, e o `catch` só faz `console.error(err)` — nenhum feedback ao usuário.

**Como falha:** Paciente com permissão de notificação concedida toca em "Ativar Notificação Fixa de SOS no Celular". O botão desaparece imediatamente (porque `notificationActivated` já virou true), mas nenhuma notificação é criada e o alert de confirmação nunca aparece. O paciente acredita que o atalho de emergência está ativo na barra do celular quando não há nada.

**Código atual:**

```jsx
const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setNotificationActivated(true);
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification(...)
        }
        alert("Notificação fixa de emergência ativada com sucesso no seu celular!");
      }
    } catch (err) {
      console.error(err);
    }
```

**Correção sugerida:** Mover `setNotificationActivated(true)` para depois do `showNotification`, aplicar um `Promise.race` com timeout em `serviceWorker.ready` e exibir alerta de falha no `catch`.

<details><summary>Verificação feita contra o código</summary>

A ordem descrita é real: `setNotificationActivated(true)` na linha 57 vem antes de `await navigator.serviceWorker.ready` na linha 59, e o `catch` (linhas 72-74) só faz `console.error`, sem feedback ao usuário — `serviceWorker.ready` de fato nunca rejeita, apenas fica pendente. Porém o registro existe (`navigator.serviceWorker.register('/sw.js')` em index.html:26), então em produção HTTPS a promise resolve normalmente; o travamento exige um cenário em que a API existe mas o registro falha (origem não segura, sw.js 404, SW desregistrado). Não consegui confirmar esse ambiente, por isso PLAUSÍVEL e severidade reduzida para baixo.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0538 · BAIXO · `CONFIRMADO`

**`window.open('_blank')` sem `noopener` dá referência `window.opener` à página aberta**

**Onde:** `src/components/SOSEmergencyModal.jsx:172`

**O defeito:** As três chamadas de `window.open(url, '_blank')` (linhas 172, 178 e 185) não passam `'noopener'` nas features, então o documento aberto recebe um `window.opener` apontando para a aplicação iRec autenticada, permitindo reverse tabnabbing (`opener.location = ...`) se a URL for redirecionada. Os links equivalentes em LocalResourcesPanel.jsx usam corretamente `rel="noopener noreferrer"`, evidenciando a inconsistência.

**Como falha:** Se a URL do Google Maps for interceptada/redirecionada (proxy corporativo, DNS hijack, encurtador futuro), a página aberta pode reescrever `window.opener.location` e substituir a aba do iRec por uma página falsa de login, capturando as credenciais do paciente.

**Código atual:**

```jsx
window.open(directMapsUrl, '_blank');
```

**Correção sugerida:** Passar `'noopener,noreferrer'` como terceiro argumento nas três chamadas de `window.open`.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 172, 178 e 185: as três chamadas usam `window.open(url, '_blank')` sem o terceiro argumento `'noopener'`. Ao contrário de `target="_blank"` em âncoras (onde noopener é implícito nos navegadores modernos, como nos links de LocalResourcesPanel.jsx:327-328), `window.open` continua entregando `window.opener` à janela aberta. Severidade baixo apropriada: o alvo é google.com e o ataque exige redirecionamento/interceptação da URL.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0539 · BAIXO · `CONFIRMADO`

**Modal SOS não é anunciado como diálogo, não fecha com Esc e o backdrop é uma div clicável sem role/foco**

**Onde:** `src/components/SOSEmergencyModal.jsx:190`

**O defeito:** O overlay é uma `<div>` com `onClick` e sem `role`, `tabIndex` ou `aria-label`; o container não tem `role="dialog"`/`aria-modal="true"`/`aria-labelledby`, não há armadilha de foco nem handler de tecla Escape, e o foco não é movido para o modal ao abrir. Trata-se de uma tela de emergência voltada também a usuários com deficiência (o app tem `uiMode: 'accessible'`).

**Como falha:** Usuário de leitor de tela aciona o SOS: o foco permanece no conteúdo atrás do overlay, o leitor continua lendo o dashboard como se o modal não existisse, e não há como fechar pelo teclado (Esc não faz nada e o backdrop clicável não é alcançável por Tab).

**Código atual:**

```jsx
<div style={{
      position: 'fixed',
      ... zIndex: 999999, ...
    }} onClick={() => { triggerVibration(); onClose(); }}>
```

**Correção sugerida:** Adicionar `role="dialog"` + `aria-modal="true"` + `aria-labelledby` no container, foco inicial no modal e handler de Escape chamando `onClose`.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 189-228: o overlay é uma `<div>` com `onClick` e sem `role`, `tabIndex` ou `aria-label`; o container interno não tem `role="dialog"`, `aria-modal` nem `aria-labelledby`; não há handler de `keydown` para Escape, armadilha de foco nem movimentação de foco na montagem (os únicos `useEffect` do arquivo tratam GPS, permissão de notificação e contagem). Severidade baixo mantida — é barreira de acessibilidade real, sem impacto funcional para usuários videntes.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0579 · BAIXO · `CONFIRMADO`

**Arredondamento dentro de `getDistance` inviabiliza o limiar de deduplicação de 50 metros**

**Onde:** `src/services/locationService.js:17`

**O defeito:** `getDistance` devolve `parseFloat(d.toFixed(2))`, ou seja, já arredondado para 10 metros. As verificações de duplicidade comparam esse valor arredondado com `< 0.05` (linhas 290-291 e 388-389), então distâncias reais entre 45 e 50 m arredondam para 0.05 e falham no teste (`0.05 < 0.05` é false), enquanto 44 m arredonda para 0.04 e passa. O limiar efetivo fica em ~45 m e é instável na fronteira.

**Como falha:** O Hospital São Francisco injetado manualmente (lat -15.562111) e o mesmo hospital mapeado no OSM a ~47 metros de distância não são detectados como duplicata: a lista mostra o mesmo hospital duas vezes, com endereços e telefones diferentes (um hardcoded, outro do OSM), ocupando 2 das 3 vagas de "hospital mais próximo".

**Código atual:**

```jsx
const d = R * c; // Distance in km
  return parseFloat(d.toFixed(2));
...
const isDupHosp = hospitals.some(h => getDistance(h.lat, h.lon, itemLat, itemLon) < 0.05);
```

**Correção sugerida:** Retornar a distância sem arredondar em `getDistance` (arredondando só na formatação da UI) ou usar `<= 0.05` nas comparações de duplicidade.

<details><summary>Verificação feita contra o código</summary>

Confirmado: `getDistance` retorna `parseFloat(d.toFixed(2))` (linha 17), ou seja, granularidade de 10 m, e a deduplicação compara esse valor arredondado com `< 0.05` nas linhas 290-291 e 388-389. Distâncias reais entre ~45 m e 50 m arredondam para 0.05 e reprovam no teste (`0.05 < 0.05` é falso), enquanto 44 m vira 0.04 e passa: o limiar efetivo é ~45 m e instável na fronteira. Combinado com os estabelecimentos injetados (item 50090), permite o mesmo hospital aparecer duas vezes. Severidade baixo apropriada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0580 · BAIXO · `CONFIRMADO`

**Geocodificação retorna null quando o perfil tem cidade mas não tem estado**

**Onde:** `src/services/locationService.js:35`

**O defeito:** As duas únicas condições exigem `state`: `street && city && state` ou `city && state`. Não há tentativa apenas com a cidade (que o Nominatim resolve bem com o sufixo ", Brasil"), então um perfil com cidade preenchida e UF vazia devolve `null` imediatamente.

**Como falha:** Paciente cadastra "Itapuranga" no campo cidade mas deixa o seletor de UF em branco. Com o GPS negado, o painel exibe "Não foi possível obter sua localização precisa do GPS nem encontrar seu endereço de cadastro." e nenhum hospital, embora a busca por "Itapuranga, Brasil" resolvesse.

**Código atual:**

```jsx
if (street && city && state) {
    query = `${street} ${number || ''}, ${neighborhood || ''}, ${city} - ${state}, Brasil`;
  } else if (city && state) {
    query = `${city} - ${state}, Brasil`;
  } else {
    return null;
  }
```

**Correção sugerida:** Adicionar um terceiro ramo `else if (city) { query = \`${city}, Brasil\`; }` antes do `return null`.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 34-41: as duas únicas montagens de query exigem `state` (`street && city && state` ou `city && state`), e o `else` retorna `null` de imediato, sem tentar apenas a cidade. Não há guarda nem tentativa alternativa. O cenário é alcançável por qualquer perfil com UF em branco combinado com GPS negado, resultando na mensagem de erro do painel sem nenhum hospital. Severidade baixo apropriada — depende de cadastro incompleto e do GPS falhar simultaneamente.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0581 · BAIXO · `CONFIRMADO`

**Geocodificação não verifica `res.ok`; resposta 429/403 lança exceção e pula o fallback cidade/estado**

**Onde:** `src/services/locationService.js:59`

**O defeito:** `await res.json()` é executado sem checar `res.ok`. O Nominatim responde 429 (rate limit) ou 403 com corpo HTML/texto — nesse caso `res.json()` lança `SyntaxError`, a execução salta direto para o `catch` da linha 97 e o bloco de fallback por cidade/estado (linhas 77-96) nunca roda. Uma degradação que existe no código fica inalcançável exatamente no cenário para o qual foi escrita.

**Como falha:** Vários pacientes do mesmo IP/rede (clínica, UBS com Wi-Fi compartilhado) abrem o painel; o Nominatim devolve 429. O geocode retorna `null`, o LocalResourcesPanel exibe "Não foi possível obter sua localização precisa do GPS nem encontrar seu endereço de cadastro." e nenhum hospital é listado, mesmo que a busca só por cidade/estado (que tem cache e é mais barata) funcionasse.

**Código atual:**

```jsx
let res = await fetch(url, { headers: { 'User-Agent': userAgent } });
    let data = await res.json();

    if (data && data.length > 0) {
```

**Correção sugerida:** Checar `if (!res.ok) throw new Error(res.status)` (ou tratar o status antes de `res.json()`) e manter o fallback de cidade/estado fora do bloco de erro da consulta precisa.

<details><summary>Verificação feita contra o código</summary>

Confirmado nas linhas 59-60 e 81-82: `await res.json()` sem checar `res.ok` (contraste com `fetchFromMirror`, linha 243, e com o reverse geocode, linha 347, que checam). Com corpo não-JSON (403/429 em HTML) `res.json()` lança e o fluxo salta para o `catch` da linha 97, ignorando o bloco de fallback por cidade/estado das linhas 77-96, que só é alcançado no caminho de sucesso com `data.length === 0`. Reduzo de médio para baixo: o fallback aponta para o mesmo host Nominatim, então sob 429 ele provavelmente também falharia — o ganho perdido é pequeno.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0582 · BAIXO · `CONFIRMADO`

**Chave de cache com 4 casas decimais cria entrada nova a cada leitura de GPS e nada expurga as vencidas**

**Onde:** `src/services/locationService.js:117`

**O defeito:** `irec_resources_cache_${numLat.toFixed(4)}_${numLon.toFixed(4)}` tem resolução de ~11 metros, então praticamente cada fix de GPS gera uma chave diferente (o cache quase nunca acerta para usuários com GPS ativo). Como nenhuma rotina remove entradas expiradas, o localStorage acumula indefinidamente payloads completos de hospitais/farmácias até estourar a cota — e a falha do `setItem` é engolida com `console.debug`.

**Como falha:** Paciente que usa o app diariamente com GPS acumula centenas de entradas `irec_resources_cache_*`. Ao atingir a cota de ~5 MB, o `setItem` passa a lançar QuotaExceededError silenciosamente aqui e, pior, também nas outras escritas do app (perfil, entradas clínicas, logs LGPD) que compartilham o mesmo armazenamento.

**Código atual:**

```jsx
const cacheKey = `irec_resources_cache_${numLat.toFixed(4)}_${numLon.toFixed(4)}`;
```

**Correção sugerida:** Arredondar a chave para 2 casas (~1 km) e, antes de gravar, remover as entradas `irec_resources_cache_*` com timestamp expirado.

<details><summary>Verificação feita contra o código</summary>

Confirmado na linha 117: `irec_resources_cache_${numLat.toFixed(4)}_${numLon.toFixed(4)}` tem resolução de ~11 m, então cada novo fix de GPS gera chave distinta e o cache raramente acerta para quem usa localização precisa. Não há nenhuma rotina de expurgo no arquivo (o TTL de 3h da linha 123 só evita usar o valor, nunca o remove) e a falha do `setItem` é engolida em `console.debug` (linhas 445-447). Severidade baixo apropriada: cada payload é pequeno e chegar à cota exige uso prolongado.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0583 · BAIXO · `VERIFICAR`

**`el.tags.amenity` sem guarda: um elemento sem `tags` derruba toda a busca de recursos**

**Onde:** `src/services/locationService.js:294`

**O defeito:** Dentro do `forEach` sobre `rawElements`, as tags são acessadas sem verificação (`el.tags.amenity`, `el.tags.healthcare`, `el.tags.shop`, `el.tags.name`, `el.tags['addr:street']`). Se qualquer mirror devolver um elemento sem a propriedade `tags`, é lançado `TypeError: Cannot read properties of undefined (reading 'amenity')`, que não é capturado dentro de `fetchNearbyHealthcareResources` e propaga para o chamador, abortando também o fallback Nominatim, a ordenação e a gravação do cache.

**Como falha:** Um dos mirrors Overpass devolve na lista de `elements` um objeto sem tags (elemento de geometria/membro). A exceção sobe até o `catch` do efeito em LocalResourcesPanel.jsx (linha 91) e o painel inteiro mostra "Erro ao carregar farmácias e hospitais da rede de dados do mapa.", sem hospital nenhum — inclusive descartando os resultados que já haviam sido coletados.

**Código atual:**

```jsx
const amenity = el.tags.amenity || '';
      const healthcare = el.tags.healthcare || '';
      const shop = el.tags.shop || '';
```

**Correção sugerida:** Iniciar o callback com `const tags = el.tags || {};` e usar `tags.` em todos os acessos subsequentes.

<details><summary>Verificação feita contra o código</summary>

O acesso sem guarda é real (linhas 294-305: `el.tags.amenity`, `el.tags.healthcare`, `el.tags.shop`, `el.tags.name`, `el.tags['addr:street']`), e o `forEach` das linhas 283-323 está fora de qualquer try/catch — o único try da região envolve apenas o fetch dos mirrors (linhas 273-279) — logo um TypeError propagaria para o `catch` do efeito em LocalResourcesPanel.jsx:91, descartando também fallback, ordenação e cache. Contudo a query filtra por tags e usa `out center;`, de modo que o Overpass sempre devolve `tags` nos elementos correspondentes; a falha depende de um comportamento de mirror que não consigo confirmar. Severidade baixo apropriada.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## IREC-0584 · BAIXO · `CONFIRMADO`

**`id: el.id` sem o tipo do elemento OSM gera keys React duplicadas na lista de resultados**

**Onde:** `src/services/locationService.js:309`

**O defeito:** A query usa `nwr` (nodes, ways e relations) e o objeto de recurso recebe `id: el.id`. Ids do OpenStreetMap são únicos apenas dentro de cada tipo: o node 123456 e a way 123456 são entidades distintas com o mesmo número. LocalResourcesPanel.jsx usa esse valor como key (`key={hosp.id}` na linha 318 e `key={pharm.id}` na linha 365), então duas entidades diferentes podem colidir.

**Como falha:** Numa cidade onde o Overpass devolve um posto de saúde mapeado como node e um hospital mapeado como way com o mesmo número de id, e ambos caem entre os 3 mais próximos, o React emite "Encountered two children with the same key" e reaproveita/embaralha os nós do DOM: o paciente vê o nome de um estabelecimento com o telefone e o link "Como Chegar" do outro.

**Código atual:**

```jsx
const resource = {
        id: el.id,
        name,
        lat: itemLat,
```

**Correção sugerida:** Usar `id: \`${el.type}_${el.id}\`` ao montar o recurso a partir dos elementos do Overpass.

<details><summary>Verificação feita contra o código</summary>

Confirmado: a query usa `nwr` (linhas 212-217), portanto o resultado mistura nodes, ways e relations, cujos ids só são únicos dentro de cada tipo, e o recurso recebe `id: el.id` puro (linha 309). LocalResourcesPanel.jsx usa esse valor como key em `key={hosp.id}` (linha 318) e `key={pharm.id}` (linha 365). Reduzo de médio para baixo: a colisão exige dois ids numéricos idênticos de tipos diferentes, na mesma lista, e ambos dentro dos 3/4 itens renderizados após o corte por distância — probabilidade muito baixa, ainda que o defeito de modelagem seja real.

</details>

**Feito quando:** reproduzir o cenário acima e o resultado errado não ocorrer mais.

---

## Verificação do módulo

Rode ao terminar todos os itens acima:

```bash
npx eslint . 2>&1 | grep -E "LocalResourcesPanel.jsx|PermissionsGuideModal.jsx|SOSEmergencyModal.jsx|locationService.js"
```

```bash
npx vite build
```

O build precisa passar. O ESLint não pode ter ganho erro novo nestes arquivos.
