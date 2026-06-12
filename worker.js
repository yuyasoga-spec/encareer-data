// エンキャリ企業情報 — AI中継サーバー (Cloudflare Worker)
// Claude APIのキーをブラウザに公開せず安全に中継します。
// デプロイ方法は「AI連携セットアップ.md」を参照。
//
// 環境変数（Cloudflareダッシュボード → Settings → Variables and Secrets で設定）:
//   ANTHROPIC_API_KEY  (Secret, 必須)  … console.anthropic.com で発行
//   APP_KEY            (Secret, 推奨)  … サイト側「⚙共有設定」に入れる合言葉。第三者の無断利用を防ぐ
//   MODEL              (任意)          … 既定 claude-opus-4-8。節約したい場合 claude-sonnet-4-6 など

const API = 'https://api.anthropic.com/v1/messages';

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'POSTのみ対応' }, 405);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'WorkerにANTHROPIC_API_KEYが設定されていません' }, 500);
    if (env.APP_KEY && request.headers.get('X-App-Key') !== env.APP_KEY) {
      return json({ error: 'アプリキーが一致しません（⚙共有設定のAI欄を確認）' }, 401);
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: 'リクエストが不正です' }, 400); }

    const path = new URL(request.url).pathname;
    try {
      if (path.endsWith('/search')) return json(await searchCompany(env, body));
      if (path.endsWith('/ocr')) return json(await ocrImages(env, body));
      return json({ error: '不明なエンドポイント: ' + path }, 404);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500);
    }
  },
};

function model(env) { return env.MODEL || 'claude-opus-4-8'; }

async function callClaude(env, payload) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data.error && data.error.message) || JSON.stringify(data);
    throw new Error('Claude API ' + res.status + ': ' + msg);
  }
  return data;
}

/* ---------------- 企業検索（Web検索付き） ---------------- */

async function searchCompany(env, { name }) {
  if (!name || !String(name).trim()) throw new Error('企業名を入力してください');

  const prompt = `あなたは日本のエンタメ業界の就活生を支援するリサーチャーです。
次の企業についてWeb検索で調べ、結果をJSONだけで出力してください（前置き・説明・コードフェンス禁止）。

企業名: ${String(name).trim()}

調べる項目:
- 正式社名 / 読み仮名(ひらがな) / 公式サイトURL / 採用ページURL
- 本社所在地 / 資本金 / 代表者 / 設立年 / 事業内容(1〜2文) / ジャンル(例: 芸能プロダクション、映像制作、レーベル等)
- 新卒採用情報(27卒・28卒): エントリー締切や選考スケジュール、ES設問(分かれば)、選考フロー
- 締切などの日付は分かる範囲で YYYY-MM-DD 形式に。年が書かれていない場合は文脈から推定し note に「推定」と書く

出力JSONの形式(この形式に厳密に従うこと。不明な項目は空文字 ""):
{
  "name": "正式社名",
  "kana": "よみがな",
  "hp": "公式サイトURL",
  "recruitPage": "採用ページURL",
  "location": "本社所在地",
  "capital": "資本金",
  "ceo": "代表者名",
  "founded": "設立年",
  "business": "事業内容",
  "genre": "ジャンル",
  "recruitInfo": "新卒採用の概要・選考フロー・ES設問など(改行可)",
  "deadlines": [ { "label": "何の締切/開始か", "date": "YYYY-MM-DD", "note": "補足" } ],
  "sources": [ "参照したURL" ],
  "confidence": "high|medium|low"
}`;

  const payload = {
    model: model(env),
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
    messages: [{ role: 'user', content: prompt }],
  };

  let res = await callClaude(env, payload);
  // サーバー側ツールの反復上限(pause_turn)に達したら続きを再開
  let guard = 0;
  while (res.stop_reason === 'pause_turn' && guard++ < 4) {
    payload.messages = [payload.messages[0], { role: 'assistant', content: res.content }];
    res = await callClaude(env, payload);
  }

  const text = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { ...parseLenientJson(text), _usage: res.usage };
}

// コードフェンスや前置きが混ざっても最初の{...}を取り出してパースする
function parseLenientJson(text) {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e === -1 || e <= s) throw new Error('検索結果の解析に失敗しました（JSONが見つかりません）');
  return JSON.parse(text.slice(s, e + 1));
}

/* ---------------- 画像読み取り（OCR→構造化） ---------------- */

const OCR_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          company: { type: 'string', description: '企業名（不明なら空文字）' },
          kind: { type: 'string', enum: ['deadline', 'start', 'event', 'info'], description: 'deadline=応募〆切, start=応募開始, event=説明会/インターン開催日, info=その他情報' },
          date: { type: 'string', description: 'YYYY-MM-DD。日付が無ければ空文字' },
          title: { type: 'string', description: '見出し（例: 28卒本選考エントリー〆切）' },
          detail: { type: 'string', description: '対象学年・提出物・備考などの詳細' },
          link: { type: 'string', description: '画像内に書かれたURL。無ければ空文字' },
        },
        required: ['company', 'kind', 'date', 'title', 'detail', 'link'],
        additionalProperties: false,
      },
    },
    rawText: { type: 'string', description: '画像から読み取った全文' },
  },
  required: ['items', 'rawText'],
  additionalProperties: false,
};

async function ocrImages(env, { images, hint }) {
  if (!Array.isArray(images) || images.length === 0) throw new Error('画像がありません');
  if (images.length > 8) throw new Error('一度に読み取れるのは8枚までです');

  const content = images.map((img) => ({
    type: 'image',
    source: { type: 'base64', media_type: img.media_type || 'image/jpeg', data: img.data },
  }));
  content.push({
    type: 'text',
    text: `これらは就活情報アカウント（X/Twitter）の投稿画像です。書かれている就活情報（企業名・締切・応募開始日・説明会やインターンの開催日・対象学年・提出物など）をすべて読み取り、構造化してください。
- 1つの画像に複数企業の情報があれば、企業ごと・期日ごとに別のitemに分ける
- 日付は YYYY-MM-DD に正規化。年が書かれていない場合は今日(${new Date().toISOString().slice(0, 10)})以降で最も近い日付と推定し、detailに「年は推定」と書く
- 読み取れない/就活情報でない画像は無理にitemを作らない${hint ? '\n- ヒント: ' + hint : ''}`,
  });

  const payload = {
    model: model(env),
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: OCR_SCHEMA } },
    messages: [{ role: 'user', content }],
  };

  const res = await callClaude(env, payload);
  const text = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { ...JSON.parse(text), _usage: res.usage };
}
