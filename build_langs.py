# -*- coding: utf-8 -*-
"""Validate generated language JSON and build the registration .js files."""
import json, os, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
LANGS = ["fr", "de", "it", "pt", "ko"]
ROMAN = {"ko"}  # languages that must carry romanization on every word/sentence
EXPECT_UNITS = ["u1", "u2", "u3", "u4", "u5"]

errs, warns = [], []


def err(c, m): errs.append("[%s] %s" % (c, m))
def warn(c, m): warns.append("[%s] %s" % (c, m))


def validate_course(code, course):
    if course.get("code") != code:
        warn(code, "course.code is %r, expected %r" % (course.get("code"), code))
    func = course.get("func", {})
    if not isinstance(func, dict) or not (25 <= len(func) <= 60):
        err(code, "func map size %d (want ~35-45)" % (len(func) if isinstance(func, dict) else -1))
    secs = course.get("sections", [])
    if len(secs) != 2:
        err(code, "expected 2 sections, got %d" % len(secs))
    units = []
    for s in secs:
        units.extend(s.get("units", []))
    ids = [u.get("id") for u in units]
    if ids != EXPECT_UNITS:
        err(code, "unit ids %r != %r" % (ids, EXPECT_UNITS))
    for u in units:
        uid = u.get("id")
        if not u.get("title") or not u.get("tip"):
            err(code, "%s missing title/tip" % uid)
        words = u.get("words", [])
        sents = u.get("sentences", [])
        if len(words) != 12:
            err(code, "%s has %d words (want 12)" % (uid, len(words)))
        if len(sents) != 10:
            err(code, "%s has %d sentences (want 10)" % (uid, len(sents)))
        seen = set()
        for w in words:
            es, en = w.get("es", ""), w.get("en", "")
            if not es or not en:
                err(code, "%s word missing es/en: %r" % (uid, w))
            if code in ROMAN and not w.get("rom"):
                err(code, "%s word missing rom: %r" % (uid, es))
            if es.strip().lower() in seen:
                warn(code, "%s duplicate word es=%r" % (uid, es))
            seen.add(es.strip().lower())
            if es.strip().lower() == en.strip().lower():
                warn(code, "%s word es==en %r (English leaking into target?)" % (uid, es))
        for s in sents:
            es, en = s.get("es", ""), s.get("en", "")
            if not es or not en:
                err(code, "%s sentence missing es/en: %r" % (uid, s))
            if code in ROMAN and not s.get("rom"):
                err(code, "%s sentence missing rom: %r" % (uid, es))
            wc = len(es.split())
            if wc < 2 or wc > 11:
                warn(code, "%s sentence length %d: %r" % (uid, wc, es))
    return course


def validate_stories(code, stories):
    if not isinstance(stories, list) or len(stories) != 2:
        err(code, "expected 2 stories, got %s" % (len(stories) if isinstance(stories, list) else type(stories)))
        return stories
    for st in stories:
        sid = st.get("id", "?")
        if not sid.startswith(code + "_"):
            warn(code, "story id %r not prefixed with %s_" % (sid, code))
        if st.get("unit") not in ("u3", "u5"):
            warn(code, "story %s unit=%r (want u3/u5)" % (sid, st.get("unit")))
        lines = st.get("lines", [])
        if not (12 <= len(lines) <= 16):
            warn(code, "story %s has %d lines (want 12-16)" % (sid, len(lines)))
        qs = [l for l in lines if l.get("type") == "q"]
        if len(qs) != 3:
            err(code, "story %s has %d q-lines (want 3)" % (sid, len(qs)))
        for q in qs:
            ch = q.get("choices", [])
            a = q.get("answer")
            if len(ch) != 3:
                err(code, "story %s q has %d choices (want 3): %r" % (sid, len(ch), q.get("prompt")))
            if not isinstance(a, int) or a < 0 or a >= len(ch):
                err(code, "story %s q bad answer index %r" % (sid, a))
        for l in lines:
            t = l.get("type")
            if t in ("narr", "say"):
                if not l.get("es") or not l.get("en"):
                    err(code, "story %s %s line missing es/en" % (sid, t))
            elif t == "q":
                if not l.get("prompt"):
                    err(code, "story %s q missing prompt" % sid)
            else:
                err(code, "story %s unknown line type %r" % (sid, t))
    return stories


def jsdump(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


for code in LANGS:
    d = os.path.join(BASE, code)
    cpath, spath = os.path.join(d, "course.json"), os.path.join(d, "stories.json")
    if not os.path.exists(cpath) or not os.path.exists(spath):
        err(code, "missing course.json or stories.json")
        continue
    try:
        course = json.load(open(cpath, encoding="utf-8"))
        stories = json.load(open(spath, encoding="utf-8"))
    except Exception as e:
        err(code, "JSON parse error: %s" % e)
        continue
    validate_course(code, course)
    validate_stories(code, stories)
    # build registration JS
    course_js = "(window.COURSES=window.COURSES||{})[%s]={part1:{sections:%s},func:%s};\n" % (
        jsdump(code), jsdump(course.get("sections", [])), jsdump(course.get("func", {})))
    stories_js = "(window.STORIES_BY_LANG=window.STORIES_BY_LANG||{})[%s]=%s;\n" % (
        jsdump(code), jsdump(stories))
    open(os.path.join(d, "course.js"), "w", encoding="utf-8").write(course_js)
    open(os.path.join(d, "stories.js"), "w", encoding="utf-8").write(stories_js)
    nwords = sum(len(u.get("words", [])) for s in course.get("sections", []) for u in s.get("units", []))
    nsent = sum(len(u.get("sentences", [])) for s in course.get("sections", []) for u in s.get("units", []))
    print("%s: %d words, %d sentences, %d func, %d stories -> wrote course.js + stories.js" % (
        code, nwords, nsent, len(course.get("func", {})), len(stories)))

print("\n--- ERRORS (%d) ---" % len(errs))
for e in errs:
    print(e)
print("\n--- WARNINGS (%d) ---" % len(warns))
for w in warns:
    print(w)
print("\nRESULT:", "FAIL" if errs else "PASS")
