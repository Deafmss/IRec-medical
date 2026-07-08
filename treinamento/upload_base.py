import os
import sys
import json
import urllib.request
import psycopg2

# Conexões do Banco de Dados Supabase
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
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))

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
        print(f"Erro ao gerar embedding: {e}")
    return None

def upload():
    api_key = obter_gemini_key()
    if not api_key:
        print("❌ Erro: Chave de API VITE_GEMINI_API_KEY não localizada no seu arquivo .env.")
        return

    diretorio = os.path.dirname(os.path.abspath(__file__))
    caminho_json = os.path.join(diretorio, "base_conhecimento_local.json")

    if not os.path.exists(caminho_json):
        print(f"❌ Erro: O arquivo local '{caminho_json}' não foi encontrado.")
        print("Por favor, execute o script 'processador_treinamento.py' primeiro para gerar a base local.")
        return

    print("Carregando base de conhecimento local...")
    with open(caminho_json, "r", encoding="utf-8") as f:
        topicos_consolidados = json.load(f)

    print("Conectando ao banco de dados Supabase...")
    try:
        conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, database=DB_NAME)
        cur = conn.cursor()
    except Exception as e:
        print(f"❌ Erro ao conectar ao Supabase: {e}")
        return

    # Limpa a tabela para subir a base homologada limpa
    print("Limpando registros anteriores da base ativa no Supabase...")
    cur.execute("TRUNCATE TABLE training_knowledge;")
    conn.commit()

    print("\nIniciando upload com geração de embeddings...")
    for topico, dados in topicos_consolidados.items():
        texto_final_banco = (
            f"# Tópico Clínico: {topico}\n\n"
            f"{dados['conteudo_markdown']}\n\n"
            f"### Evidências PubMed Associadas:\n{dados['pubmed_evidences']}"
        )
        
        print(f" -> Gerando embedding para: {topico}...")
        embedding = obter_embedding(texto_final_banco, api_key)
        if embedding:
            cur.execute(
                "INSERT INTO training_knowledge (video_title, category, content, timestamp_start, timestamp_end, embedding) "
                "VALUES (%s, %s, %s, %s, %s, %s);",
                ("Consolidado", topico, texto_final_banco, "Manual", "Manual", embedding)
            )
            conn.commit()
            print(f" ✅ Capítulo '{topico}' carregado com sucesso no Supabase!")
        else:
            print(f" ❌ Falha ao obter embedding para '{topico}'. Pulado.")

    cur.close()
    conn.close()
    print("\n🎉 Base de Conhecimento Clínica Homologada carregada com sucesso no Supabase!")

if __name__ == "__main__":
    upload()
