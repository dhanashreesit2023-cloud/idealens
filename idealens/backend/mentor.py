"""Rule-based mentor chat (used when no LLM key is set, or as fallback)."""
import re


def answer(doc, message):
    r, s, m = doc["report"], doc["report"]["scores"], message.lower()
    has = lambda *w: any(re.search(x, m) for x in w)
    if has(r"\bcost|budget|price|money|expens|afford"):
        return f"Estimated cost: {r['cost']['estimate']} ({r['cost']['band']} band). To cut it, use free tiers, open datasets and simulators before buying hardware or paid APIs."
    if has(r"\btime|week|long|deadline|duration|schedule"):
        return f"Expect about {r['time_weeks']} weeks. Phases: " + "; ".join(f"{p['phase']} (week {p['from_week']}-{p['to_week']})" for p in r["roadmap"]) + "."
    if has(r"\brisk|danger|problem|fail|challenge"):
        top = sorted(r["risks"], key=lambda x: {"High": 0, "Medium": 1, "Low": 2}[x["level"]])[:3]
        return "Biggest risks: " + " | ".join(f"{k['category']} ({k['level']}): {k['mitigation']}" for k in top)
    if has(r"improv|better|innovat|differenti|unique|stand out|enhance|feature"):
        return "Ways to strengthen it: " + " ".join(f"{i + 1}) {x}" for i, x in enumerate(r["suggestions"][:3]))
    if has(r"\btech|stack|framework|language|tool|database|library"):
        t = r["technology"]
        return f"Suggested stack - Frontend: {t['Frontend']}; Backend: {t['Backend']}; Database: {t['Database']}; AI/ML: {t['AI / ML']}; Deployment: {t['Deployment']}."
    if has(r"similar|exist|competit|duplicate|already|copy"):
        if not r["similar"]:
            return "No close matches were found in the reference dataset, so the idea looks fairly unique."
        return "Closest existing projects: " + "; ".join(f"{x['title']} ({x['similarity']}%)" for x in r["similar"][:3]) + ". Differentiate with a feature or user group they do not serve."
    if has(r"roadmap|plan|step|start|begin|how do i"):
        return "Start with: " + "; ".join(f"{p['phase']}: {p['tasks'][0]}" for p in r["roadmap"][:3]) + "."
    if has(r"sdg|goal|sustainab|united nations|\bun\b"):
        return ("Matching UN SDGs: " + "; ".join(f"SDG {g['number']} {g['name']}" for g in r["sdgs"]) + ".") if r["sdgs"] else "No clear UN SDG match - mention who benefits and how to strengthen the link."
    if has(r"score|why|explain|origin|feasib|impact|relevan|rating|overall"):
        return f"Overall {s['overall']}/100. " + " ".join(f"{k.capitalize()} {s[k]}: {r['reasons'][k]}" for k in ("originality", "feasibility", "innovation"))
    return "I can help with cost, time, risks, improvements, technology, similar projects, the roadmap, SDGs or why you got these scores. Try: 'How can I reduce the cost?'"
