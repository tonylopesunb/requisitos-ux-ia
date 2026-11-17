"""Verifica a integridade do conjunto de dados fictícios.

Uso: python3 validar.py   (na pasta dos arquivos JSON)
Sai com código 1 se encontrar algum problema.
"""
import json
import pathlib
import sys

BASE = pathlib.Path(__file__).resolve().parent
problemas = []


def carregar(nome):
    return json.loads((BASE / nome).read_text(encoding="utf-8"))


orgao = carregar("orgao.json")
cat = carregar("catalogos.json")
perfis = carregar("perfis.json")
necs = carregar("necessidades.json")
hists = carregar("historias.json")
prts = carregar("prototipos.json")
riscos = carregar("riscos.json")
ents = carregar("entregas.json")
vins = carregar("rastreabilidade.json")
ia = carregar("registro_ia.json")


def ids(lista):
    vistos = set()
    for item in lista:
        if item["id"] in vistos:
            problemas.append(f"ID repetido: {item['id']}")
        vistos.add(item["id"])
    return vistos


P, N, H, PR, R, E, V, I = map(ids, [perfis, necs, hists, prts, riscos, ents, vins, ia])
EQP = ids(orgao["equipe_de_produto"])
SPR = ids(orgao["sprints"])
SRV = ids(orgao["servicos_digitais"])
HEU = {h["id"] for h in cat["heuristicas_nielsen"]}
WCAG = {w["id"] for w in cat["criterios_wcag_usados"]}
EMAG = {e["id"] for e in cat["recomendacoes_emag_usadas"]}
TRAT = {t["id"] for t in cat["tipos_de_tratamento"]}
TODOS = N | H | PR | E
ia_por_id = {e["id"]: e for e in ia}


def ref(valor, conjunto, onde):
    if valor is not None and valor not in conjunto:
        problemas.append(f"{onde}: referência inexistente {valor}")


for n in necs:
    ref(n["servico_id"], SRV, n["id"])
    ref(n["registrada_por"], EQP, n["id"])
    for p in n["perfis_afetados"]:
        ref(p, P, n["id"])

for h in hists:
    ref(h["necessidade_id"], N, h["id"])
    ref(h["perfil_id"], P, h["id"])
    ref(h["sugestao_ia_id"], I, h["id"])
    ref(h["sprint_id"], SPR, h["id"])

for r in riscos:
    o = r["objeto"]
    ref(o["id"], N | H | PR, r["id"])
    ref(r["heuristica"], HEU, r["id"])
    for w in r["wcag"]:
        ref(w, WCAG, r["id"])
    for m in r["emag"]:
        ref(m, EMAG, r["id"])
    for p in r["perfis_afetados"]:
        ref(p, P, r["id"])
    ref(r["sugestao_ia_id"], I, r["id"])
    if not 0 <= r["severidade"] <= 4:
        problemas.append(f"{r['id']}: severidade fora da escala")
    if (r["origem"] == "ia") != (r["sugestao_ia_id"] is not None):
        problemas.append(f"{r['id']}: origem e sugestao_ia_id incoerentes")
    tratado = r["tratamento"] is not None
    if tratado != (r["situacao"] == "tratado"):
        problemas.append(f"{r['id']}: situação e tratamento incoerentes")
    if tratado:
        ref(r["tratamento"]["tipo"], TRAT, r["id"])
        ref(r["tratamento"]["responsavel"], EQP, r["id"])

for v in vins:
    ref(v["origem"], TODOS, v["id"])
    ref(v["destino"], TODOS, v["id"])
    ref(v["sugestao_ia_id"], I, v["id"])
    ref(v["validado_por"], EQP, v["id"])
    validado = v["status"] in ("confirmado", "editado", "recusado")
    if validado != (v["validado_por"] is not None):
        problemas.append(f"{v['id']}: status e validador incoerentes")
    sug = ia_por_id.get(v["sugestao_ia_id"])
    if sug and v["data_validacao"] and v["data_validacao"] < sug["data_hora"][:10]:
        problemas.append(f"{v['id']}: validado antes da sugestão da IA")

for e in ia:
    ref(e["decidido_por"], EQP, e["id"])
    if e["decisao"] not in ("aceitar", "editar", "recusar", "pendente"):
        problemas.append(f"{e['id']}: decisão inválida")
    for campo in ("modelo", "versao_modelo", "data_hora", "entrada", "saida"):
        if not e.get(campo):
            problemas.append(f"{e['id']}: campo obrigatório vazio ({campo})")

# Regra 2 do modelo: portão da Definition of Ready.
validos = [v for v in vins if v["status"] in ("confirmado", "editado")]
for h in hists:
    prots = {v["destino"] for v in validos if v["origem"] == h["id"] and v["destino"] in PR}
    # Para a DoR, um protótipo com vínculo ainda pendente também conta.
    candidatos = {v["destino"] for v in vins if v["origem"] == h["id"]
                  and v["destino"] in PR and v["status"] != "recusado"}
    objetos = {h["id"], h["necessidade_id"]} | candidatos
    abertos = [r["id"] for r in riscos if r["objeto"]["id"] in objetos and r["situacao"] != "tratado"]
    dor3 = bool(prots)
    dor5 = not abertos
    if h["dor"]["DOR-3"] != dor3:
        problemas.append(f"{h['id']}: DOR-3 registrado {h['dor']['DOR-3']}, calculado {dor3}")
    if h["dor"]["DOR-5"] != dor5:
        problemas.append(f"{h['id']}: DOR-5 registrado {h['dor']['DOR-5']}, calculado {dor5} {abertos}")
    pronta = all(h["dor"].values())
    if pronta == (h["situacao"] == "bloqueada_dor"):
        problemas.append(f"{h['id']}: situação {h['situacao']} incoerente com a DoR")

# Restrição do projeto: nada de dados reais.
proibidos = ["pgdf", "isma", "procuradoria", "—"]
for arq in BASE.glob("*.json"):
    texto = arq.read_text(encoding="utf-8").lower()
    for termo in proibidos:
        if termo in texto:
            problemas.append(f"{arq.name}: contém termo vedado {termo!r}")

if problemas:
    print("Problemas encontrados:")
    for p in problemas:
        print(" -", p)
    sys.exit(1)

print(f"OK: {len(perfis)} perfis, {len(necs)} necessidades, {len(hists)} histórias, "
      f"{len(prts)} protótipos, {len(riscos)} riscos, {len(vins)} vínculos, "
      f"{len(ia)} registros de IA, {len(ents)} entregas.")
for h in hists:
    print(f"  {h['id']} {h['situacao']}")
