# Byte-exact OpenRarity (optional)

RarityScope's in-repo engine approximates the official OpenRarity ranking to ~99%. If you want
**byte-exact** ranks from the official `open_rarity` library, generate the fixture here and the
data build will use it verbatim (and drift-check the engine against it).

Skip this entirely if ~99% is fine for your collection — everything works without it.

## Generate the fixture

```bash
# open-rarity requires Python >=3.10,<3.13
python3.12 -m venv venv && . venv/bin/activate
pip install open-rarity==0.7.5

# from the repo root, after data/meta.json exists (see AGENTS.md step b):
python3 scripts/openrarity/build_rarity_rank.py data/meta.json data/rarity_rank.json

npm run build:data   # picks the fixture up automatically
```

The build log flips from "shipping engine OpenRarity approximation" to
"shipping canonical fixture ranks (byte-exact)" when the fixture is in place.

## Fixture schema

`data/rarity_rank.json`, keyed by serial string:

```json
{ "<serial>": { "rank": 1, "score": 123.456789, "rs_rank": 1, "rs_score": 4567.89 } }
```

- `rank` / `score` — the official OpenRarity rank + score (library ties broken by serial ascending).
- `rs_rank` / `rs_score` — RarityScore (`Σ N/count`) computed by the same script. The data build
  uses `rs_rank` as a drift guard: the in-repo engine must reproduce it ≥99% (identical formula,
  so a mismatch means malformed metadata or an engine bug).

Rarity is static for a fixed supply — this only needs re-running if the collection's trait
metadata ever changes.
