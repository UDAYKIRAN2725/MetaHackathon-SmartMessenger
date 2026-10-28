import os
import statistics
import time

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
api_key = os.getenv("API_KEY")
if not api_key:
    raise RuntimeError("API_KEY not found. Add it to your .env file.")

client = OpenAI(base_url="https://api.meta.ai/v1", api_key=api_key)

MODELS = ["muse-wonder-1.0", "muse-spark-1.3", "muse-spark-1.2", "muse-spark-1.1"]
# Reasoning effort: None = API default. Set via env var, e.g. EFFORT=minimal
EFFORT = os.getenv("EFFORT") or None
PROMPT = "Write a friendly 3-sentence reply to a friend asking if I'm free for dinner on Friday."
RUNS = 3


def time_one(model):
    """Return (time to first token, total time, output tokens) for one streamed call."""
    start = time.perf_counter()
    first = None
    tokens = None
    stream = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": PROMPT}],
        stream=True,
        stream_options={"include_usage": True},
        **({"reasoning_effort": EFFORT} if EFFORT else {}),
    )
    for chunk in stream:
        if first is None and chunk.choices and chunk.choices[0].delta.content:
            first = time.perf_counter() - start
        if chunk.usage:
            tokens = chunk.usage.completion_tokens
    total = time.perf_counter() - start
    return first if first is not None else total, total, tokens


print(f"Prompt: {PROMPT}\nRuns per model: {RUNS}\nReasoning effort: {EFFORT or 'default'}\n")
print(f"{'Model':<18}{'First token (s)':>17}{'Total (s)':>12}{'Out tokens':>12}")
for model in MODELS:
    try:
        results = [time_one(model) for _ in range(RUNS)]
    except Exception as e:
        print(f"{model:<18}  error: {e}")
        continue
    ttft = statistics.median(r[0] for r in results)
    total = statistics.median(r[1] for r in results)
    toks = [r[2] for r in results if r[2] is not None]
    tok_str = str(int(statistics.median(toks))) if toks else "n/a"
    print(f"{model:<18}{ttft:>17.2f}{total:>12.2f}{tok_str:>12}")
