// NSY — Convert glTF TRIANGLES primitive → GL_LINES primitive.
//
// Takes the low-poly triangle mesh exported by Blender and rebuilds it
// as a set of unique edges (deduplicated). The output GLB has line
// primitives that model-viewer / Three.js render as thin 1-pixel lines —
// the actual K2000 / Knight Rider aesthetic, with no overlapping tubes.
//
// Run:
//   node scripts/tris-to-lines.mjs <input.glb> <output.glb>

import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, KHRMaterialsEmissiveStrength } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node tris-to-lines.mjs <input.glb> <output.glb>');
  process.exit(1);
}
const [INPUT, OUTPUT] = args;

// glTF primitive modes
const MODE_LINES = 1;
const MODE_TRIANGLES = 4;

const io = new NodeIO()
  .registerExtensions([KHRDracoMeshCompression, KHRMaterialsEmissiveStrength])
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

console.log(`[lines] Reading: ${INPUT}`);
const doc = await io.read(INPUT);
const root = doc.getRoot();
const meshes = root.listMeshes();
console.log(`[lines] ${meshes.length} mesh(es) in document`);

let totalTris = 0;
let totalLines = 0;

for (const mesh of meshes) {
  for (const prim of mesh.listPrimitives()) {
    if (prim.getMode() !== MODE_TRIANGLES) {
      console.log(`[lines] Skipping primitive with mode ${prim.getMode()} (not TRIANGLES)`);
      continue;
    }
    const indicesAcc = prim.getIndices();
    if (!indicesAcc) {
      console.log('[lines] Skipping primitive without indices');
      continue;
    }
    const idx = indicesAcc.getArray();
    const triCount = idx.length / 3;
    totalTris += triCount;

    // Build unique edge set. Use a Set keyed by "min,max" so (a,b)==(b,a).
    const edges = new Set();
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      const e1 = a < b ? `${a},${b}` : `${b},${a}`;
      const e2 = b < c ? `${b},${c}` : `${c},${b}`;
      const e3 = a < c ? `${a},${c}` : `${c},${a}`;
      edges.add(e1);
      edges.add(e2);
      edges.add(e3);
    }
    console.log(`[lines]   triangles=${triCount}, unique edges=${edges.size}`);
    totalLines += edges.size;

    // Build flat line-index array (2 indices per edge).
    const lineIdx = new Uint32Array(edges.size * 2);
    let j = 0;
    for (const key of edges) {
      const [a, b] = key.split(',');
      lineIdx[j++] = parseInt(a, 10);
      lineIdx[j++] = parseInt(b, 10);
    }

    // Replace the primitive's indices accessor with the new line indices.
    const newIndicesAcc = doc.createAccessor()
      .setType('SCALAR')
      .setArray(lineIdx)
      .setBuffer(indicesAcc.getBuffer());

    prim.setIndices(newIndicesAcc);
    prim.setMode(MODE_LINES);
  }
}

console.log(`[lines] Totals: ${totalTris} triangles → ${totalLines} unique edges (lines)`);

// Remove Draco encoding if present — Draco doesn't support line primitives.
// We'll just write a plain GLB; gzip on the server gives plenty of compression
// for what is basically a small int32 array.
const dracoExt = root.listExtensionsUsed().find(e => e.extensionName === 'KHR_draco_mesh_compression');
if (dracoExt) {
  console.log('[lines] Removing Draco extension (incompatible with LINES)…');
  dracoExt.dispose();
}

await io.write(OUTPUT, doc);
console.log(`[lines] ✅ Wrote: ${OUTPUT}`);
