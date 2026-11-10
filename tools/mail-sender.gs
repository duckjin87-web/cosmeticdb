/**
 * 신규처 등록평가 — 메일 발송 서버 (Google Apps Script)
 *
 * 이 스크립트를 hyeopsaeng@gmail.com 계정으로 배포하면, 앱에서 보낸 메일이
 * 그 계정 명의로 발송됩니다. (보내는 사람 = 스크립트를 배포한 계정)
 *
 * 배포 방법
 *  1. hyeopsaeng@gmail.com 으로 로그인 → script.google.com → 새 프로젝트
 *  2. 이 파일 내용을 Code.gs 에 붙여넣기
 *  3. 아래 TOKEN 을 아무도 모르는 긴 문자열로 바꾸기 (앱 설정의 '인증키'와 같아야 함)
 *  4. 배포 → 새 배포 → 유형: 웹 앱
 *       - 다음 사용자로 실행: 나(hyeopsaeng@gmail.com)
 *       - 액세스 권한: 모든 사용자
 *  5. 처음 배포할 때 Gmail 발송 권한 승인
 *  6. 발급된 웹 앱 URL(…/exec)과 TOKEN 을 앱의 ✉️ 메일 발송 → ⚙ 발송 설정에 입력
 *
 * 한도: 개인 Gmail 계정은 하루 약 100통(수신자 기준), 첨부 합계 25MB.
 */

const TOKEN = '여기에-긴-비밀-문자열을-넣으세요';   // ← 반드시 변경
const SENDER_NAME = '신규처 등록평가';
const MAX_RECIPIENTS = 20;

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (!req || req.token !== TOKEN) return json_({ ok: false, error: '인증키가 일치하지 않습니다.' });

    const to = (req.to || []).map(String).map(s => s.trim()).filter(isEmail_);
    if (!to.length) return json_({ ok: false, error: '받는 사람이 없습니다.' });
    if (to.length > MAX_RECIPIENTS) return json_({ ok: false, error: `받는 사람은 ${MAX_RECIPIENTS}명까지입니다.` });

    const attachments = (req.attachments || []).map(a =>
      Utilities.newBlob(Utilities.base64Decode(a.data), a.mimeType || 'application/octet-stream', a.name || 'file'));

    GmailApp.sendEmail(to.join(','), String(req.subject || '(제목 없음)').slice(0, 250), String(req.body || ''), {
      name: SENDER_NAME,
      attachments: attachments,
    });
    return json_({ ok: true, sentTo: to.length, remainingToday: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/* 앱의 '연결 확인' 버튼이 호출 — 발송은 하지 않음 */
function doGet() {
  return json_({ ok: true, service: 'cosmedb-mail', remainingToday: MailApp.getRemainingDailyQuota() });
}

function isEmail_(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s); }
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
