# SharePoint 공용 폴더 자동 업로드 — IT 요청서

평가완료 시 생성되는 체크리스트 Excel과 내부보고용 PPT를 SharePoint 공용 폴더로
자동 업로드하기 위한 설정 안내입니다. **Azure AD 앱 등록이나 사용자 로그인은 필요 없습니다.**

---

## IT 담당자에게 요청할 내용

Power Automate 흐름 **1개**를 만들어 주시고, 생성된 **HTTP POST URL**을 회신해 주세요.

### 흐름 구성

**1. 트리거 — “HTTP 요청을 받을 때”**

요청 본문 JSON 스키마:

```json
{
  "type": "object",
  "properties": {
    "fileName":      { "type": "string" },
    "contentType":   { "type": "string" },
    "contentBase64": { "type": "string" },
    "companyName":   { "type": "string" },
    "visitDate":     { "type": "string" },
    "evaluator":     { "type": "string" },
    "uploadedAt":    { "type": "string" }
  }
}
```

**2. 작업 — “파일 만들기” (SharePoint)**

| 항목 | 값 |
|---|---|
| 사이트 주소 | 공용 폴더가 있는 SharePoint 사이트 |
| 폴더 경로 | 저장할 문서 라이브러리 폴더 |
| 파일 이름 | `fileName` (동적 콘텐츠) |
| 파일 콘텐츠 | `base64ToBinary(triggerBody()?['contentBase64'])` |

> **파일 콘텐츠에는 반드시 위 식(expression)을 넣어야 합니다.**
> `contentBase64`를 그대로 넣으면 파일이 깨집니다.

**3. (선택) 업체별 하위 폴더로 정리**

폴더 경로를 아래 식으로 지정하면 업체명 폴더가 자동 생성됩니다.

```
/공용문서/신규처등록평가/@{triggerBody()?['companyName']}
```

**4. 저장 후, 트리거에 표시되는 `HTTP POST URL` 전체를 회신**

형식: `https://prod-00.koreacentral.logic.azure.com:443/workflows/.../triggers/manual/paths/invoke?api-version=...&sig=...`

---

## 앱에서 설정하는 방법

1. 평가 화면 하단 **☁️ 공용폴더 연동** 클릭
2. 받은 URL 붙여넣기 → 확인
3. **연결테스트** 클릭 → 공용 폴더에 `_연결테스트_날짜.txt` 파일이 생기면 성공

이후 **평가완료** 또는 **📄 내부보고용 / 📊 Excel 저장** 시 공용 폴더로 자동 업로드됩니다.
아이폰·안드로이드에서도 동일하게 동작합니다.

---

## 참고

- URL에는 서명(`sig=`)이 포함되어 있어 **URL 자체가 인증 수단**입니다. 외부에 공유하지 마세요.
- 업로드 실패 시(네트워크 끊김 등) 기존처럼 **로컬 저장/다운로드로 자동 대체**되므로 파일이 유실되지 않습니다.
- 연동을 해제하려면 **☁️ 공용폴더 연동**에서 주소를 비우고 확인하면 됩니다.
- 이 기능은 파일(Excel/PPT) 업로드용입니다. 평가 데이터 자체는 기기 브라우저에 저장되므로,
  기기 간 이관은 **💾 백업 / 📂 복원**을 사용하세요.
