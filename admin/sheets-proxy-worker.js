/**
 * Cloudflare Worker - Google Sheets API Proxy (인플루언서 관리)
 *
 * 배포 방법:
 * 1. https://dash.cloudflare.com 접속
 * 2. Workers & Pages > Create Worker (이름: sheets-proxy)
 * 3. 이 코드 붙여넣기
 * 4. Settings > Variables 에 환경변수 추가:
 *    - GOOGLE_SERVICE_ACCOUNT_EMAIL: 서비스 계정 이메일
 *    - GOOGLE_PRIVATE_KEY: 서비스 계정 비공개 키 (PEM 형식, -----BEGIN PRIVATE KEY----- 포함)
 *    - SPREADSHEET_ID: 스프레드시트 ID (URL에서 /d/ 뒤의 값)
 *    - SHEET_NAME: 시트 탭 이름 (기본값: "Sheet1")
 * 5. Settings > KV Namespace Bindings 추가:
 *    - Variable name: INFLUENCER_CACHE
 *    - KV Namespace: 새로 생성 (이름: influencer-cache)
 * 6. Deploy
 *
 * Google Cloud 설정:
 * 1. Google Cloud Console > APIs & Services > Credentials
 * 2. Create Service Account > 키 생성 (JSON)
 * 3. Google Sheets API 활성화
 * 4. 스프레드시트를 서비스 계정 이메일로 공유 (편집자)
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return corsResponse();
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // 환경변수 확인 (health check용)
      if (path === '/health' && request.method === 'GET') {
        return jsonResponse({
          ok: true,
          env: {
            GOOGLE_SERVICE_ACCOUNT_EMAIL: !!env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            GOOGLE_PRIVATE_KEY: !!env.GOOGLE_PRIVATE_KEY,
            SPREADSHEET_ID: !!env.SPREADSHEET_ID,
            SHEET_NAME: !!env.SHEET_NAME,
            INFLUENCER_CACHE: !!env.INFLUENCER_CACHE,
          }
        });
      }

      // 필수 환경변수 검증
      if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY || !env.SPREADSHEET_ID) {
        return jsonResponse({
          error: 'Missing required environment variables. Check: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, SPREADSHEET_ID',
          missing: {
            GOOGLE_SERVICE_ACCOUNT_EMAIL: !env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            GOOGLE_PRIVATE_KEY: !env.GOOGLE_PRIVATE_KEY,
            SPREADSHEET_ID: !env.SPREADSHEET_ID,
          }
        }, 500);
      }

      if (path === '/influencers' && request.method === 'GET') {
        return await handleGetInfluencers(env);
      }
      if (path === '/influencers/update' && request.method === 'PATCH') {
        return await handleUpdateInfluencer(request, env);
      }
      if (path === '/influencers/refresh' && request.method === 'POST') {
        return await handleRefresh(env);
      }
      if (path === '/config' && request.method === 'GET') {
        return await handleGetConfig(env);
      }
      if (path === '/config/save' && request.method === 'POST') {
        return await handleSaveConfig(request, env);
      }
      if (path === '/grade-config' && request.method === 'GET') {
        return await handleGetGradeConfig(env);
      }
      if (path === '/grade-config/save' && request.method === 'POST') {
        return await handleSaveGradeConfig(request, env);
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  }
};

// ─── 엔드포인트 핸들러 ────────────────────────────────

async function handleGetInfluencers(env) {
  // KV 캐시 확인 (KV 미설정 시 스킵)
  if (env.INFLUENCER_CACHE) {
    try {
      const cached = await env.INFLUENCER_CACHE.get('influencer_data', 'json');
      if (cached) {
        return jsonResponse({
          data: cached.data,
          headers: cached.headers,
          count: cached.data.length,
          cachedAt: cached.fetchedAt,
          fromCache: true
        });
      }
    } catch (e) { /* KV 오류 시 API 직접 호출 */ }
  }

  return await fetchAndCache(env);
}

async function handleUpdateInfluencer(request, env) {
  const body = await request.json();
  const { rowIndex, columnIndex, value } = body;

  if (!rowIndex || columnIndex === undefined) {
    return jsonResponse({ error: 'rowIndex and columnIndex are required' }, 400);
  }

  const token = await getAccessToken(env);
  const sheetName = env.SHEET_NAME || 'Sheet1';
  const colLetter = columnIndexToLetter(columnIndex);
  const range = `${sheetName}!${colLetter}${rowIndex}`;

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [[value]] })
    }
  );

  const result = await response.json();

  if (result.error) {
    return jsonResponse({ error: result.error.message }, 400);
  }

  // 캐시 무효화
  if (env.INFLUENCER_CACHE) {
    try { await env.INFLUENCER_CACHE.delete('influencer_data'); } catch (e) {}
  }

  return jsonResponse({ success: true, updatedRange: result.updatedRange });
}

async function handleRefresh(env) {
  if (env.INFLUENCER_CACHE) {
    try { await env.INFLUENCER_CACHE.delete('influencer_data'); } catch (e) {}
  }
  return await fetchAndCache(env);
}

// ─── Config 핸들러 ────────────────────────────────────

async function handleGetConfig(env) {
  const token = await getAccessToken(env);
  const configSheet = 'influencer_config';

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(configSheet)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const result = await response.json();
  if (result.error) {
    // 시트가 없으면 빈 배열 반환
    return jsonResponse({ columns: [] });
  }

  const values = result.values || [];
  if (values.length < 2) {
    return jsonResponse({ columns: [] });
  }

  const colHeaders = values[0].map(h => h.trim());
  const columns = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    colHeaders.forEach((h, idx) => {
      obj[h] = row[idx] || '';
    });
    columns.push(obj);
  }

  return jsonResponse({ columns });
}

async function handleSaveConfig(request, env) {
  const body = await request.json();
  const { columns } = body;

  if (!columns || !Array.isArray(columns)) {
    return jsonResponse({ error: 'columns array is required' }, 400);
  }

  const token = await getAccessToken(env);
  const configSheet = 'influencer_config';

  const values = [['컬럼명', '노출']];
  columns.forEach(col => {
    values.push([col.name, col.visible ? 'TRUE' : 'FALSE']);
  });

  // 시트가 없으면 자동 생성
  await ensureSheetExists(env.SPREADSHEET_ID, configSheet, token);

  // 기존 데이터 클리어
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(configSheet)}:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    }
  );

  // 새 데이터 쓰기
  const range = `${configSheet}!A1:B${values.length}`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    }
  );

  const result = await response.json();
  if (result.error) {
    return jsonResponse({ error: result.error.message }, 400);
  }

  return jsonResponse({ success: true });
}

// ─── Grade Config 핸들러 ─────────────────────────────

const DEFAULT_GRADES = [
  { grade: 'S', minFollowers: '200000', minViews: '100000', minEngagement: '5%' },
  { grade: 'A', minFollowers: '100000', minViews: '50000', minEngagement: '3%' },
  { grade: 'B', minFollowers: '50000', minViews: '20000', minEngagement: '2%' },
  { grade: 'C', minFollowers: '10000', minViews: '10000', minEngagement: '' },
  { grade: '검토대상', minFollowers: '0', minViews: '0', minEngagement: '' }
];

async function handleGetGradeConfig(env) {
  const token = await getAccessToken(env);
  const configSheet = 'grade_config';

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(configSheet)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const result = await response.json();
  if (result.error || !result.values || result.values.length < 2) {
    return jsonResponse({ grades: DEFAULT_GRADES, fromSheet: false });
  }

  const grades = [];
  for (let i = 1; i < result.values.length; i++) {
    const row = result.values[i];
    grades.push({
      grade: row[0] || '',
      minFollowers: row[1] || '0',
      minViews: row[2] || '0',
      minEngagement: row[3] || ''
    });
  }

  return jsonResponse({ grades, fromSheet: true });
}

async function handleSaveGradeConfig(request, env) {
  const body = await request.json();
  const { grades, applyFormula } = body;

  if (!grades || !Array.isArray(grades)) {
    return jsonResponse({ error: 'grades array is required' }, 400);
  }

  const token = await getAccessToken(env);
  const configSheet = 'grade_config';

  await ensureSheetExists(env.SPREADSHEET_ID, configSheet, token);

  // Config 시트에 기준값 저장
  const values = [['등급', '팔로워_최소', '조회수_최소', '참여율_최소']];
  grades.forEach(g => {
    values.push([g.grade, g.minFollowers, g.minViews, g.minEngagement]);
  });

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(configSheet)}:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }
  );

  const range = `${configSheet}!A1:D${values.length}`;
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    }
  );

  const writeResult = await writeRes.json();
  if (writeResult.error) {
    return jsonResponse({ error: writeResult.error.message }, 400);
  }

  // 수식 적용
  if (applyFormula) {
    const formulaResult = await applyGradeFormula(env, token, grades);
    return jsonResponse({ success: true, formulaApplied: formulaResult });
  }

  return jsonResponse({ success: true });
}

async function applyGradeFormula(env, token, grades) {
  const sheetName = env.SHEET_NAME || 'Sheet1';

  // 헤더에서 컬럼 위치 찾기
  const headerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(sheetName + '!1:1')}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const headerResult = await headerRes.json();
  const sheetHeaders = (headerResult.values && headerResult.values[0]) || [];

  const followerIdx = sheetHeaders.findIndex(h => h.includes('팔로워') && !h.includes('대비'));
  const viewsIdx = sheetHeaders.findIndex(h => h.includes('평균') && h.includes('릴스'));
  const engagementIdx = sheetHeaders.findIndex(h => h.includes('소통참여율'));
  const gradeIdx = sheetHeaders.findIndex(h => h.includes('인플루언서 등급'));

  if (gradeIdx === -1 || followerIdx === -1 || viewsIdx === -1) {
    return { error: '필수 컬럼을 찾을 수 없습니다 (팔로워, 평균 릴스, 인플루언서 등급)' };
  }

  const fCol = columnIndexToLetter(followerIdx);
  const vCol = columnIndexToLetter(viewsIdx);
  const eCol = engagementIdx >= 0 ? columnIndexToLetter(engagementIdx) : null;
  const gCol = columnIndexToLetter(gradeIdx);

  // 데이터 행 수 파악
  const countRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(sheetName + '!A:A')}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const countResult = await countRes.json();
  const totalRows = (countResult.values || []).length;

  if (totalRows < 2) return { error: '데이터가 없습니다' };

  // 수식 생성
  const formulas = [];
  for (let r = 2; r <= totalRows; r++) {
    const parts = [];

    grades.forEach((g, i) => {
      const configRow = i + 2;
      if (i === grades.length - 1) {
        // 마지막 등급은 기본값 (TRUE)
        parts.push(`TRUE, grade_config!$A$${configRow}`);
      } else if (eCol && g.minEngagement) {
        // 참여율 기준 있음: 팔로워 AND (조회수 OR 참여율)
        parts.push(`AND(${fCol}${r}>=grade_config!$B$${configRow}, OR(${vCol}${r}>=grade_config!$C$${configRow}, ${eCol}${r}>=grade_config!$D$${configRow})), grade_config!$A$${configRow}`);
      } else {
        // 참여율 기준 없음: 팔로워 AND 조회수
        parts.push(`AND(${fCol}${r}>=grade_config!$B$${configRow}, ${vCol}${r}>=grade_config!$C$${configRow}), grade_config!$A$${configRow}`);
      }
    });

    formulas.push([`=IFS(${parts.join(', ')})`]);
  }

  // 등급 컬럼에 수식 일괄 적용
  const formulaRange = `${sheetName}!${gCol}2:${gCol}${totalRows}`;
  const formulaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(formulaRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: formulas })
    }
  );

  const formulaResult = await formulaRes.json();
  if (formulaResult.error) {
    return { error: formulaResult.error.message };
  }

  // 캐시 무효화
  if (env.INFLUENCER_CACHE) {
    try { await env.INFLUENCER_CACHE.delete('influencer_data'); } catch (e) {}
  }

  return { success: true, updatedRows: totalRows - 1 };
}

// ─── Sheets API 호출 ──────────────────────────────────

async function fetchAndCache(env) {
  const token = await getAccessToken(env);
  const sheetName = env.SHEET_NAME || 'Sheet1';

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const result = await response.json();

  if (result.error) {
    return jsonResponse({ error: result.error.message }, 400);
  }

  const values = result.values || [];
  if (values.length < 2) {
    return jsonResponse({ data: [], headers: [], count: 0, cachedAt: null, fromCache: false });
  }

  const headers = values[0].map(h => h.trim().replace(/\n/g, ' '));
  const data = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = { _rowIndex: i + 1 };

    headers.forEach((header, idx) => {
      obj[header] = row[idx] !== undefined ? row[idx] : '';
    });

    data.push(obj);
  }

  const fetchedAt = new Date().toISOString();

  // KV에 캐시 (5분 TTL, KV 미설정 시 스킵)
  if (env.INFLUENCER_CACHE) {
    try {
      await env.INFLUENCER_CACHE.put(
        'influencer_data',
        JSON.stringify({ data, headers, fetchedAt }),
        { expirationTtl: 300 }
      );
    } catch (e) { /* KV 쓰기 실패 시 무시 */ }
  }

  return jsonResponse({
    data,
    headers,
    count: data.length,
    cachedAt: fetchedAt,
    fromCache: false
  });
}

// ─── Google Service Account JWT 인증 ──────────────────

async function getAccessToken(env) {
  // KV에서 캐시된 토큰 확인
  if (env.INFLUENCER_CACHE) {
    try {
      const cached = await env.INFLUENCER_CACHE.get('google_access_token', 'json');
      if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
      }
    } catch (e) { /* KV 오류 시 새 토큰 발급 */ }
  }

  const jwt = await createJWT(env.GOOGLE_SERVICE_ACCOUNT_EMAIL, env.GOOGLE_PRIVATE_KEY);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Auth failed: ${data.error_description || data.error}`);
  }

  // 토큰 캐시 (55분 TTL, 실제 만료 60분)
  if (env.INFLUENCER_CACHE) {
    try {
      await env.INFLUENCER_CACHE.put(
        'google_access_token',
        JSON.stringify({
          token: data.access_token,
          expiresAt: Date.now() + 55 * 60 * 1000
        }),
        { expirationTtl: 3300 }
      );
    } catch (e) { /* KV 쓰기 실패 시 무시 */ }
  }

  return data.access_token;
}

async function createJWT(email, privateKeyPem) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const key = await importPrivateKey(privateKeyPem);

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, signInput);

  return `${headerB64}.${payloadB64}.${base64url(signature)}`;
}

async function importPrivateKey(pem) {
  const pemBody = pem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/[\n\r\s]/g, '');

  const binaryDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

// ─── 유틸리티 ─────────────────────────────────────────

async function ensureSheetExists(spreadsheetId, sheetName, token) {
  // 스프레드시트 메타데이터에서 시트 목록 확인
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const meta = await metaRes.json();
  const exists = (meta.sheets || []).some(s => s.properties.title === sheetName);
  if (exists) return;

  // 시트가 없으면 생성
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetName } } }]
      })
    }
  );
}

function columnIndexToLetter(index) {
  let letter = '';
  let i = index;
  while (i >= 0) {
    letter = String.fromCharCode(65 + (i % 26)) + letter;
    i = Math.floor(i / 26) - 1;
  }
  return letter;
}

function base64url(input) {
  if (typeof input === 'string') {
    return btoa(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  const bytes = new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function corsResponse() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
