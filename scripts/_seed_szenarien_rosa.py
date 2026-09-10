#!/usr/bin/env python3
import os, json, uuid, urllib.request, urllib.parse, dotenv, pathlib

dotenv.load_dotenv(pathlib.Path(__file__).parent.parent / ".env.local")
URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}",
     "Content-Type": "application/json", "Prefer": "return=representation"}

PROP_ID = "da000000-0000-0000-0000-000000000010"
TENANT  = "a0000000-0000-0000-0000-000000000d01"
USER_ID = "b8da1bcf-9ab8-4546-8d85-e1eaffd49e43"
FAKTOR  = 20
IST_NOI = 161_220.0

def call(method, path, body=None, qs=None):
    url = URL + path + (f"?{urllib.parse.urlencode(qs)}" if qs else "")
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, method=method, headers=H)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read().decode()
            return (json.loads(raw) if raw.strip() else [])
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:200]}")
        return None

def calc(typ, p):
    invest = ertrag = 0.0
    if typ == "werbeflaeche_giebel": ertrag = p.get("miete_pa_eur", 0)
    elif typ == "fahrradbox": invest = p.get("invest_eur", 0); ertrag = p.get("menge",0)*p.get("miete_pm_eur",0)*12
    elif typ == "muenzwaschraum": invest = p.get("invest_eur",0); ertrag = p.get("ertrag_pa_eur",0)
    elif typ == "stellplatz_anlegen": invest = p.get("invest_eur",0); ertrag = p.get("menge",0)*p.get("miete_pm_eur",0)*12
    elif typ in ("kellerlager","garten_parzelle"): ertrag = p.get("menge",0)*p.get("miete_pm_eur",0)*12
    elif typ in ("dg_ausbau","souterrain_ausbau"):
        invest = p.get("neue_flaeche_qm",0)*p.get("baukosten_qm_eur",0)
        ertrag = p.get("neue_flaeche_qm",0)*p.get("zielmiete_eur_qm",0)*12
    elif typ == "pv_dachpacht": invest = p.get("capex_eur",0); ertrag = p.get("pacht_pa_eur",0)
    elif typ == "dachpacht_mobilfunk": ertrag = p.get("pacht_pa_eur",0)
    wh = round(ertrag*FAKTOR, 2)
    am = round(invest/ertrag, 2) if invest > 0 and ertrag > 0 else None
    return round(invest,2), round(ertrag,2), wh, am

# Objektfaktor setzen
call("PATCH", "/rest/v1/properties",
     {"objektfaktor": FAKTOR, "gemeinde_id": "e1000000-0000-0000-0000-000000000001"},
     {"id": f"eq.{PROP_ID}"})
print("✓ Objektfaktor=20 + Gemeinde Leipzig gesetzt\n")

SZENARIEN = [
    {"name": "A – Quick Wins", "massnahmen": [
        ("werbeflaeche_giebel", {"miete_pa_eur": 2000},           "zulaessig"),
        ("fahrradbox",          {"menge":8,"miete_pm_eur":55,"invest_eur":8000}, "zulaessig"),
        ("muenzwaschraum",      {"invest_eur":15000,"ertrag_pa_eur":3600},       "zulaessig"),
        ("stellplatz_anlegen",  {"menge":4,"miete_pm_eur":55,"invest_eur":5000},"bedingt"),
        ("kellerlager",         {"menge":9,"miete_pm_eur":65},                   "zulaessig"),
        ("garten_parzelle",     {"menge":7,"miete_pm_eur":40},                   "zulaessig"),
    ]},
    {"name": "B – DG-Ausbau", "massnahmen": [
        ("dg_ausbau", {"neue_flaeche_qm":210,"baukosten_qm_eur":2500,"zielmiete_eur_qm":12}, "bedingt"),
    ]},
    {"name": "C – PV + Mobilfunk", "massnahmen": [
        ("pv_dachpacht",       {"kwp":65,"capex_eur":0,"pacht_pa_eur":4500}, "bedingt"),
        ("dachpacht_mobilfunk",{"pacht_pa_eur":5000},                        "bedingt"),
        ("dachpacht_mobilfunk",{"pacht_pa_eur":4500},                        "bedingt"),
    ]},
    {"name": "D – Souterrain", "massnahmen": [
        ("souterrain_ausbau", {"neue_flaeche_qm":68,"baukosten_qm_eur":850,"zielmiete_eur_qm":8}, "bedingt"),
    ]},
]

for sz_def in SZENARIEN:
    sz_id = str(uuid.uuid4())
    res = call("POST", "/rest/v1/szenario", {
        "id": sz_id, "tenant_id": TENANT, "created_by": USER_ID,
        "property_id": PROP_ID, "name": sz_def["name"], "ist_baseline": False,
    })
    if res is None:
        print(f"✗ Szenario {sz_def['name']} konnte nicht angelegt werden"); continue

    print(f"── {sz_def['name']}")
    delta = 0.0
    for typ, params, zul in sz_def["massnahmen"]:
        m_id = str(uuid.uuid4())
        invest, ertrag, wh, am = calc(typ, params)
        call("POST", "/rest/v1/massnahme", {
            "id": m_id, "tenant_id": TENANT, "created_by": USER_ID,
            "property_id": PROP_ID, "typ_code": typ, "params": params,
            "invest_eur": invest, "ertragswirkung_pa_eur": ertrag,
            "werthebel_eur": wh, "amortisation_jahre": am, "zulaessigkeit": zul,
        })
        call("POST", "/rest/v1/szenario_massnahme",
             {"szenario_id": sz_id, "massnahme_id": m_id, "tenant_id": TENANT})
        delta += ertrag
        am_str = f"amort {am:.1f}J" if am else "kein Invest"
        print(f"  {typ}: {ertrag:>9,.0f} €/J  wh {wh:>11,.0f} €  {am_str}")

    noi = round(IST_NOI + delta, 2)
    call("POST", "/rest/v1/kennzahlen_snapshot", {
        "id": str(uuid.uuid4()), "tenant_id": TENANT, "szenario_id": sz_id,
        "noi_eur": noi, "faktor": FAKTOR,
        "verkehrswert_eur": round(noi*FAKTOR, 2),
        "bruttorendite": None, "nettorendite": None, "ek_rendite": None,
        "irr": None, "aufteilungsgewinn_eur": 0,
        "inputs": {"ist_noi": IST_NOI, "delta_noi": delta},
        "engine_version": "1.0.0",
    })
    pct = delta/IST_NOI*100
    print(f"  → Jahres-Kaltmiete {IST_NOI:,.0f} + {delta:,.0f} = {noi:,.0f} €")
    print(f"  → Verkehrswert {noi*FAKTOR:,.0f} € (+{pct:.1f}% NOI)\n")

print("✓ Fertig.")
