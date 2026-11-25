# Version-specific effect tables

One `VERSION` table per firmware version, in the `P()` / `T()` / `VERSION` shape used by the
live app's `typesFor()` / `extraCommonParams()` lookup:

- each of the 9 blocks (`fx1`, `fx2`, `amp`, `cab`, `mod`, `del`, `rev`, `eq`, `synth`) has
  `common` (extra block-wide params) and `types` (selectable effect types);
- each type has `id`, `variant` (the value the device reports/accepts), `slug`, `name`,
  `description`, optional `note`/`warning`, and `params`;
- a param is a `range` or `enum`; `cc: null` with `sysexParamIndex: n` means SysEx-only, where
  `n` is the param's position in that type's own `params` array.

Source of truth: `packages/protocol/src/data/blocks/*.ts` (the hardware-verified current
catalogue). Version gates come from `docs/FIRMWARE_VERSION_HISTORY.md` §§3–4:

| Version | Gates applied |
| --- | --- |
| 1.10 | Baseline: FX1 0–3, FX2 0–10, MOD 0–4, 4-param Duck, Pitch ±12 st, Spring CC88 "Mod", no CAB Level, no Synth |
| 1.11 | No FX/parameter change except FX2 Motion Wah (id 11) [FW] |
| 1.12 | Pitch ±24 st, Spring CC88 "Tone", Duck 8 params, CAB Level on CC67, MOD ids 10/11/12/17 |
| 1.2 | Synth Mode (10 voices) + FX1 ids 4–11 / FX2 ids 12–21 [REL]+[FW]; all delay types add a SysEx-only PingPong Off/On control; id/param values confirmed under 1.3.5, exact boundary unpinned |

`patches.js` defines the community patches once; `modified/<version>.js` combines an original
with those patches. UniVibe is mandatory for every modified build; Octave is optional and only
available on 1.12 and 1.2. `applyPatches()` replaces by type id and appends the UniVibe slot on
1.10/1.11 where Velvet Vibrato does not exist. Octave replaces FX2 Pitch (id 8), never FX2
Range (id 5). The six selectable variants are:

| Selector | Base | Patches |
| --- | --- | --- |
| `1.10+uv` | 1.10 | UniVibe |
| `1.11+uv` | 1.11 | UniVibe |
| `1.12+uv` | 1.12 | UniVibe |
| `1.12+uv+oct` | 1.12 | UniVibe + Octave |
| `1.2+uv` | 1.2 | UniVibe |
| `1.2+uv+oct` | 1.2 | UniVibe + Octave |

Older `*-modified` selector names remain as aliases (`1.12-modified` and `1.2-modified` keep
their previous meaning: both patches).

AMP/CAB type lists stay empty here: those names are read from the device at runtime (the
`MODELS` arrays in `blocks/amp.ts` / `blocks/cab.ts` are fallback display data only).
