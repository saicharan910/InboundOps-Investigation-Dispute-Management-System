import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { LayoutDashboard, ClipboardList, Search, Bell, Plus, Download, ChevronDown, Clock3, CircleAlert, CheckCircle2, ArrowUpRight, ArrowDownRight, Filter, RefreshCw, X, FileSearch, Building2, UserRound, CalendarDays, MessageSquareText, Send, ShieldAlert, Menu, MoreHorizontal, ExternalLink, CircleHelp, Activity, Check, AlertTriangle } from 'lucide-react'
import './styles.css'

const API = '/api'
const STATUSES = ['Open','Investigating','Pending Partner','Resolved','Escalated']
const PRIORITIES = ['Low','Medium','High','Critical']
const REASONS = ['Short payment','Missing receipt','Quantity mismatch','Duplicate charge','Rate discrepancy','Documentation gap']
const FCS = ['BLR7','HYD2','MAA4','DEL5','PUN3']
const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n||0))
const dateFmt = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'
const dateTime = d => d ? new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'
const overdue = c => c.status !== 'Resolved' && new Date(c.due_at) < new Date()
const variance = c => Math.max(0, Number(c.expected_amount)-Number(c.actual_amount))
function App(){
  const [page,setPage] = useState('Overview')
  const [stats,setStats] = useState(null)
  const [cases,setCases] = useState([])
  const [selected,setSelected] = useState(null)
  const [detail,setDetail] = useState(null)
  const [search,setSearch] = useState('')
  const [status,setStatus] = useState('')
  const [priority,setPriority] = useState('')
  const [fc,setFc] = useState('')
  const [loading,setLoading] = useState(true)
  const [notice,setNotice] = useState('')
  const [showCreate,setShowCreate] = useState(false)
  const [mobileNav,setMobileNav] = useState(false)
  const [refreshing,setRefreshing] = useState(false)

  async function api(path, options={}){
    const res = await fetch(API+path,{headers:{'Content-Type':'application/json'},...options})
    const data = await res.json().catch(()=>({}))
    if(!res.ok) throw new Error(data.error || 'Something went wrong')
    return data
  }
  async function loadAll(){
    setRefreshing(true)
    try{
      const qs = new URLSearchParams()
      if(search) qs.set('search',search)
      if(status) qs.set('status',status)
      if(priority) qs.set('priority',priority)
      if(fc) qs.set('fc',fc)
      const [s,c] = await Promise.all([api('/stats'),api('/cases?'+qs.toString())])
      setStats(s); setCases(c)
    }catch(e){setNotice(e.message)}finally{setLoading(false);setRefreshing(false)}
  }
  useEffect(()=>{const t=setTimeout(loadAll,220);return()=>clearTimeout(t)},[search,status,priority,fc])
  useEffect(()=>{if(notice){const t=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(t)}},[notice])
  async function openCase(c){
    try{const d=await api('/cases/'+c.id);setSelected(c);setDetail(d)}catch(e){setNotice(e.message)}
  }
  async function updateCase(id,patch){
    try{await api('/cases/'+id,{method:'PATCH',body:JSON.stringify(patch)});setNotice('Case updated successfully.');await loadAll();const d=await api('/cases/'+id);setDetail(d);setSelected(d)}
    catch(e){setNotice(e.message)}
  }
  async function createCase(data){
    try{await api('/cases',{method:'POST',body:JSON.stringify(data)});setShowCreate(false);setNotice('New investigation case created.');await loadAll()}
    catch(e){throw e}
  }
  async function addNote(id,note){
    await api(`/cases/${id}/notes`,{method:'POST',body:JSON.stringify({note})})
    const d=await api('/cases/'+id);setDetail(d);setSelected(d);setNotice('Investigation note added.')
  }
  async function escalate(id,data){
    await api(`/cases/${id}/escalate`,{method:'POST',body:JSON.stringify(data)})
    await loadAll();const d=await api('/cases/'+id);setDetail(d);setSelected(d);setNotice('Case escalated successfully.')
  }
  const nav=[{name:'Overview',icon:LayoutDashboard},{name:'Case queue',icon:ClipboardList}]
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'mobile-open':''}`}>
      <div className="brand"><div className="brand-mark"><Activity size={21}/></div><div><strong>InboundOps</strong><small>INVESTIGATION DESK</small></div><button className="mobile-close icon-btn" onClick={()=>setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{nav.map(n=><button key={n.name} className={`nav-item ${page===n.name?'active':''}`} onClick={()=>{setPage(n.name);setMobileNav(false)}}><n.icon size={18}/><span>{n.name}</span>{n.name==='Case queue'&&<span className="nav-count">{stats?.open_cases||0}</span>}</button>)}</nav>
      <div className="sidebar-section">
        <div className="workspace-label">OPERATIONS</div>
        <button className="nav-item" onClick={()=>{setPage('Case queue');setStatus('Escalated')}}><ShieldAlert size={18}/><span>Escalations</span><span className="nav-count alert">{stats?.escalated_cases||0}</span></button>
        <button className="nav-item" onClick={()=>{setPage('Case queue');setStatus('');setPriority('Critical')}}><CircleAlert size={18}/><span>Critical priority</span></button>
      </div>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><strong>Need a hand?</strong><p>Keep investigation notes clear and actions traceable.</p><span>OPERATIONS PLAYBOOK <ArrowUpRight size={13}/></span></div><div className="user-profile"><div className="avatar">OA</div><div className="user-copy"><strong>Operations Analyst</strong><small>Investigation team</small></div><MoreHorizontal size={18} className="muted"/></div></div>
    </aside>
    {mobileNav&&<div className="mobile-scrim" onClick={()=>setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn menu-btn" onClick={()=>setMobileNav(true)}><Menu size={20}/></button><span className="breadcrumb">Operations <span>/</span> <b>{page}</b></span></div><div className="topbar-actions"><div className="system-status"><span></span> All systems operational</div><button className="icon-btn" title="Notifications" onClick={()=>setNotice('No new notifications.')}><Bell size={18}/></button><div className="top-avatar">OA</div></div></header>
      <div className="page-content">
        {page==='Overview'?<Overview stats={stats} cases={cases} loading={loading} onOpen={openCase} onNew={()=>setShowCreate(true)} onQueue={()=>setPage('Case queue')} onExport={()=>window.location.href=API+'/export.csv'}/>:<Queue cases={cases} loading={loading} search={search} setSearch={setSearch} status={status} setStatus={setStatus} priority={priority} setPriority={setPriority} fc={fc} setFc={setFc} onOpen={openCase} onNew={()=>setShowCreate(true)} onExport={()=>window.location.href=API+'/export.csv'} onReset={()=>{setSearch('');setStatus('');setPriority('');setFc('')}}/>}
      </div>
      <footer className="footer"><span>InboundOps <span className="dot-sep">·</span> Investigation &amp; dispute operations</span><span>Demo environment <span className="footer-dot"></span></span></footer>
    </main>
    {selected&&detail&&<CaseDrawer item={detail} onClose={()=>{setSelected(null);setDetail(null)}} onUpdate={updateCase} onNote={addNote} onEscalate={escalate}/>}
    {showCreate&&<CreateModal onClose={()=>setShowCreate(false)} onCreate={createCase}/>}
    {notice&&<div className="toast"><CheckCircle2 size={17}/><span>{notice}</span><button onClick={()=>setNotice('')}><X size={15}/></button></div>}
  </div>
}

function Overview({stats:s,cases,loading,onOpen,onNew,onQueue,onExport}){
 const urgent=cases.filter(c=>c.status!=='Resolved').slice(0,5)
 return <div className="page-wrap">
  <div className="page-heading"><div><div className="eyebrow">TUESDAY, 13 OCTOBER 2026 <span className="eyebrow-line"/></div><h1>Operations overview</h1><p className="page-subtitle">Monitor investigation performance and keep inbound disputes moving.</p></div><div className="heading-actions"><button className="btn btn-secondary" onClick={onExport}><Download size={16}/> Export report</button><button className="btn btn-primary" onClick={onNew}><Plus size={17}/> New case</button></div></div>
  <div className="insight-banner"><div className="banner-icon"><FileSearch size={21}/></div><div><strong>Investigation desk</strong><p>Review priority cases, capture findings, and escalate blockers before the SLA deadline.</p></div><button onClick={onQueue}>Open case queue <ArrowUpRight size={15}/></button></div>
  <div className="section-head"><div><h2>Performance snapshot</h2><p>Current case queue and resolution health</p></div><span className="live-label"><span/> LIVE METRICS</span></div>
  <div className="kpi-grid">
   <Kpi title="Total cases" value={s?.total_cases??'—'} icon={ClipboardList} tone="blue" foot="All recorded investigations"/>
   <Kpi title="Open cases" value={s?.open_cases??'—'} icon={Clock3} tone="amber" foot="Awaiting final resolution"/>
   <Kpi title="Overdue cases" value={s?.overdue_cases??'—'} icon={CircleAlert} tone="red" foot="Past target resolution date"/>
   <Kpi title="Resolution rate" value={s?`${s.resolution_rate}%`:'—'} icon={CheckCircle2} tone="green" foot={`${s?.resolved_cases??0} cases resolved`}/>
  </div>
  <div className="analytics-grid">
   <div className="panel chart-panel"><div className="panel-heading"><div><h3>Dispute volume by centre</h3><p>Case distribution across fulfilment centres</p></div><span className="panel-tag">BY FC</span></div>
    <div className="chart-area">{s?.by_fc?<ResponsiveContainer width="100%" height="100%"><BarChart data={s.by_fc} margin={{top:10,right:10,left:-18,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f4"/><XAxis dataKey="fc_code" axisLine={false} tickLine={false} tick={{fontSize:12,fill:'#7b8495'}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#7b8495'}} allowDecimals={false}/><Tooltip cursor={{fill:'#f6f8fb'}}/><Bar dataKey="cases" name="Cases" fill="#3867d6" radius={[5,5,0,0]} maxBarSize={42}/></BarChart></ResponsiveContainer>:<div className="chart-empty">Loading chart…</div>}</div>
    <div className="chart-foot"><span><i className="legend-blue"/> Cases per fulfilment centre</span><button onClick={onQueue}>View all <ArrowUpRight size={14}/></button></div>
   </div>
   <div className="panel chart-panel"><div className="panel-heading"><div><h3>Case status breakdown</h3><p>Current workflow distribution</p></div><span className="panel-tag">STATUS</span></div>
    <div className="status-chart">{s?.by_status?<><ResponsiveContainer width="52%" height="100%"><PieChart><Pie data={Object.entries(s.by_status).map(([name,value])=>({name,value}))} dataKey="value" nameKey="name" innerRadius={54} outerRadius={78} paddingAngle={3} stroke="none">{Object.entries(s.by_status).map(([k],i)=><Cell key={k} fill={['#3867d6','#e5a23b','#8a73d6','#2d9a70','#df5b58'][i]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="status-legend">{Object.entries(s.by_status).map(([name,value],i)=><div key={name}><span className="legend-dot" style={{background:['#3867d6','#e5a23b','#8a73d6','#2d9a70','#df5b58'][i]}}/><span>{name}</span><b>{value}</b></div>)}</div></>:<div className="chart-empty">Loading chart…</div>}</div>
   </div>
  </div>
  <div className="section-head section-head-gap"><div><h2>Priority attention</h2><p>Cases requiring timely action</p></div><button className="text-button" onClick={onQueue}>View case queue <ArrowUpRight size={15}/></button></div>
  <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>CASE / SELLER</th><th>FULFILMENT CENTRE</th><th>DISPUTED AMOUNT</th><th>PRIORITY</th><th>STATUS</th><th>SLA DUE</th><th></th></tr></thead><tbody>
   {loading?<tr><td colSpan="7" className="empty-cell">Loading investigation queue…</td></tr>:urgent.map(c=><CaseRow key={c.id} c={c} onOpen={onOpen}/>)}{!loading&&urgent.length===0&&<tr><td colSpan="7" className="empty-cell">No cases match the current filters.</td></tr>}
  </tbody></table></div><div className="table-footer"><span>Showing {urgent.length} active case{urgent.length===1?'':'s'}</span><button className="text-button" onClick={onQueue}>Go to case queue <ArrowUpRight size={14}/></button></div></div>
  <div className="bottom-note"><ShieldAlert size={17}/><span><b>Operational reminder:</b> Document each investigation action and escalate unresolved high-risk cases through the appropriate review path.</span></div>
 </div>
}
function Kpi({title,value,icon:Icon,tone,foot}){return <div className="kpi-card"><div className="kpi-top"><span>{title}</span><span className={`kpi-icon ${tone}`}><Icon size={18}/></span></div><div className="kpi-value">{value}</div><div className="kpi-foot">{foot}</div></div>}
function CaseRow({c,onOpen}){return <tr onClick={()=>onOpen(c)} className="click-row"><td><div className="case-cell"><strong>{c.case_ref}</strong><span>{c.seller_name}</span></div></td><td><span className="fc-chip"><Building2 size={13}/>{c.fc_code}</span></td><td><strong>{money(variance(c))}</strong></td><td><Priority value={c.priority}/></td><td><Status value={c.status}/></td><td><span className={overdue(c)?'due overdue':'due'}>{overdue(c)&&<CircleAlert size={13}/>} {dateFmt(c.due_at)}</span></td><td><button className="row-arrow" onClick={e=>{e.stopPropagation();onOpen(c)}}><ArrowUpRight size={16}/></button></td></tr>}
function Priority({value}){return <span className={`priority p-${value.toLowerCase()}`}><i/>{value}</span>}
function Status({value}){const cls=value.toLowerCase().replace(' ','-');return <span className={`status s-${cls}`}><i/>{value}</span>}
function Queue({cases,loading,search,setSearch,status,setStatus,priority,setPriority,fc,setFc,onOpen,onNew,onExport,onReset}){
 return <div className="page-wrap">
  <div className="page-heading"><div><div className="eyebrow">OPERATIONS <span className="eyebrow-line"/></div><h1>Investigation case queue</h1><p className="page-subtitle">Search, prioritize, and manage payment dispute investigations.</p></div><div className="heading-actions"><button className="btn btn-secondary" onClick={onExport}><Download size={16}/> Export CSV</button><button className="btn btn-primary" onClick={onNew}><Plus size={17}/> New case</button></div></div>
  <div className="queue-summary"><div><span className="summary-icon blue"><ClipboardList size={17}/></span><div><small>Filtered cases</small><strong>{cases.length}</strong></div></div><div><span className="summary-icon amber"><Clock3 size={17}/></span><div><small>Awaiting resolution</small><strong>{cases.filter(c=>c.status!=='Resolved').length}</strong></div></div><div><span className="summary-icon red"><CircleAlert size={17}/></span><div><small>Overdue in view</small><strong>{cases.filter(overdue).length}</strong></div></div></div>
  <div className="panel queue-panel"><div className="filter-bar"><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search case, seller, FC or reason…"/>{search&&<button onClick={()=>setSearch('')}><X size={14}/></button>}</div><div className="filter-selects"><label><Filter size={14}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map(x=><option key={x}>{x}</option>)}</select></label><label><select value={priority} onChange={e=>setPriority(e.target.value)}><option value="">All priorities</option>{PRIORITIES.map(x=><option key={x}>{x}</option>)}</select></label><label><select value={fc} onChange={e=>setFc(e.target.value)}><option value="">All centres</option>{FCS.map(x=><option key={x}>{x}</option>)}</select></label><button className="reset-btn" onClick={onReset}>Reset</button></div></div>
   <div className="table-scroll"><table><thead><tr><th>CASE / SELLER</th><th>FULFILMENT CENTRE</th><th>DISPUTE REASON</th><th>AMOUNT AT RISK</th><th>PRIORITY</th><th>STATUS</th><th>SLA DUE</th><th></th></tr></thead><tbody>
   {loading?<tr><td colSpan="8" className="empty-cell">Loading cases…</td></tr>:cases.map(c=><tr key={c.id} onClick={()=>onOpen(c)} className="click-row"><td><div className="case-cell"><strong>{c.case_ref}</strong><span>{c.seller_name}</span></div></td><td><span className="fc-chip"><Building2 size={13}/>{c.fc_code}</span></td><td><span className="reason-text">{c.reason}</span></td><td><strong>{money(variance(c))}</strong></td><td><Priority value={c.priority}/></td><td><Status value={c.status}/></td><td><span className={overdue(c)?'due overdue':'due'}>{overdue(c)&&<CircleAlert size={13}/>} {dateFmt(c.due_at)}</span></td><td><button className="row-arrow" onClick={e=>{e.stopPropagation();onOpen(c)}}><ArrowUpRight size={16}/></button></td></tr>)}
   {!loading&&cases.length===0&&<tr><td colSpan="8" className="empty-cell"><div className="empty-state"><Search size={25}/><strong>No matching cases</strong><span>Try adjusting your filters or search term.</span><button className="btn btn-secondary" onClick={onReset}>Clear filters</button></div></td></tr>}
   </tbody></table></div><div className="table-footer"><span>{cases.length} case{cases.length===1?'':'s'} found</span><span>Amounts shown in INR <span className="dot-sep">·</span> Select a case to investigate</span></div>
  </div>
 </div>
}
function CaseDrawer({item,onClose,onUpdate,onNote,onEscalate}){
 const [tab,setTab]=useState('Investigation');const [note,setNote]=useState('');const [showEsc,setShowEsc]=useState(false);const [escReason,setEscReason]=useState('');const [escLevel,setEscLevel]=useState('L2');const [escTeam,setEscTeam]=useState('Inbound Support');const [busy,setBusy]=useState(false)
 useEffect(()=>{setTab('Investigation');setNote('');setShowEsc(false)},[item.id])
 async function submitNote(){if(!note.trim())return;setBusy(true);try{await onNote(item.id,note.trim());setNote('')}catch(e){}finally{setBusy(false)}}
 async function submitEsc(){if(!escReason.trim())return;setBusy(true);try{await onEscalate(item.id,{reason:escReason,level:escLevel,assigned_team:escTeam});setShowEsc(false);setEscReason('')}catch(e){}finally{setBusy(false)}}
 return <div className="drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><aside className="case-drawer"><div className="drawer-header"><div><span className="drawer-eyebrow">INVESTIGATION RECORD</span><h2>{item.case_ref}</h2><p>{item.seller_name} <span>·</span> {item.seller_id}</p></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>
  <div className="drawer-scroll"><div className="drawer-status-row"><Status value={item.status}/><Priority value={item.priority}/><span className={overdue(item)?'due overdue':'due'}>{overdue(item)?'SLA overdue':'Due'} {dateFmt(item.due_at)}</span></div>
   <div className="amount-card"><div><span>AMOUNT AT RISK</span><strong>{money(variance(item))}</strong><small>Expected {money(item.expected_amount)} <span>·</span> Actual {money(item.actual_amount)}</small></div><div className="amount-icon"><ArrowDownRight size={21}/></div></div>
   <div className="detail-grid"><Detail label="Fulfilment centre" value={item.fc_code} icon={Building2}/><Detail label="Dispute reason" value={item.reason} icon={FileSearch}/><Detail label="Assigned owner" value={item.owner} icon={UserRound}/><Detail label="Created on" value={dateFmt(item.created_at)} icon={CalendarDays}/></div>
   <div className="detail-section"><h3>Case summary</h3><p>{item.summary}</p></div>
   <div className="drawer-tabs"><button className={tab==='Investigation'?'active':''} onClick={()=>setTab('Investigation')}>Investigation</button><button className={tab==='Activity'?'active':''} onClick={()=>setTab('Activity')}>Activity <span>{item.activity?.length||0}</span></button><button className={tab==='Escalations'?'active':''} onClick={()=>setTab('Escalations')}>Escalations <span>{item.escalations?.length||0}</span></button></div>
   {tab==='Investigation'&&<div className="investigation-tab">
    <div className="field-row"><label>Status<select value={item.status} onChange={e=>onUpdate(item.id,{status:e.target.value})}>{STATUSES.map(x=><option key={x}>{x}</option>)}</select></label><label>Priority<select value={item.priority} onChange={e=>onUpdate(item.id,{priority:e.target.value})}>{PRIORITIES.map(x=><option key={x}>{x}</option>)}</select></label></div>
    <label className="field-label">Assigned owner<input value={item.owner||''} onChange={e=>onUpdate(item.id,{owner:e.target.value})} onBlur={e=>onUpdate(item.id,{owner:e.target.value})}/></label>
    <div className="note-composer"><label htmlFor="investigation-note">Investigation note</label><textarea id="investigation-note" rows="3" value={note} onChange={e=>setNote(e.target.value)} placeholder="Record evidence checked, findings, blockers, and next action…"/><div className="composer-footer"><span><MessageSquareText size={13}/> Notes are recorded in the activity history</span><button className="btn btn-primary btn-small" disabled={!note.trim()||busy} onClick={submitNote}><Send size={14}/> Add note</button></div></div>
    <button className="escalate-button" onClick={()=>setShowEsc(!showEsc)}><ShieldAlert size={16}/> Escalate this case <ArrowUpRight size={14}/></button>
    {showEsc&&<div className="escalation-form"><label>Escalation level<select value={escLevel} onChange={e=>setEscLevel(e.target.value)}><option>L1</option><option>L2</option><option>L3</option></select></label><label>Assigned team<select value={escTeam} onChange={e=>setEscTeam(e.target.value)}><option>Inbound Support</option><option>Payments Operations</option><option>Fulfilment Centre Team</option><option>Partner Support</option><option>Technical Support</option></select></label><label>Reason<textarea rows="2" value={escReason} onChange={e=>setEscReason(e.target.value)} placeholder="Explain why escalation is required…"/></label><button className="btn btn-primary" disabled={!escReason.trim()||busy} onClick={submitEsc}>Submit escalation</button></div>}
    {item.status==='Resolved'&&<div className="resolved-note"><CheckCircle2 size={17}/> This case is marked as resolved.</div>}
   </div>}
   {tab==='Activity'&&<div className="timeline">{(item.activity||[]).map(a=><div className="timeline-item" key={a.id}><div className="timeline-icon"><Activity size={14}/></div><div><strong>{a.action}</strong><p>{a.note}</p><small>{a.actor} <span>·</span> {dateTime(a.created_at)}</small></div></div>)}</div>}
   {tab==='Escalations'&&<div className="timeline">{(item.escalations||[]).length?(item.escalations||[]).map(a=><div className="timeline-item" key={a.id}><div className="timeline-icon red"><ShieldAlert size={14}/></div><div><strong>{a.level} escalation <span className="mini-status">{a.status}</span></strong><p>{a.reason}</p><small>{a.assigned_team} <span>·</span> {dateTime(a.created_at)}</small></div></div>):<div className="empty-state compact"><ShieldAlert size={24}/><strong>No escalations recorded</strong><span>Escalation history will appear here.</span></div>}</div>}
  </div><div className="drawer-footer"><button className="btn btn-secondary" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={()=>onUpdate(item.id,{status:'Resolved',resolution:'Reviewed and marked resolved'})}><Check size={16}/> Mark resolved</button></div></aside></div>
}
function Detail({label,value,icon:Icon}){return <div className="detail-item"><span className="detail-icon"><Icon size={15}/></span><div><small>{label}</small><strong>{value||'Unassigned'}</strong></div></div>}
function CreateModal({onClose,onCreate}){
 const [form,setForm]=useState({seller_name:'',seller_id:'',fc_code:'BLR7',reason:'Short payment',expected_amount:'',actual_amount:'',priority:'Medium',owner:'Unassigned',summary:'',due_at:new Date(Date.now()+48*3600000).toISOString().slice(0,16)})
 const [error,setError]=useState('');const [busy,setBusy]=useState(false)
 const set=(k,v)=>setForm(p=>({...p,[k]:v}))
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{await onCreate({...form,expected_amount:Number(form.expected_amount),actual_amount:Number(form.actual_amount),due_at:new Date(form.due_at).toISOString()})}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="create-modal"><div className="modal-heading"><div><span className="drawer-eyebrow">CASE MANAGEMENT</span><h2>Create investigation case</h2><p>Add a new payment dispute to the operations queue.</p></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>
 <form onSubmit={submit}><div className="form-grid"><label>Seller / partner name *<input required value={form.seller_name} onChange={e=>set('seller_name',e.target.value)} placeholder="e.g. Acme Retail"/></label><label>Seller ID *<input required value={form.seller_id} onChange={e=>set('seller_id',e.target.value)} placeholder="e.g. SEL-1001"/></label><label>Fulfilment centre *<select value={form.fc_code} onChange={e=>set('fc_code',e.target.value)}>{FCS.map(x=><option key={x}>{x}</option>)}</select></label><label>Dispute reason *<select value={form.reason} onChange={e=>set('reason',e.target.value)}>{REASONS.map(x=><option key={x}>{x}</option>)}</select></label><label>Expected amount (₹) *<input required type="number" min="0" step="0.01" value={form.expected_amount} onChange={e=>set('expected_amount',e.target.value)} placeholder="0.00"/></label><label>Actual amount (₹) *<input required type="number" min="0" step="0.01" value={form.actual_amount} onChange={e=>set('actual_amount',e.target.value)} placeholder="0.00"/></label><label>Priority<select value={form.priority} onChange={e=>set('priority',e.target.value)}>{PRIORITIES.map(x=><option key={x}>{x}</option>)}</select></label><label>Assigned owner<input value={form.owner} onChange={e=>set('owner',e.target.value)} placeholder="Unassigned"/></label><label className="full-field">SLA due date &amp; time *<input required type="datetime-local" value={form.due_at} onChange={e=>set('due_at',e.target.value)}/></label><label className="full-field">Case summary / initial findings *<textarea required rows="3" value={form.summary} onChange={e=>set('summary',e.target.value)} placeholder="Describe the discrepancy and initial evidence…"/></label></div>{error&&<div className="form-error"><AlertTriangle size={15}/>{error}</div>}<div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy}><Plus size={16}/>{busy?'Creating…':'Create case'}</button></div></form></div></div>
}
createRoot(document.getElementById('root')).render(<App/>)
