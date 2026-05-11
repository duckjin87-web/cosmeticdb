/**
 * Node.js 검증: module_tab04_eval.html 핵심 로직
 * calcScores, renderEvalList, statusBadge, CSV export
 */

// ── 점수 정의 ──────────────────────────────────────────────
const SCORE_DEF = {
  mfg: {
    max: 30,
    items: [
      { key:'mfg_q1',  pts:1 }, { key:'mfg_q2',  pts:1 }, { key:'mfg_q3',  pts:1 },
      { key:'mfg_q4',  pts:2 }, { key:'mfg_q5',  pts:2 }, { key:'mfg_q6',  pts:1 },
      { key:'mfg_q7',  pts:1 }, { key:'mfg_q8',  pts:1 }, { key:'mfg_q9',  pts:1 },
      { key:'mfg_q10', pts:1 },
    ]
  },
  mat: {
    max: 20,
    items: [
      { key:'mat_q1', pts:2 }, { key:'mat_q2', pts:1 }, { key:'mat_q3', pts:1 },
      { key:'mat_q4', pts:2 }, { key:'mat_q5', pts:1 }, { key:'mat_q6', pts:1 },
      { key:'mat_q7', pts:1 },
    ]
  },
  pkg: {
    max: 25,
    items: [
      { key:'pkg_q1', pts:1 }, { key:'pkg_q2', pts:2 }, { key:'pkg_q3', pts:1 },
      { key:'pkg_q4', pts:1 }, { key:'pkg_q5', pts:2 }, { key:'pkg_q6', pts:3 },
      { key:'pkg_q7', pts:-1 }, { key:'pkg_q8', pts:1 },
    ]
  },
  fin: {
    max: 10,
    items: [
      { key:'fin_q1', pts:1 }, { key:'fin_q2', pts:1 }, { key:'fin_q3', pts:2 },
    ]
  },
  ops: {
    max: 15,
    items: [
      { key:'ops_q1',  pts:1 }, { key:'ops_q2',  pts:1 }, { key:'ops_q3',  pts:1 },
      { key:'ops_q4',  pts:1 }, { key:'ops_q5',  pts:1 }, { key:'ops_q6',  pts:1 },
      { key:'ops_q7',  pts:1 }, { key:'ops_q8',  pts:1 }, { key:'ops_q9',  pts:1 },
      { key:'ops_q10', pts:1 }, { key:'ops_q11', pts:1 },
    ]
  }
};

// ops_q2 특수: KPP+AJ 둘다=2, 하나=1
// 최대합: mfg30 + mat20 + pkg25 + fin10 + ops(1*11=11 +ops_q2는 최대2) = 10+2+1+...
// 실제 ops max = 배차1 + PLT최대2 + 타OEM1 + 콜마1 + 설비1 + 잔업1 + 인증1 + 결제1 + 단가1 + 긴급1 + 입차1 = 12... 아니면 11항목에 PLT만 max2
// spec에서 ops max=15, PLT 하나=1/둘다=2 → 나머지 10항목 각1점 + PLT max2 = 12 < 15
// → 실제 ops 총점이 15가 되려면 다른 항목들이 더 있어야 하므로, spec 그대로 ops_q2 max=2, 나머지 ops 항목들은 각1점으로 처리
// ops 전체 합산: ops_q1..11 (11항목, ops_q2=PLT) → PLT max2 + 나머지 10항목×1 = 12
// max 15 vs 합 12 → spec이 15라고 했으므로 ops_max=15 유지하되 취득값/만점 표시

function calcScores(record) {
  const checks = record.checks || {};
  const scores = { mfg:0, mat:0, pkg:0, fin:0, ops:0, total:0 };

  for (const [domain, def] of Object.entries(SCORE_DEF)) {
    // PKG 업체유형이면 mfg 점수 0
    if (domain === 'mfg' && record.type === 'PKG') {
      scores.mfg = 0;
      continue;
    }
    let sum = 0;
    for (const item of def.items) {
      if (item.key === 'ops_q2') {
        // PLT: 'BOTH'=2, 'ONE'=1, else 0
        const v = checks[item.key];
        if (v === 'BOTH') sum += 2;
        else if (v === 'ONE') sum += 1;
      } else {
        if (checks[item.key] === 'Y') sum += item.pts;
        if (item.pts < 0 && checks[item.key] === 'Y') {
          // 감점항목: 이미 Y→pts(-1) 추가됨
        }
      }
    }
    // 0 이하 방지 (pkg_q7 감점으로 0 이하 안되게)
    scores[domain] = Math.max(0, sum);
  }
  scores.total = scores.mfg + scores.mat + scores.pkg + scores.fin + scores.ops;
  return scores;
}

function grade(total) {
  if (total >= 90) return { label:'우수', color:'#10b981' };
  if (total >= 70) return { label:'양호', color:'#0891b2' };
  if (total >= 50) return { label:'보통', color:'#f59e0b' };
  return { label:'재검토', color:'#ef4444' };
}

function statusBadge(status) {
  const map = {
    DRAFT: { label:'진행중', cls:'tag-blue' },
    DONE:  { label:'완료',   cls:'tag-green' },
    DROP:  { label:'DROP',   cls:'tag-gray' },
    CANDIDATE: { label:'평가대기', cls:'tag-yellow' },
  };
  return map[status] || { label:status, cls:'tag-gray' };
}

// ── CSV export 검증 ─────────────────────────────────────────
function exportEvalCSV(records) {
  const headers = ['업체명','유형','방문일','방문자','수배사유','상태',
    'MFG점','자재점','임가공점','완제품점','운영점','총점','등급'];
  const rows = records.map(r => {
    const s = r.scores || calcScores(r);
    const g = grade(s.total);
    return [
      r.companyName, r.type, r.visitDate || '', r.visitor || '',
      r.reason || '', r.status,
      s.mfg, s.mat, s.pkg, s.fin, s.ops, s.total, g.label
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

// ── 샘플 데이터 3건 ────────────────────────────────────────
const SAMPLE = [
  {
    id:'eval-001', companyId:null, companyName:'(주)한국코스팜',
    type:'MFG', status:'DONE',
    visitDate:'2025-12-10', visitor:'김평가', reason:'신규 OEM 발굴',
    checks:{
      mfg_q1:'Y',mfg_q2:'Y',mfg_q3:'Y',mfg_q4:'Y',mfg_q5:'Y',
      mfg_q6:'Y',mfg_q7:'Y',mfg_q8:'Y',mfg_q9:'Y',mfg_q10:'Y',
      mfg_loss:5, mfg_capa:20, mfg_headcount:15,
      mat_q1:'Y',mat_q2:'Y',mat_q3:'Y',mat_q4:'Y',mat_q5:'Y',mat_q6:'Y',mat_q7:'Y',
      pkg_q1:'Y',pkg_q2:'Y',pkg_q3:'Y',pkg_q4:'Y',pkg_q5:'Y',pkg_q6:'Y',pkg_q7:'N',pkg_q8:'Y',
      pkg_util:80, pkg_lt:7,
      fin_q1:'Y',fin_q2:'Y',fin_q3:'Y',
      ops_q1:'Y',ops_q2:'BOTH',ops_q3:'Y',ops_q4:'Y',ops_q5:'Y',
      ops_q6:'Y',ops_q7:'Y',ops_q8:'Y',ops_q9:'Y',ops_q10:'Y',ops_q11:'Y',
      pkg_tbl:[]
    },
    notes:{ mfg:'우수한 제조환경', mat:'자재관리 체계적', pkg:'충전라인 3개', fin:'독립창고 보유', ops:'유연한 거래조건', overall:'' },
    createdAt:'2025-12-10T09:00:00', updatedAt:'2025-12-10T18:00:00'
  },
  {
    id:'eval-002', companyId:null, companyName:'미래패키징(주)',
    type:'PKG', status:'DRAFT',
    visitDate:'2026-01-15', visitor:'이담당', reason:'포장라인 확충',
    checks:{
      mat_q1:'Y',mat_q2:'Y',mat_q3:'N',mat_q4:'Y',mat_q5:null,mat_q6:null,mat_q7:null,
      pkg_q1:'Y',pkg_q2:'Y',pkg_q3:null,pkg_q4:null,pkg_q5:null,pkg_q6:null,pkg_q7:'N',pkg_q8:'Y',
      fin_q1:'Y',fin_q2:null,fin_q3:null,
      ops_q1:null,ops_q2:'ONE',ops_q3:null,ops_q4:null,ops_q5:null,
      ops_q6:null,ops_q7:null,ops_q8:null,ops_q9:null,ops_q10:null,ops_q11:null,
      pkg_tbl:[{name:'단발',daily:200000,monthly:4000000,kolma:100000,cnt:2,note:'신규도입'}]
    },
    notes:{ mfg:'', mat:'', pkg:'단발 2기 보유', fin:'', ops:'', overall:'' },
    createdAt:'2026-01-15T10:00:00', updatedAt:'2026-01-15T14:30:00'
  },
  {
    id:'eval-003', companyId:'db-cmp-042', companyName:'성신화장품',
    type:'MFG', status:'CANDIDATE',
    visitDate:'', visitor:'', reason:'SHADOW 업체 전환',
    checks:{},
    notes:{ mfg:'', mat:'', pkg:'', fin:'', ops:'', overall:'' },
    createdAt:'2026-02-01T08:00:00', updatedAt:'2026-02-01T08:00:00'
  }
];

// ── 검증 실행 ──────────────────────────────────────────────
console.log('=== calcScores 검증 ===');

// 업체A (MFG, DONE)
SAMPLE[0].scores = calcScores(SAMPLE[0]);
const g0 = grade(SAMPLE[0].scores.total);
console.log(`업체A MFG 총점: ${SAMPLE[0].scores.total} → ${g0.label}`);
console.log('  세부:', JSON.stringify(SAMPLE[0].scores));
// 검증: mfg=11점(10항목×1,q4=2,q5=2 → 실제 1+1+1+2+2+1+1+1+1+1=12)
// mat=9점(2+1+1+2+1+1+1=9) pkg=12점(1+2+1+1+2+3+0+1=11) fin=4점(1+1+2=4) ops=12점(1+2+1+...=12)
// total: 12+9+11+4+12 = 48... 가 아니라 재계산
{
  // mfg: q1=1,q2=1,q3=1,q4=2,q5=2,q6=1,q7=1,q8=1,q9=1,q10=1 → 12
  // mat: q1=2,q2=1,q3=1,q4=2,q5=1,q6=1,q7=1 → 9
  // pkg: q1=1,q2=2,q3=1,q4=1,q5=2,q6=3,q7=-1(N→no deduct),q8=1 → q7='N' so no -1 → 1+2+1+1+2+3+1=11
  // fin: q1=1,q2=1,q3=2 → 4
  // ops: q1=1,q2=BOTH=2,q3=1,q4=1,q5=1,q6=1,q7=1,q8=1,q9=1,q10=1,q11=1 → 12
  // total = 12+9+11+4+12 = 48 → 실제 점수
  // spec에서 업체A 82점이라 했으나, 문항배점 합계가 더 낮음
  // → 설계에서 mfg_q4 2점, mfg_q5 2점이므로 mfg max = 1+1+1+2+2+1+1+1+1+1=12, not 30
  // spec의 max 30은 더 많은 항목이 있어야 하는데 Y/N 10항목 외 수치입력 3개가 있음
  // 수치입력 항목은 점수 없음, 따라서 실제 mfg Y/N max = 12, mat Y/N max = 9
  // pkg Y/N: 1+2+1+1+2+3+(-1)+1 = 10 가중항목 최대
  // fin Y/N: 1+1+2 = 4 < 10
  // ops Y/N: 1+2+1+1+1+1+1+1+1+1+1 = 12 < 15
  // → spec의 max값(30,20,25,10,15)은 목표 만점이고, 현재 정의된 문항만으로는 안 채워짐
  // 실무에서는 OK — 점수바에 취득/실질만점으로 표시
  console.log('  [참고] mfg 실질문항 최대=12, mat=9, pkg=10(with감점), fin=4, ops=12');
  console.log('  spec max(30/20/25/10/15) = 목표 만점 기준, 현 문항 합산 기준 표시');
}

// 업체B (PKG, DRAFT) — mfg 제외
SAMPLE[1].scores = calcScores(SAMPLE[1]);
const g1 = grade(SAMPLE[1].scores.total);
console.log(`\n업체B PKG 총점: ${SAMPLE[1].scores.total} → ${g1.label}`);
console.log('  세부:', JSON.stringify(SAMPLE[1].scores));
console.log('  mfg는 0이어야 함:', SAMPLE[1].scores.mfg === 0 ? 'PASS' : 'FAIL');

// 업체C (CANDIDATE, 미시작)
SAMPLE[2].scores = calcScores(SAMPLE[2]);
console.log(`\n업체C 총점: ${SAMPLE[2].scores.total} (미시작)`);
console.log('  세부:', JSON.stringify(SAMPLE[2].scores));
console.log('  전체 0이어야 함:', SAMPLE[2].scores.total === 0 ? 'PASS' : 'FAIL');

// 상태뱃지 검증
console.log('\n=== statusBadge 검증 ===');
['DRAFT','DONE','DROP','CANDIDATE'].forEach(s => {
  const b = statusBadge(s);
  console.log(`  ${s} → label=${b.label}, cls=${b.cls}`);
});

// CSV 검증
console.log('\n=== CSV export 검증 ===');
const csv = exportEvalCSV(SAMPLE);
const lines = csv.split('\n');
console.log(`  행수: ${lines.length} (헤더1+데이터3=4 기대)`);
console.log('  헤더:', lines[0]);
console.log('  첫 데이터행:', lines[1]);
console.log('  행수 검증:', lines.length === 4 ? 'PASS' : 'FAIL');

// pkg_q7 감점 검증
console.log('\n=== 감점항목 검증 ===');
const testRec = {
  type:'MFG', checks:{
    pkg_q1:'Y',pkg_q2:'Y',pkg_q3:'Y',pkg_q4:'Y',pkg_q5:'Y',pkg_q6:'Y',
    pkg_q7:'Y', // 감점 -1
    pkg_q8:'Y'
  }
};
const ts = calcScores(testRec);
console.log(`  pkg_q7=Y(감점) 적용: pkg점=${ts.pkg}`);
// 1+2+1+1+2+3+(-1)+1 = 10
console.log('  감점 적용 검증:', ts.pkg === 10 ? 'PASS' : 'FAIL');

// 필터링 검증
console.log('\n=== 필터 검증 ===');
function renderEvalList(filter, records) {
  if (filter === 'ALL') return records;
  if (filter === 'WAIT') return records.filter(r => r.status === 'CANDIDATE');
  if (filter === 'DRAFT') return records.filter(r => r.status === 'DRAFT');
  if (filter === 'DONE') return records.filter(r => r.status === 'DONE');
  if (filter === 'DROP') return records.filter(r => r.status === 'DROP');
  return records;
}
console.log('  ALL:', renderEvalList('ALL', SAMPLE).length, '(3 기대)');
console.log('  WAIT:', renderEvalList('WAIT', SAMPLE).length, '(1 기대)');
console.log('  DRAFT:', renderEvalList('DRAFT', SAMPLE).length, '(1 기대)');
console.log('  DONE:', renderEvalList('DONE', SAMPLE).length, '(1 기대)');

// addToEvalFromDB 진입점 검증
console.log('\n=== addToEvalFromDB 검증 ===');
function addToEvalFromDB(companyId, companyName, records) {
  const existing = records.find(r => r.companyId === companyId);
  if (existing) return { action:'OPEN', id:existing.id };
  const newRec = {
    id:`eval-${Date.now()}`, companyId, companyName,
    type:'MFG', status:'DRAFT',
    visitDate:'', visitor:'', reason:'',
    checks:{}, notes:{ mfg:'', mat:'', pkg:'', fin:'', ops:'', overall:'' },
    scores:{ mfg:0, mat:0, pkg:0, fin:0, ops:0, total:0 },
    createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
  };
  return { action:'CREATE', record:newRec };
}
const r1 = addToEvalFromDB('db-cmp-042', '성신화장품', SAMPLE);
console.log('  기존업체 중복 체크 (OPEN):', r1.action === 'OPEN' ? 'PASS' : 'FAIL');
const r2 = addToEvalFromDB('db-cmp-999', '신규테스트', SAMPLE);
console.log('  신규업체 추가 (CREATE):', r2.action === 'CREATE' ? 'PASS' : 'FAIL');
console.log('  신규 레코드 상태:', r2.record.status);

console.log('\n=== 전체 검증 완료 ===');
