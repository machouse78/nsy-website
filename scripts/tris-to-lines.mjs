// NSY — Convert glTF TRIANGLES primitive → GL_LINES primitive.
//
// Takes the low-poly triangle mesh exported by Blender and rebuilds it
// as a set of unique edges (deduplicated). The output GLB has line
// primitives that model-viewer / Three.js render as thin 1-pixel lines —
// the actual K2000 / Knight Rider aesthetic, with no overlapping tubes.
//
// Run:
//   node scripts/tris-to-lines.mjs <input.glb> <output.glb> [--min-angle <deg>]
//
// --min-angle <deg> (optionnel) : filtre par angle dièdre. Ne garde que les
//   arêtes "vives" — celles dont les 2 faces adjacentes forment un angle
//   ≥ deg — plus les arêtes de bord (1 seule face). Les arêtes internes de
//   tessellation des panneaux plats (capot, toit, portières) disparaissent :
//   le wireframe reste lisible de face au lieu de baver en masse cyan.
//   Les sommets sont soudés par position (l'export scinde les vertex par
//   normale/UV, ce qui ferait passer des arêtes internes pour des bords).
//   Sans l'option (ou 0) : comportement historique, toutes les arêtes.

import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, KHRMaterialsEmissiveStrength } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node tris-to-lines.mjs <input.glb> <output.glb> [--min-angle <deg>]');
  process.exit(1);
}
const [INPUT, OUTPUT] = args;
const angleIdx = args.indexOf('--min-angle');
const MIN_ANGLE_DEG = angleIdx !== -1 ? parseFloat(args[angleIdx + 1]) : 0;
if (Number.isNaN(MIN_ANGLE_DEG) || MIN_ANGLE_DEG < 0) {
  console.error('--min-angle attend un nombre de degrés ≥ 0');
  process.exit(1);
}

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

    let lineIdx;
    if (MIN_ANGLE_DEG <= 0) {
      // ── Mode historique : toutes les arêtes uniques ──
      const edges = new Set();
      for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i], b = idx[i + 1], c = idx[i + 2];
        edges.add(a < b ? `${a},${b}` : `${b},${a}`);
        edges.add(b < c ? `${b},${c}` : `${c},${b}`);
        edges.add(a < c ? `${a},${c}` : `${c},${a}`);
      }
      console.log(`[lines]   triangles=${triCount}, unique edges=${edges.size}`);
      totalLines += edges.size;
      lineIdx = new Uint32Array(edges.size * 2);
      let j = 0;
      for (const key of edges) {
        const [a, b] = key.split(',');
        lineIdx[j++] = parseInt(a, 10);
        lineIdx[j++] = parseInt(b, 10);
      }
    } else {
      // ── Mode arêtes vives : soudure par position + angle dièdre ──
      const pos = prim.getAttribute('POSITION').getArray();
      const vertCount = pos.length / 3;

      // 1. Soudure : index d'origine → id de position physique (arrondie).
      //    L'export glTF duplique les sommets (normales/UV différentes) ;
      //    sans soudure, chaque couture passerait pour un bord de surface.
      const weldOf = new Uint32Array(vertCount);
      const weldRep = []; // weldId → un index d'origine représentatif
      {
        const seen = new Map();
        for (let v = 0; v < vertCount; v++) {
          const key = `${Math.round(pos[v * 3] * 1e4)},${Math.round(pos[v * 3 + 1] * 1e4)},${Math.round(pos[v * 3 + 2] * 1e4)}`;
          let id = seen.get(key);
          if (id === undefined) { id = weldRep.length; seen.set(key, id); weldRep.push(v); }
          weldOf[v] = id;
        }
      }

      // 2. Arête (paire de weldIds) → normales des faces adjacentes.
      const edgeFaces = new Map(); // "min,max" → { normals: [[x,y,z]…] }
      const addEdge = (wa, wb, nx, ny, nz) => {
        if (wa === wb) return; // arête dégénérée (2 sommets soudés)
        const key = wa < wb ? `${wa},${wb}` : `${wb},${wa}`;
        let e = edgeFaces.get(key);
        if (!e) { e = { normals: [] }; edgeFaces.set(key, e); }
        e.normals.push([nx, ny, nz]);
      };
      for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i], b = idx[i + 1], c = idx[i + 2];
        // Normale de face (produit vectoriel AB × AC), normalisée.
        const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
        const ux = pos[b * 3] - ax, uy = pos[b * 3 + 1] - ay, uz = pos[b * 3 + 2] - az;
        const vx = pos[c * 3] - ax, vy = pos[c * 3 + 1] - ay, vz = pos[c * 3 + 2] - az;
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const len = Math.hypot(nx, ny, nz);
        if (len < 1e-12) continue; // triangle dégénéré : n'apporte aucune info
        nx /= len; ny /= len; nz /= len;
        const wa = weldOf[a], wb = weldOf[b], wc = weldOf[c];
        addEdge(wa, wb, nx, ny, nz);
        addEdge(wb, wc, nx, ny, nz);
        addEdge(wa, wc, nx, ny, nz);
      }

      // 3. Filtre : bord (1 face) OU angle dièdre max ≥ seuil.
      const cosThreshold = Math.cos(MIN_ANGLE_DEG * Math.PI / 180);
      const kept = [];
      for (const [key, e] of edgeFaces) {
        let keep = e.normals.length === 1; // bord de surface
        if (!keep) {
          // Angle max entre paires de normales (gère les arêtes non-manifold)
          outer: for (let m = 0; m < e.normals.length - 1; m++) {
            for (let n = m + 1; n < e.normals.length; n++) {
              const [x1, y1, z1] = e.normals[m];
              const [x2, y2, z2] = e.normals[n];
              if (x1 * x2 + y1 * y2 + z1 * z2 < cosThreshold) { keep = true; break outer; }
            }
          }
        }
        if (keep) kept.push(key);
      }
      console.log(`[lines]   triangles=${triCount}, arêtes uniques=${edgeFaces.size}, gardées (≥${MIN_ANGLE_DEG}°+bords)=${kept.length}`);
      totalLines += kept.length;
      lineIdx = new Uint32Array(kept.length * 2);
      let j = 0;
      for (const key of kept) {
        const [wa, wb] = key.split(',');
        lineIdx[j++] = weldRep[parseInt(wa, 10)];
        lineIdx[j++] = weldRep[parseInt(wb, 10)];
      }
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
