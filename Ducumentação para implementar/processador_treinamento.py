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

def transcrever_audio_com_timestamps(caminho_audio, api_key):
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
    
    print("  -> Transcrevendo áudio com marcação temporal de segmentos...")
    prompt = (
        "Você é um transcritor clínico de alta precisão. Transcreva o áudio em Português. "
        "Divida a transcrição em trechos lógicos de fala com cerca de 1 a 2 minutos. "
        "Sua resposta deve ser ESTRITAMENTE um array JSON puro (sem marcação de bloco de código ```json), "
        "contendo objetos estruturados exatamente como neste modelo:\n"
        "[\n"
        "  {\n"
        "    \"start\": \"HH:MM:SS\",\n"
        "    \"end\": \"HH:MM:SS\",\n"
        "    \"text\": \"texto transcrito do trecho...\"\n"
        "  }\n"
        "]"
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
    texto_bruto = res["candidates"][0]["content"]["parts"][0]["text"].strip()
    
    # Limpa arquivo temporário do Gemini
    try:
        req_del = urllib.request.Request(f"{file_uri}?key={api_key}", method="DELETE")
        with urllib.request.urlopen(req_del) as response:
            pass
    except Exception:
        pass

    # Remove possível marcação de markdown ```json que a IA possa ter retornado
    if texto_bruto.startswith("```"):
        linhas = texto_bruto.split("\n")
        if linhas[0].startswith("```"):
            linhas = linhas[1:]
        if linhas[-1].startswith("```"):
            linhas = linhas[:-1]
        texto_bruto = "\n".join(linhas).strip()
        
    try:
        return json.loads(texto_bruto)
    except Exception as e:
        print(f"  -> Erro ao parsear JSON da transcrição: {e}. Salvando como parágrafo único.")
        return [{"start": "00:00:00", "end": "00:00:00", "text": texto_bruto}]

def processar_pdf_documento(caminho_pdf, api_key):
    file_size = os.path.getsize(caminho_pdf)
    display_name = os.path.basename(caminho_pdf)
    
    print(f"  -> Fazendo upload do PDF para o Gemini...")
    upload_url = iniciar_upload_gemini(file_size, "application/pdf", display_name, api_key)
    file_info = enviar_bytes_gemini(upload_url, caminho_pdf)
    file_uri = file_info["file"]["uri"]
    
    print("  -> Aguardando processamento do arquivo PDF...")
    while True:
        status = obter_estado_arquivo_gemini(file_uri, api_key)
        state = status.get("file", {}).get("state", "PROCESSING")
        if state == "ACTIVE":
            break
        elif state == "FAILED":
            raise Exception("Falha no processamento do PDF pelo Gemini.")
        time.sleep(5)
        
    print("  -> Extraindo e formatando conteúdo do PDF...")
    prompt = (
        "Extraia todo o conteúdo textual clínico relevante deste documento PDF em Português. "
        "Organize-o de forma muito clara em markdown estruturado. "
        "Retorne apenas o conteúdo, sem explicações adicionais."
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
    
    # Limpa arquivo temporário
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

def chunk_texto(texto, max_chars=1000):
    paragrafos = texto.split("\n")
    chunks = []
    chunk_atual = ""
    for p in paragrafos:
        p = p.strip()
        if not p:
            continue
        if len(chunk_atual) + len(p) < max_chars:
            chunk_atual += "\n" + p
        else:
            if chunk_atual.strip():
                chunks.append(chunk_atual.strip())
            chunk_atual = p
    if chunk_atual.strip():
        chunks.append(chunk_atual.strip())
    return chunks

def analisar_imagem_via_gemini(caminho_imagem, api_key):
    file_size = os.path.getsize(caminho_imagem)
    display_name = os.path.basename(caminho_imagem)
    
    upload_url = iniciar_upload_gemini(file_size, "image/jpeg", display_name, api_key)
    file_info = enviar_bytes_gemini(upload_url, caminho_imagem)
    file_uri = file_info["file"]["uri"]
    
    prompt = (
        "Analise esta imagem retirada de uma videoaula de treinamento clínico de nossa equipe e forneça: "
        "1. O que a imagem mostra (ex: Lesão por pressão, Úlcera venosa, Anatomia da derme, etc.). "
        "2. Detalhamento clínico das características visuais (presença de necrose, esfacelo, granulação, "
        "estado das bordas, sinais de infecção ou biofilme). "
        "3. Conduta teórica padrão explicada na imagem (caso haja textos ou slides associados). "
        "Retorne uma descrição clínica em Português objetiva, clara e resumida em formato markdown."
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
    
    # Limpa o arquivo da nuvem
    try:
        req_del = urllib.request.Request(f"{file_uri}?key={api_key}", method="DELETE")
        with urllib.request.urlopen(req_del) as response:
            pass
    except Exception:
        pass
        
    return descricao

def processar_base():
    api_key = obter_gemini_key()
    if not api_key:
        print("❌ Erro: Chave de API VITE_GEMINI_API_KEY não localizada no seu arquivo .env.")
        return

    # Pastas locais
    treinamento_dir = os.path.dirname(os.path.abspath(__file__))
    audios_temp_dir = os.path.join(treinamento_dir, "audios_temporarios")
    os.makedirs(audios_temp_dir, exist_ok=True)
    
    capturas_dir = os.path.abspath(os.path.join(treinamento_dir, "..", "public", "treinamento_capturas"))
    os.makedirs(capturas_dir, exist_ok=True)

    print("Conectando ao banco de dados Supabase...")
    conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, database=DB_NAME)
    cur = conn.cursor()

    # Mapeia as subpastas de treinamento
    for root, dirs, files in os.walk(treinamento_dir):
        if "audios_temporarios" in root or "public" in root:
            continue
            
        categoria_bruta = os.path.basename(root)
        if categoria_bruta == "treinamento" or not categoria_bruta:
            continue

        # Limpa o nome da categoria (ex: "Anatomia da Pele - 01" -> "Anatomia da Pele")
        categoria = categoria_bruta.split(" - ")[0].strip()

        for file in files:
            caminho_arquivo = os.path.join(root, file)
            titulo_base = os.path.splitext(file)[0]
            
            # 1. PROCESSAR VÍDEOS
            if file.endswith(('.mp4', '.mkv', '.m4v', '.MP4')):
                cur.execute("SELECT id FROM training_knowledge WHERE video_title = %s LIMIT 1;", (titulo_base,))
                if cur.fetchone():
                    print(f"Skipping (Vídeo já indexado): {file}")
                    continue
                
                print(f"\n=======================================================")
                print(f"Processando Vídeo: {file} [Categoria: {categoria}]")
                print(f"=======================================================")

                caminho_audio = os.path.join(audios_temp_dir, f"{titulo_base}.mp3")
                
                # Extração do Áudio
                print("1. Extraindo áudio do vídeo...")
                cmd_audio = [
                    "ffmpeg", "-y", "-i", caminho_arquivo, 
                    "-vn", "-ar", "16000", "-ac", "1", "-ab", "64k", "-f", "mp3", 
                    caminho_audio
                ]
                subprocess.run(cmd_audio, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
                # Transcrição com timestamps
                try:
                    trechos = transcrever_audio_com_timestamps(caminho_audio, api_key)
                    print("2. Indexando trechos com timestamps no Supabase...")
                    
                    for trecho in trechos:
                        tempo_inicio = trecho.get("start", "00:00:00")
                        tempo_fim = trecho.get("end", "00:00:00")
                        conteudo = trecho.get("text", "").strip()
                        
                        if len(conteudo) > 15:
                            embedding = obter_embedding(conteudo, api_key)
                            if embedding:
                                cur.execute(
                                    "INSERT INTO training_knowledge (video_title, category, content, timestamp_start, timestamp_end, embedding) "
                                    "VALUES (%s, %s, %s, %s, %s, %s);",
                                    (titulo_base, categoria, conteudo, tempo_inicio, tempo_fim, embedding)
                                )
                                conn.commit()
                                
                    print(f"  -> {len(trechos)} segmentos salvos com sucesso!")
                except Exception as e:
                    print(f"❌ Erro ao transcrever/indexar trechos de {file}: {e}")
                    
                if os.path.exists(caminho_audio):
                    os.remove(caminho_audio)

                # Extração de Imagens (1 frame a cada 60s)
                print("3. Extraindo capturas de tela (1 frame por minuto)...")
                padrao_captura = os.path.join(capturas_dir, f"{titulo_base}_min_%02d_00.jpg")
                cmd_imagens = [
                    "ffmpeg", "-y", "-i", caminho_arquivo,
                    "-vf", "fps=1/60,scale=800:-1", "-q:v", "2",
                    padrao_captura
                ]
                subprocess.run(cmd_imagens, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
                imagens_geradas = sorted([
                    f for f in os.listdir(capturas_dir) 
                    if f.startswith(titulo_base) and f.endswith(".jpg")
                ])
                
                print(f"  -> Encontradas {len(imagens_geradas)} capturas. Analisando clinicamente...")
                for img_file in imagens_geradas:
                    caminho_img = os.path.join(capturas_dir, img_file)
                    
                    # Corrige o deslocamento de 1 minuto causado pela numeração do ffmpeg
                    partes = img_file.split("_min_")
                    timestamp = "00:00"
                    if len(partes) > 1:
                        idx_str = partes[1].split("_00.jpg")[0]
                        try:
                            minuto_real = int(idx_str) - 1
                            timestamp = f"{minuto_real:02d}:00"
                        except ValueError:
                            pass
                        
                    try:
                        descricao_visual = analisar_imagem_via_gemini(caminho_img, api_key)
                        embedding_visual = obter_embedding(descricao_visual, api_key)
                        
                        if embedding_visual:
                            url_publica_imagem = f"/treinamento_capturas/{img_file}"
                            cur.execute(
                                "INSERT INTO training_visual_cases (video_title, timestamp_str, image_url, clinical_description, embedding) "
                                "VALUES (%s, %s, %s, %s, %s);",
                                (titulo_base, timestamp, url_publica_imagem, descricao_visual, embedding_visual)
                            )
                            conn.commit()
                    except Exception as e:
                        print(f"  -> Erro ao analisar imagem {img_file}: {e}")
                        
                print(f"✓ Vídeo {file} concluído e indexado com sucesso!")

            # 2. PROCESSAR DOCUMENTOS PDF
            elif file.endswith('.pdf'):
                cur.execute("SELECT id FROM training_knowledge WHERE video_title = %s LIMIT 1;", (titulo_base,))
                if cur.fetchone():
                    print(f"Skipping (Documento PDF já indexado): {file}")
                    continue
                
                print(f"\n=======================================================")
                print(f"Processando PDF: {file} [Categoria: {categoria}]")
                print(f"=======================================================")
                
                try:
                    conteudo_pdf = processar_pdf_documento(caminho_arquivo, api_key)
                    chunks = chunk_texto(conteudo_pdf)
                    print(f"  -> Gerados {len(chunks)} chunks. Indexando no Supabase...")
                    
                    for idx, chunk in enumerate(chunks):
                        embedding = obter_embedding(chunk, api_key)
                        if embedding:
                            cur.execute(
                                "INSERT INTO training_knowledge (video_title, category, content, timestamp_start, timestamp_end, embedding) "
                                "VALUES (%s, %s, %s, %s, %s, %s);",
                                (titulo_base, categoria, chunk, "Documento", "Documento", embedding)
                            )
                            conn.commit()
                    print(f"✓ Documento PDF {file} indexado com sucesso!")
                except Exception as e:
                    print(f"❌ Erro ao processar PDF {file}: {e}")

            # 3. PROCESSAR DOCUMENTOS WORD (DOCX)
            elif file.endswith('.docx'):
                cur.execute("SELECT id FROM training_knowledge WHERE video_title = %s LIMIT 1;", (titulo_base,))
                if cur.fetchone():
                    print(f"Skipping (Documento DOCX já indexado): {file}")
                    continue
                
                print(f"\n=======================================================")
                print(f"Processando DOCX: {file} [Categoria: {categoria}]")
                print(f"=======================================================")
                
                try:
                    conteudo_docx = ler_docx_puro(caminho_arquivo)
                    if conteudo_docx.strip():
                        chunks = chunk_texto(conteudo_docx)
                        print(f"  -> Gerados {len(chunks)} chunks. Indexando no Supabase...")
                        for idx, chunk in enumerate(chunks):
                            embedding = obter_embedding(chunk, api_key)
                            if embedding:
                                cur.execute(
                                    "INSERT INTO training_knowledge (video_title, category, content, timestamp_start, timestamp_end, embedding) "
                                    "VALUES (%s, %s, %s, %s, %s, %s);",
                                    (titulo_base, categoria, chunk, "Documento", "Documento", embedding)
                                )
                                conn.commit()
                        print(f"✓ Documento DOCX {file} indexado com sucesso!")
                except Exception as e:
                    print(f"❌ Erro ao processar DOCX {file}: {e}")

    cur.close()
    conn.close()
    
    # Remove pasta de áudios temporários vazia
    if os.path.exists(audios_temp_dir) and not os.listdir(audios_temp_dir):
        os.rmdir(audios_temp_dir)
        
    print("\n✅ Processamento e Indexação da base de conhecimento de treinamento concluída com sucesso!")

if __name__ == "__main__":
    processar_base()
