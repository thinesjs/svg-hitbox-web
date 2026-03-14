# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [1.7.0](https://github.com/thinesjs/svg-hitbox-web/compare/v1.6.0...v1.7.0) (2026-03-14)


### Features

* add name field for stop display name (tooltip) ([3d9f2a2](https://github.com/thinesjs/svg-hitbox-web/commit/3d9f2a23fe0c5a1ae443baed7c6a1c203f76b4c4))

## [1.6.0](https://github.com/thinesjs/svg-hitbox-web/compare/v1.5.0...v1.6.0) (2026-03-14)


### Features

* add bulk field editor for multi-selection ([135f78f](https://github.com/thinesjs/svg-hitbox-web/commit/135f78fc13130f3d1c8e722fea673ef55909d39e))

## [1.5.0](https://github.com/thinesjs/svg-hitbox-web/compare/v1.4.2...v1.5.0) (2026-03-14)


### Features

* add feed field and typed HitboxFields in TS export ([2cfc4fd](https://github.com/thinesjs/svg-hitbox-web/commit/2cfc4fdea0a412c793a0d555ae369ca0be3df453))

## [1.4.2](https://github.com/thinesjs/svg-hitbox-web/compare/v1.4.1...v1.4.2) (2026-03-14)


### Bug Fixes

* replace ScrollArea with overflow-auto div in code preview dialog ([3025ada](https://github.com/thinesjs/svg-hitbox-web/commit/3025adaaf5223a9545fde20ca9d89a210f2fdf7e))

## [1.4.1](https://github.com/thinesjs/svg-hitbox-web/compare/v1.4.0...v1.4.1) (2026-03-14)


### Bug Fixes

* sidebar hitbox list and code preview dialog overflow ([7074d98](https://github.com/thinesjs/svg-hitbox-web/commit/7074d988ade7b86e5103731885724df77b006fc1))

## [1.4.0](https://github.com/thinesjs/svg-hitbox-web/compare/v1.3.0...v1.4.0) (2026-03-14)


### Features

* add batch callbacks to prevent drag/resize flooding undo stack ([25b4f06](https://github.com/thinesjs/svg-hitbox-web/commit/25b4f0647d517742ae8c8b3cc60e966ec0fc29ab))
* add undo/redo buttons to sidebar header ([7c30664](https://github.com/thinesjs/svg-hitbox-web/commit/7c306649f63d19465b07d07c2493e0fffa1a6c38))
* add undo/redo items to context menu ([1cbb722](https://github.com/thinesjs/svg-hitbox-web/commit/1cbb72263065ed870ae6d166c5d27382a4cb335a))
* add useHistory hook with undo/redo stacks and batch API ([ba9dcc4](https://github.com/thinesjs/svg-hitbox-web/commit/ba9dcc4ccbe52833488f4d669f041ceb1d47dd79))
* wire useHistory into App with undo/redo keyboard shortcuts ([1f3085e](https://github.com/thinesjs/svg-hitbox-web/commit/1f3085e314a3494120ddaf3b9c855320a0e61f06))

## [1.3.0](https://github.com/thinesjs/svg-hitbox-web/compare/v1.2.0...v1.3.0) (2026-03-14)


### Features

* add CodePreviewDialog component with Shiki highlighting ([d9284e6](https://github.com/thinesjs/svg-hitbox-web/commit/d9284e6c83fd501b58ce3fe90a3485f48fdcd694))
* wire up code preview dialog with sidebar trigger ([62e1304](https://github.com/thinesjs/svg-hitbox-web/commit/62e13045a1d38ac47faf00d68fdef59ad936a78b))

## [1.2.0](https://github.com/thinesjs/svg-hitbox-web/compare/v1.1.0...v1.2.0) (2026-03-13)


### Features

* add Docker build and GHCR deploy workflow ([5885897](https://github.com/thinesjs/svg-hitbox-web/commit/588589765a3ba7ef7b54c02e27e40a3b3515882e))


### Bug Fixes

* **ci:** remove ENV secret references from deploy workflow ([8271a85](https://github.com/thinesjs/svg-hitbox-web/commit/8271a8545671a1f6e58bf26f13b83f436053f2a2))

## 1.1.0 (2026-03-13)


### Features

* add discriminated union types and geometry helpers for multi-shape hitboxes ([5d440a5](https://github.com/thinesjs/svg-hitbox-web/commit/5d440a517919f850ed202c1f866f95e9bd5401fb))
* add locked field, ViewBox export, z-order/flip/marquee geometry, context-menu component ([d82ecb4](https://github.com/thinesjs/svg-hitbox-web/commit/d82ecb4fdb5dd15060cd07b8a2eef608cd7a2a8e))
* add multi-shape support (rect + circle) to v2 spec ([9a1ce82](https://github.com/thinesjs/svg-hitbox-web/commit/9a1ce82f61390995086c8e081197d7660c3dafb4))
* add sidebar, metadata editor, import/export, and keyboard shortcuts ([f0d6c5e](https://github.com/thinesjs/svg-hitbox-web/commit/f0d6c5eb0dd0c7ebe5fcaabcb4070f63dc13df63))
* add v2 implementation plan for hitbox labeller ([add76c2](https://github.com/thinesjs/svg-hitbox-web/commit/add76c2e4b6d12a05c0a471c12edfcf6a0c33ab2))
* drag-to-draw hitbox rectangles with overlay rendering ([1a39ac7](https://github.com/thinesjs/svg-hitbox-web/commit/1a39ac768d0a447eaa6ad6a3b87e93886a9e4fa4))
* extract useCanvasInteractions hook, add marquee/space-pan/group-move/lock-guard ([2b4d0d2](https://github.com/thinesjs/svg-hitbox-web/commit/2b4d0d20b280cc159187af0b08be7dc75c27fcec))
* final integration, edge cases, lock-aware editor, clean exports ([71b5f81](https://github.com/thinesjs/svg-hitbox-web/commit/71b5f81860b363830ccb3e8806817f6c6aeea4ea))
* initialize shadcn with radix-nova preset and install UI components ([0e8e689](https://github.com/thinesjs/svg-hitbox-web/commit/0e8e689f99f91864f5217c76e79c26199b53dd6d))
* initialize shadcn with Tailwind v4 and Vite config ([fdf9ab6](https://github.com/thinesjs/svg-hitbox-web/commit/fdf9ab6cfe2a06d39f756e17f882c74e360012f8))
* migrate App.tsx to multi-selection state model with z-order/lock/flip handlers ([807fd4d](https://github.com/thinesjs/svg-hitbox-web/commit/807fd4d73148c3246bc746e0b470ccb42597d8ad))
* migrate HitboxSidebar to shadcn components with shape selector ([5cc4fe6](https://github.com/thinesjs/svg-hitbox-web/commit/5cc4fe6dd553f3ffefc13bea8f70cd1e4782bedb))
* pass selectedIds and onToggleSelect to HitboxSidebar ([1174d45](https://github.com/thinesjs/svg-hitbox-web/commit/1174d4582929f0ab2fe12089a43f8a4161d388c3))
* rewrite App and HitboxEditor for multi-shape support with shadcn components ([ab88c19](https://github.com/thinesjs/svg-hitbox-web/commit/ab88c19418b6136d5a3eacfc38585834be32c5e8))
* rewrite SvgCanvas with select/move/resize for rect and circle hitboxes ([afca8f2](https://github.com/thinesjs/svg-hitbox-web/commit/afca8f29eee847985b6ef09d95230d0603540044))
* scaffold hitbox labeller with types, file picker, and pan/zoom SVG canvas ([bbc5d28](https://github.com/thinesjs/svg-hitbox-web/commit/bbc5d2851f766b0053e6600c3c436611355e5bfb))
* sidebar multi-selection, shift+click toggle, lock indicators ([68399e0](https://github.com/thinesjs/svg-hitbox-web/commit/68399e0db8e789cdee1a10421c15436bf5949c30))


### Bug Fixes

* add flushSync to context target, Set-based lock/unlock lookups ([a5bc506](https://github.com/thinesjs/svg-hitbox-web/commit/a5bc50656c37a589771b79888447c46bd858a77d))
* address code review - stale closures in editor, null check in import ([60a60aa](https://github.com/thinesjs/svg-hitbox-web/commit/60a60aaacc4b666abedc0333197095461f436038))
* address spec review issues for hitbox labeller v2 ([6b82a01](https://github.com/thinesjs/svg-hitbox-web/commit/6b82a013a115a2443b84b350da5532669c29b231))
* **ci:** add packageManager field for pnpm action-setup ([5a0da59](https://github.com/thinesjs/svg-hitbox-web/commit/5a0da592e7e08188c01a1adf954fd25ae8d16cae))
* sidebar selection lookup O(n²) → O(1) via Set, add lock emoji aria-label ([ef5a981](https://github.com/thinesjs/svg-hitbox-web/commit/ef5a9811d019a74346c56ec1bc9118fab5d3c0ed))
* strip locked field unconditionally from exports ([664e801](https://github.com/thinesjs/svg-hitbox-web/commit/664e801d2b0b0e2b29aca0a7be8f1f59410bf81b))
