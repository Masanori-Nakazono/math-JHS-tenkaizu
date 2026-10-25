// 中学数学「立体と展開図」— 幾何計算モジュール（外部依存なし）
//
// 設計：
//  1. 立体を「頂点リスト + 面リスト」で定義し、法線を全て外向きに揃える。
//  2. 面の隣接グラフの全域木（展開木）を選び、3D から 2D へ等長に開いて展開図を作る。
//  3. 各ヒンジの折り角 = 両面の外向き法線のなす角。これを t 倍して折ると立体に戻る。
//  4. 円柱・円錐は多面体ではないので、等長変形の式を直接書く。

/* ========== ベクトル ========== */
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

/* ========== 3x3 行列（行優先） ========== */
export const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export function rot3(u, th) {
  const c = Math.cos(th), s = Math.sin(th), t = 1 - c;
  const [x, y, z] = u;
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}
export const mv = (R, p) => [
  R[0] * p[0] + R[1] * p[1] + R[2] * p[2],
  R[3] * p[0] + R[4] * p[1] + R[5] * p[2],
  R[6] * p[0] + R[7] * p[1] + R[8] * p[2],
];
export function mm(A, B) {
  const C = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += A[i * 3 + k] * B[k * 3 + j];
      C[i * 3 + j] = s;
    }
  return C;
}
const transpose = (A) => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];

/* 回転行列 → クォータニオン [x,y,z,w] */
export function quatFromMat(R) {
  const tr = R[0] + R[4] + R[8];
  let x, y, z, w;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = 0.25 * s; x = (R[7] - R[5]) / s; y = (R[2] - R[6]) / s; z = (R[3] - R[1]) / s;
  } else if (R[0] > R[4] && R[0] > R[8]) {
    const s = Math.sqrt(1 + R[0] - R[4] - R[8]) * 2;
    w = (R[7] - R[5]) / s; x = 0.25 * s; y = (R[1] + R[3]) / s; z = (R[2] + R[6]) / s;
  } else if (R[4] > R[8]) {
    const s = Math.sqrt(1 + R[4] - R[0] - R[8]) * 2;
    w = (R[2] - R[6]) / s; x = (R[1] + R[3]) / s; y = 0.25 * s; z = (R[5] + R[7]) / s;
  } else {
    const s = Math.sqrt(1 + R[8] - R[0] - R[4]) * 2;
    w = (R[3] - R[1]) / s; x = (R[2] + R[6]) / s; y = (R[5] + R[7]) / s; z = 0.25 * s;
  }
  const n = Math.hypot(x, y, z, w) || 1;
  return [x / n, y / n, z / n, w / n];
}

/* ========== 2D ========== */
const centroid2 = (P) => {
  let x = 0, y = 0;
  for (const p of P) { x += p[0]; y += p[1]; }
  return [x / P.length, y / P.length];
};

/* ========== 面の法線・面積 ========== */
export function faceNormal(verts, f) {
  // Newell の方法：面が平面でなくても安定
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < f.length; i++) {
    const a = verts[f[i]], b = verts[f[(i + 1) % f.length]];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return norm([nx, ny, nz]);
}
export function faceArea(verts, f) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < f.length; i++) {
    const a = verts[f[i]], b = verts[f[(i + 1) % f.length]];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return Math.hypot(nx, ny, nz) / 2;
}
const faceCentroid = (verts, f) => {
  let s = [0, 0, 0];
  for (const i of f) s = add(s, verts[i]);
  return mul(s, 1 / f.length);
};

/** 全ての面の向きを外向きに揃える（原点を含む凸立体を前提） */
export function orientOutward(solid) {
  let c = [0, 0, 0];
  for (const v of solid.verts) c = add(c, v);
  c = mul(c, 1 / solid.verts.length);
  solid.faces = solid.faces.map((f) => {
    const n = faceNormal(solid.verts, f);
    if (dot(n, sub(faceCentroid(solid.verts, f), c)) < 0) return f.slice().reverse();
    return f;
  });
  return solid;
}

/* ========== 立体の定義 ========== */

/** 正 n 角形（1辺 side）を xy 平面に、中心を原点に置く */
export function regularPolygon(n, side) {
  const R = side / (2 * Math.sin(Math.PI / n));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n - Math.PI / 2 - Math.PI / n;
    pts.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  return pts;
}
export const rectangle = (a, b) => [
  [-a / 2, -b / 2], [a / 2, -b / 2], [a / 2, b / 2], [-a / 2, b / 2],
];

/** 角柱：底面 base（xy平面の凸多角形, 反時計回り）を z 方向に h 押し出す */
export function prism(base, h) {
  const n = base.length;
  const verts = [];
  for (const p of base) verts.push([p[0], p[1], -h / 2]);
  for (const p of base) verts.push([p[0], p[1], h / 2]);
  const faces = [], kinds = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([i, j, n + j, n + i]); kinds.push('side');
  }
  const bottom = []; for (let i = n - 1; i >= 0; i--) bottom.push(i);
  faces.push(bottom); kinds.push('base');
  const top = []; for (let i = 0; i < n; i++) top.push(n + i);
  faces.push(top); kinds.push('base');
  const b = Math.min(1, n - 1);
  const parentOf = {};
  for (let i = 1; i < n; i++) parentOf[i] = i - 1;
  parentOf[n] = b; parentOf[n + 1] = b;
  return orientOutward({ verts, faces, kinds, tree: { root: 0, parentOf } });
}

/** 角錐：底面 base を z=0 に、頂点を (0,0,h) に置く */
export function pyramid(base, h) {
  const n = base.length;
  const verts = base.map((p) => [p[0], p[1], 0]);
  verts.push([0, 0, h]);
  const faces = [], kinds = [];
  for (let i = 0; i < n; i++) {
    faces.push([i, (i + 1) % n, n]); kinds.push('side');
  }
  const bottom = []; for (let i = n - 1; i >= 0; i--) bottom.push(i);
  faces.push(bottom); kinds.push('base');
  const parentOf = {};
  for (let i = 0; i < n; i++) parentOf[i] = n;
  return orientOutward({ verts, faces, kinds, tree: { root: n, parentOf } });
}

/** 頂点だけから凸多面体の面を復元（正多面体用） */
export function facesFromVertices(verts) {
  const n = verts.length;
  let minD = Infinity;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) minD = Math.min(minD, vlen(sub(verts[i], verts[j])));
  const lim = minD * 1.2;
  const nb = verts.map(() => []);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (i !== j && vlen(sub(verts[i], verts[j])) < lim) nb[i].push(j);
  // 各頂点の接平面で近傍を角度順に並べる
  const sorted = verts.map((v, i) => {
    const nv = norm(v);
    let e1 = cross(nv, [0, 0, 1]);
    if (vlen(e1) < 1e-6) e1 = cross(nv, [0, 1, 0]);
    e1 = norm(e1);
    const e2 = cross(nv, e1);
    return nb[i]
      .map((j) => {
        const d = sub(verts[j], v);
        return { j, a: Math.atan2(dot(d, e2), dot(d, e1)) };
      })
      .sort((p, q) => p.a - q.a)
      .map((p) => p.j);
  });
  const used = new Set();
  const faces = [];
  for (let u = 0; u < n; u++) {
    for (const v0 of sorted[u]) {
      if (used.has(u + '>' + v0)) continue;
      const face = [];
      let a = u, b = v0;
      for (let guard = 0; guard < 100; guard++) {
        used.add(a + '>' + b);
        face.push(b);
        const ring = sorted[b];
        const k = ring.indexOf(a);
        const next = ring[(k + 1) % ring.length];
        a = b; b = next;
        if (a === u && b === v0) break;
      }
      faces.push(face);
    }
  }
  return faces;
}

const PHI = (1 + Math.sqrt(5)) / 2;

/** 正多面体はどの面も対等なので、側面・底面の区別をなくす */
function allSame(solid) {
  solid.kinds = solid.kinds.map(() => 'face');
  return solid;
}

/** 正多面体。edge = 1辺の長さ */
export function platonic(kind, edge) {
  let verts, baseEdge;
  if (kind === 'tetra') {
    // 正四面体は「正三角形を底面とする正三角錐」として作る（展開図が教科書どおりになる）
    const s = edge;
    return allSame(pyramid(regularPolygon(3, s), s * Math.sqrt(2 / 3)));
  } else if (kind === 'cube') {
    return allSame(prism(regularPolygon(4, edge), edge));
  } else if (kind === 'octa') {
    verts = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    baseEdge = Math.SQRT2;
  } else if (kind === 'dodeca') {
    verts = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) verts.push([sx, sy, sz]);
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) verts.push([0, sy / PHI, sz * PHI]);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) verts.push([sx / PHI, sy * PHI, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) verts.push([sx * PHI, 0, sz / PHI]);
    baseEdge = 2 / PHI;
  } else if (kind === 'icosa') {
    verts = [];
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) verts.push([0, sy, sz * PHI]);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) verts.push([sx, sy * PHI, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) verts.push([sx * PHI, 0, sz]);
    baseEdge = 2;
  } else throw new Error('unknown platonic: ' + kind);
  const k = edge / baseEdge;
  verts = verts.map((v) => mul(v, k));
  const faces = facesFromVertices(verts);
  const solid = orientOutward({ verts, faces, kinds: faces.map(() => 'face') });
  if (kind === 'octa' || kind === 'dodeca') solid.tree = flowerTree(solid);
  return solid;
}

/* ========== 展開（アンフォールディング） ========== */

const ekey = (a, b) => (a < b ? a + '_' + b : b + '_' + a);

function buildAdjacency(faces) {
  const edgeMap = new Map();
  faces.forEach((f, fi) => {
    for (let k = 0; k < f.length; k++) {
      const K = ekey(f[k], f[(k + 1) % f.length]);
      if (!edgeMap.has(K)) edgeMap.set(K, []);
      edgeMap.get(K).push({ f: fi, k });
    }
  });
  const adj = faces.map(() => []);
  faces.forEach((f, fi) => {
    for (let k = 0; k < f.length; k++) {
      const K = ekey(f[k], f[(k + 1) % f.length]);
      const other = edgeMap.get(K).find((r) => r.f !== fi);
      if (other) adj[fi].push({ to: other.f, key: K, k });
    }
  });
  return { edgeMap, adj };
}

/** 対面する2つの「花」型の展開木（正八面体・正十二面体の教科書的な展開図） */
function flowerTree(solid) {
  const { faces, verts } = solid;
  const { adj } = buildAdjacency(faces);
  const nrm = faces.map((f) => faceNormal(verts, f));
  const root = 0;
  let far = -1, best = 2;
  for (let i = 1; i < faces.length; i++) {
    const d = dot(nrm[root], nrm[i]);
    if (d < best) { best = d; far = i; }
  }
  const petA = adj[root].map((e) => e.to);
  const petB = adj[far].map((e) => e.to);
  if (1 + petA.length + 1 + petB.length !== faces.length) return null;
  // 2つの花をつなぐ辺を探す
  let link = null;
  for (const a of petA) for (const e of adj[a]) if (petB.includes(e.to)) link = [a, e.to];
  if (!link) return null;
  const parentOf = {};
  for (const a of petA) parentOf[a] = root;
  parentOf[link[1]] = link[0];
  parentOf[far] = link[1];
  for (const b of petB) if (b !== link[1]) parentOf[b] = far;
  return { root, parentOf };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 面の 2D ローカル座標（第3軸を内向き法線にとるので、折りは +z 方向になる） */
function faceLocal2D(verts, f) {
  const o = verts[f[0]];
  const ex = norm(sub(verts[f[1]], o));
  const nIn = mul(faceNormal(verts, f), -1);
  const ey = cross(nIn, ex);
  return f.map((i) => {
    const p = sub(verts[i], o);
    return [dot(p, ex), dot(p, ey)];
  });
}

/* 凸多角形の重なり判定（分離軸法）。共有辺で誤検出しないよう少し縮める */
function shrink(P, f) {
  const c = centroid2(P);
  return P.map((p) => [c[0] + (p[0] - c[0]) * (1 - f), c[1] + (p[1] - c[1]) * (1 - f)]);
}
function convexOverlap(A, B) {
  for (const [P, Q] of [[A, B], [B, A]]) {
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const ax = -(b[1] - a[1]), ay = b[0] - a[0];
      let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
      for (const p of P) { const v = p[0] * ax + p[1] * ay; p0 = Math.min(p0, v); p1 = Math.max(p1, v); }
      for (const q of Q) { const v = q[0] * ax + q[1] * ay; q0 = Math.min(q0, v); q1 = Math.max(q1, v); }
      if (p1 < q0 || q1 < p0) return false;
    }
  }
  return true;
}
function countOverlaps(net) {
  const S = net.map((P) => shrink(P, 0.02));
  let c = 0;
  for (let i = 0; i < S.length; i++)
    for (let j = i + 1; j < S.length; j++) if (convexOverlap(S[i], S[j])) c++;
  return c;
}

function treeFromDFS(adj, root, rng) {
  const parent = new Array(adj.length).fill(-2);
  const order = [root];
  parent[root] = -1;
  const pk = new Array(adj.length).fill(null);
  const walk = (fi) => {
    const nb = rng ? shuffled(adj[fi], rng) : adj[fi];
    for (const e of nb) {
      if (parent[e.to] === -2) {
        parent[e.to] = fi; pk[e.to] = e.key; order.push(e.to); walk(e.to);
      }
    }
  };
  walk(root);
  return { parent, pk, order };
}

function treeFromSpec(adj, spec) {
  const n = adj.length;
  const parent = new Array(n).fill(-2);
  const pk = new Array(n).fill(null);
  parent[spec.root] = -1;
  const children = new Map();
  for (const [c, p] of Object.entries(spec.parentOf)) {
    const ci = Number(c);
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(ci);
  }
  const order = [spec.root];
  const queue = [spec.root];
  while (queue.length) {
    const p = queue.shift();
    for (const c of children.get(p) || []) {
      const e = adj[p].find((x) => x.to === c);
      if (!e) throw new Error(`faces ${p} and ${c} are not adjacent`);
      parent[c] = p; pk[c] = e.key; order.push(c); queue.push(c);
    }
  }
  if (order.length !== n) throw new Error('tree spec does not cover all faces');
  return { parent, pk, order };
}

/**
 * 展開図モデルを作る。
 * 返り値の各面は、展開図平面（z=0）での 2D 多角形と、親面に対するヒンジを持つ。
 */
export function buildUnfolding(solid, opts = {}) {
  const { verts, faces, kinds } = solid;
  const nF = faces.length;
  const { edgeMap, adj } = buildAdjacency(faces);
  const loc = faces.map((f) => faceLocal2D(verts, f));
  const nrm = faces.map((f) => faceNormal(verts, f));

  const layout = (tree) => {
    const net = new Array(nF);
    net[tree.order[0]] = loc[tree.order[0]];
    for (let oi = 1; oi < tree.order.length; oi++) {
      const fi = tree.order[oi];
      const pi = tree.parent[fi];
      const [va, vb] = tree.pk[fi].split('_').map(Number);
      const pa = net[pi][faces[pi].indexOf(va)], pb = net[pi][faces[pi].indexOf(vb)];
      const ca = loc[fi][faces[fi].indexOf(va)], cb = loc[fi][faces[fi].indexOf(vb)];
      const ang = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) - Math.atan2(cb[1] - ca[1], cb[0] - ca[0]);
      const co = Math.cos(ang), si = Math.sin(ang);
      net[fi] = loc[fi].map((p) => {
        const x = p[0] - ca[0], y = p[1] - ca[1];
        return [pa[0] + co * x - si * y, pa[1] + si * x + co * y];
      });
    }
    return net;
  };

  // 展開木（＝どの辺で切り開くか）を決める。
  // 既定では教科書どおりの切り方を使い、opts.random なら別の切り方をランダムに探す。
  let tree = null, net = null, overlaps = Infinity;
  const spec = opts.random ? null : opts.tree !== undefined ? opts.tree : solid.tree;
  if (spec) {
    tree = treeFromSpec(adj, spec);
    net = layout(tree);
    overlaps = countOverlaps(net);
  }
  if (overlaps > 0 && !opts.random) {
    const plain = treeFromDFS(adj, opts.root || 0, null);
    const pnet = layout(plain);
    const po = countOverlaps(pnet);
    if (po < overlaps) { tree = plain; net = pnet; overlaps = po; }
  }
  if (overlaps > 0) {
    const rng = mulberry32(opts.seed || 12345);
    for (let trial = 0; trial < 6000 && overlaps > 0; trial++) {
      const t2 = treeFromDFS(adj, trial % nF, rng);
      const n2 = layout(t2);
      const o2 = countOverlaps(n2);
      if (o2 < overlaps) { tree = t2; net = n2; overlaps = o2; }
    }
  }

  // 折り線 / 切り口（くっつく辺）の分類
  const treeKeys = new Set(tree.pk.filter(Boolean));
  const pairId = new Map();
  for (const [K, rec] of edgeMap) if (rec.length === 2 && !treeKeys.has(K)) pairId.set(K, pairId.size);

  const out = faces.map((f, fi) => {
    const poly = net[fi];
    const edges = [];
    for (let k = 0; k < f.length; k++) {
      const K = ekey(f[k], f[(k + 1) % f.length]);
      edges.push({
        k,
        type: treeKeys.has(K) ? 'fold' : 'cut',
        pair: pairId.has(K) ? pairId.get(K) : -1,
      });
    }
    const o = { index: fi, v3: f.slice(), poly, edges, kind: kinds ? kinds[fi] : 'face', parent: tree.parent[fi] };
    if (tree.parent[fi] >= 0) {
      const [va, vb] = tree.pk[fi].split('_').map(Number);
      const pi = tree.parent[fi];
      const pa = net[pi][faces[pi].indexOf(va)], pb = net[pi][faces[pi].indexOf(vb)];
      let u = [pb[0] - pa[0], pb[1] - pa[1]];
      const ul = Math.hypot(u[0], u[1]) || 1;
      u = [u[0] / ul, u[1] / ul];
      // 子の重心が +z 側に持ち上がる向きに軸をとる
      const cc = centroid2(poly);
      const d = [cc[0] - pa[0], cc[1] - pa[1]];
      if (u[0] * d[1] - u[1] * d[0] < 0) u = [-u[0], -u[1]];
      o.pivot = pa;
      o.axis = u;
      o.angle = Math.acos(clamp(dot(nrm[pi], nrm[fi]), -1, 1));
    } else {
      o.pivot = [0, 0]; o.axis = [1, 0]; o.angle = 0;
    }
    return o;
  });

  const model = {
    type: 'poly',
    faces: out,
    order: tree.order,
    root: tree.order[0],
    pairCount: pairId.size,
    overlaps,
    solid,
    stats: polyStats(solid, edgeMap),
  };
  model.pose = canonicalPose(model);
  return model;
}

function polyStats(solid, edgeMap) {
  const V = solid.verts.length, F = solid.faces.length, E = [...edgeMap.values()].filter((r) => r.length === 2).length;
  let area = 0, vol = 0;
  let c = [0, 0, 0];
  for (const v of solid.verts) c = add(c, v);
  c = mul(c, 1 / V);
  for (const f of solid.faces) {
    const a = faceArea(solid.verts, f);
    area += a;
    vol += (a * dot(sub(faceCentroid(solid.verts, f), c), faceNormal(solid.verts, f))) / 3;
  }
  return { V, E, F, area, volume: Math.abs(vol) };
}

/** 各面の変換（回転 R と平行移動 T）を折りたたみ量 t ∈ [0,1] について求める */
export function foldFrames(model, t) {
  const out = new Array(model.faces.length);
  out[model.root] = { R: I3, T: [0, 0, 0] };
  for (const fi of model.order) {
    if (fi === model.root) continue;
    const f = model.faces[fi];
    const P = out[f.parent];
    const R = rot3([f.axis[0], f.axis[1], 0], f.angle * t);
    const piv = [f.pivot[0], f.pivot[1], 0];
    const T = sub(piv, mv(R, piv));
    out[fi] = { R: mm(P.R, R), T: add(mv(P.R, T), P.T) };
  }
  return out;
}
export const applyFrame = (fr, p) => add(mv(fr.R, p), fr.T);

/** 面 fi の 2D 点を 3D に */
export function facePoints3(model, frames, fi) {
  const fr = frames[fi];
  return model.faces[fi].poly.map((p) => applyFrame(fr, [p[0], p[1], 0]));
}

/**
 * t=1 で組み上がった立体を、元の定義どおりの向きに戻す回転。
 * 3点の正規直交フレームを比べて求める。
 */
function canonicalPose(model) {
  const frames = foldFrames(model, 1);
  const f0 = model.faces[model.root];
  const ids = f0.v3.slice(0, 3);
  const folded = facePoints3(model, frames, model.root).slice(0, 3);
  const orig = ids.map((i) => model.solid.verts[i]);
  const frame = (p) => {
    const e1 = norm(sub(p[1], p[0]));
    const e3 = norm(cross(e1, sub(p[2], p[0])));
    const e2 = cross(e3, e1);
    // 列ベクトルが e1,e2,e3
    return [e1[0], e2[0], e3[0], e1[1], e2[1], e3[1], e1[2], e2[2], e3[2]];
  };
  const Ff = frame(folded), Fo = frame(orig);
  // folded = R * orig なので、戻す回転は R^T = Fo * Ff^T
  return quatFromMat(mm(Fo, transpose(Ff)));
}

/** t=1 で各頂点がきちんと1点に集まるかを測る（自己検証用） */
export function closureError(model) {
  const frames = foldFrames(model, 1);
  const acc = new Map();
  model.faces.forEach((f, fi) => {
    const pts = facePoints3(model, frames, fi);
    f.v3.forEach((vi, k) => {
      if (!acc.has(vi)) acc.set(vi, []);
      acc.get(vi).push(pts[k]);
    });
  });
  let worst = 0;
  for (const pts of acc.values()) {
    let c = [0, 0, 0];
    for (const p of pts) c = add(c, p);
    c = mul(c, 1 / pts.length);
    for (const p of pts) worst = Math.max(worst, vlen(sub(p, c)));
  }
  const scale = Math.max(...model.solid.verts.map((v) => vlen(v))) || 1;
  return worst / scale;
}

/* ========== 円柱・円錐（なめらかな曲面） ========== */

export function makeCylinder(r, h) {
  const L = 2 * Math.PI * r;
  return {
    type: 'cylinder', r, h, L,
    pose: quatFromMat(rot3([1, 0, 0], Math.PI / 2)), // 軸を上向きに直す
    stats: {
      area: 2 * Math.PI * r * r + L * h,
      volume: Math.PI * r * r * h,
      lateral: L * h,
      side: L,
    },
  };
}
/** 側面：弧長 s∈[0,L]、高さ y∈[0,h] の点 */
export function cylPoint(m, s, y, t) {
  const k = (t * 2 * Math.PI) / m.L;
  if (k < 1e-7) return [s, y, (k * s * s) / 2];
  return [Math.sin(k * s) / k, y, (1 - Math.cos(k * s)) / k];
}
function cylFrame(m, t) {
  const k = (t * 2 * Math.PI) / m.L;
  const s0 = m.L / 2;
  const a = k * s0;
  return {
    T: [Math.cos(a), 0, Math.sin(a)],
    N: [-Math.sin(a), 0, Math.cos(a)],
    A0: cylPoint(m, s0, 0, t),
    A1: cylPoint(m, s0, m.h, t),
    g: (t * Math.PI) / 2,
  };
}
/** 底面/上面の円：局所座標 (u, v)、v は長方形の辺からの距離（0..2r）、中心は v=r */
export function cylBasePoint(m, u, v, top, t) {
  const F = cylFrame(m, t);
  const A = top ? F.A1 : F.A0;
  const sy = top ? 1 : -1;
  const c = Math.cos(F.g), s = Math.sin(F.g);
  return [
    A[0] + u * F.T[0] + v * s * F.N[0],
    A[1] + sy * v * c,
    A[2] + u * F.T[2] + v * s * F.N[2],
  ];
}

export function makeCone(r, h) {
  const l = Math.hypot(r, h);
  const theta = (2 * Math.PI * r) / l; // おうぎ形の中心角(rad)
  return {
    type: 'cone', r, h, l, theta,
    pose: quatFromMat(rot3([1, 0, 0], Math.PI)), // 頂点を上に向ける

    stats: {
      area: Math.PI * r * r + Math.PI * r * l,
      volume: (Math.PI * r * r * h) / 3,
      lateral: Math.PI * r * l,
      deg: (theta * 180) / Math.PI,
      arc: 2 * Math.PI * r,
    },
  };
}
const coneSB = (m, t) => 1 + t * (m.r / m.l - 1);
/** 側面：母線方向 rho∈[0,l]、角度 psi∈[0,theta] の点 */
export function conePoint(m, rho, psi, t) {
  const sb = coneSB(m, t);
  const cb = Math.sqrt(Math.max(0, 1 - sb * sb));
  const phi = psi / sb;
  return [rho * sb * Math.cos(phi), rho * sb * Math.sin(phi), rho * cb];
}
function coneFrame(m, t) {
  const sb = coneSB(m, t);
  const cb = Math.sqrt(Math.max(0, 1 - sb * sb));
  const phi = m.theta / 2 / sb;
  const cp = Math.cos(phi), sp = Math.sin(phi);
  return {
    A: conePoint(m, m.l, m.theta / 2, t),
    T: [-sp, cp, 0],
    D: [sb * cp, sb * sp, cb],
    W: [-cb * cp, -cb * sp, sb],
    g: t * (Math.PI / 2 + Math.asin(m.r / m.l)),
  };
}
/** 底面の円：局所座標 (u, v)、v は弧からの距離（0..2r）、中心は v=r */
export function coneBasePoint(m, u, v, t) {
  const F = coneFrame(m, t);
  const c = Math.cos(F.g), s = Math.sin(F.g);
  return [
    F.A[0] + u * F.T[0] + v * (F.D[0] * c + F.W[0] * s),
    F.A[1] + u * F.T[1] + v * (F.D[1] * c + F.W[1] * s),
    F.A[2] + u * F.T[2] + v * (F.D[2] * c + F.W[2] * s),
  ];
}

/* ========== プリセット ========== */
export const PRESETS = [
  {
    id: 'prism', group: '角柱', name: '角柱', note: '側面は長方形。底面の角の数を変えると、三角柱・五角柱・六角柱…になる',
    params: { n: 3, h: 2.2 },
    controls: [
      { key: 'n', label: '底面の角の数', min: 3, max: 8, step: 1, unit: '' },
      { key: 'h', label: '高さ', min: 0.6, max: 4, step: 0.1, unit: '' },
    ],
    build: (p) => prism(regularPolygon(p.n, 1.6), p.h),
  },
  {
    id: 'box', group: '角柱', name: '直方体', note: '四角柱のうち、底面が長方形のもの',
    params: { a: 2.4, b: 1.5, c: 1.9 },
    controls: [
      { key: 'a', label: 'たて', min: 0.6, max: 3.6, step: 0.1 },
      { key: 'b', label: 'よこ', min: 0.6, max: 3.6, step: 0.1 },
      { key: 'c', label: '高さ', min: 0.6, max: 3.6, step: 0.1 },
    ],
    build: (p) => prism(rectangle(p.a, p.b), p.c),
  },
  {
    id: 'cylinder', group: '円柱', name: '円柱', note: '側面は長方形。よこの長さ = 底面の円周',
    params: { r: 1, h: 2.4 },
    controls: [
      { key: 'r', label: '底面の半径 r', min: 0.4, max: 2, step: 0.05 },
      { key: 'h', label: '高さ h', min: 0.6, max: 4, step: 0.1 },
    ],
    build: (p) => makeCylinder(p.r, p.h),
  },
  {
    id: 'pyramid', group: '角錐', name: '角錐', note: '側面は三角形。底面の角の数を変えると、三角錐・四角錐・五角錐…になる',
    params: { n: 4, h: 2.4 },
    controls: [
      { key: 'n', label: '底面の角の数', min: 3, max: 8, step: 1 },
      { key: 'h', label: '高さ', min: 0.8, max: 4, step: 0.1 },
    ],
    build: (p) => pyramid(regularPolygon(p.n, 1.7), p.h),
  },
  {
    id: 'cone', group: '円錐', name: '円錐', note: '側面はおうぎ形。中心角 = 360° × r ÷ 母線',
    params: { r: 1.1, h: 2.4 },
    controls: [
      { key: 'r', label: '底面の半径 r', min: 0.4, max: 2, step: 0.05 },
      { key: 'h', label: '高さ h', min: 0.6, max: 4.5, step: 0.1 },
    ],
    build: (p) => makeCone(p.r, p.h),
  },
  {
    id: 'tetra', group: '正多面体', name: '正四面体', note: '正三角形 4 枚。三角錐（正三角錐）の仲間',
    params: { e: 2 }, controls: [{ key: 'e', label: '1辺の長さ', min: 1, max: 3, step: 0.1 }],
    build: (p) => platonic('tetra', p.e),
  },
  {
    id: 'cube', group: '正多面体', name: '正六面体', note: '正方形 6 枚。立方体のこと。展開図は全部で 11 種類',
    params: { e: 2 }, controls: [{ key: 'e', label: '1辺の長さ', min: 1, max: 3, step: 0.1 }],
    build: (p) => platonic('cube', p.e),
  },
  {
    id: 'octa', group: '正多面体', name: '正八面体', note: '正三角形 8 枚',
    params: { e: 1.8 }, controls: [{ key: 'e', label: '1辺の長さ', min: 1, max: 3, step: 0.1 }],
    build: (p) => platonic('octa', p.e),
  },
  {
    id: 'dodeca', group: '正多面体', name: '正十二面体', note: '正五角形 12 枚',
    params: { e: 1.2 }, controls: [{ key: 'e', label: '1辺の長さ', min: 0.6, max: 2, step: 0.05 }],
    build: (p) => platonic('dodeca', p.e),
  },
  {
    id: 'icosa', group: '正多面体', name: '正二十面体', note: '正三角形 20 枚',
    params: { e: 1.1 }, controls: [{ key: 'e', label: '1辺の長さ', min: 0.6, max: 2, step: 0.05 }],
    build: (p) => platonic('icosa', p.e),
  },
];

/**
 * 同じ立体でも、切る辺を変えれば展開図は変わる（＝展開図は1通りではない）。
 * variant 0 は教科書どおりの切り方、1以降は重なりのない別の切り方。
 */
export function unfoldVariant(solid, variant = 0) {
  if (!variant) return buildUnfolding(solid, { seed: 20240501 });
  return buildUnfolding(solid, { random: true, seed: 7919 * variant + 31 });
}

/** プリセットとパラメータからモデルを作る */
export function buildModel(preset, params, variant = 0) {
  const s = preset.build(params);
  if (s.type === 'cylinder' || s.type === 'cone') return s;
  return unfoldVariant(s, variant);
}
