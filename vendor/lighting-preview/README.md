# Offline lighting preview

Frozen ESM dependency graph for the isolated HD preview. The main editor keeps its
existing embedded Three.js r160 graph. No npm install, CDN, or network model fetch
is required by the distributed application.

Pinned versions, original/rewritten SHA-256 hashes and the OIDN weights source are
in `manifest.json`. Package licenses and the weights' Apache 2.0 license are
included. Imports, including the BVH worker, use local relative paths; the Windows
reserved basename `aux.wgsl.js` is published as `furnish-aux.wgsl.js`.

Patch set 2 adds guarded Furnish kernel adaptations in six WebGPU modules.
`scripts/lib/lighting-preview-patches.cjs` verifies the pinned rewritten source
hashes before applying them, and the existing vendor script reproduces the output.
The manifest retains original package hashes and records the adapted file hashes.
Each isolated preview audits all actual materials before constructing its tracer:
unused features and absent map slots become compile-time constants, while active
or unknown features retain the generic implementation. Empty medium walks are
skipped only when no material requests scattering. Read/write FP32 accumulation
avoids a full-image copy per iteration only when the WGSL feature is available;
other devices retain the two-texture path. The pixel pool owns at most one active
path per pixel. Sampling, glass attenuation, clearcoat, physical parameters and
OIDN are unchanged. See the [validation](../../docs/validation/progressive-kernel-20261117/README.md).
The BVH transformation record also flags the structural occluders used by
cutaway daylight. They take part in shadow ray queries and are skipped by
surface ray queries. Normal production meshes retain both query paths.

To reproduce, use a separate directory with the exact package versions in the
manifest, and run `node scripts/vendor-lighting-preview.cjs <node_modules>
<rt_hdr_alb_nrm_small.tza>`. The script verifies versions and the weights hash. Put
the original `OIDN-WEIGHTS-LICENSE.txt` next to the weights. It uses Node builtins
and performs no network access. `tests/test-lighting-preview.cjs` checks all
distributed hashes.
