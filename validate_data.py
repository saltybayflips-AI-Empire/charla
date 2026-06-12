# Independent validation of agent-generated course data
import json, re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

def load(path, prefix):
    txt = open(path, encoding="utf-8").read().strip()
    assert txt.startswith(prefix), f"{path}: bad prefix"
    assert txt.endswith(";"), f"{path}: missing trailing semicolon"
    return json.loads(txt[len(prefix):-1])

p1 = load("course-data-1.js", "window.COURSE_PART1 =")
p2 = load("course-data-2.js", "window.COURSE_PART2 =")
stories = load("stories-data.js", "window.STORIES =")

units = []
for sec in p1["sections"] + p2["sections"]:
    for u in sec["units"]:
        units.append(u)

ids = [u["id"] for u in units]
assert ids == [f"u{i}" for i in range(1, 16)], f"unit ids wrong: {ids}"

all_es = {}
problems = []
for u in units:
    if len(u["words"]) != 12: problems.append(f"{u['id']}: {len(u['words'])} words")
    if len(u["sentences"]) != 10: problems.append(f"{u['id']}: {len(u['sentences'])} sentences")
    if not u.get("tip"): problems.append(f"{u['id']}: missing tip")
    emoji_count = sum(1 for w in u["words"] if w.get("emoji"))
    if emoji_count < 5: problems.append(f"{u['id']}: only {emoji_count} emoji words")
    for w in u["words"]:
        key = w["es"].lower()
        if key in all_es: problems.append(f"duplicate word: '{w['es']}' in {u['id']} and {all_es[key]}")
        all_es[key] = u["id"]
        if not w.get("en"): problems.append(f"{u['id']}: word missing en: {w}")
    for s in u["sentences"]:
        n = len(s["es"].split())
        if n < 2 or n > 11: problems.append(f"{u['id']}: sentence length {n}: {s['es']}")
        if not s.get("en"): problems.append(f"{u['id']}: sentence missing en")

unit_ids = set(ids)
assert len(stories) == 5, f"{len(stories)} stories"
for st in stories:
    assert st["unit"] in unit_ids, f"story {st['id']} references missing unit {st['unit']}"
    qs = [l for l in st["lines"] if l["type"] == "q"]
    if not (3 <= len(qs) <= 4): problems.append(f"{st['id']}: {len(qs)} questions")
    if not (10 <= len(st["lines"]) <= 18): problems.append(f"{st['id']}: {len(st['lines'])} lines")
    for q in qs:
        assert isinstance(q["answer"], int) and 0 <= q["answer"] < len(q["choices"]), f"{st['id']}: bad answer index"
    for l in st["lines"]:
        if l["type"] == "say" and not l.get("avatar"): problems.append(f"{st['id']}: say line missing avatar")
    if not (15 <= st.get("xp", 0) <= 30): problems.append(f"{st['id']}: xp {st.get('xp')}")
answers = [q["answer"] for st in stories for q in st["lines"] if q["type"] == "q"]

total_words = sum(len(u["words"]) for u in units)
total_sents = sum(len(u["sentences"]) for u in units)
print(f"UNITS: {len(units)} | words: {total_words} | sentences: {total_sents} | stories: {len(stories)}")
print(f"story answer-index spread: {sorted(set(answers))} (counts: {[answers.count(i) for i in range(3)]})")
if problems:
    print("PROBLEMS:")
    for p in problems: print(" -", p)
    sys.exit(1)
print("ALL CHECKS PASSED")
