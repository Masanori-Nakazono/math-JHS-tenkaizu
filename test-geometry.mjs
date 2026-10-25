// node test-geometry.mjs — 展開図が正しく立体に閉じるかを数値で検証する
import {
  PRESETS, buildModel, buildUnfolding, closureError, prism, pyramid, platonic,
  regularPolygon, rectangle, makeCylinder, makeCone, cylPoint, cylBasePoint,
  conePoint, coneBasePoint, sub, vlen, add, mul,
} from './geometry.js';

let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail++; console.log('  ✗ ' + msg); } };
const f3 = (x) => x.toFixed(3);

console.log('=== 多面体：展開 → 折りたたみ の閉合テスト ===');
const cases = [];
for (let n = 3; n <= 8; n++) cases.push([`${n}角柱`, prism(regularPolygon(n, 1.6), 2.2)]);
cases.push(['直方体', prism(rectangle(2.4, 1.5), 1.9)]);
for (let n = 3; n <= 8; n++) cases.push([`${n}角錐`, pyramid(regularPolygon(n, 1.7), 2.4)]);
for (const k of ['tetra', 'cube', 'octa', 'dodeca', 'icosa'])
  cases.push([k, platonic(k, k === 'dodeca' ? 1.2 : k === 'icosa' ? 1.1 : 2)]);

for (const [name, solid] of cases) {
  const m = buildUnfolding(solid, { seed: 20240501 });
  const { V, E, F, area, volume } = m.stats;
  const err = closureError(m);
  const euler = V - E + F;
  console.log(
    `${name.padEnd(8)} F=${String(F).padStart(2)} E=${String(E).padStart(2)} V=${String(V).padStart(2)}` +
    `  V-E+F=${euler}  表面積=${f3(area)}  体積=${f3(volume)}` +
    `  閉合誤差=${err.toExponential(1)}  重なり=${m.overlaps}  くっつく辺の組=${m.pairCount}`
  );
  ok(euler === 2, `${name}: オイラーの多面体定理が成り立たない (${euler})`);
  ok(err < 1e-9, `${name}: t=1 で頂点が一致しない (${err})`);
  ok(m.overlaps === 0, `${name}: 展開図が重なっている (${m.overlaps})`);
  ok(m.pairCount === E - (F - 1), `${name}: くっつく辺の組数が合わない`);
}

console.log('\n=== 面の枚数 ===');
ok(platonic('tetra', 2).faces.length === 4, '正四面体が4面でない');
ok(platonic('cube', 2).faces.length === 6, '正六面体が6面でない');
ok(platonic('octa', 2).faces.length === 8, '正八面体が8面でない');
const dod = platonic('dodeca', 1.2), ico = platonic('icosa', 1.1);
ok(dod.faces.length === 12 && dod.faces.every((f) => f.length === 5), '正十二面体が正五角形12枚でない');
ok(ico.faces.length === 20 && ico.faces.every((f) => f.length === 3), '正二十面体が正三角形20枚でない');
console.log(`正十二面体: ${dod.faces.length} 面 / 各 ${dod.faces[0].length} 角形`);
console.log(`正二十面体: ${ico.faces.length} 面 / 各 ${ico.faces[0].length} 角形`);

// 1辺の長さが指定どおりか
for (const [k, e] of [['octa', 1.8], ['dodeca', 1.2], ['icosa', 1.1]]) {
  const s = platonic(k, e);
  const f = s.faces[0];
  const len = vlen(sub(s.verts[f[1]], s.verts[f[0]]));
  ok(Math.abs(len - e) < 1e-9, `${k}: 1辺が ${len} (期待 ${e})`);
}

console.log('\n=== 円柱 ===');
{
  const m = makeCylinder(1.1, 2.4);
  // t=1 で継ぎ目が一致する
  const g = vlen(sub(cylPoint(m, 0, 1, 1), cylPoint(m, m.L, 1, 1)));
  ok(g < 1e-9, `継ぎ目が閉じない (${g})`);
  // 側面上の点はすべて軸から半径 r
  let worst = 0;
  for (let i = 0; i <= 40; i++) {
    const p = cylPoint(m, (i / 40) * m.L, 0.7, 1);
    worst = Math.max(worst, Math.abs(Math.hypot(p[0], p[2] - m.r) - m.r));
  }
  ok(worst < 1e-9, `側面が円筒になっていない (${worst})`);
  // 底面の円の中心が軸上に来る
  const c0 = cylBasePoint(m, 0, m.r, false, 1);
  const c1 = cylBasePoint(m, 0, m.r, true, 1);
  ok(Math.hypot(c0[0], c0[2] - m.r) < 1e-9 && Math.abs(c0[1]) < 1e-9, `底面の中心がずれる ${c0}`);
  ok(Math.hypot(c1[0], c1[2] - m.r) < 1e-9 && Math.abs(c1[1] - m.h) < 1e-9, `上面の中心がずれる ${c1}`);
  // 展開時（t=0）は平らな長方形
  const p00 = cylPoint(m, 0, 0, 0), p10 = cylPoint(m, m.L, m.h, 0);
  ok(Math.abs(p00[2]) < 1e-12 && Math.abs(p10[2]) < 1e-12, '展開図が平らでない');
  ok(Math.abs(p10[0] - m.L) < 1e-12, '側面の横の長さが 2πr でない');
  console.log(`側面の長方形: 横 ${f3(m.L)} = 2πr, たて ${f3(m.h)}  表面積 ${f3(m.stats.area)}  体積 ${f3(m.stats.volume)}`);
}

console.log('\n=== 円錐 ===');
{
  const m = makeCone(1.1, 2.4);
  // t=1：底円の半径と高さ
  let worst = 0;
  for (let i = 0; i <= 40; i++) {
    const p = conePoint(m, m.l, (i / 40) * m.theta, 1);
    worst = Math.max(worst, Math.abs(Math.hypot(p[0], p[1]) - m.r), Math.abs(p[2] - m.h));
  }
  ok(worst < 1e-9, `円錐の底円が合わない (${worst})`);
  // 継ぎ目（psi=0 と psi=theta）が一致
  const g = vlen(sub(conePoint(m, m.l, 0, 1), conePoint(m, m.l, m.theta, 1)));
  ok(g < 1e-9, `おうぎ形の継ぎ目が閉じない (${g})`);
  // 底面の円の中心が軸上・底の高さに来る
  const c = coneBasePoint(m, 0, m.r, 1);
  ok(Math.hypot(c[0], c[1]) < 1e-9 && Math.abs(c[2] - m.h) < 1e-9, `底面の中心がずれる ${c}`);
  // 等長性：おうぎ形の弧の長さ = 底面の円周
  ok(Math.abs(m.l * m.theta - 2 * Math.PI * m.r) < 1e-12, '弧の長さが底面の円周と違う');
  // 展開時は平ら
  const p0 = conePoint(m, m.l, m.theta / 2, 0);
  ok(Math.abs(p0[2]) < 1e-12, 'おうぎ形が平らでない');
  console.log(`母線 ${f3(m.l)}  中心角 ${f3(m.stats.deg)}°  弧 ${f3(m.stats.arc)}  側面積 ${f3(m.stats.lateral)}  表面積 ${f3(m.stats.area)}`);
  // 公式どおりか
  ok(Math.abs(m.stats.deg - 360 * m.r / m.l) < 1e-9, '中心角が 360r/l でない');
}

console.log('\n=== プリセット一括 ===');
for (const p of PRESETS) {
  const m = buildModel(p, { ...p.params });
  if (m.type === 'poly') {
    const err = closureError(m);
    ok(err < 1e-9 && m.overlaps === 0, `${p.name}: 閉合${err.toExponential(1)} 重なり${m.overlaps}`);
    console.log(`${p.name.padEnd(16)} 面${m.stats.F} 辺${m.stats.E} 頂点${m.stats.V} 閉合${err.toExponential(1)} 重なり${m.overlaps}`);
  } else {
    console.log(`${p.name.padEnd(16)} ${m.type} OK`);
  }
}

// n を動かしても壊れないか
for (let n = 3; n <= 8; n++) {
  for (const id of ['prism', 'pyramid']) {
    const p = PRESETS.find((x) => x.id === id);
    const m = buildModel(p, { ...p.params, n });
    ok(closureError(m) < 1e-9 && m.overlaps === 0, `${id} n=${n} で失敗`);
  }
}

console.log('\n=== 別の開き方（展開図は1通りではない） ===');
{
  const { unfoldVariant } = await import('./geometry.js');
  for (const [name, solid] of [
    ['立方体', platonic('cube', 2)],
    ['三角柱', prism(regularPolygon(3, 1.6), 2.2)],
    ['正四角錐', pyramid(regularPolygon(4, 1.7), 2.4)],
    ['正八面体', platonic('octa', 1.8)],
    ['正十二面体', platonic('dodeca', 1.2)],
    ['正二十面体', platonic('icosa', 1.1)],
  ]) {
    const shapes = new Set();
    for (let v = 0; v < 6; v++) {
      const m = unfoldVariant(solid, v);
      ok(closureError(m) < 1e-9, `${name} 変化形${v}: 立体に戻らない`);
      ok(m.overlaps === 0, `${name} 変化形${v}: 展開図が重なる`);
      // 展開図の形を、各面の重心の相対位置で粗くハッシュ化して種類数を数える
      const key = m.faces
        .map((f) => f.poly.reduce((s, p) => s + Math.round(p[0] * 4) + ':' + Math.round(p[1] * 4) + ',', ''))
        .sort()
        .join('|');
      shapes.add(key);
    }
    console.log(`${name.padEnd(7)} 6回の切り開きで ${shapes.size} 通りの展開図`);
    ok(shapes.size >= 2, `${name}: 切る辺を変えても展開図が変わらない`);
  }
}

console.log(fail === 0 ? '\n✅ すべて通過' : `\n❌ ${fail} 件失敗`);
process.exit(fail === 0 ? 0 : 1);
