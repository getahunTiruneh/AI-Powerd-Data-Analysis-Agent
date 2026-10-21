from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import re
import pandas as pd
import json
from typing import List, Optional
import httpx
from contextlib import asynccontextmanager
import asyncio
import uvicorn
import time

load_dotenv()

# Setup HTTP client with connection pooling
http_client = httpx.AsyncClient(
    limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
    timeout=httpx.Timeout(600.0, connect=10.0)
)

# Limit concurrent AI provider calls to prevent flooding local/remote API
ai_semaphore = asyncio.Semaphore(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await http_client.aclose()

app = FastAPI(title="XYZ Bank Data Insight API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AI_PROVIDER = os.environ.get('AI_PROVIDER', 'groq')  # groq | ollama

# Groq (cloud)
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
GROQ_API_URL = os.environ.get('GROQ_API_URL', 'https://api.groq.com/openai/v1/chat/completions')
GROQ_MODEL = os.environ.get('GROQ_MODEL', 'llama-3.3-70b-versatile')
GROQ_FALLBACK_MODEL = os.environ.get('GROQ_FALLBACK_MODEL', 'llama-3.1-8b-instant')

# Ollama (local / on-prem)
OLLAMA_BASE_URL = os.environ.get('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', 'llama3.2:latest')

# Shared
MODEL = os.environ.get('GROQ_MODEL', 'llama-3.3-70b-versatile')  # kept for backward compat
MAX_TOKENS = int(os.environ.get('MAX_TOKENS', 4000))
TEMPERATURE = float(os.environ.get('TEMPERATURE', 0.3))
MAX_RETRIES = int(os.environ.get('GROQ_MAX_RETRIES', 3))
OLLAMA_TIMEOUT = int(os.environ.get('OLLAMA_TIMEOUT', 300))

# ─────────────────────────────────────────────
# Request Models
# ─────────────────────────────────────────────

class ChatRequest(BaseModel):
    messages: list
    context: dict = {}

class SqlGenRequest(BaseModel):
    question: str
    table_name: str
    columns: list           # [{column_name, data_type, is_nullable}]
    sample_rows: list       # Up to 3 real rows for context
    total_rows: int = 0
    conversation_history: list = []  # Last few messages for follow-up context

class AutocompleteRequest(BaseModel):
    current_input: str
    context: dict = {}

class SuggestionsRequest(BaseModel):
    data_mart_name: str = ""
    columns: list = []
    total_rows: int = 0
    file_name: str = ""
    file_headers: list = []
    file_rows: int = 0


# ─────────────────────────────────────────────
# Cache Setup for Suggestions
# ─────────────────────────────────────────────

suggestions_cache = {}
SUGGESTIONS_CACHE_TTL = 300  # 5 minutes

def get_cached_suggestions(cache_key: str):
    if cache_key in suggestions_cache:
        data, expiry = suggestions_cache[cache_key]
        if time.time() < expiry:
            print(f"[CACHE] Hit for suggestion key: {cache_key}")
            return data
        else:
            del suggestions_cache[cache_key]
    return None

def set_cached_suggestions(cache_key: str, data: list):
    suggestions_cache[cache_key] = (data, time.time() + SUGGESTIONS_CACHE_TTL)
    print(f"[CACHE] Set suggestions cache key: {cache_key}")


# ─────────────────────────────────────────────
# Groq API caller (shared helper)
# ─────────────────────────────────────────────

IMAGE_ERROR_RESPONSE = "I can only analyze structured data from CSV/Excel files and database tables. I cannot read images, screenshots, or scanned documents. Please upload a CSV or Excel file."

def is_image_error(text: str) -> bool:
    patterns = [
        r'cannot\s*read.*\.(png|jpg|jpeg|gif|bmp|webp)',
        r'does not support image',
        r'this model does not support',
        r"can't process image",
        r'unable to process image',
        r'image input is not supported',
    ]
    return any(re.search(p, text, re.IGNORECASE) for p in patterns)

async def call_groq(messages: list, temperature: float = 0.3, max_tokens: int = 4000) -> str:
    """Call Groq API asynchronously and return the raw text response.
    Retries on 429 rate limits with exponential backoff and fallback model."""
    models_to_try = [GROQ_MODEL, GROQ_FALLBACK_MODEL]

    async with ai_semaphore:
        for attempt in range(MAX_RETRIES + 1):
            model = models_to_try[0] if attempt == 0 else models_to_try[-1]
            try:
                response = await http_client.post(
                    GROQ_API_URL,
                    headers={
                        'Authorization': f'Bearer {GROQ_API_KEY}',
                        'Content-Type': 'application/json'
                    },
                    json={
                        'model': model,
                        'messages': messages,
                        'temperature': temperature,
                        'max_tokens': max_tokens
                    },
                    timeout=60.0
                )
                if response.status_code == 200:
                    return response.json()['choices'][0]['message']['content']

                if response.status_code == 429 and attempt < MAX_RETRIES:
                    wait = 2 ** attempt
                    print(f"[Groq] Rate limited on {model}, retrying in {wait}s (attempt {attempt + 1}/{MAX_RETRIES})")
                    await asyncio.sleep(wait)
                    continue

                if is_image_error(response.text):
                    return IMAGE_ERROR_RESPONSE

                raise HTTPException(status_code=500, detail=f'Groq API error: {response.status_code} — {response.text}')
            except httpx.RequestError as e:
                if attempt < MAX_RETRIES:
                    wait = 2 ** attempt
                    await asyncio.sleep(wait)
                    continue
                raise HTTPException(status_code=500, detail=f'Error connecting to Groq: {str(e)}')

    return ""

async def call_ollama(messages: list, temperature: float = 0.3, max_tokens: int = 4000) -> str:
    """Call local Ollama API asynchronously and return the raw text response."""
    url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens
        }
    }
    
    async with ai_semaphore:
        try:
            response = await http_client.post(url, json=payload, timeout=float(OLLAMA_TIMEOUT))
            if response.status_code == 200:
                return response.json().get('message', {}).get('content', '')
                
            if is_image_error(response.text):
                return IMAGE_ERROR_RESPONSE
                
            raise HTTPException(status_code=500, detail=f'Ollama API error: {response.status_code} — {response.text}')
        except Exception as e:
            raise HTTPException(status_code=500, detail=f'Error connecting to Ollama: {str(e)}')


async def call_ai(messages: list, temperature: float = 0.3, max_tokens: int = 4000) -> str:
    """Dispatch to the configured AI provider (groq or ollama) asynchronously."""
    provider = AI_PROVIDER.lower()
    print(f"[AI] Using provider: {provider}, model: {GROQ_MODEL if provider == 'groq' else OLLAMA_MODEL}")
    if provider == 'ollama':
        return await call_ollama(messages, temperature, max_tokens)
    return await call_groq(messages, temperature, max_tokens)


# ─────────────────────────────────────────────
# System Prompt Builder (for /api/chat)
# ─────────────────────────────────────────────

def build_system_prompt(context: dict) -> str:
    prompt = """You are the XYZ Bank Data Insight Agent.

RULES:
- Answer based ONLY on the data provided below. Never invent or estimate numbers.
- For TABLE requests: use markdown tables with | separators
- For CHART/GRAPH requests: respond with a ```json code block in this exact format:
  {"type": "bar"|"line"|"pie", "title": "...", "data": [{"name": "...", "value": 123}, ...]}
- Keep responses concise, professional, and in English
- Use ## headings and bullet points for structure
- If the data does not contain enough information to answer, say so clearly

"""

    # ── Query Result Context (Text-to-SQL results) ──
    if context.get('queryResult'):
        qr = context['queryResult']
        rows = qr.get('rows', [])
        cols = qr.get('columns', [])
        total_returned = qr.get('totalReturned', len(rows))
        total_in_table = max(0, qr.get('totalInTable', 0))
        sql = qr.get('sql', '')

        prompt += f"\n=== QUERY RESULTS (Real Data from Full Dataset) ===\n"
        prompt += f"Table Size: {total_in_table:,} rows total in database\n"
        prompt += f"Rows Returned by Query: {total_returned}\n"
        if sql:
            prompt += f"SQL Used: {sql}\n"
        prompt += f"Columns: {', '.join(cols)}\n\n"

        if rows:
            prompt += "Data:\n"
            for row in rows[:100]:
                prompt += json.dumps(row, default=str) + "\n"

        prompt += "\n⚠️ IMPORTANT: These results come from executing SQL against ALL "
        prompt += f"{total_in_table:,} records. They are ACCURATE — not a sample. "
        prompt += "Base your entire answer on these results only.\n"

        if qr.get('sqlError'):
            prompt += f"\n⚠️ Note: The SQL query encountered an error: {qr.get('sqlError')}\n"
            prompt += "A fallback sample of data is shown below instead.\n"

    # ── Fallback: Sample-based Data Mart Data ──
    elif context.get('dataMartData'):
        dm = context['dataMartData']
        records = dm.get('records', [])
        columns = dm.get('columns', [])
        total_rows = dm.get('totalRows', 0)

        prompt += f"\n=== DATA MART SAMPLE: {dm.get('name', 'Unknown')} ===\n"
        prompt += f"⚠️ WARNING: This is a SAMPLE of {len(records)} rows from {total_rows:,} total rows.\n"
        prompt += f"Columns: {', '.join(columns)}\n\n"

        if records and columns:
            df = pd.DataFrame(records, columns=columns)
            prompt += "Sample rows:\n"
            for i, row in enumerate(records[:20]):
                prompt += f"[{i+1}] {json.dumps({col: row.get(col, '') for col in columns[:12]}, default=str)}\n"

        prompt += "\n⚠️ Do NOT extrapolate these sample values to the full dataset. "
        prompt += "Tell the user these are sample results only.\n"

    # ── File Upload Data ──
    if context.get('fileData'):
        fd = context['fileData']
        data = fd.get('data', [])
        headers = fd.get('headers', [])

        prompt += f"\n=== UPLOADED FILE: {fd.get('name', 'Unknown')} ===\n"
        prompt += f"Columns: {', '.join(headers)}\n"
        prompt += f"Total Rows in File: {fd.get('totalRows', len(data))}\n"
        prompt += f"Rows Available for Analysis: {len(data)}\n\n"

        if data:
            prompt += "Data:\n"
            for i, row in enumerate(data[:50]):
                row_data = [f"{h}: {row.get(h, '')}" for h in headers]
                prompt += f"[{i+1}] {' | '.join(row_data)}\n"
            prompt += "\nUse ONLY the actual row data listed above. Do NOT generate, invent, or fabricate any data values.\n"
            prompt += "If the user asks for sample records, show the actual rows from the data above — not fictional examples.\n"
        else:
            prompt += "⚠️ The uploaded file contains zero data rows. Do NOT fabricate or generate fictional data.\n"
            prompt += "Inform the user that no data was found in the uploaded file.\n"

    # ── Data Mart Info ──
    if context.get('dataMartInfo'):
        dm = context['dataMartInfo']
        prompt += f"\nActive Data Mart: {dm.get('name', 'Unknown')}\n"
        if dm.get('description'):
            prompt += f"Description: {dm.get('description')}\n"

    # ── Available Tables ──
    if context.get('availableTables'):
        prompt += "\n=== USER'S AVAILABLE DATA MARTS ===\n"
        for table in context['availableTables']:
            name = table.get('name', table.get('table_name', 'Unknown'))
            prompt += f"- {name}\n"

    return prompt


# ─────────────────────────────────────────────
# /api/sql-gen — Generate SQL from natural language
# ─────────────────────────────────────────────

@app.post("/api/sql-gen")
async def sql_gen(request: SqlGenRequest):
    """
    Accepts a natural language question + table schema and returns
    a safe PostgreSQL SELECT query. Temperature is set very low (0.1)
    for deterministic, accurate SQL generation.
    """
    # Build column description
    col_lines = []
    for c in request.columns:
        col_name = c.get('column_name', '')
        col_type = c.get('data_type', 'text')
        nullable = "(nullable)" if c.get('is_nullable') == 'YES' else ""
        col_lines.append(f"  {col_name} {col_type} {nullable}".strip())
    col_desc = "\n".join(col_lines)

    # Format sample rows for context
    sample_text = ""
    for i, row in enumerate(request.sample_rows[:3]):
        sample_text += f"Row {i+1}: {json.dumps(row, default=str)}\n"

    # Format recent conversation history (last 4 messages for follow-up context)
    history_text = ""
    recent = request.conversation_history[-4:] if request.conversation_history else []
    for msg in recent:
        role = "User" if msg.get('role') == 'user' else "Assistant"
        history_text += f"{role}: {msg.get('content', '')}\n"

    system_prompt = f"""You are a PostgreSQL expert for XYZ Bank.
Your ONLY job is to generate a valid PostgreSQL SELECT query.

TABLE SCHEMA:
Table: data_mart."{request.table_name}"
Columns:
{col_desc}

Total rows in table: {request.total_rows:,}

SAMPLE DATA (3 rows):
{sample_text}

STRICT RULES:
1. Output ONLY the raw SQL query — no explanation, no markdown, no code fences
2. Use ONLY SELECT statements — never INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE
3. Always reference the table as: data_mart."{request.table_name}"
4. Double-quote column names that contain spaces or special characters
5. Add LIMIT 100 at the end unless the user asks for a specific number or COUNT
6. For aggregations, always use GROUP BY
7. For date columns, use PostgreSQL date functions (DATE_TRUNC, EXTRACT, etc.)
8. For text searches, use ILIKE for case-insensitive matching
9. If the question asks for a count of all rows, use: SELECT COUNT(*) AS total_count FROM data_mart."{request.table_name}"
10. Never use subqueries that reference tables outside of data_mart schema
11. If you cannot generate a valid SQL for the question, output exactly: CANNOT_GENERATE
"""

    user_prompt = ""
    if history_text:
        user_prompt += f"Conversation context:\n{history_text}\n"
    user_prompt += f"Question: {request.question}\n\nGenerate the SQL query:"

    try:
        sql = await call_ai(
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ],
            temperature=0.1,
            max_tokens=500
        )

        # Strip any accidental markdown fences
        sql = re.sub(r'```sql\s*', '', sql, flags=re.IGNORECASE)
        sql = re.sub(r'```\s*', '', sql)
        sql = sql.strip()

        if sql == 'CANNOT_GENERATE' or not sql:
            return {"sql": None, "error": "Could not generate SQL for this question"}

        print(f"[SQL-GEN] Generated: {sql[:120]}...")
        return {"sql": sql}

    except Exception as e:
        print(f"[SQL-GEN] Error: {e}")
        return {"sql": None, "error": str(e)}


# ─────────────────────────────────────────────
# /api/chat — Format query results into response
# ─────────────────────────────────────────────

@app.post("/api/chat")
async def chat(request: ChatRequest):
    print(f"[AI] Messages: {len(request.messages)}")
    print(f"[AI] Has fileData: {bool(request.context.get('fileData'))}")
    print(f"[AI] Has queryResult: {bool(request.context.get('queryResult'))}")
    print(f"[AI] Has dataMartData (fallback): {bool(request.context.get('dataMartData'))}")

    if request.context.get('queryResult'):
        qr = request.context['queryResult']
        print(f"[AI] Query returned {qr.get('totalReturned')} rows from {qr.get('totalInTable'):,} total")

    system_prompt = build_system_prompt(request.context)
    api_messages = [{'role': 'system', 'content': system_prompt}] + request.messages

    try:
        ai_message = await call_ai(api_messages, temperature=TEMPERATURE, max_tokens=MAX_TOKENS)

        # Detect model capability errors
        if is_image_error(ai_message):
            return {
                'success': True,
                'message': IMAGE_ERROR_RESPONSE,
                'model': MODEL
            }

        # Clean up stray asterisk-only patterns
        cleaned = re.sub(r'^\*+\s*\n?', '', ai_message)
        cleaned = re.sub(r'\n\*+\s*\n?', '\n', cleaned)
        cleaned = re.sub(r'\[\d+\]\([^)]+\)', '', cleaned)

        if re.match(r'^[\*\s\n]+$', cleaned.strip()) or len(cleaned.strip()) < 10:
            cleaned = "The analysis completed but no meaningful content was generated. Please try rephrasing your question."

        print(f"[AI] Response: {len(cleaned)} chars")
        return {'success': True, 'message': cleaned, 'model': MODEL}

    except Exception as e:
        print(f"[AI] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# /api/chat/stream — SSE streaming endpoint
# ─────────────────────────────────────────────

async def stream_ollama(messages: list, temperature: float = 0.3, max_tokens: int = 4000):
    """Call Ollama with streaming and yield SSE tokens."""
    url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens
        }
    }
    async with ai_semaphore:
        try:
            async with http_client.stream("POST", url, json=payload, timeout=float(OLLAMA_TIMEOUT)) as resp:
                if resp.status_code != 200:
                    error_text = await resp.aread()
                    yield f"data: {{\"error\": \"Ollama API error: {resp.status_code}\"}}\n\n"
                    return
                buffer = ""
                async for chunk in resp.aiter_bytes():
                    buffer += chunk.decode()
                    lines = buffer.split("\n")
                    buffer = lines.pop()
                    for line in lines:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                            token = data.get("message", {}).get("content", "")
                            if token:
                                yield f"data: {json.dumps({'token': token})}\n\n"
                        except json.JSONDecodeError:
                            pass
                yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"


async def stream_groq(messages: list, temperature: float = 0.3, max_tokens: int = 4000):
    """Call Groq with streaming and yield SSE tokens."""
    async with ai_semaphore:
        try:
            async with http_client.stream("POST", GROQ_API_URL,
                headers={
                    'Authorization': f'Bearer {GROQ_API_KEY}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': GROQ_MODEL,
                    'messages': messages,
                    'temperature': temperature,
                    'max_tokens': max_tokens,
                    'stream': True
                },
                timeout=120.0
            ) as resp:
                if resp.status_code != 200:
                    yield f"data: {{\"error\": \"Groq API error: {resp.status_code}\"}}\n\n"
                    return
                buffer = ""
                async for chunk in resp.aiter_bytes():
                    buffer += chunk.decode()
                    lines = buffer.split("\n")
                    buffer = lines.pop()
                    for line in lines:
                        line = line.strip()
                        if not line or not line.startswith("data: "):
                            continue
                        payload_str = line[6:]
                        if payload_str == "[DONE]":
                            yield "data: [DONE]\n\n"
                            return
                        try:
                            data = json.loads(payload_str)
                            token = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if token:
                                yield f"data: {json.dumps({'token': token})}\n\n"
                        except json.JSONDecodeError:
                            pass
        except Exception as e:
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    context = request.context
    system_prompt = build_system_prompt(context)
    api_messages = [{'role': 'system', 'content': system_prompt}] + request.messages

    provider = AI_PROVIDER.lower()
    if provider == 'ollama':
        stream_gen = stream_ollama(api_messages, temperature=TEMPERATURE, max_tokens=MAX_TOKENS)
    else:
        stream_gen = stream_groq(api_messages, temperature=TEMPERATURE, max_tokens=MAX_TOKENS)

    return StreamingResponse(stream_gen, media_type="text/event-stream")


# ─────────────────────────────────────────────
# /api/autocomplete
# ─────────────────────────────────────────────

@app.post("/api/autocomplete")
async def autocomplete(request: AutocompleteRequest):
    input_text = request.current_input.strip()
    if not input_text or len(input_text) < 3:
        return {"suggestion": ""}

    dm_name = request.context.get("dataMartName", "")
    dm_desc = request.context.get("dataMartDescription", "")

    system_prompt = """You are an AI assistant that suggests short query completions for a banking data analysis tool.
Given a partial user query, suggest ONLY the completion (3-8 words max).
Respond with ONLY the completion text. No quotes, no prefixes, no extra words."""

    if dm_name:
        system_prompt += f"\n\nThe user is querying: {dm_name}"
    if dm_desc:
        system_prompt += f" ({dm_desc})"

    user_prompt = f"Partial query: \"{input_text}\"\nComplete it (3-8 words only):"

    try:
        raw = await call_ai(
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ],
            temperature=0.3,
            max_tokens=20
        )
        raw = raw.strip().strip('"').strip("'")
        if raw and len(raw) < 50 and not input_text.lower().startswith(raw.lower()):
            return {"suggestion": raw}
        return {"suggestion": ""}
    except Exception as e:
        print(f"[AI Autocomplete] Error: {e}")
        return {"suggestion": ""}


# ─────────────────────────────────────────────
# /api/suggestions
# ─────────────────────────────────────────────

@app.post("/api/suggestions")
async def suggestions(request: SuggestionsRequest):
    # Try Cache first
    if request.file_name:
        cache_key = f"file:{request.file_name}:{','.join(request.file_headers)}"
    else:
        cache_key = f"db:{request.data_mart_name}:{','.join(request.columns)}"
        
    cached_val = get_cached_suggestions(cache_key)
    if cached_val is not None:
        return {"suggestions": cached_val}

    system_prompt = """You are a banking executive data analyst. Generate 4 insightful business questions based STRICTLY on the provided data mart name and its columns.

Rules:
- Each question on a separate line starting with "- "
- Every question MUST reference one or more of the listed columns
- Questions must be specific to the data mart/table name and its column context
- Executive report style: trends, rankings, distributions, comparisons, top-N, period comparisons
- Banking/finance relevant: growth, performance, risk, customer behavior, digital adoption
- Keep each question under 15 words
- Never ask about the data structure itself (what columns exist, how many rows, schema questions)
- Different data marts should get completely different questions based on their columns
- Respond with ONLY the 4 lines, nothing else"""

    context_info = ""
    if request.file_name:
        context_info += f"\nUploaded file: {request.file_name}\n"
        if request.file_headers:
            context_info += f"Columns: {', '.join(request.file_headers)}\n"
        context_info += f"Rows: {request.file_rows}\n"
    elif request.data_mart_name:
        context_info += f"\nData Mart: {request.data_mart_name}\n"
        if request.columns:
            context_info += f"Columns: {', '.join(request.columns)}\n"
        context_info += f"Total rows: {request.total_rows}\n"

    user_prompt = f"Generate 4 executive analysis questions for the data source below. Each question must use actual column names.{context_info}"

    try:
        raw = await call_ai(
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ],
            temperature=0.5,
            max_tokens=200
        )
        questions = [line.strip("- ").strip() for line in raw.strip().split("\n") if line.strip().startswith("- ")]
        questions = [q for q in questions if q][:4]
        while len(questions) < 4:
            questions.append(f"Show analysis of {request.data_mart_name or request.file_name or 'data'}")
        
        # Set cache
        set_cached_suggestions(cache_key, questions)
        return {"suggestions": questions}
    except Exception as e:
        print(f"[AI Suggestions] Error: {e}")
        fallback_questions = [
            f"Show monthly trend for {request.data_mart_name or request.file_name or 'data'}",
            f"Top 10 by key metric in {request.data_mart_name or request.file_name or 'data'}",
            f"Compare performance across categories",
            f"Show summary report with key metrics"
        ]
        return {"suggestions": fallback_questions}


# ─────────────────────────────────────────────
# Health & Info
# ─────────────────────────────────────────────

@app.get("/health")
async def health():
    return {'status': 'ok', 'service': 'Python AI Service', 'model': MODEL}

@app.get("/")
async def index():
    return {
        'service': 'XYZ Bank Data Insight Service',
        'version': '2.0.0',
        'endpoints': {
            'chat': '/api/chat',
            'sql_gen': '/api/sql-gen',
            'autocomplete': '/api/autocomplete',
            'health': '/health'
        }
    }

if __name__ == "__main__":
    PORT = int(os.environ.get('PORT', 3002))
    print(f"Python AI Service v2.0 running on port {PORT}")
    uvicorn.run(app, host='0.0.0.0', port=PORT)