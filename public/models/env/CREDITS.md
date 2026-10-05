# Environment model credits

All third-party models here are **CC0 1.0** (public domain,
http://creativecommons.org/publicdomain/zero/1.0/) — no attribution required,
credited anyway.

## nature.glb

Source: **Nature Kit 2.1** by Kenney — https://kenney.nl/assets/nature-kit
Licence: CC0 1.0 (per the pack's `License.txt`)
Downloaded: 2026-09-23

Models merged into this file (from `Models/GLTF format/`), unmodified apart
from merge + meshopt compression; colours are replaced at runtime
(`components/scene/Scenery.tsx`):

| Node | Used as |
|---|---|
| `cactus_tall` | tall saguaro |
| `cactus_short` | short saguaro |
| `rock_largeA`, `rock_largeC`, `rock_largeD`, `rock_largeF` | boulders |
| `rock_tallE` | mesa (widened) |
| `rock_tallB` | butte (widened) |
| `stump_oldTall` | dead snag (dead-tree stand-in) |
| `tree_plateau` | twisted acacia-style tree |
| `plant_bush`, `plant_bushDetailed` | dry desert shrubs |
| `grass`, `grass_large` | dry ground tufts |

Build pipeline (from the extracted pack):

```
gltf-transform merge <the 14 files above> merged.glb --merge-scenes
gltf-transform dedup merged.glb dedup.glb
gltf-transform prune dedup.glb pruned.glb
# rename the merged scene to "env-nature" (it inherits "cactus_tall",
# which makes GLTFLoader rename the cactus_tall node to stay unique)
gltf-transform meshopt renamed.glb nature.glb
```

meshopt rather than Draco: the whole file is 48 KB, less than a sixth of
the Draco decoder, and drei's `useGLTF` already bundles the meshopt decoder.

## props.glb

Source: **Car Kit** by Kenney — https://kenney.nl/assets/car-kit (the copy
already in this repo under `kenney_car-kit/`, `Models/GLB format/`)
Licence: CC0 1.0 (per `kenney_car-kit/License.txt`)

| Node | Used as |
|---|---|
| `cone` | traffic cones lining each gap-jump run-in |
| `truck` | LedgerX vault — armoured-car stand-in |
| `sedan`, `suv` | Eurobank outpost — parked cars |
| `delivery` | Trigono diner — food truck |
| `box` | Gumroad camp — crate stack |

Pipeline: a small gltf-transform script wraps each model's top-level
nodes (body, wheels, door…) under one parent named after the file, merges
them into one scene named `env-props` (not a model name — GLTFLoader keeps
names unique and would rename the colliding node), dedups the shared
`colormap.png` atlas, then `gltf-transform meshopt`. At runtime each model
is baked into a single geometry so it costs one draw call.

## Procedural stand-ins (no CC0 model found)

- **Barrel cactus** — no barrel cactus or prickly pear in Kenney's Nature,
  Survival, Graveyard or Platformer kits; Quaternius packs only ship
  FBX/OBJ and don't match the Kenney style. Built in code in
  `components/scene/Scenery.tsx` (`barrelGeometry`).
