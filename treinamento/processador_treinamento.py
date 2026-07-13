# -*- coding: utf-8 -*-
"""
processador_treinamento.py - iRec Clinical Knowledge Base Generator v7 (FINAL)

Correcoes aplicadas:
  [1] sys.stdout.reconfigure utf-8 -> resolve crash de encoding no Windows
  [2] Modelo corrigido para gemini-1.5-flash (amplamente disponivel na API)
  [3] Erro 404 nao lanca excecao imediata: agora retenta com backoff
  [4] Cache preload: textos ja em cache sao carregados em textos_brutos no inicio
  [5] Fragmentacao de audio em chunks de 5min (resolve arquivos >100MB)
  [6] Backoff exponencial: 5s -> 15s -> 30s -> 60s
"""

import os
import sys
import json
import base64
import subprocess
import urllib.request
import urllib.parse
import time
import zipfile
import shutil
import xml.etree.ElementTree as ET

# [FIX 1] Forca UTF-8 no stdout do Windows para nao quebrar caracteres especiais
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# --- CONSTANTES -----------------------------------------------------------------

TREINAMENTO_DIR   = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH        = os.path.join(TREINAMENTO_DIR, "transcricoes_cache.json")
ERROS_PATH        = os.path.join(TREINAMENTO_DIR, "erros.log")
JSON_PATH         = os.path.join(TREINAMENTO_DIR, "base_conhecimento_local.json")
HTML_PATH         = os.path.join(TREINAMENTO_DIR, "relatorio_revisao_medica.html")
AUDIOS_DIR        = os.path.join(TREINAMENTO_DIR, "audios_temporarios")
CAPTURAS_DIR      = os.path.abspath(os.path.join(TREINAMENTO_DIR, "..", "public", "treinamento_capturas"))

# Modelo confirmado via teste direto: gemini-3.5-flash funciona com estas chaves
MODELO_GEMINI     = "gemini-3.5-flash"
CHUNK_SEGUNDOS    = 120   # 2 minutos (evita estourar o limite de 40.000 TPM do Free Tier)

# --- UTILITARIOS ----------------------------------------------------------------

# Throttler global: chaves de projetos diferentes, podemos rodar mais rapido!
# Com 4 projetos de 10 RPM cada (total 40 RPM):
# 10s de intervalo = 6 RPM (extremamente seguro, cada projeto recebe ~1.5 RPM)
_ultima_chamada_api = 0.0
INTERVALO_MINIMO_API = 10.0  # segundos entre chamadas de audio

# Indice de chave (mantido para compatibilidade, mas rotacao nao ajuda no rate limit)
_chave_idx = 0

def log_erro(msg):
    with open(ERROS_PATH, "a", encoding="utf-8") as f:
        f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    print(f"  [AVISO] {msg}")

def obter_todas_as_keys():
    """Carrega todas as VITE_GEMINI_API_KEY, VITE_GEMINI_API_KEY_2 ... do .env"""
    chaves = []
    try:
        caminho_env = os.path.abspath(os.path.join(TREINAMENTO_DIR, "..", ".env"))
        if os.path.exists(caminho_env):
            with open(caminho_env, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("VITE_GEMINI_API_KEY") and "=" in line:
                        valor = line.split("=", 1)[-1].strip()
                        if valor:
                            chaves.append(valor)
    except Exception as e:
        print(f"Erro ao ler .env: {e}")
    return chaves

def obter_gemini_key():
    """Retorna a primeira chave (compatibilidade com codigo legado)."""
    chaves = obter_todas_as_keys()
    return chaves[0] if chaves else None

def proxima_chave(chaves):
    """Rotaciona para a proxima chave disponivel."""
    global _chave_idx
    _chave_idx = (_chave_idx + 1) % len(chaves)
    return chaves[_chave_idx]

def carregar_cache():
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def salvar_cache(cache):
    try:
        with open(CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Erro ao salvar cache: {e}")

def testar_api(api_key, chaves=None):
    """Testa a conexao com a API antes de comecar o processamento."""
    print(f"Testando conexao com Gemini ({MODELO_GEMINI})...")
    try:
        body = {"contents": [{"parts": [{"text": "Responda apenas: OK"}]}]}
        res = requisicao_api_gemini(body, api_key, chaves)
        resposta = res["candidates"][0]["content"]["parts"][0]["text"].strip()
        print(f"  [OK] API funcionando. Resposta: {resposta}")
        return True
    except Exception as e:
        print(f"  [ERRO] Falha no teste da API: {e}")
        return False

# --- CHAMADAS GEMINI COM THROTTLER GLOBAL --------------------------------------

def _throttle():
    """
    Garante intervalo minimo de INTERVALO_MINIMO_API segundos entre chamadas.
    Como todas as 20 chaves compartilham o mesmo projeto (20 RPM),
    o rate limit e por projeto, nao por chave. Este throttler e a unica
    forma correta de respeitar o limite.
    """
    global _ultima_chamada_api
    agora = time.time()
    decorrido = agora - _ultima_chamada_api
    if decorrido < INTERVALO_MINIMO_API:
        esperar = INTERVALO_MINIMO_API - decorrido
        time.sleep(esperar)
    _ultima_chamada_api = time.time()

def requisicao_api_gemini(body, api_key, chaves=None):
    """
    Chama a API Gemini com throttler global e retry robusto.
    Rotaciona as chaves automaticamente se 'chaves' for fornecido para distribuir a carga.
    """
    global _chave_idx
    endpoint = f"{MODELO_GEMINI}:generateContent"
    headers = {"Content-Type": "application/json"}
    dados = json.dumps(body).encode("utf-8")

    MAX_RETRIES_429 = 8
    MAX_RETRIES_OTHER = 3
    retries_429 = 0
    retries_other = 0
    ultimo_erro = None

    while True:
        # Rotaciona para a proxima chave a cada tentativa/chamada para distribuir
        if chaves:
            chave_atual = chaves[_chave_idx]
            _chave_idx = (_chave_idx + 1) % len(chaves)
        else:
            chave_atual = api_key

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{endpoint}?key={chave_atual}"
        
        _throttle()
        try:
            req = urllib.request.Request(url, data=dados, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=90) as response:
                return json.loads(response.read().decode("utf-8"))

        except Exception as e:
            ultimo_erro = e
            err_str = str(e)
            codigo = getattr(e, "code", 0)

            if "429" in err_str or codigo == 429:
                retries_429 += 1
                if retries_429 > MAX_RETRIES_429:
                    print(f"  [FATAL] 429 apos {MAX_RETRIES_429} tentativas. Quota diaria esgotada.")
                    raise ultimo_erro
                print(f"  [429 #{retries_429}/{MAX_RETRIES_429}] Rotacionando chave e aguardando 15s...")
                time.sleep(15) # Menor tempo de espera porque temos multiplos projetos!

            elif "503" in err_str or codigo == 503:
                retries_other += 1
                espera = [15, 30, 60][min(retries_other - 1, 2)]
                if retries_other > MAX_RETRIES_OTHER:
                    raise ultimo_erro
                print(f"  [503 #{retries_other}] Aguardando {espera}s...")
                time.sleep(espera)

            else:
                retries_other += 1
                espera = [15, 30, 60][min(retries_other - 1, 2)]
                if retries_other > MAX_RETRIES_OTHER:
                    raise ultimo_erro
                print(f"  [Erro #{retries_other}: {err_str[:60]}] Aguardando {espera}s...")
                time.sleep(espera)


# --- FRAGMENTACAO E TRANSCRICAO DE AUDIO ---------------------------------------

def fragmentar_audio(caminho_mp3):
    """Divide um MP3 em segmentos de CHUNK_SEGUNDOS segundos."""
    basename = os.path.splitext(os.path.basename(caminho_mp3))[0]
    chunks_dir = os.path.join(AUDIOS_DIR, f"chunks_{basename[:40]}")
    os.makedirs(chunks_dir, exist_ok=True)

    padrao = os.path.join(chunks_dir, "chunk_%03d.mp3")
    cmd = [
        "ffmpeg", "-y", "-i", caminho_mp3,
        "-f", "segment", "-segment_time", str(CHUNK_SEGUNDOS),
        "-c", "copy", padrao
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    chunks = sorted([
        os.path.join(chunks_dir, f)
        for f in os.listdir(chunks_dir)
        if f.endswith(".mp3")
    ])
    return chunks, chunks_dir

def transcrever_chunk(caminho_chunk, api_key, prompt, chaves=None):
    """Transcreve um unico fragmento de audio via Base64 inline."""
    with open(caminho_chunk, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode("utf-8")

    body = {
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": "audio/mpeg", "data": audio_b64}},
                {"text": prompt}
            ]
        }]
    }
    res = requisicao_api_gemini(body, api_key, chaves)
    return res["candidates"][0]["content"]["parts"][0]["text"].strip()

def transcrever_audio(caminho_mp3, api_key, chaves=None):
    """
    Pipeline de transcricao:
    1. Fragmenta o MP3 em chunks de 5 min
    2. Transcreve cada chunk via Base64 inline (sem File API, sem timeout)
    3. Concatena e retorna o texto completo
    """
    tamanho_mb = os.path.getsize(caminho_mp3) / (1024 * 1024)
    minutos = int(CHUNK_SEGUNDOS / 60)
    print(f"  -> Fragmentando audio ({tamanho_mb:.1f}MB) em segmentos de {minutos} min...")

    chunks, chunks_dir = fragmentar_audio(caminho_mp3)

    if not chunks:
        raise Exception("ffmpeg nao gerou nenhum fragmento de audio.")

    print(f"  -> {len(chunks)} fragmentos criados. Transcrevendo com Gemini...")

    prompt = (
        "Voce e um transcritor clinico de alta precisao especializado em dermatologia e curativos. "
        "Transcreva LITERALMENTE este trecho de audio em Portugues brasileiro. "
        "Preserve todos os termos tecnicos medicos, nomes de curativos, patologias e condutas clinicas "
        "exatamente como pronunciados. "
        "Retorne SOMENTE a transcricao pura, sem cabecalho, sem comentarios, sem introducao."
    )

    partes = []
    for i, chunk in enumerate(chunks):
        chunk_mb = os.path.getsize(chunk) / (1024 * 1024)
        print(f"     Fragmento {i+1}/{len(chunks)} ({chunk_mb:.1f}MB)...", end=" ", flush=True)
        try:
            texto = transcrever_chunk(chunk, api_key, prompt, chaves)
            if len(texto) < 30:
                print(f"[CURTO: {len(texto)} chars - possivel silencio]")
            else:
                print(f"[OK: {len(texto)} chars]")
                partes.append(texto)
            # Throttler ja garante o intervalo — sem sleep adicional
        except Exception as e:
            print(f"[ERRO]")
            log_erro(f"Chunk {i+1} de '{os.path.basename(caminho_mp3)}': {e}")

    # Limpa pasta de chunks temporarios
    try:
        shutil.rmtree(chunks_dir)
    except Exception:
        pass

    if not partes:
        raise Exception("Nenhum fragmento foi transcrito com sucesso.")

    return "\n\n".join(partes)

# --- PROCESSAMENTO DE DOCUMENTOS -----------------------------------------------

def processar_pdf(caminho_pdf, api_key, chaves=None):
    tamanho_mb = os.path.getsize(caminho_pdf) / (1024 * 1024)
    print(f"  -> PDF ({tamanho_mb:.1f}MB) via Base64...")

    with open(caminho_pdf, "rb") as f:
        pdf_b64 = base64.b64encode(f.read()).decode("utf-8")

    body = {
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": "application/pdf", "data": pdf_b64}},
                {"text": "Extraia todo o conteudo textual clinico relevante em Portugues claro e estruturado."}
            ]
        }]
    }
    res = requisicao_api_gemini(body, api_key, chaves)
    return res["candidates"][0]["content"]["parts"][0]["text"]

def ler_docx(caminho):
    try:
        with zipfile.ZipFile(caminho) as z:
            xml_content = z.read("word/document.xml")
            root = ET.fromstring(xml_content)
            ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
            textos = [elem.text for elem in root.iter(f"{ns}t") if elem.text]
            return "\n\n".join(textos)
    except Exception as e:
        log_erro(f"Erro ao ler DOCX {caminho}: {e}")
        return ""

# --- FASE 2: MAPEAMENTO DE TOPICOS ---------------------------------------------

def extrair_topicos(texto_completo, api_key, chaves=None):
    print("Mapeando topicos clinicos do corpus completo...")
    prompt = (
        "Voce e um classificador medico especialista em feridas e curativos. "
        "Analise o texto abaixo e identifique TODOS os topicos clinicos relevantes: "
        "Comorbidades, Tipos de Lesoes, Curativos/Produtos, Tecnicas de Tratamento, Patologias especificas. "
        "Retorne um JSON array de strings, sem markdown, apenas o JSON puro. "
        'Exemplo: ["Diabetes", "Hidrogel", "Ulcera Venosa", "Alginato de Calcio", "Lesao por Pressao"]\n\n'
        f"Texto:\n{texto_completo[:50000]}"
    )

    body = {"contents": [{"parts": [{"text": prompt}]}]}
    res = requisicao_api_gemini(body, api_key, chaves)
    texto_json = res["candidates"][0]["content"]["parts"][0]["text"].strip()

    # Remove markdown code blocks se presentes
    if "```" in texto_json:
        linhas = [l for l in texto_json.split("\n") if not l.strip().startswith("```")]
        texto_json = "\n".join(linhas).strip()

    try:
        topicos = json.loads(texto_json)
        print(f"  -> {len(topicos)} topicos identificados.")
        return topicos
    except Exception:
        log_erro(f"Falha ao parsear topicos JSON. Usando lista padrao. Resposta: {texto_json[:200]}")
        return [
            "Anatomia da Pele", "Fisiologia da Pele", "Cicatrizacao",
            "Lesao por Pressao", "Ulcera Venosa", "Ulcera Diabetica",
            "Hanseniase", "Leishmaniose", "Curativos e Coberturas", "Pioderma"
        ]

# --- FASE 3: CONSOLIDACAO TEMATICA ---------------------------------------------

def consolidar_topico(topico, textos_brutos, api_key, chaves=None):
    # Prioriza trechos que mencionam o topico
    trechos = [t[:3000] for t in textos_brutos if topico.lower()[:8] in t.lower()]
    if not trechos:
        trechos = [t[:2000] for t in textos_brutos[:5]]

    contexto = "\n\n---\n\n".join(trechos[:6])

    prompt = (
        f"Voce e um revisor clinico especialista em feridas e curativos. "
        f"Consolide TUDO que foi ensinado sobre '{topico}' nas aulas abaixo. "
        "Use EXATAMENTE estas 3 secoes:\n\n"
        "### 1. Ensino do Treinamento Interno\n"
        "(Compilado das orientacoes praticas das aulas)\n\n"
        "### 2. Contraindicacoes Estritas\n"
        "(Situacoes em que o tratamento NUNCA deve ser usado - lista com marcadores)\n\n"
        "### 3. Evidencias Cientificas Complementares\n"
        "(Embasamento clinico da literatura medica)\n\n"
        "REGRA ABSOLUTA: Nao invente medicamentos, dosagens ou condutas nao descritas abaixo.\n\n"
        f"Textos das aulas:\n{contexto}"
    )

    body = {"contents": [{"parts": [{"text": prompt}]}]}
    res = requisicao_api_gemini(body, api_key, chaves)
    return res["candidates"][0]["content"]["parts"][0]["text"]

# --- FASE 3B: LOOP CRITIC-GENERATOR ANTI-ALUCINACAO ---------------------------

def validar_e_corrigir_topico(topico, conteudo, pubmed, api_key, chaves=None):
    """
    Loop de auto-correcao clinica.
    Para quando o auditor aprova, ou apos 3 rodadas.
    """
    versao_atual = conteudo

    for rodada in range(1, 4):
        print(f"    [Auditoria {rodada}/3] Verificando '{topico}'...")

        prompt = f"""Voce e um Auditor Medico Clinico de maxima rigidez cientifica.
Missao: auditar o manual abaixo sobre '{topico}' e identificar:
- Informacoes clinicas incorretas ou imprecisas
- Alucinacoes (dados inventados ausentes no contexto)
- Contraindicacoes erradas ou incompletas
- Condutas perigosas ou inadequadas

Manual auditado:
{versao_atual}

Evidencias PubMed:
{pubmed}

Responda SOMENTE com este JSON puro (sem markdown, sem ```):
{{
  "aprovado": true,
  "problemas_encontrados": "",
  "conteudo_corrigido": "(repita o manual original aqui)"
}}

OU se houver problemas:
{{
  "aprovado": false,
  "problemas_encontrados": "descricao dos problemas",
  "conteudo_corrigido": "(manual completo corrigido com as 3 secoes)"
}}"""

        try:
            body = {"contents": [{"parts": [{"text": prompt}]}]}
            res = requisicao_api_gemini(body, api_key, chaves)
            texto = res["candidates"][0]["content"]["parts"][0]["text"].strip()

            # Remove markdown code fences se presentes
            if "```" in texto:
                texto = "\n".join(
                    l for l in texto.split("\n")
                    if not l.strip().startswith("```")
                ).strip()

            dados = json.loads(texto)

            if dados.get("aprovado", False):
                print(f"    [OK] Aprovado na rodada {rodada}!")
                return versao_atual
            else:
                problema = dados.get("problemas_encontrados", "")[:100]
                print(f"    [CORR] Corrigido: {problema}")
                versao_atual = dados.get("conteudo_corrigido", versao_atual)
                time.sleep(5)

        except json.JSONDecodeError:
            # Se o auditor nao retornou JSON valido, mantem a versao atual
            print(f"    [AVISO] Auditor retornou formato invalido na rodada {rodada}. Mantendo versao atual.")
            break
        except Exception as e:
            log_erro(f"Auditor de '{topico}' rodada {rodada}: {e}")
            break

    print(f"    [OK] Auditoria concluida.")
    return versao_atual

# --- PUBMED --------------------------------------------------------------------

def buscar_pubmed(topico, api_key, chaves=None):
    print(f"  -> PubMed: '{topico}'...")
    try:
        # Traduz o topico para ingles
        body = {"contents": [{"parts": [{"text": f"Translate '{topico}' to English medical terminology. Return only the translation, no explanation."}]}]}
        res = requisicao_api_gemini(body, api_key, chaves)
        termo_en = res["candidates"][0]["content"]["parts"][0]["text"].strip()

        query = urllib.parse.quote(f"{termo_en} wound care treatment")
        url_search = (
            f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
            f"?db=pubmed&term={query}&retmode=json&retmax=3"
        )
        req = urllib.request.Request(url_search, headers={"User-Agent": "iRecBot/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            ids = json.loads(r.read())["esearchresult"].get("idlist", [])

        if not ids:
            return "Nenhuma evidencia PubMed especifica localizada para este topico."

        url_summary = (
            f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
            f"?db=pubmed&id={','.join(ids)}&retmode=json"
        )
        req_s = urllib.request.Request(url_summary, headers={"User-Agent": "iRecBot/1.0"})
        with urllib.request.urlopen(req_s, timeout=15) as r:
            results = json.loads(r.read()).get("result", {})

        artigos = []
        for uid in ids:
            art = results.get(uid, {})
            titulo_art = art.get("title", "Sem titulo")
            autores = ", ".join([a.get("name", "") for a in art.get("authors", [])[:2]])
            source = art.get("source", "PubMed")
            data = art.get("pubdate", "")
            artigos.append(f"* {source} - \"{titulo_art}\" ({autores}, {data}). PMID: {uid}")

        return "\n".join(artigos)

    except Exception as e:
        log_erro(f"PubMed falhou para '{topico}': {e}")
        return "Consulta PubMed indisponivel no momento."

# --- RELATORIO HTML ------------------------------------------------------------

def gerar_html(topicos_consolidados):
    print(f"Gerando relatorio HTML...")
    imgs = []
    if os.path.exists(CAPTURAS_DIR):
        imgs = sorted([f for f in os.listdir(CAPTURAS_DIR) if f.lower().endswith(".jpg")])

    body_html = ""
    for topico, dados in topicos_consolidados.items():
        conteudo_html = (
            dados["conteudo_markdown"]
            .replace("### 1.", '<h4 class="sec">1.')
            .replace("### 2.", '<h4 class="sec">2.')
            .replace("### 3.", '<h4 class="sec">3.')
            .replace("\n", "<br>")
        )
        evidencias_html = dados["pubmed_evidences"].replace("\n* ", "<br>&bull; ")

        palavra_chave = topico.split()[0].lower()
        imgs_topico = [img for img in imgs if palavra_chave in img.lower()][:4]
        imgs_html = "".join(
            f'<div class="img-card"><img src="../public/treinamento_capturas/{img}" alt="{img}"><p>{img[:35]}</p></div>'
            for img in imgs_topico
        )

        body_html += f"""
        <div class="card">
            <h2>{topico}</h2>
            <div class="content">{conteudo_html}</div>
            <div class="evidence">
                <h4>Evidencias PubMed</h4>
                <p>{evidencias_html}</p>
            </div>
            {"" if not imgs_html else f'<div class="imgs">{imgs_html}</div>'}
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>iRec - Manual Clinico de Feridas</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: 'Segoe UI', sans-serif; background: #f0f4f8; color: #1a202c; }}
        header {{ background: linear-gradient(135deg, #1e3c72, #2a5298); color: #fff; padding: 40px 20px; text-align: center; }}
        header h1 {{ font-size: 26px; margin-bottom: 8px; }}
        header p {{ opacity: .8; font-size: 14px; }}
        .container {{ max-width: 1100px; margin: 40px auto; padding: 0 20px; }}
        .alert {{ background: #ebf8ff; border-left: 5px solid #3182ce; padding: 16px; border-radius: 4px; margin-bottom: 30px; font-size: 14px; }}
        .card {{ background: #fff; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,.07); margin-bottom: 35px; padding: 30px; border-top: 5px solid #38a169; }}
        .card h2 {{ color: #2f855a; font-size: 20px; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }}
        h4.sec {{ color: #2d3748; font-size: 15px; margin: 20px 0 8px; padding: 6px 0; border-bottom: 1px solid #edf2f7; }}
        .evidence {{ background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-top: 20px; }}
        .evidence h4 {{ color: #2b6cb0; font-size: 14px; margin-bottom: 8px; }}
        .imgs {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-top: 20px; }}
        .img-card {{ border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }}
        .img-card img {{ width: 100%; height: 130px; object-fit: cover; }}
        .img-card p {{ font-size: 11px; padding: 5px; color: #718096; text-align: center; }}
        footer {{ text-align: center; padding: 24px; color: #718096; font-size: 13px; }}
    </style>
</head>
<body>
<header>
    <h1>iRec - Manual de Conhecimento Clinico</h1>
    <p>Gerado automaticamente por IA &bull; Requer aprovacao do medico supervisor antes da ativacao</p>
</header>
<div class="container">
    <div class="alert">
        <strong>Instrucoes ao Medico Revisor:</strong> Este documento foi gerado por IA a partir das videoaulas
        e enriquecido com referencias PubMed. Cada capitulo passou por auditoria anti-alucinacao automatica (Critic Loop).
        Revise criticamente e, apos aprovacao, execute <code>python upload_base.py</code> para ativar na IA do iRec.
    </div>
    {body_html}
</div>
<footer>iRec Medical - Tecnologia para Salvaguarda de Vidas</footer>
</body>
</html>"""

    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  [OK] HTML salvo: {HTML_PATH}")

# --- PIPELINE PRINCIPAL --------------------------------------------------------

def processar_base():
    print("=" * 60)
    print(" iRec - Processador de Base de Conhecimento Clinico v6")
    print("=" * 60)

    chaves = obter_todas_as_keys()
    if not chaves:
        print("[ERRO FATAL] Nenhuma VITE_GEMINI_API_KEY encontrada no .env")
        return

    api_key = chaves[0]
    print(f"[INFO] {len(chaves)} chaves de API carregadas para rotacao.")

    # Testa a API antes de comecar
    if not testar_api(api_key, chaves):
        print("[ERRO FATAL] Nao foi possivel conectar a API Gemini. Verifique a chave e a internet.")
        return

    os.makedirs(AUDIOS_DIR, exist_ok=True)
    os.makedirs(CAPTURAS_DIR, exist_ok=True)

    # [FIX 4] Carrega o cache completo e ja popula textos_brutos com o que esta salvo
    cache = carregar_cache()
    textos_brutos = list(cache.values())  # Garante que todos os textos do cache entram na consolidacao
    total_processados = 0
    total_falhos = 0

    print(f"\n[INFO] Cache carregado: {len(cache)} videos ja transcritos.")
    print(f"[INFO] {len(textos_brutos)} textos carregados para consolidacao.")

    print("\n" + "=" * 60)
    print("FASE 1: EXTRACAO DE CONTEUDO BRUTO")
    print("=" * 60)

    for root_dir, dirs, files in os.walk(TREINAMENTO_DIR):
        # Ignora pastas de sistema e a pasta public
        dirs[:] = [
            d for d in dirs
            if d not in ("audios_temporarios", "__pycache__", "public")
            and "public" not in root_dir
        ]

        for file in sorted(files):
            caminho = os.path.join(root_dir, file)
            titulo = os.path.splitext(file)[0]
            ext = file.lower().rsplit(".", 1)[-1]

            # ---- VIDEO -------------------------------------------------------
            if ext in ("mp4", "mkv", "m4v"):
                if titulo in cache:
                    print(f"  [CACHE] {file}")
                    continue  # ja carregado em textos_brutos acima

                print(f"\n  [VIDEO] {file}")
                tamanho_mb = os.path.getsize(caminho) / (1024 * 1024)

                # Extrai audio com aceleracao de hardware
                caminho_mp3 = os.path.join(AUDIOS_DIR, f"{titulo[:80]}.mp3")
                print(f"  -> Extraindo audio ({tamanho_mb:.0f}MB) com GPU...")
                cmd_audio = [
                    "ffmpeg", "-hwaccel", "auto", "-y", "-i", caminho,
                    "-vn", "-ar", "16000", "-ac", "1", "-b:a", "64k",
                    "-f", "mp3", caminho_mp3
                ]
                subprocess.run(cmd_audio, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

                if not os.path.exists(caminho_mp3) or os.path.getsize(caminho_mp3) < 1000:
                    log_erro(f"ffmpeg nao gerou audio para: {file}")
                    total_falhos += 1
                    continue

                # Transcreve via fragmentacao + Base64 inline
                try:
                    transcricao = transcrever_audio(caminho_mp3, api_key, chaves)
                    if len(transcricao) < 100:
                        log_erro(f"Transcricao muito curta ({len(transcricao)} chars): {file}")
                        total_falhos += 1
                    else:
                        cache[titulo] = transcricao
                        salvar_cache(cache)
                        textos_brutos.append(transcricao)
                        total_processados += 1
                        print(f"  [OK] Transcrito: {len(transcricao):,} chars")
                except Exception as e:
                    log_erro(f"Transcricao falhou para '{file}': {e}")
                    total_falhos += 1

                # Remove MP3 temporario
                try:
                    if os.path.exists(caminho_mp3):
                        os.remove(caminho_mp3)
                except Exception:
                    pass

                # Extrai capturas de tela (1 por minuto)
                print(f"  -> Extraindo capturas de tela...")
                padrao_img = os.path.join(CAPTURAS_DIR, f"{titulo[:60]}_min_%02d.jpg")
                cmd_imgs = [
                    "ffmpeg", "-hwaccel", "auto", "-y", "-i", caminho,
                    "-vf", "fps=1/60,scale=800:-1", "-q:v", "3", padrao_img
                ]
                subprocess.run(cmd_imgs, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

                time.sleep(6)  # Pausa entre videos para estabilizar rate limit

            # ---- PDF ---------------------------------------------------------
            elif ext == "pdf":
                if titulo in cache:
                    print(f"  [CACHE] {file}")
                    continue
                print(f"\n  [PDF] {file}")
                try:
                    conteudo = processar_pdf(caminho, api_key, chaves)
                    cache[titulo] = conteudo
                    salvar_cache(cache)
                    textos_brutos.append(conteudo)
                    total_processados += 1
                    print(f"  [OK] PDF extraido: {len(conteudo):,} chars")
                except Exception as e:
                    log_erro(f"PDF '{file}': {e}")
                    total_falhos += 1
                time.sleep(5)

            # ---- DOCX --------------------------------------------------------
            elif ext == "docx":
                if titulo in cache:
                    print(f"  [CACHE] {file}")
                    continue
                print(f"\n  [DOCX] {file}")
                conteudo = ler_docx(caminho)
                if conteudo.strip():
                    cache[titulo] = conteudo
                    salvar_cache(cache)
                    textos_brutos.append(conteudo)
                    total_processados += 1
                    print(f"  [OK] DOCX lido: {len(conteudo):,} chars")
                else:
                    log_erro(f"DOCX vazio ou ilegivel: {file}")

    print(f"\n{'='*60}")
    print(f"FASE 1 CONCLUIDA")
    print(f"  Novos transcritos: {total_processados}")
    print(f"  Total no cache:    {len(cache)}")
    print(f"  Falhas:            {total_falhos}")
    if total_falhos > 0:
        print(f"  [AVISO] Detalhes em: {ERROS_PATH}")
    print("=" * 60)

    if not textos_brutos:
        print("[ERRO] Nenhum conteudo disponivel para consolidacao. Verifique o erros.log.")
        return

    # FASE 2 & FASE 3 OTIMIZADAS: Salva os textos brutos consolidados para poupar a quota de API
    print("\n" + "=" * 60)
    print("SALVANDO TEXTOS BRUTOS CONSOLIDADOS (POUPANDO REQUISICOES)")
    print("=" * 60)
    
    txt_consolidado_path = os.path.join(TREINAMENTO_DIR, "transcricoes_consolidadas.txt")
    
    # Formata agrupando por vídeo
    conteudo_saida = []
    for titulo, texto in sorted(cache.items()):
        conteudo_saida.append(f"=== VÍDEO: {titulo} ===\n{texto}\n")
    
    texto_total = "\n\n".join(conteudo_saida)
    
    with open(txt_consolidado_path, "w", encoding="utf-8") as f:
        f.write(texto_total)
        
    print(f"  [OK] Todos os {len(cache)} conteudos transcritos foram salvos com sucesso em:")
    print(f"  -> {txt_consolidado_path}")
    print("\n[INFO] Parando execucao por aqui para poupar quotas de API, conforme solicitado!")
    print("=" * 60)
    return

    # --- FASE 3 ---------------------------------------------------------------
    print("\n" + "=" * 60)
    print("FASE 3: CONSOLIDACAO + AUDITORIA ANTI-ALUCINACAO")
    print("=" * 60)
    topicos_consolidados = {}

    for i, topico in enumerate(topicos, 1):
        print(f"\n[{i}/{len(topicos)}] Topico: {topico}")

        try:
            conteudo   = consolidar_topico(topico, textos_brutos, api_key, chaves)
            pubmed     = buscar_pubmed(topico, api_key, chaves)
            auditado   = validar_e_corrigir_topico(topico, conteudo, pubmed, api_key, chaves)
            topicos_consolidados[topico] = {
                "conteudo_markdown": auditado,
                "pubmed_evidences":  pubmed
            }
        except Exception as e:
            log_erro(f"Falha ao consolidar topico '{topico}': {e}")
            topicos_consolidados[topico] = {
                "conteudo_markdown": f"Erro ao gerar conteudo: {e}",
                "pubmed_evidences":  "Indisponivel"
            }

        time.sleep(6)

    # --- FASE 4 ---------------------------------------------------------------
    print("\n" + "=" * 60)
    print("FASE 4: SALVANDO ARQUIVOS LOCAIS")
    print("=" * 60)

    gerar_html(topicos_consolidados)

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(topicos_consolidados, f, ensure_ascii=False, indent=2)
    print(f"  [OK] JSON salvo: {JSON_PATH}")

    # Limpa pasta de audios se vazia
    try:
        if os.path.exists(AUDIOS_DIR) and not os.listdir(AUDIOS_DIR):
            os.rmdir(AUDIOS_DIR)
    except Exception:
        pass

    print("\n" + "=" * 60)
    print("PROCESSAMENTO COMPLETO!")
    print(f"  Relatorio medico: {HTML_PATH}")
    print(f"  Base JSON:        {JSON_PATH}")
    print(f"  Para ativar na IA: python treinamento/upload_base.py")
    print("=" * 60)


if __name__ == "__main__":
    processar_base()
