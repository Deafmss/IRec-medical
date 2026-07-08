import os
import sys
import json
import subprocess
import urllib.request
import urllib.parse
import time
import zipfile
import xml.etree.ElementTree as ET
import psycopg2

# Conexões do Banco de Dados Supabase (Já integradas no projeto)
DB_HOST = "aws-1-us-east-2.pooler.supabase.com"
DB_PORT = 6543
DB_USER = "postgres.uiaeuzpojqhtjvbqwblb"
DB_PASS = "aOkqvRQbDaWNls4t"
DB_NAME = "postgres"

def obter_gemini_key():
    try:
        caminho_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
        if os.path.exists(caminho_env):
            with open(caminho_env, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("VITE_GEMINI_API_KEY="):
                        return line.split("=")[-1].strip()
    except Exception as e:
        print(f"Erro ao ler arquivo .env: {e}")
    return None

def requisicao_api_gemini(endpoint_action, body, api_key):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{endpoint_action}?key={api_key}"
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as e:
            if tentativa == 2:
                raise e
            print(f"Aviso: Erro na chamada do Gemini ({e}). Tentando novamente em 5s...")
            time.sleep(5)

def obter_embedding(texto, api_key):
    body = {
        "model": "models/gemini-embedding-001",
        "content": {"parts": [{"text": texto}]},
        "outputDimensionality": 768
    }
    try:
        res = requisicao_api_gemini("gemini-embedding-001:embedContent", body, api_key)
        if res and "embedding" in res and "values" in res["embedding"]:
            return res["embedding"]["values"]
    except Exception as e:
        print(f"  -> Erro ao obter embedding: {e}")
    return None

def iniciar_upload_gemini(file_size, mime_type, display_name, api_key):
    url = f"https://generativelanguage.googleapis.com/upload/v1beta/files?key={api_key}"
    headers = {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": str(file_size),
        "X-Goog-Upload-Header-Content-Type": mime_type,
        "Content-Type": "application/json"
    }
    body = {"file": {"display_name": display_name}}
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(req) as response:
        return response.headers.get("X-Goog-Upload-URL")

def enviar_bytes_gemini(upload_url, file_path):
    headers = {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "upload, finalize",
        "X-Goog-Upload-Offset": "0",
        "Content-Type": "application/octet-stream"
    }
    with open(file_path, "rb") as f:
        file_bytes = f.read()
    
    req = urllib.request.Request(upload_url, data=file_bytes, headers=headers, method="POST")
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))

def obter_estado_arquivo_gemini(file_uri, api_key):
    url = f"{file_uri}?key={api_key}"
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))

def transcrever_audio_bruto(caminho_audio, api_key):
    file_size = os.path.getsize(caminho_audio)
    display_name = os.path.basename(caminho_audio)
    
    print("  -> Fazendo upload do áudio para o Gemini...")
    upload_url = iniciar_upload_gemini(file_size, "audio/mp3", display_name, api_key)
    file_info = enviar_bytes_gemini(upload_url, caminho_audio)
    file_uri = file_info["file"]["uri"]
    
    print("  -> Aguardando processamento do arquivo de áudio...")
    while True:
        status = obter_estado_arquivo_gemini(file_uri, api_key)
        state = status.get("file", {}).get("state", "PROCESSING")
        if state == "ACTIVE":
            break
        elif state == "FAILED":
            raise Exception("Falha no processamento do áudio pelo Gemini.")
        time.sleep(5)
    
    print("  -> Transcrevendo áudio...")
    prompt = (
        "Você é um transcritor clínico de alta precisão. Transcreva o áudio em Português literal. "
        "Não resuma nem pule termos técnicos de cicatrização de feridas e enfermagem. "
        "Retorne apenas a transcrição pura, sem introduções."
    )
    
    body = {
        "contents": [{
            "parts": [
                {"file_data": {"file_uri": file_uri, "mime_type": "audio/mp3"}},
                {"text": prompt}
            ]
        }]
    }
    
    res = requisicao_api_gemini("gemini-2.5-flash:generateContent", body, api_key)
    texto_transcrito = res["candidates"][0]["content"]["parts"][0]["text"].strip()
    
    try:
        req_del = urllib.request.Request(f"{file_uri}?key={api_key}", method="DELETE")
        with urllib.request.urlopen(req_del) as response:
            pass
    except Exception:
        pass
        
    return texto_transcrito

def processar_pdf_documento(caminho_pdf, api_key):
    file_size = os.path.getsize(caminho_pdf)
    display_name = os.path.basename(caminho_pdf)
    
    upload_url = iniciar_upload_gemini(file_size, "application/pdf", display_name, api_key)
    file_info = enviar_bytes_gemini(upload_url, caminho_pdf)
    file_uri = file_info["file"]["uri"]
    
    while True:
        status = obter_estado_arquivo_gemini(file_uri, api_key)
        state = status.get("file", {}).get("state", "PROCESSING")
        if state == "ACTIVE":
            break
        elif state == "FAILED":
            raise Exception("Falha no processamento do PDF pelo Gemini.")
        time.sleep(5)
        
    prompt = (
        "Extraia todo o conteúdo textual relevante deste documento em Português. "
        "Organize-o de forma clara em markdown. Retorne apenas o conteúdo."
    )
    
    body = {
        "contents": [{
            "parts": [
                {"file_data": {"file_uri": file_uri, "mime_type": "application/pdf"}},
                {"text": prompt}
            ]
        }]
    }
    
    res = requisicao_api_gemini("gemini-2.5-flash:generateContent", body, api_key)
    conteudo_md = res["candidates"][0]["content"]["parts"][0]["text"]
    
    try:
        req_del = urllib.request.Request(f"{file_uri}?key={api_key}", method="DELETE")
        with urllib.request.urlopen(req_del) as response:
            pass
    except Exception:
        pass
        
    return conteudo_md

def ler_docx_puro(caminho):
    try:
        with zipfile.ZipFile(caminho) as z:
            xml_content = z.read('word/document.xml')
            root = ET.fromstring(xml_content)
            paragraphs = []
            for elem in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
                if elem.text:
                    paragraphs.append(elem.text)
            return "\n\n".join(paragraphs)
    except Exception as e:
        print(f"  -> Erro ao ler docx {caminho}: {e}")
        return ""

def analisar_imagem_via_gemini(caminho_imagem, api_key):
    file_size = os.path.getsize(caminho_imagem)
    display_name = os.path.basename(caminho_imagem)
    
    upload_url = iniciar_upload_gemini(file_size, "image/jpeg", display_name, api_key)
    file_info = enviar_bytes_gemini(upload_url, caminho_imagem)
    file_uri = file_info["file"]["uri"]
    
    prompt = (
        "Descreva clinicamente esta captura de tela de videoaula de feridas. "
        "Forneça as características visuais (esfacelo, necrose, granulação, tipo de lesão, etc.) "
        "e possíveis tratamentos citados. Retorne um texto descritivo curto em Português."
    )
    
    body = {
        "contents": [{
            "parts": [
                {"file_data": {"file_uri": file_uri, "mime_type": "image/jpeg"}},
                {"text": prompt}
            ]
        }]
    }
    
    res = requisicao_api_gemini("gemini-2.5-flash:generateContent", body, api_key)
    descricao = res["candidates"][0]["content"]["parts"][0]["text"]
    
    try:
        req_del = urllib.request.Request(f"{file_uri}?key={api_key}", method="DELETE")
        with urllib.request.urlopen(req_del) as response:
            pass
    except Exception:
        pass
        
    return descricao

def extrair_entidades_clinicas(texto_completo, api_key):
    print("Mapeando entidades clínicas e tópicos principais...")
    prompt = (
        "Você é um classificador médico de alta precisão. Analise o texto a seguir e identifique "
        "as principais Comorbidades (ex: Diabetes, Hipertensão, Insuficiência Venosa), Tratamentos/Curativos "
        "(ex: Hidrogel, Alginato de Cálcio, Terapia Compressiva) e Tipos de Lesões (ex: Lesão por Pressão, Úlcera Arterial). "
        "Retorne estritamente um array JSON contendo apenas strings simples com o nome padronizado de cada tópico identificado. "
        "Exemplo de retorno: [\"Diabetes\", \"Hidrogel\", \"Úlcera Venosa\", \"Alginato de Cálcio\"]\n"
        "Não adicione marcações de markdown como ```json, retorne apenas o texto do JSON.\n\n"
        f"Texto:\n{texto_completo[:40000]}"  # Limita para caber no contexto inicial
    )
    
    body = {"contents": [{"parts": [{"text": prompt}]}]}
    res = requisicao_api_gemini("gemini-2.5-flash:generateContent", body, api_key)
    texto_json = res["candidates"][0]["content"]["parts"][0]["text"].strip()
    
    if texto_json.startswith("```"):
        linhas = texto_json.split("\n")
        if linhas[0].startswith("```"):
            linhas = linhas[1:]
        if linhas[-1].startswith("```"):
            linhas = linhas[:-1]
        texto_json = "\n".join(linhas).strip()
        
    try:
        return json.loads(texto_json)
    except Exception as e:
        print(f"Erro ao mapear tópicos: {e}. Usando fallback de tópicos gerais.")
        return ["Diabetes", "Hipertensão Arterial", "Insuficiência Venosa", "Lesão por Pressão", "Hidrogel", "Alginato de Cálcio"]

def buscar_evidencia_pubmed(topico, api_key):
    print(f"  -> Pesquisando evidências no PubMed para: {topico}...")
    # Traduz o tópico para inglês para buscar no PubMed
    prompt_traducao = f"Traduza o termo médico '{topico}' para inglês científico. Retorne apenas a tradução, sem pontos."
    body_trad = {"contents": [{"parts": [{"text": prompt_traducao}]}]}
    res_trad = requisicao_api_gemini("gemini-2.5-flash:generateContent", body_trad, api_key)
    termo_en = res_trad["candidates"][0]["content"]["parts"][0]["text"].strip()
    
    # Faz busca na API pública do NCBI PubMed
    query = urllib.parse.quote(f"{termo_en} wound care therapy")
    url_search = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={query}&retmode=json&retmax=3"
    
    try:
        req = urllib.request.Request(url_search, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            id_list = res_data.get("esearchresult", {}).get("idlist", [])
            
        if not id_list:
            return "Nenhuma evidência clínica direta encontrada no PubMed para este termo."
            
        # Puxa sumários dos artigos
        ids = ",".join(id_list)
        url_summary = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={ids}&retmode=json"
        req_sum = urllib.request.Request(url_summary, headers={"User-Agent": "Mozilla/5.0"})
        
        artigos = []
        with urllib.request.urlopen(req_sum) as response:
            sum_data = json.loads(response.read().decode("utf-8"))
            results = sum_data.get("result", {})
            for uid in id_list:
                art = results.get(uid, {})
                titulo = art.get("title", "Sem título")
                autores = ", ".join([a.get("name", "") for a in art.get("authors", [])[:3]])
                source = art.get("source", "PubMed")
                pubdate = art.get("pubdate", "")
                artigos.append(f"* **[{source}]** *\"{titulo}\"* ({autores}, {pubdate}). PubMed ID: {uid}.")
                
        return "\n".join(artigos)
    except Exception as e:
        print(f"  -> Falha na busca PubMed: {e}")
        return "Conexão com a base científica do PubMed temporariamente indisponível."

def consolidar_conhecimento_tematico(topico, textos_brutos, api_key):
    print(f"Consolidando e higienizando informações do tópico: {topico}...")
    
    # Pega apenas trechos que mencionam o tópico para não estourar o contexto
    trechos_relevantes = []
    for txt in textos_brutos:
        if topico.lower() in txt.lower():
            trechos_relevantes.append(txt[:3000])
            
    contexto_aulas = "\n\n---\n\n".join(trechos_relevantes[:8]) # Max 8 trechos
    
    prompt = (
        "Você é um revisor clínico de alta precisão. Consolide todas as informações de videoaulas "
        f"fornecidas sobre o assunto '{topico}'.\n"
        "Sua tarefa é estruturar e reescrever as informações com tom extremamente formal, preciso e científico, "
        "eliminando redundâncias ou gírias faladas pelo professor. Divida a resposta exatamente nestas seções markdown:\n\n"
        "### 1. Ensino do Treinamento Interno\n"
        "(O compilado resumido e direto de todas as orientações que o professor ensinou nas videoaulas sobre este tema).\n\n"
        "### 2. Contraindicações Estritas\n"
        "(Lista clara de tópicos com situações em que o curativo/tratamento NUNCA deve ser aplicado ou cuidados "
        "críticos de segurança que devem ser tomados).\n\n"
        "### 3. Evidências Científicas Complementares (Fatores Científicos)\n"
        "(Adicione detalhes científicos consolidados na literatura médica de suporte para embasamento clínico real).\n\n"
        "Seja rigoroso com a veracidade técnica. Não invente dosagens ou curativos não descritos.\n\n"
        f"Textos das aulas:\n{contexto_aulas}"
    )
    
    body = {"contents": [{"parts": [{"text": prompt}]}]}
    res = requisicao_api_gemini("gemini-2.5-flash:generateContent", body, api_key)
    return res["candidates"][0]["content"]["parts"][0]["text"]

def gerar_relatorio_html(topicos_consolidados, capturas_dir):
    caminho_html = os.path.abspath(os.path.join(os.path.dirname(__file__), "relatorio_revisao_medica.html"))
    print(f"Exportando Relatório de Revisão Médica para: {caminho_html}...")
    
    # Carrega arquivos de imagem locais na pasta pública
    imagens_locais = []
    if os.path.exists(capturas_dir):
        imagens_locais = sorted([f for f in os.listdir(capturas_dir) if f.endswith(".jpg")])

    html_content = """
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>iRec - Relatório de Revisão Médica e Base de Conhecimento</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f4f6f9;
                color: #2c3e50;
                margin: 0;
                padding: 0;
            }
            .header {
                background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                color: white;
                padding: 40px 20px;
                text-align: center;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header h1 { margin: 0; font-size: 2.5em; }
            .header p { margin: 10px 0 0 0; font-size: 1.1em; opacity: 0.9; }
            .container {
                max-width: 1200px;
                margin: 40px auto;
                padding: 0 20px;
            }
            .alert-box {
                background-color: #ebf5fb;
                border-left: 5px solid #2980b9;
                padding: 15px;
                margin-bottom: 35px;
                border-radius: 4px;
            }
            .alert-box h3 { margin: 0 0 5px 0; color: #2980b9; }
            .alert-box p { margin: 0; font-size: 0.95em; line-height: 1.5; }
            .chapter-card {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                margin-bottom: 40px;
                padding: 30px;
                border-top: 5px solid #27ae60;
            }
            .chapter-card h2 {
                margin-top: 0;
                color: #27ae60;
                border-bottom: 2px solid #ecf0f1;
                padding-bottom: 10px;
                font-size: 1.8em;
            }
            .section-title {
                color: #2c3e50;
                font-size: 1.2em;
                margin-top: 25px;
                font-weight: bold;
            }
            .evidence-box {
                background: #fdfefe;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                padding: 20px;
                margin-top: 20px;
            }
            .evidence-box h4 { margin: 0 0 10px 0; color: #7f8c8d; }
            .grid-images {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                gap: 15px;
                margin-top: 25px;
            }
            .image-card {
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                overflow: hidden;
                background: #f8fafc;
            }
            .image-card img {
                width: 100%;
                height: 150px;
                object-fit: cover;
            }
            .image-card p {
                font-size: 0.8em;
                padding: 8px;
                margin: 0;
                color: #7f8c8d;
                text-align: center;
            }
            .footer {
                text-align: center;
                padding: 30px 20px;
                color: #7f8c8d;
                font-size: 0.9em;
                border-top: 1px solid #ecf0f1;
                margin-top: 60px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Manual de Conhecimento Clínico iRec</h1>
            <p>Relatório de Consolidação Temática para Revisão e Homologação Médica</p>
        </div>
        <div class="container">
            <div class="alert-box">
                <h3>Instruções para o Médico Revisor</h3>
                <p>Este documento consolida todo o conhecimento extraído das videoaulas de treinamento interno combinadas com pesquisas automáticas de fact-checking científico realizadas no PubMed. Por favor, analise a veracidade de cada capítulo de conduta. Após sua aprovação por escrito, estas informações serão carregadas como base de conhecimento ativa da IA do iRec.</p>
            </div>
    """
    
    for topico, dados in topicos_consolidados.items():
        html_content += f"""
        <div class="chapter-card">
            <h2>Capítulo: {topico}</h2>
            <div>
                {dados['conteudo_markdown'].replace('### 1. Ensino do Treinamento Interno', '<div class="section-title">1. Ensino do Treinamento Interno</div>').replace('### 2. Contraindicações Estritas', '<div class="section-title">2. Contraindicações Estritas</div>').replace('### 3. Evidências Científicas Complementares', '<div class="section-title">3. Evidências Científicas Complementares</div>')}
            </div>
            
            <div class="evidence-box">
                <h4>Evidências Adicionais de Suporte (PubMed Search Swarm)</h4>
                <p style="font-size: 0.95em; line-height: 1.6; margin: 0;">{dados['pubmed_evidences'].replace('* ', '<br>• ')}</p>
            </div>
        """
        
        # Filtra e adiciona imagens do tópico
        imagens_topico = [img for img in imagens_locais if topico.lower() in img.lower()]
        if imagens_topico:
            html_content += """<div class="grid-images">"""
            for img in imagens_topico[:4]: # Max 4 imagens por tópico no HTML
                html_content += f"""
                <div class="image-card">
                    <img src="../public/treinamento_capturas/{img}" alt="Slide/Caso Clínico">
                    <p>{img.split('_min_')[0]}</p>
                </div>
                """
            html_content += """</div>"""
            
        html_content += "</div>"
        
    html_content += """
        </div>
        <div class="footer">
            <p>© iRec Medical - Tecnologia para Salvaguarda de Vidas</p>
        </div>
    </body>
    </html>
    """
    
    with open(caminho_html, "w", encoding="utf-8") as f:
        f.write(html_content)

def processar_base():
    api_key = obter_gemini_key()
    if not api_key:
        print("❌ Erro: Chave de API VITE_GEMINI_API_KEY não localizada no seu arquivo .env.")
        return

    treinamento_dir = os.path.dirname(os.path.abspath(__file__))
    audios_temp_dir = os.path.join(treinamento_dir, "audios_temporarios")
    os.makedirs(audios_temp_dir, exist_ok=True)
    
    capturas_dir = os.path.abspath(os.path.join(treinamento_dir, "..", "public", "treinamento_capturas"))
    os.makedirs(capturas_dir, exist_ok=True)

    textos_brutos = []

    print("--- FASE 1: EXTRAÇÃO DE CONTEÚDO BRUTO (VÍDEOS E DOCUMENTOS) ---")
    for root, dirs, files in os.walk(treinamento_dir):
        if "audios_temporarios" in root or "public" in root:
            continue
            
        for file in files:
            caminho_arquivo = os.path.join(root, file)
            titulo_base = os.path.splitext(file)[0]
            
            # PROCESSAR VÍDEOS
            if file.endswith(('.mp4', '.mkv', '.m4v', '.MP4')):
                print(f"Extraindo áudio de: {file}")
                caminho_audio = os.path.join(audios_temp_dir, f"{titulo_base}.mp3")
                cmd_audio = [
                    "ffmpeg", "-y", "-i", caminho_arquivo, 
                    "-vn", "-ar", "16000", "-ac", "1", "-ab", "64k", "-f", "mp3", 
                    caminho_audio
                ]
                subprocess.run(cmd_audio, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
                try:
                    transcricao = transcrever_audio_bruto(caminho_audio, api_key)
                    textos_brutos.append(transcricao)
                except Exception as e:
                    print(f"Erro ao transcrever {file}: {e}")
                    
                if os.path.exists(caminho_audio):
                    os.remove(caminho_audio)

                # Extrai prints visuais dos slides
                print(f"Extraindo capturas de: {file}")
                padrao_captura = os.path.join(capturas_dir, f"{titulo_base}_min_%02d_00.jpg")
                cmd_imagens = [
                    "ffmpeg", "-y", "-i", caminho_arquivo,
                    "-vf", "fps=1/60,scale=800:-1", "-q:v", "2",
                    padrao_captura
                ]
                subprocess.run(cmd_imagens, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            # PROCESSAR DOCUMENTOS PDF
            elif file.endswith('.pdf'):
                try:
                    print(f"Lendo PDF: {file}")
                    conteudo = processar_pdf_documento(caminho_arquivo, api_key)
                    textos_brutos.append(conteudo)
                except Exception as e:
                    print(f"Erro no PDF {file}: {e}")

            # PROCESSAR DOCUMENTOS WORD (DOCX)
            elif file.endswith('.docx'):
                print(f"Lendo DOCX: {file}")
                conteudo = ler_docx_puro(caminho_arquivo)
                if conteudo.strip():
                    textos_brutos.append(conteudo)

    if not textos_brutos:
        print("❌ Nenhum material clínico localizado para processamento.")
        return

    # Junta todo o texto bruto para mapeamento das entidades principais
    texto_consolidado_bruto = "\n\n".join(textos_brutos)
    
    print("\n--- FASE 2: MAPEAMENTO DE ENTIDADES CLÍNICAS (PATOLOGIAS/CURATIVOS) ---")
    topicos_mapeados = extrair_entidades_clinicas(texto_consolidado_bruto, api_key)
    print(f"Tópicos Clínicos Identificados: {topicos_mapeados}")

    print("\n--- FASE 3: CONSOLIDAÇÃO TEMÁTICA E ENRIQUECIMENTO CIENTÍFICO (PUBMED) ---")
    topicos_consolidados = {}
    for topico in topicos_mapeados:
        # Consolida aulas e vídeo transcripts
        conteudo_consolidado = consolidar_conhecimento_tematico(topico, textos_brutos, api_key)
        
        # Faz pesquisa PubMed
        pubmed_evidences = buscar_evidencia_pubmed(topico, api_key)
        
        topicos_consolidados[topico] = {
            "conteudo_markdown": conteudo_consolidado,
            "pubmed_evidences": pubmed_evidences
        }

    # Salva o manual HTML local para aprovação médica off-line
    gerar_relatorio_html(topicos_consolidados, capturas_dir)

    print("\n--- FASE 4: SALVANDO BASE DE CONHECIMENTO LOCAL EM JSON ---")
    caminho_json = os.path.join(treinamento_dir, "base_conhecimento_local.json")
    try:
        with open(caminho_json, "w", encoding="utf-8") as f:
            json.dump(topicos_consolidados, f, ensure_ascii=False, indent=4)
        print(f"✅ Base de conhecimento local salva com sucesso em: {caminho_json}")
    except Exception as e:
        print(f"❌ Erro ao salvar arquivo JSON local: {e}")
    
    if os.path.exists(audios_temp_dir) and not os.listdir(audios_temp_dir):
        os.rmdir(audios_temp_dir)

    print("\n✅ Base de Conhecimento Temática criada, enriquecida e carregada com sucesso!")

if __name__ == "__main__":
    processar_base()
