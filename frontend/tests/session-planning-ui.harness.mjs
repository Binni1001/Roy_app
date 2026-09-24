// Local browser QA with synthetic people only. Never reads .env or contacts Supabase.
// Run from frontend: node tests/session-planning-ui.harness.mjs
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { buildDraft, inputVersion, PLANNING_LEVELS, validateProfile } from '../../backend/src/modules/session-planning/sessionPlanning.draft.js'
import { analyzeWeek } from '../../backend/src/modules/session-planning/sessionPlanning.rules.js'

const period = { id: 'qa-period', group_id: 'qa-club', status: 'open', start_date: '2026-09-01', end_date: '2026-09-30' }
const week = '2026-09-07'
const members = Array.from({ length: 11 }, (_, i) => ({ id: `qa-${i}`, full_name: `Thành viên thử ${i + 1}` }))
let profiles = members.map((person, i) => ({ person_id: person.id, level: i === 10 ? null : i % 3 + 1,
  preferred_partner_id: i === 0 ? 'qa-1' : null, revision: 1 }))
let preferences = []
let schemaMissing = false
const version = () => inputVersion(period, members, preferences, profiles, week)

const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '/src/api/client.js';
import DraftPlanningPanel from '/src/features/session-planning/DraftPlanningPanel.jsx';
import '/src/index.css';
import '/src/App.css';
import '/src/features/session-planning/sessionPlanning.css';
async function call(action, payload) {
  const response = await fetch('/__qa/' + action, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload || {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message, { cause: { response: { data } } });
  return data;
}
api.sessionPlanning.draftInputs = () => call('inputs');
api.sessionPlanning.preview = (period, payload) => call('preview', payload);
api.sessionPlanning.saveProfile = (period, person, payload) => call('profile', { person, payload });
document.querySelector('#change').onclick = () => call('change');
document.querySelector('#schema').onclick = () => call('schema');
document.querySelector('#mobile').onclick = () => { document.querySelector('main').style.maxWidth = '390px'; };
createRoot(document.querySelector('#root')).render(React.createElement(DraftPlanningPanel, { periodId: 'qa-period', weekStart: '${week}' }));
`
const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Roy — QA xếp nháp (dữ liệu giả)</title></head>
<body><main class="session-planning" style="max-width:1200px;margin:16px auto;padding:16px">
<h1>Kiểm thử cục bộ — chỉ dữ liệu giả</h1><div class="planning-toolbar">
<button id="change">Giả lập thay đổi lịch bận từ nơi khác</button><button id="schema">Bật/tắt lỗi thiếu migration</button><button id="mobile">Xem khung hẹp 390px</button>
</div><div id="root"></div></main><script type="module" src="/__qa-entry.js"></script></body></html>`

const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, envDir: false,
  plugins: [react(), {
    name: 'planning-qa-only',
    resolveId(id) { if (id === '/__qa-entry.js') return '\0planning-qa-entry' },
    load(id) { if (id === '\0planning-qa-entry') return entry },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (req.url === '/' || req.url === '/planning-qa') {
          res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml('/planning-qa', html)); return
        }
        if (!req.url?.startsWith('/__qa/')) return next()
        res.setHeader('Content-Type', 'application/json')
        try {
          let raw = ''
          for await (const chunk of req) { raw += chunk; if (raw.length > 65536) throw new Error('QA payload too large') }
          const body = JSON.parse(raw || '{}'), action = req.url.slice('/__qa/'.length)
          if (action === 'schema') { schemaMissing = !schemaMissing; res.end('{}'); return }
          if (action === 'change') {
            preferences = [{ person_id: 'qa-0', busy_weekdays: [1], revision: (preferences[0]?.revision || 0) + 1 }]
            res.end('{}'); return
          }
          if (schemaMissing) throw Object.assign(new Error('Chức năng xếp lịch chưa được cài đặt đầy đủ.'), { code: 'PLANNING_SCHEMA_NOT_READY', statusCode: 503 })
          if (action === 'inputs') {
            res.end(JSON.stringify({ stage: 'draft_preview', input_version: version(), levels: PLANNING_LEVELS, can_edit: true,
              analysis: analyzeWeek(period, members, preferences, week),
              members: members.map((person) => ({ ...person, profile: profiles.find((row) => row.person_id === person.id) })) })); return
          }
          if (action === 'profile') {
            const profile = profiles.find((row) => row.person_id === body.person)
            const payload = validateProfile(body.payload, body.person, members)
            if (!profile || profile.revision !== payload.expected_revision) throw new Error('QA revision conflict')
            profiles = profiles.map((row) => row.person_id === body.person ? { ...row, level: payload.level,
              preferred_partner_id: payload.preferred_partner_id, revision: row.revision + 1 } : row)
            res.end('{}'); return
          }
          if (action === 'preview') {
            if (body.input_version !== version()) throw Object.assign(new Error('Đầu vào đã thay đổi. Tải lại đầu vào và xếp thử lại.'), { code: 'PLANNING_STALE_INPUT', statusCode: 409 })
            res.end(JSON.stringify({ ...buildDraft(period, members, preferences, profiles, week, body.assignments), input_version: version() })); return
          }
          res.statusCode = 404; res.end('{}')
        } catch (error) { res.statusCode = error.statusCode || 400; res.end(JSON.stringify({ code: error.code || 'QA_ERROR', message: error.message })) }
      })
    },
  }],
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://planning-test.invalid'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('synthetic-qa-key-not-a-secret') },
  server: { host: '127.0.0.1', port: 5179, strictPort: true, open: false },
})
await server.listen()
server.printUrls()
