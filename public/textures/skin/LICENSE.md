# Human Skin 4 — PBR Texture Set

- **Source**: ShareTextures.com — https://www.sharetextures.com/textures/abstract/human-skin-4
- **Author**: M. Tolga Arslan
- **License**: CC0 1.0 Universal (Public Domain Dedication) — https://www.sharetextures.com/p/terms
- **Resolution**: 2048 x 2048 JPEG
- **Downloaded**: 2026-07-10
- **Direct zip**: https://files.sharetextures.com/file/Share-Textures/human_skin_4-2K.zip

## Maps

| File            | Role                                            |
|-----------------|-------------------------------------------------|
| diffuse.jpg     | Albedo / base color                             |
| normal.jpg      | Tangent-space normal (OpenGL / Y+)              |
| smoothness.jpg  | Smoothness — INVERT for THREE.js roughness      |
| ao.jpg          | Ambient occlusion                               |
| height.jpg      | Displacement / height                           |
| metallic.jpg    | Metallic (should be ~black for skin)            |
| edge.jpg        | Edge / cavity (optional)                        |

## Notes for THREE.js MeshPhysicalMaterial

- Set `roughnessMap` = invert(`smoothness.jpg`), or flip `roughness` uniform.
- Use `normalMap` with `normalMapType = THREE.TangentSpaceNormalMap` and `normalScale = new Vector2(1, 1)` (flip Y to `-1` if it looks inverted).
- `aoMap` requires the geometry to have a `uv2` attribute (typically clone `uv`).
- Skin is not metallic — either omit `metalnessMap` or force `metalness = 0`.

## Commercial-safe

CC0 permits commercial use, redistribution, and modification with no attribution required.
