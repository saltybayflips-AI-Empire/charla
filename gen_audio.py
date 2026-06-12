# Generate neural MP3s for all course content with edge-tts (es-MX-DaliaNeural)
import asyncio, json, hashlib, os, sys, io
import edge_tts

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
VOICE = "es-MX-DaliaNeural"
OUT = "audio"

def load(path, prefix):
    txt = open(path, encoding="utf-8").read().strip()
    return json.loads(txt[len(prefix):-1])

p1 = load("course-data-1.js", "window.COURSE_PART1 =")
p2 = load("course-data-2.js", "window.COURSE_PART2 =")
stories = load("stories-data.js", "window.STORIES =")

texts = []
seen = set()
def add(t):
    t = t.strip()
    if t and t not in seen:
        seen.add(t); texts.append(t)

for sec in p1["sections"] + p2["sections"]:
    for u in sec["units"]:
        for w in u["words"]: add(w["es"])
        for s in u["sentences"]: add(s["es"])
for st in stories:
    for l in st["lines"]:
        if l["type"] in ("narr", "say"): add(l["es"])

os.makedirs(OUT, exist_ok=True)
def fname(t): return hashlib.sha1(t.encode("utf-8")).hexdigest()[:12] + ".mp3"

async def gen(t, sem):
    path = os.path.join(OUT, fname(t))
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return True
    async with sem:
        for attempt in range(3):
            try:
                c = edge_tts.Communicate(t, VOICE)
                await c.save(path)
                if os.path.getsize(path) > 500:
                    return True
            except Exception as e:
                await asyncio.sleep(1.5 * (attempt + 1))
    return False

async def main():
    sem = asyncio.Semaphore(4)
    results = await asyncio.gather(*[gen(t, sem) for t in texts])
    ok = sum(1 for r in results if r)
    fails = [t for t, r in zip(texts, results) if not r]
    # write the lookup map (only successful clips)
    mp = {t: OUT + "/" + fname(t) for t, r in zip(texts, results) if r}
    with open("audio-map.js", "w", encoding="utf-8") as f:
        f.write("window.AUDIO_MAP = " + json.dumps(mp, ensure_ascii=False) + ";")
    total_kb = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) // 1024
    print(f"AUDIO DONE: {ok}/{len(texts)} clips, {total_kb} KB total")
    if fails:
        print("FAILED:", "; ".join(fails[:10]))
        sys.exit(1)

asyncio.run(main())
