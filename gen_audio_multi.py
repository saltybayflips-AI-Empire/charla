# -*- coding: utf-8 -*-
"""Generate neural MP3s for FR/DE/IT/PT course content with edge-tts.
Idempotent: skips clips that already exist (>1KB). Writes data/<code>/audio-map.js."""
import asyncio, json, hashlib, os, sys, io
import edge_tts

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

LANGS = {
    "fr": "fr-FR-DeniseNeural",
    "de": "de-DE-KatjaNeural",
    "it": "it-IT-ElsaNeural",
    "pt": "pt-BR-FranciscaNeural",
    "ko": "ko-KR-SunHiNeural",
}
BASE = os.path.dirname(os.path.abspath(__file__))


def collect_texts(code):
    d = os.path.join(BASE, "data", code)
    course = json.load(open(os.path.join(d, "course.json"), encoding="utf-8"))
    stories = json.load(open(os.path.join(d, "stories.json"), encoding="utf-8"))
    texts, seen = [], set()

    def add(t):
        t = (t or "").strip()
        if t and t not in seen:
            seen.add(t)
            texts.append(t)

    for sec in course.get("sections", []):
        for u in sec.get("units", []):
            for w in u.get("words", []):
                add(w.get("es"))
            for s in u.get("sentences", []):
                add(s.get("es"))
    for st in stories:
        for l in st.get("lines", []):
            if l.get("type") in ("narr", "say"):
                add(l.get("es"))
    return texts


def fname(t):
    return hashlib.sha1(t.encode("utf-8")).hexdigest()[:12] + ".mp3"


async def gen(text, voice, outdir, sem):
    path = os.path.join(outdir, fname(text))
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return True
    async with sem:
        for attempt in range(3):
            try:
                c = edge_tts.Communicate(text, voice)
                await c.save(path)
                if os.path.getsize(path) > 500:
                    return True
            except Exception:
                await asyncio.sleep(1.5 * (attempt + 1))
    return False


async def do_lang(code, voice, sem):
    outdir = os.path.join(BASE, "data", code, "audio")
    os.makedirs(outdir, exist_ok=True)
    texts = collect_texts(code)
    results = await asyncio.gather(*[gen(t, voice, outdir, sem) for t in texts])
    ok = sum(1 for r in results if r)
    fails = [t for t, r in zip(texts, results) if not r]
    # map keys = exact target text, values = path relative to index.html
    mp = {t: "data/%s/audio/%s" % (code, fname(t)) for t, r in zip(texts, results) if r}
    js = '(window.AUDIO_MAPS=window.AUDIO_MAPS||{})["%s"]=%s;\n' % (code, json.dumps(mp, ensure_ascii=False))
    open(os.path.join(BASE, "data", code, "audio-map.js"), "w", encoding="utf-8").write(js)
    kb = sum(os.path.getsize(os.path.join(outdir, f)) for f in os.listdir(outdir)) // 1024
    print("%s: %d/%d clips, %d KB%s" % (code, ok, len(texts), kb, (" FAILS:" + "; ".join(fails[:6])) if fails else ""))
    return ok, len(texts), fails


async def main():
    sem = asyncio.Semaphore(6)
    grand_ok = grand_total = 0
    any_fail = False
    for code, voice in LANGS.items():
        ok, total, fails = await do_lang(code, voice, sem)
        grand_ok += ok
        grand_total += total
        if fails:
            any_fail = True
    print("ALL AUDIO DONE: %d/%d clips across %d languages" % (grand_ok, grand_total, len(LANGS)))
    if any_fail:
        sys.exit(1)


asyncio.run(main())
