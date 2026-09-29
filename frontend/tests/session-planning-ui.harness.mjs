// Local browser QA with synthetic people only. Never reads .env or contacts Supabase.
// Run from frontend: node tests/session-planning-ui.harness.mjs
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { buildDraft, inputVersion, PLANNING_LEVELS, validateProfile } from '../../backend/src/modules/session-planning/sessionPlanning.draft.js'
import { analyzeWeek } from '../../backend/src/modules/session-planning/sessionPlanning.rules.js'

const period = { id: 'qa-period', name: 'Tháng 9 · Roy Badminton', group_id: 'qa-club', status: 'open', start_date: '2026-09-01', end_date: '2026-09-30' }
const week = '2026-09-07'
const members = Array.from({ length: 11 }, (_, i) => ({ id: `qa-${i}`, full_name: `Thành viên thử ${i + 1}` }))
let profiles = members.map((person, i) => ({ person_id: person.id, level: i === 10 ? null : i % 3 + 1,
  preferred_partner_id: i === 0 ? 'qa-1' : null, revision: 1 }))
let preferences = []
let schemaMissing = false
const openDays = []
const openDates = () => openDays.map(day => day.play_date)
const version = () => inputVersion(period, members, preferences, profiles, week, openDates())

const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '/src/api/client.js';
import DraftPlanningPanel from '/src/features/session-planning/DraftPlanningPanel.jsx';
import SessionPlanningPanel from '/src/features/session-planning/SessionPlanningPanel.jsx';
import AdminSessionsLayout from '/src/features/session-planning/AdminSessionsLayout.jsx';
import SessionsPanel from '/src/features/admin/panels/SessionsPanel.jsx';
import { UserContent } from '/src/features/user/UserContent.jsx';
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
api.sessionPlanning.save = (period, person, payload) => call('availability-save', { person, payload });
api.guests.bySession = async () => [{ id:'guest', person:{full_name:'Khách thử'}, amount:50000, note:'Dữ liệu giả' }];
api.guests.create = async (payload) => payload;
document.querySelector('#change').onclick = () => call('change');
document.querySelector('#schema').onclick = () => call('schema');
document.querySelector('#mobile').onclick = () => { document.querySelector('main').style.maxWidth = '390px'; };
const h = React.createElement;
function Screens() {
  const [mode, setMode] = React.useState('admin');
  const [sessions, setSessions] = React.useState([
    {id:'session-1', play_date:'2026-09-23', shuttle_used_count:6, note:'Một buổi chơi cùng cả nhóm.'},
    {id:'session-2', play_date:'2026-09-21', shuttle_used_count:4, note:'Buổi đầu tuần — ghi chú dài để kiểm tra cách xuống dòng trên điện thoại.'},
  ]);
  const [forms, setForms] = React.useState({ session:{play_date:'2026-09-25', shuttle_used_count:0, note:''}, guest:{session_id:'session-1',person_id:'qa-0',amount:50000} });
  const manager = mode !== 'user';
  api.sessionPlanning.get = () => call('availability', {manager});
  api.sessionPlanning.openDays = () => call('open-days', {manager});
  api.sessionPlanning.changeOpenDay = (period,date,payload) => call('open-day-change',{date,...payload,manager});
  api.sessions.create = async (payload) => { const row = {...payload,id:'session-'+Date.now()}; setSessions((rows)=>[...rows,row]); return row; };
  api.sessions.update = async (id,payload) => {setSessions((rows)=>rows.map((row)=>row.id===id?{...row,...payload}:row)); return payload;};
  api.sessions.remove = async (id) => {setSessions((rows)=>rows.filter((row)=>row.id!==id)); return {id};};
  return h(React.Fragment, null,
    h('div', {className:'planning-toolbar',style:{marginBottom:20}}, ...['admin','user','scoped'].map((value)=>h('button',{key:value,onClick:()=>setMode(value)},value === 'admin' ? 'Xem Owner' : value === 'user' ? 'Xem User' : 'Xem Admin theo nhóm'))),
    h('div',{key:mode}, manager ? h(AdminSessionsLayout,{periodId:'qa-period',
      fixed:h(SessionPlanningPanel,{periodId:'qa-period',manager:true}),
      history:h(SessionsPanel,{people:${JSON.stringify(members)}, sessions, sessionForm:forms.session,guestForm:forms.guest,selectedPeriodId:'qa-period',
        setForm:(name,patch)=>setForms((value)=>({...value,[name]:{...value[name],...patch}})),submit:async(action)=>action(),canManageGuests:mode==='admin',canDeleteSessions:mode==='admin'})})
      : h(UserContent,{activeTab:'schedule',sessions,selectedPeriodId:'qa-period'}))
  );
}
createRoot(document.querySelector('#root')).render(location.pathname === '/planning-qa' ? h(DraftPlanningPanel,{periodId:'qa-period',weekStart:'${week}'}) : h(Screens));
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
          if (action === 'open-days') {
            if (schemaMissing) throw new Error('Buổi tự đăng ký chưa được kích hoạt.')
            res.end(JSON.stringify({can_manage:body.manager,can_edit:true,period,days:openDays.map(day=>({...day,
              count:day.joined?1:0,can_join:!body.manager&&!day.joined&&day.status==='open',can_leave:!body.manager&&day.joined,
              can_change:body.manager,joined:!body.manager&&day.joined,names:day.joined?['Thành viên thử 1']:[]}))})); return
          }
          if (action === 'open-day-change') {
            const day=openDays.find(day=>day.play_date===body.date)
            if(body.action==='open'&&!day) openDays.push({play_date:body.date,status:'open',capacity:8,note:body.note,joined:false})
            if(day&&body.action==='close') day.status='closed'
            if(day&&body.action==='reopen') day.status='open'
            if(day&&body.action==='join') day.joined=true
            if(day&&body.action==='leave') day.joined=false
            res.end('{}'); return
          }
          if (action === 'change') {
            preferences = [{ person_id: 'qa-0', busy_weekdays: [1], revision: (preferences[0]?.revision || 0) + 1 }]
            res.end('{}'); return
          }
          if (action === 'availability') {
            const rows = body.manager ? members : members.slice(0, 1)
            res.end(JSON.stringify({period, can_manage:body.manager, can_edit:true,
              analysis:analyzeWeek(period,members,preferences,week,openDates()),
              members:rows.map((person)=>({...person,preferences:preferences.find((row)=>row.person_id===person.id)||{busy_weekdays:[],date_overrides:{},revision:0}}))})); return
          }
          if (action === 'availability-save') {
            preferences = [...preferences.filter((row)=>row.person_id!==body.person), {...body.payload, person_id:body.person, revision:body.payload.expected_revision+1}]
            res.end('{}'); return
          }
          if (schemaMissing) throw Object.assign(new Error('Chức năng xếp lịch chưa được cài đặt đầy đủ.'), { code: 'PLANNING_SCHEMA_NOT_READY', statusCode: 503 })
          if (action === 'inputs') {
            res.end(JSON.stringify({ stage: 'draft_preview', input_version: version(), levels: PLANNING_LEVELS, can_edit: true,
              analysis: analyzeWeek(period, members, preferences, week, openDates()),
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
            res.end(JSON.stringify({ ...buildDraft(period, members, preferences, profiles, week, body.assignments, openDates()), input_version: version() })); return
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
