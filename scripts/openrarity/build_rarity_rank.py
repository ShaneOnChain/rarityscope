#!/usr/bin/env python3
"""
Generate RarityScope's optional byte-exact OpenRarity fixture (data/rarity_rank.json)
using the official `open_rarity` library. See README.md in this directory.

Usage (from the repo root, after data/meta.json exists):
    python3 scripts/openrarity/build_rarity_rank.py data/meta.json data/rarity_rank.json

Input: meta.json keyed by serial string, each value [{"trait_type","value"}, ...].
Include EVERY trait slot per piece — "no trait" slots as literal values ('none', etc.),
exactly as fed to the app build (see AGENTS.md step b).

Output, keyed by serial string:
    {"<serial>": {"rank":     <OpenRarity rank, 1..N, 1 = rarest>,
                  "score":    <OpenRarity information-content score>,
                  "rs_rank":  <RarityScore rank>,
                  "rs_score": <RarityScore = sum(N/count)>}}
rs_* ride along so the data build can drift-check the in-repo engine against this fixture.

PIN THESE — newer combos break (open-rarity needs Python >=3.10,<3.13):
    python3.12 -m venv venv && . venv/bin/activate
    pip install open-rarity==0.7.5
"""
import json
import sys
from collections import Counter, defaultdict

from open_rarity import (
    Token, Collection, RarityRanker, TokenMetadata, EVMContractTokenIdentifier,
)
from open_rarity.models.token_standard import TokenStandard

src = sys.argv[1] if len(sys.argv) > 1 else "data/meta.json"
out = sys.argv[2] if len(sys.argv) > 2 else "data/rarity_rank.json"
meta = json.load(open(src))
N = len(meta)

# --- RarityScore (sum of N/count) — secondary fields, used as the build's drift guard ---
freq = defaultdict(Counter)
for serial, traits in meta.items():
    for t in traits:
        freq[t["trait_type"]][t["value"]] += 1
rs_score = {s: sum(N / freq[t["trait_type"]][t["value"]] for t in traits)
            for s, traits in meta.items()}
rs_rank = {s: i + 1 for i, (s, _) in
           enumerate(sorted(rs_score.items(), key=lambda x: (-x[1], int(x[0]))))}

# --- OpenRarity (information content) via the official library ---
tokens = []
for serial, traits in meta.items():
    attrs = {t["trait_type"]: t["value"] for t in traits}  # every slot, literal values
    tokens.append(Token(
        token_identifier=EVMContractTokenIdentifier(contract_address="0x0", token_id=int(serial)),
        token_standard=TokenStandard.ERC721,
        metadata=TokenMetadata.from_attributes(attrs),
    ))
ranked = RarityRanker.rank_collection(collection=Collection(tokens=tokens, name="collection"))

# Break the library's score ties deterministically by serial ascending -> strict 1..N.
rows = sorted(((str(tr.token.token_identifier.token_id), float(tr.score)) for tr in ranked),
              key=lambda r: (-r[1], int(r[0])))
out_obj = {}
for i, (serial, score) in enumerate(rows):
    out_obj[serial] = {
        "rank": i + 1,
        "score": round(score, 6),
        "rs_rank": rs_rank[serial],
        "rs_score": round(rs_score[serial], 2),
    }

assert sorted(v["rank"] for v in out_obj.values()) == list(range(1, N + 1)), "rank not a clean permutation"
json.dump(out_obj, open(out, "w"))
top3 = ", ".join(f"#{s}" for s, _ in rows[:3])
print(f"wrote {len(out_obj)} serials -> {out}  (rarest: {top3})")
