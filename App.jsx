import { useState, useRef, useEffect } from "react";

const MODEL = "claude-sonnet-4-20250514";

/* ─── utils ─────────────────────────────────────────────────────────── */
function daysFromNow(n) { const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; }
function todayStr() { return new Date().toISOString().split("T")[0]; }
function daysLeft(s) { return Math.ceil((new Date(s)-new Date())/86400000); }
function expiryColor(s) { const d=daysLeft(s); return d<=3?"#C53030":d<=7?"#B7791F":"#276749"; }
function expiryLabel(s) { const d=daysLeft(s); if(d<=0)return"Abgelaufen"; if(d===1)return"Morgen"; return`${d} Tage`; }
function greet(name) {
  const h=new Date().getHours();
  const g = h<12?"Guten Morgen":h<18?"Guten Tag":"Guten Abend";
  return name ? `${g}, ${name}` : g;
}
function loadProfile() {
  try { const r=localStorage.getItem("freshly_profile"); return r?JSON.parse(r):null; } catch { return null; }
}
function saveProfile(p) { try { localStorage.setItem("freshly_profile",JSON.stringify(p)); } catch {} }

/* ─── seed ───────────────────────────────────────────────────────────── */
const SEED_ITEMS = [
  {id:1,name:"Vollmilch",cat:"Milchprodukte",qty:"1",unit:"L",expiry:daysFromNow(3),added:todayStr()},
  {id:2,name:"Emmentaler",cat:"Milchprodukte",qty:"200",unit:"g",expiry:daysFromNow(12),added:todayStr()},
  {id:3,name:"Bio-Eier",cat:"Milchprodukte",qty:"6",unit:"Stk",expiry:daysFromNow(20),added:todayStr()},
  {id:4,name:"Hühnerbrust",cat:"Fleisch",qty:"500",unit:"g",expiry:daysFromNow(2),added:todayStr()},
  {id:5,name:"Spaghetti",cat:"Pasta & Reis",qty:"400",unit:"g",expiry:daysFromNow(365),added:todayStr()},
  {id:6,name:"Tomatensauce",cat:"Konserven",qty:"2",unit:"Dosen",expiry:daysFromNow(180),added:todayStr()},
  {id:7,name:"Zwiebeln",cat:"Gemüse",qty:"3",unit:"Stk",expiry:daysFromNow(14),added:todayStr()},
  {id:8,name:"Knoblauch",cat:"Gemüse",qty:"1",unit:"Kopf",expiry:daysFromNow(30),added:todayStr()},
  {id:9,name:"Olivenöl",cat:"Öle",qty:"500",unit:"ml",expiry:daysFromNow(365),added:todayStr()},
  {id:10,name:"Joghurt Natur",cat:"Milchprodukte",qty:"2",unit:"Stk",expiry:daysFromNow(7),added:todayStr()},
];
const SEED_RECIPES = [{
  id:1, name:"Spaghetti Aglio e Olio", time:20, diff:"Einfach", diet:"vegetarisch",
  ing:["400g Spaghetti","4 Knoblauchzehen","6 EL Olivenöl","Peperoncino","Salz"],
  steps:["Spaghetti in reichlich Salzwasser bissfest kochen.","Knoblauch in Scheiben in Olivenöl goldbraun braten.","Peperoncino kurz mitrösten.","Pasta abgiessen, mit Öl und etwas Kochwasser vermengen."],
  gen:false
}];

/* ─── tokens ─────────────────────────────────────────────────────────── */
const C = {
  bg:"#F9F7F3", card:"#FFFFFF", card2:"#F2EFE9", border:"#E9E4DC",
  text:"#1A1714", sub:"#7C746C",
  green:"#2D7D46", greenL:"#EBF5EE", greenM:"#C6E6CE",
  orange:"#C05621", orangeL:"#FEF0E7",
  red:"#C53030", redL:"#FEF2F2",
  amber:"#B7791F", purple:"#6B46C1",
};

/* ─── icons ──────────────────────────────────────────────────────────── */
const ICONS = {
  home:"M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z M9 21V12h6v9",
  pantry:"M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12",
  chef:"M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z M9 21h6",
  settings:"M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  plus:"M12 5v14M5 12h14",
  trash:"M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2",
  edit:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  clock:"M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z M12 6v6l4 2",
  fire:"M12 23c-4.97 0-9-3.58-9-8 0-3.31 1.99-5.86 4-7.5.29 1.77 1.5 3.37 3 4 0-3 1.5-5.5 4-7 0 3 2 5.5 2 8 1.19-.75 2-2.16 2-3.5 1.16 1.29 2 3.2 2 5 0 4.42-4.03 9-8 9z",
  x:"M18 6L6 18M6 6l12 12",
  sparkle:"M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z",
  leaf:"M2 22c3-3 6-8 6-13 3 0 7 2 9 5-1-3 0-6 2-8 1 6-1 11-5 14-1 1-2 2-4 2H2z",
  camera:"M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8z",
  warning:"M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  search:"M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
  check:"M20 6L9 17l-5-5",
  receipt:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4",
  star:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  info:"M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z M12 8v4M12 16h.01",
  user:"M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  arrow:"M5 12h14M12 5l7 7-7 7",
  mic:"M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8",
  micoff:"M1 1l22 22M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8",
};
function Ic({ n, s=22, col="currentColor", sw=1.8 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke={col} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{flexShrink:0}}>
      <path d={ICONS[n]||""} />
    </svg>
  );
}

/* ─── small components ───────────────────────────────────────────────── */
function Chip({ icon, text, col }) {
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:5,background:`${col}18`,border:`1px solid ${col}30`,borderRadius:20,padding:"4px 10px"}}>
      {icon && <Ic n={icon} s={11} col={col} />}
      <span style={{fontSize:11,fontWeight:700,color:col}}>{text}</span>
    </div>
  );
}
function SectionLabel({ icon, col, label }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
      <Ic n={icon} s={14} col={col} />
      <span style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:"0.09em"}}>{label}</span>
    </div>
  );
}
function FL({ children }) {
  return <div style={{fontSize:12,fontWeight:700,color:C.sub,marginBottom:6}}>{children}</div>;
}
function ErrBox({ msg }) {
  return <div style={{background:C.redL,border:`1px solid ${C.red}30`,borderRadius:12,padding:"11px 14px",fontSize:13,color:C.red,marginBottom:14,lineHeight:1.5}}>{msg}</div>;
}
function IS(small) {
  return {width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:small?"10px":"12px 13px",fontSize:small?12:14,outline:"none",color:C.text,fontFamily:"inherit"};
}
function PBtn({ onClick, text, col, disabled, loading }) {
  return (
    <button onClick={onClick} disabled={disabled||loading} className="tap"
      style={{width:"100%",background:(disabled||loading)?C.card2:col,border:"none",borderRadius:14,padding:"15px",fontSize:14,fontWeight:800,color:(disabled||loading)?C.sub:"#fff",cursor:(disabled||loading)?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:(disabled||loading)?"none":`0 3px 12px ${col}35`,transition:"all .2s"}}>
      {loading ? <><Spin white /><span>Lädt…</span></> : text}
    </button>
  );
}
function Spin({ white }) {
  return <div style={{width:18,height:18,border:`2.5px solid ${white?"rgba(255,255,255,0.3)":C.border}`,borderTopColor:white?"#fff":C.green,borderRadius:"50%",animation:"spin 0.9s linear infinite"}} />;
}

/* ─── sheet ──────────────────────────────────────────────────────────── */
function Sheet({ onClose, title, children }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"flex-end",background:"rgba(0,0,0,0.32)",backdropFilter:"blur(8px)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="slide-up" style={{width:"100%",maxWidth:430,margin:"0 auto",background:C.card,borderRadius:"24px 24px 0 0",padding:`20px 20px calc(24px + env(safe-area-inset-bottom,0px))`,maxHeight:"92dvh",overflowY:"auto",boxShadow:"0 -8px 32px rgba(0,0,0,0.10)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:17,fontWeight:800}}>{title}</div>
          <button onClick={onClose} className="tap" style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"7px",cursor:"pointer",display:"flex"}}>
            <Ic n="x" s={16} col={C.sub} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── bottom nav ─────────────────────────────────────────────────────── */
function BottomNav({ tab, setTab }) {
  const tabs = [
    {id:"home",icon:"home",label:"Start"},
    {id:"pantry",icon:"pantry",label:"Vorrat"},
    {id:"recipes",icon:"chef",label:"Rezepte"},
    {id:"settings",icon:"settings",label:"Einstellungen"},
  ];
  return (
    <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",paddingBottom:"env(safe-area-inset-bottom,0px)",zIndex:50,boxShadow:"0 -1px 14px rgba(0,0,0,0.06)"}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} className="tap"
          style={{flex:1,padding:"12px 4px 10px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <Ic n={t.icon} s={22} col={tab===t.id?C.green:C.sub} />
          <span style={{fontSize:10,fontWeight:700,color:tab===t.id?C.green:C.sub}}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ONBOARDING
════════════════════════════════════════════════════════════════════════ */
const DIET_OPTIONS = [
  {id:"alles",   label:"Alles",         emoji:"🍽️"},
  {id:"vegetarisch", label:"Vegetarisch", emoji:"🥦"},
  {id:"vegan",   label:"Vegan",         emoji:"🌱"},
  {id:"glutenfrei",  label:"Glutenfrei",  emoji:"🌾"},
  {id:"laktosefrei", label:"Laktosefrei", emoji:"🥛"},
];
const SUPERMARKT_OPTIONS = [
  {id:"migros",  label:"Migros",  emoji:"🟠"},
  {id:"coop",    label:"Coop",    emoji:"🔴"},
  {id:"lidl",    label:"Lidl",    emoji:"🔵"},
  {id:"aldi",    label:"Aldi",    emoji:"🟡"},
  {id:"andere",  label:"Andere",  emoji:"🛒"},
];

function Onboarding({ onDone }) {
  const [step, setStep] = useState(0); // 0=name, 1=diet, 2=supermarkt
  const [name, setName] = useState("");
  const [diet, setDiet] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [err, setErr] = useState("");

  function toggleArr(arr, setArr, id) {
    setArr(a => a.includes(id) ? a.filter(x=>x!==id) : [...a,id]);
  }

  function next() {
    if (step===0 && !name.trim()) { setErr("Bitte gib deinen Namen ein."); return; }
    setErr("");
    if (step < 2) { setStep(s=>s+1); return; }
    onDone({ name:name.trim(), diet, markets });
  }

  const steps = ["Willkommen", "Ernährung", "Supermärkte"];

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:C.bg,display:"flex",flexDirection:"column",fontFamily:"'Outfit',sans-serif"}}>
      <div style={{height:"env(safe-area-inset-top,44px)",background:C.bg}} />

      {/* progress */}
      <div style={{padding:"20px 24px 0"}}>
        <div style={{display:"flex",gap:6,marginBottom:32}}>
          {steps.map((_,i)=>(
            <div key={i} style={{flex:1,height:3,borderRadius:10,background:i<=step?C.green:C.border,transition:"background .3s"}} />
          ))}
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"0 24px"}}>
        {/* Step 0: Name */}
        {step===0 && (
          <div className="fu">
            <div style={{marginBottom:32}}>
              <div style={{fontSize:32,fontWeight:900,letterSpacing:"-1px",lineHeight:1.1,marginBottom:8}}>
                Hallo bei <span style={{color:C.green}}>freshly</span> 👋
              </div>
              <div style={{fontSize:15,color:C.sub,lineHeight:1.6}}>
                Dein smarter Küchen-Assistent für den Schweizer Alltag.
              </div>
            </div>
            <FL>Wie heisst du?</FL>
            {err && <ErrBox msg={err} />}
            <input
              value={name}
              onChange={e=>{setName(e.target.value);setErr("");}}
              placeholder="Dein Vorname"
              autoFocus
              style={{...IS(false),marginBottom:12,fontSize:18,fontWeight:700}}
            />
            <div style={{fontSize:12,color:C.sub,marginBottom:32}}>Wird lokal gespeichert, nur für die persönliche Begrüssung.</div>

            {/* feature preview */}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[
                {icon:"receipt",text:"Kassenzettel fotografieren & KI liest Lebensmittel aus",col:C.orange},
                {icon:"sparkle",text:"KI generiert Rezepte aus deinem Vorrat",col:C.purple},
                {icon:"fire",text:"Ablaufdatum-Warnungen damit nichts verschwendet wird",col:C.red},
              ].map(f=>(
                <div key={f.text} style={{display:"flex",alignItems:"center",gap:12,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 14px"}}>
                  <div style={{background:`${f.col}15`,borderRadius:10,padding:"8px",flexShrink:0}}>
                    <Ic n={f.icon} s={18} col={f.col} />
                  </div>
                  <div style={{fontSize:13,color:C.text,lineHeight:1.4}}>{f.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Diet */}
        {step===1 && (
          <div className="fu">
            <div style={{marginBottom:28}}>
              <div style={{fontSize:28,fontWeight:900,letterSpacing:"-0.5px",marginBottom:8}}>Ernährungsweise</div>
              <div style={{fontSize:14,color:C.sub}}>Was passt zu dir? Mehrfachauswahl möglich.</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {DIET_OPTIONS.map(d=>{
                const sel = diet.includes(d.id);
                return (
                  <button key={d.id} onClick={()=>toggleArr(diet,setDiet,d.id)} className="tap"
                    style={{background:sel?C.greenL:C.card,border:`2px solid ${sel?C.green:C.border}`,borderRadius:16,padding:"16px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"all .15s"}}>
                    <span style={{fontSize:24}}>{d.emoji}</span>
                    <span style={{fontSize:15,fontWeight:700,color:sel?C.green:C.text}}>{d.label}</span>
                    {sel && <div style={{marginLeft:"auto"}}><Ic n="check" s={18} col={C.green} sw={2.5} /></div>}
                  </button>
                );
              })}
            </div>
            <div style={{fontSize:12,color:C.sub,marginTop:12}}>Du kannst das jederzeit in den Einstellungen ändern.</div>
          </div>
        )}

        {/* Step 2: Supermarkt */}
        {step===2 && (
          <div className="fu">
            <div style={{marginBottom:28}}>
              <div style={{fontSize:28,fontWeight:900,letterSpacing:"-0.5px",marginBottom:8}}>Deine Supermärkte</div>
              <div style={{fontSize:14,color:C.sub}}>Wo kaufst du hauptsächlich ein?</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {SUPERMARKT_OPTIONS.map(m=>{
                const sel = markets.includes(m.id);
                return (
                  <button key={m.id} onClick={()=>toggleArr(markets,setMarkets,m.id)} className="tap"
                    style={{background:sel?C.greenL:C.card,border:`2px solid ${sel?C.green:C.border}`,borderRadius:16,padding:"18px 14px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
                    <span style={{fontSize:28}}>{m.emoji}</span>
                    <span style={{fontSize:14,fontWeight:700,color:sel?C.green:C.text}}>{m.label}</span>
                    {sel && <Ic n="check" s={16} col={C.green} sw={2.5} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* bottom button */}
      <div style={{padding:`16px 24px calc(20px + env(safe-area-inset-bottom,0px))`,background:C.bg,borderTop:`1px solid ${C.border}`}}>
        <button onClick={next} className="tap"
          style={{width:"100%",background:`linear-gradient(135deg,${C.green},#1a5c32)`,border:"none",borderRadius:16,padding:"16px",fontSize:16,fontWeight:800,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:`0 4px 18px ${C.green}38`,fontFamily:"inherit"}}>
          <span>{step<2?"Weiter":"Los geht's"}</span>
          <Ic n="arrow" s={18} col="#fff" />
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   HOME TAB
════════════════════════════════════════════════════════════════════════ */
function HomeTab({ items, recipes, soon, setTab, setModal, profile }) {
  const daily = recipes[0] || null;
  return (
    <div style={{padding:"20px 20px 0"}} className="fu">
      <div style={{marginBottom:20}}>
        <SectionLabel icon="star" col={C.amber} label="Tagesrezept" />
        {daily ? (
          <div onClick={()=>setModal({type:"view",data:daily})} className="tap"
            style={{background:`linear-gradient(135deg,${C.green},#1a5c32)`,borderRadius:20,padding:"20px",cursor:"pointer",boxShadow:`0 6px 24px ${C.green}40`,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",right:-20,top:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.07)"}} />
            <div style={{position:"absolute",right:10,bottom:-30,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}} />
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Heute empfohlen</div>
            <div style={{fontSize:20,fontWeight:800,color:"#fff",marginBottom:10,lineHeight:1.2}}>{daily.name}</div>
            <div style={{display:"flex",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.15)",borderRadius:20,padding:"5px 10px"}}>
                <Ic n="clock" s={13} col="rgba(255,255,255,0.9)" />
                <span style={{fontSize:12,color:"rgba(255,255,255,0.9)",fontWeight:600}}>{daily.time} Min</span>
              </div>
              {daily.diet && (
                <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.15)",borderRadius:20,padding:"5px 10px"}}>
                  <Ic n="leaf" s={13} col="rgba(255,255,255,0.9)" />
                  <span style={{fontSize:12,color:"rgba(255,255,255,0.9)",fontWeight:600}}>{daily.diet}</span>
                </div>
              )}
            </div>
            <div style={{marginTop:10,fontSize:12,color:"rgba(255,255,255,0.6)"}}>{daily.ing.slice(0,3).join(" · ")}</div>
          </div>
        ) : (
          <div onClick={()=>setModal({type:"ai"})} className="tap"
            style={{background:C.greenL,border:`1.5px dashed ${C.greenM}`,borderRadius:20,padding:"24px",textAlign:"center",cursor:"pointer"}}>
            <Ic n="sparkle" s={28} col={C.green} />
            <div style={{fontSize:14,fontWeight:700,color:C.green,marginTop:8}}>KI-Rezept generieren</div>
            <div style={{fontSize:12,color:C.sub,marginTop:4}}>Noch kein Tagesrezept</div>
          </div>
        )}
      </div>

      {soon.length>0 && (
        <div style={{marginBottom:20}}>
          <SectionLabel icon="fire" col={C.red} label="Läuft bald ab" />
          {soon.slice(0,3).map((item,i)=>(
            <div key={item.id} className="fu" style={{animationDelay:`${i*0.06}s`,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>{item.name}</div>
                <div style={{fontSize:11,color:expiryColor(item.expiry),fontWeight:700,marginTop:2}}>{expiryLabel(item.expiry)}</div>
              </div>
              <div style={{background:`${expiryColor(item.expiry)}18`,border:`1px solid ${expiryColor(item.expiry)}30`,borderRadius:20,padding:"4px 10px"}}>
                <span style={{fontSize:12,color:expiryColor(item.expiry),fontWeight:700}}>{item.qty} {item.unit}</span>
              </div>
            </div>
          ))}
          {soon.length>3 && (
            <button onClick={()=>setTab("pantry")} className="tap"
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px",fontSize:13,fontWeight:600,color:C.sub,cursor:"pointer",fontFamily:"inherit"}}>
              +{soon.length-3} weitere ansehen
            </button>
          )}
        </div>
      )}

      <div style={{marginBottom:20}}>
        <SectionLabel icon="pantry" col={C.sub} label="Übersicht" />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div onClick={()=>setTab("recipes")} className="tap"
            style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <Ic n="chef" s={22} col={C.green} />
            <div style={{fontSize:28,fontWeight:900,letterSpacing:"-1px",marginTop:8,color:C.text}}>{recipes.length}</div>
            <div style={{fontSize:12,color:C.sub,fontWeight:600,marginTop:2}}>Rezepte</div>
          </div>
          <div onClick={()=>setModal({type:"receipt"})} className="tap"
            style={{background:`linear-gradient(135deg,${C.orange},#9C4221)`,border:"none",borderRadius:16,padding:"16px",cursor:"pointer",boxShadow:`0 4px 16px ${C.orange}30`,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",right:-10,bottom:-10,width:60,height:60,borderRadius:"50%",background:"rgba(255,255,255,0.1)"}} />
            <Ic n="receipt" s={22} col="#fff" />
            <div style={{fontSize:14,fontWeight:800,color:"#fff",marginTop:8}}>Kassenzettel</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.75)",marginTop:2}}>Mit Kamera scannen</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   PANTRY TAB
════════════════════════════════════════════════════════════════════════ */
function PantryTab({ items, removeItem, setModal }) {
  const [q,setQ]=useState("");
  const [cat,setCat]=useState("all");
  const cats=["all",...new Set(items.map(i=>i.cat))];
  const list=items
    .filter(i=>(cat==="all"||i.cat===cat)&&i.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a,b)=>daysLeft(a.expiry)-daysLeft(b.expiry));
  return (
    <div className="fu">
      <div style={{padding:"14px 20px 0"}}>
        <div style={{display:"flex",gap:8,marginBottom:11}}>
          <div style={{flex:1,position:"relative",display:"flex",alignItems:"center"}}>
            <div style={{position:"absolute",left:11,pointerEvents:"none",display:"flex"}}><Ic n="search" s={16} col={C.sub} /></div>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Suchen…"
              style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 12px 11px 36px",fontSize:14,outline:"none",fontFamily:"inherit",color:C.text}} />
          </div>
          <button onClick={()=>setModal({type:"receipt"})} className="tap"
            style={{background:C.green,border:"none",borderRadius:12,padding:"0 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,boxShadow:`0 2px 8px ${C.green}30`}}>
            <Ic n="receipt" s={17} col="#fff" />
          </button>
          <button onClick={()=>setModal({type:"voice"})} className="tap"
            style={{background:"#6B46C1",border:"none",borderRadius:12,padding:"0 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,boxShadow:"0 2px 8px #6B46C130"}}>
            <Ic n="mic" s={17} col="#fff" />
          </button>
          <button onClick={()=>setModal({type:"addItem"})} className="tap"
            style={{background:C.orange,border:"none",borderRadius:12,padding:"0 13px",cursor:"pointer",display:"flex",alignItems:"center",boxShadow:`0 2px 8px ${C.orange}30`}}>
            <Ic n="plus" s={20} col="#fff" />
          </button>
        </div>
        <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:12}}>
          {cats.map(ct=>(
            <button key={ct} onClick={()=>setCat(ct)} className="tap"
              style={{flexShrink:0,background:cat===ct?C.green:C.card,border:`1px solid ${cat===ct?C.green:C.border}`,borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,color:cat===ct?"#fff":C.sub,cursor:"pointer",fontFamily:"inherit"}}>
              {ct==="all"?"Alle":ct}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:"0 20px"}}>
        {list.length===0 && <div style={{textAlign:"center",padding:"50px 0"}}><Ic n="pantry" s={40} col={C.border} /><div style={{color:C.sub,fontSize:14,marginTop:12}}>Nichts gefunden.</div></div>}
        {list.map((item,i)=>(
          <div key={item.id} className="fu" style={{animationDelay:`${i*0.04}s`,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
              <div style={{fontSize:12,color:C.sub,marginTop:1}}>{item.cat} · {item.qty} {item.unit}</div>
              <div style={{marginTop:6,display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:expiryColor(item.expiry),flexShrink:0}} />
                <span style={{fontSize:11,color:expiryColor(item.expiry),fontWeight:700}}>{expiryLabel(item.expiry)}</span>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginLeft:10}}>
              <button onClick={()=>setModal({type:"addItem",edit:item})} className="tap" style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px",cursor:"pointer",display:"flex"}}><Ic n="edit" s={15} col={C.sub} /></button>
              <button onClick={()=>removeItem(item.id)} className="tap" style={{background:C.redL,border:`1px solid ${C.red}25`,borderRadius:9,padding:"8px",cursor:"pointer",display:"flex"}}><Ic n="trash" s={15} col={C.red} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   RECIPES TAB
════════════════════════════════════════════════════════════════════════ */
function RecipesTab({ recipes, items, setModal }) {
  const [diet,setDiet]=useState("all");
  const diets=["all","vegetarisch","vegan","fleisch"];
  const list=recipes.filter(r=>diet==="all"||r.diet===diet);
  const hasEnough=items.length>=3;
  return (
    <div className="fu">
      <div style={{padding:"14px 20px 0"}}>
        {hasEnough ? (
          <button onClick={()=>setModal({type:"ai"})} className="tap"
            style={{width:"100%",background:`linear-gradient(135deg,${C.green},#1a5c32)`,border:"none",borderRadius:16,padding:"17px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10,boxShadow:`0 4px 18px ${C.green}38`,fontFamily:"inherit"}}>
            <Ic n="sparkle" s={20} col="#fff" />
            <span style={{fontSize:15,fontWeight:800,color:"#fff"}}>KI-Rezept aus meinem Vorrat</span>
          </button>
        ) : (
          <div style={{background:C.orangeL,border:`1.5px solid ${C.orange}30`,borderRadius:16,padding:"16px",marginBottom:10,display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{marginTop:2}}><Ic n="info" s={18} col={C.orange} /></div>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:C.orange,marginBottom:4}}>Zu wenig Zutaten</div>
              <div style={{fontSize:13,color:C.sub,lineHeight:1.6}}>Du hast erst <strong>{items.length}</strong> {items.length===1?"Produkt":"Produkte"} im Vorrat. Füge mindestens 3 hinzu.</div>
            </div>
          </div>
        )}
        <button onClick={()=>setModal({type:"addRecipe"})} className="tap"
          style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:"12px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",fontFamily:"inherit"}}>
          <Ic n="plus" s={17} col={C.orange} />
          <span style={{fontSize:13,fontWeight:700}}>Eigenes Rezept hinzufügen</span>
        </button>
        <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:12}}>
          {diets.map(d=>(
            <button key={d} onClick={()=>setDiet(d)} className="tap"
              style={{flexShrink:0,background:diet===d?C.orange:C.card,border:`1px solid ${diet===d?C.orange:C.border}`,borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,color:diet===d?"#fff":C.sub,cursor:"pointer",fontFamily:"inherit"}}>
              {d==="all"?"Alle":d.charAt(0).toUpperCase()+d.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:"0 20px"}}>
        {list.length===0 && <div style={{textAlign:"center",padding:"50px 0"}}><Ic n="chef" s={40} col={C.border} /><div style={{color:C.sub,fontSize:14,marginTop:12}}>Noch keine Rezepte.</div></div>}
        {list.map((r,i)=>(
          <div key={r.id} onClick={()=>setModal({type:"view",data:r})} className="fu tap"
            style={{animationDelay:`${i*0.05}s`,background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",marginBottom:10,cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>{r.name}</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              <Chip icon="clock" text={`${r.time} Min`} col={C.orange} />
              <Chip text={r.diff} col={C.sub} />
              {r.diet && <Chip icon="leaf" text={r.diet} col={C.green} />}
              {r.gen && <Chip icon="sparkle" text="KI" col={C.purple} />}
            </div>
            <div style={{marginTop:10,fontSize:12,color:C.sub,lineHeight:1.5}}>
              {r.ing.slice(0,4).join(" · ")}{r.ing.length>4?` +${r.ing.length-4}`:""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   SETTINGS TAB
════════════════════════════════════════════════════════════════════════ */
function SettingsTab({ profile, onResetProfile }) {
  return (
    <div style={{padding:"20px"}} className="fu">
      <SectionLabel icon="settings" col={C.orange} label="Einstellungen" />

      {profile && (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",marginBottom:12,display:"flex",alignItems:"center",gap:14,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:`linear-gradient(135deg,${C.green},#1a5c32)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:18,fontWeight:800,color:"#fff"}}>{profile.name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>{profile.name}</div>
            <div style={{fontSize:12,color:C.sub,marginTop:2}}>
              {profile.diet.length>0 ? profile.diet.join(", ") : "Keine Präferenz"} · {profile.markets.length>0 ? profile.markets.join(", ") : "Alle Märkte"}
            </div>
          </div>
        </div>
      )}

      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)",marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>Über Freshly</div>
        <div style={{fontSize:13,color:C.sub,lineHeight:1.8}}>Version 2.0 · KI-gestützte Lebensmittelverwaltung<br/>Kassenzettel-Scan mit Kamera und KI<br/>Optimiert für Schweizer Supermärkte</div>
      </div>

      <button onClick={onResetProfile} className="tap"
        style={{width:"100%",background:C.redL,border:`1px solid ${C.red}25`,borderRadius:14,padding:"14px",fontSize:14,fontWeight:700,color:C.red,cursor:"pointer",fontFamily:"inherit"}}>
        Profil zurücksetzen & Onboarding neu starten
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   RECEIPT / CAMERA MODAL — FIXED LAYOUT
════════════════════════════════════════════════════════════════════════ */
function ReceiptModal({ onClose, onAddMany }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [phase,    setPhase]    = useState("cam");
  const [photo,    setPhoto]    = useState(null);
  const [results,  setResults]  = useState([]);
  const [selected, setSelected] = useState({});
  const [expiryMap,setExpiryMap]= useState({});
  const [err,      setErr]      = useState("");
  const [camErr,   setCamErr]   = useState("");

  useEffect(()=>{
    let active=true;
    async function startCam() {
      try {
        const stream=await navigator.mediaDevices.getUserMedia({
          video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}}
        });
        if(!active){stream.getTracks().forEach(t=>t.stop());return;}
        streamRef.current=stream;
        if(videoRef.current){videoRef.current.srcObject=stream;videoRef.current.play();}
      } catch {
        setCamErr("Kamera nicht verfügbar. Bitte in Safari öffnen und Kamera-Zugriff erlauben.");
      }
    }
    startCam();
    return ()=>{active=false;streamRef.current?.getTracks().forEach(t=>t.stop());};
  },[]);

  function capture() {
    const v=videoRef.current; const cv=canvasRef.current;
    if(!v||!cv)return;
    cv.width=v.videoWidth||1280; cv.height=v.videoHeight||720;
    cv.getContext("2d").drawImage(v,0,0);
    setPhoto(cv.toDataURL("image/jpeg",0.85));
    streamRef.current?.getTracks().forEach(t=>t.stop());
    setPhase("preview");
  }

  function retake() {
    setPhoto(null);setPhase("cam");setErr("");
    navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}})
      .then(stream=>{streamRef.current=stream;if(videoRef.current){videoRef.current.srcObject=stream;videoRef.current.play();}})
      .catch(()=>setCamErr("Kamera nicht verfügbar."));
  }

  async function analyse() {
    if(!photo)return;
    setPhase("processing");setErr("");
    const base64=photo.split(",")[1];
    const prompt=`Du bist ein Lebensmittel-Experte. Analysiere diesen Kassenzettel oder dieses Produktfoto.
Extrahiere NUR Lebensmittel und Getränke. Ignoriere: Zahnpasta, Shampoo, Reinigungsmittel, Haushaltswaren, Kosmetik, Hygieneartikel.
Schätze sinnvolle Kategorien: Milchprodukte, Fleisch, Gemüse, Obst, Pasta & Reis, Konserven, Getränke, Brot & Gebäck, Snacks, Saucen, Öle, Tiefkühl, Sonstiges.
Antworte NUR mit einem validen JSON-Array ohne Markdown:
[{"name":"Produktname","cat":"Kategorie","qty":"1","unit":"Stk"}]
Falls keine Lebensmittel erkennbar: []`;
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:MODEL,max_tokens:1500,messages:[{role:"user",content:[
          {type:"image",source:{type:"base64",media_type:"image/jpeg",data:base64}},
          {type:"text",text:prompt}
        ]}]})
      });
      const data=await res.json();
      const raw=data.content?.find(b=>b.type==="text")?.text||"[]";
      const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
      if(!Array.isArray(parsed)||parsed.length===0){
        setErr("Keine Lebensmittel erkannt. Kassenzettel deutlicher fotografieren.");
        setPhase("preview");return;
      }
      setResults(parsed);
      const sel={}; parsed.forEach((_,i)=>{sel[i]=true;});setSelected(sel);
      const exp={}; parsed.forEach((_,i)=>{exp[i]=daysFromNow(14);});setExpiryMap(exp);
      setPhase("results");
    } catch {
      setErr("Fehler bei der Analyse. Bitte nochmal versuchen.");
      setPhase("preview");
    }
  }

  function confirm() {
    const toAdd=results.filter((_,i)=>selected[i]).map((item,i)=>({...item,expiry:expiryMap[i]||daysFromNow(14)}));
    if(toAdd.length>0)onAddMany(toAdd);
    onClose();
  }

  const selCount=results.filter((_,i)=>selected[i]).length;
  const phases={cam:"Kassenzettel fotografieren",preview:"Foto prüfen",processing:"Analysiere…",results:"Erkannte Lebensmittel"};

  return (
    /* KEY FIX: position fixed + full screen, no browser nav overlap */
    <div style={{position:"fixed",inset:0,zIndex:200,background:"#000",display:"flex",flexDirection:"column"}} className="fade-in">
      <div style={{height:"env(safe-area-inset-top,44px)",background:"#000",flexShrink:0}} />

      {/* header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:"#000",flexShrink:0}}>
        <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{phases[phase]}</div>
        <button onClick={onClose} className="tap" style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:9,padding:"8px",cursor:"pointer",display:"flex"}}>
          <Ic n="x" s={18} col="#fff" />
        </button>
      </div>

      {/* CAM phase */}
      {phase==="cam" && (
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
          {camErr ? (
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,gap:16}}>
              <Ic n="camera" s={48} col="rgba(255,255,255,0.3)" />
              <div style={{color:"rgba(255,255,255,0.7)",fontSize:14,textAlign:"center",lineHeight:1.6}}>{camErr}</div>
            </div>
          ) : (
            <div style={{flex:1,position:"relative",minHeight:0}}>
              <video ref={videoRef} playsInline muted style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",background:"#111"}} />
              {/* guide overlay */}
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                <div style={{border:"2px solid rgba(255,255,255,0.7)",borderRadius:16,width:"85%",height:"50%",boxShadow:"0 0 0 2000px rgba(0,0,0,0.5)"}} />
                <div style={{marginTop:14,background:"rgba(0,0,0,0.7)",borderRadius:20,padding:"8px 16px"}}>
                  <span style={{color:"rgba(255,255,255,0.9)",fontSize:12,fontWeight:600}}>Kassenzettel im Rahmen ausrichten</span>
                </div>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} style={{display:"none"}} />
          {/* FIXED: large padding-bottom so button never hides behind browser bar */}
          <div style={{flexShrink:0,paddingTop:24,paddingBottom:"max(40px, env(safe-area-inset-bottom,40px))",paddingLeft:24,paddingRight:24,background:"#000",display:"flex",justifyContent:"center"}}>
            <button onClick={capture} disabled={!!camErr} className="tap"
              style={{width:80,height:80,borderRadius:"50%",background:camErr?"#333":"#fff",border:"4px solid rgba(255,255,255,0.3)",cursor:camErr?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 0 3px rgba(255,255,255,0.5)"}}>
              <div style={{width:62,height:62,borderRadius:"50%",background:camErr?"#555":"#f0f0f0",border:"3px solid #ccc"}} />
            </button>
          </div>
        </div>
      )}

      {/* PREVIEW / PROCESSING phase */}
      {(phase==="preview"||phase==="processing")&&photo && (
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
          <div style={{flex:1,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",background:"#111"}}>
            <img src={photo} alt="Kassenzettel" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}} />
          </div>
          {err && <div style={{background:"#7f1d1d",margin:"0 16px 8px",borderRadius:12,padding:"12px 14px",flexShrink:0}}><div style={{color:"#fecaca",fontSize:13}}>{err}</div></div>}
          <div style={{flexShrink:0,padding:"16px 20px",paddingBottom:"max(20px, env(safe-area-inset-bottom,20px))",background:"#000",display:"flex",gap:10}}>
            <button onClick={retake} disabled={phase==="processing"} className="tap"
              style={{flex:1,background:"rgba(255,255,255,0.1)",border:"none",borderRadius:13,padding:"15px",color:"#fff",fontSize:14,fontWeight:700,cursor:phase==="processing"?"not-allowed":"pointer",fontFamily:"inherit"}}>
              Nochmal
            </button>
            <button onClick={analyse} disabled={phase==="processing"} className="tap"
              style={{flex:2,background:phase==="processing"?"#333":`linear-gradient(135deg,${C.green},#1a5c32)`,border:"none",borderRadius:13,padding:"15px",color:"#fff",fontSize:14,fontWeight:700,cursor:phase==="processing"?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit"}}>
              {phase==="processing"?<><Spin white /><span>KI analysiert…</span></>:<><Ic n="sparkle" s={17} col="#fff" /><span>Lebensmittel erkennen</span></>}
            </button>
          </div>
        </div>
      )}

      {/* RESULTS phase */}
      {phase==="results" && (
        <div style={{flex:1,display:"flex",flexDirection:"column",background:C.bg,minHeight:0}}>
          <div style={{padding:"12px 20px 10px",background:C.card,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
            <div style={{fontSize:13,color:C.sub}}><strong style={{color:C.text}}>{selCount}</strong> von {results.length} ausgewählt · Ablaufdatum anpassen falls nötig</div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"12px 20px"}}>
            {results.map((item,i)=>(
              <div key={i} onClick={()=>setSelected(s=>({...s,[i]:!s[i]}))} className="tap"
                style={{background:C.card,border:`1.5px solid ${selected[i]?C.green:C.border}`,borderRadius:14,padding:"13px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12,cursor:"pointer",transition:"border-color .15s"}}>
                <div style={{width:22,height:22,borderRadius:6,background:selected[i]?C.green:C.card2,border:`1.5px solid ${selected[i]?C.green:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                  {selected[i]&&<Ic n="check" s={13} col="#fff" sw={2.5} />}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14}}>{item.name}</div>
                  <div style={{fontSize:12,color:C.sub,marginTop:1}}>{item.cat} · {item.qty} {item.unit}</div>
                </div>
                <input type="date" value={expiryMap[i]||daysFromNow(14)}
                  onChange={e=>{e.stopPropagation();setExpiryMap(m=>({...m,[i]:e.target.value}));}}
                  onClick={e=>e.stopPropagation()}
                  style={{fontSize:11,color:C.sub,background:"transparent",border:"none",outline:"none",cursor:"pointer",fontFamily:"inherit",flexShrink:0}} />
              </div>
            ))}
          </div>
          <div style={{flexShrink:0,padding:"12px 20px",paddingBottom:"max(16px, env(safe-area-inset-bottom,16px))",background:C.card,borderTop:`1px solid ${C.border}`}}>
            <button onClick={confirm} className="tap"
              style={{width:"100%",background:selCount===0?C.card2:`linear-gradient(135deg,${C.green},#1a5c32)`,border:"none",borderRadius:14,padding:"15px",fontSize:15,fontWeight:800,color:selCount===0?C.sub:"#fff",cursor:selCount===0?"not-allowed":"pointer",boxShadow:selCount===0?"none":`0 4px 16px ${C.green}35`,fontFamily:"inherit"}}>
              {selCount===0?"Nichts ausgewählt":`${selCount} Produkt${selCount>1?"e":""} hinzufügen`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   VOICE MODAL
════════════════════════════════════════════════════════════════════════ */

// Parst gesprochenen Text in Produkt-Objekte
// Beispiel: "Milch 2 Liter in 5 Tagen" → {name:"Milch", qty:"2", unit:"Liter", expiry:daysFromNow(5)}
function parseVoiceText(text) {
  const UNITS = ["liter","l","kilogramm","kg","gramm","g","milliliter","ml","stück","stk","dosen","dose","kopf","bund","päckli","packung"];
  const MONTHS = {januar:1,februar:2,märz:3,april:4,mai:5,juni:6,juli:7,august:8,september:9,oktober:10,november:11,dezember:12};

  // Splitte bei "und", Komma oder Zeilenumbruch in einzelne Produkte
  const parts = text.toLowerCase()
    .split(/\s*(?:,|und|\n)\s*/)
    .map(s=>s.trim())
    .filter(Boolean);

  const results = [];

  for (const part of parts) {
    const item = { name:"", qty:"1", unit:"Stk", expiry:daysFromNow(14) };
    let remaining = part;

    // Ablaufdatum erkennen: "in X tagen", "in X wochen", "am DD.MM", "am 15. mai"
    const inDays = remaining.match(/in\s+(\d+)\s+tag/);
    const inWeeks = remaining.match(/in\s+(\d+)\s+woch/);
    const inMonths = remaining.match(/in\s+(\d+)\s+monat/);
    const dateDE = remaining.match(/am\s+(\d{1,2})\.\s*(\d{1,2})(?:\.(\d{2,4}))?/);
    const dateName = remaining.match(/am\s+(\d{1,2})\.\s*([a-zä]+)/);

    if (inDays) {
      item.expiry = daysFromNow(parseInt(inDays[1]));
      remaining = remaining.replace(inDays[0],"").trim();
    } else if (inWeeks) {
      item.expiry = daysFromNow(parseInt(inWeeks[1])*7);
      remaining = remaining.replace(inWeeks[0],"").trim();
    } else if (inMonths) {
      item.expiry = daysFromNow(parseInt(inMonths[1])*30);
      remaining = remaining.replace(inMonths[0],"").trim();
    } else if (dateDE) {
      const day=parseInt(dateDE[1]), month=parseInt(dateDE[2]);
      const year = dateDE[3] ? parseInt(dateDE[3]) : new Date().getFullYear();
      const d = new Date(year<100?2000+year:year, month-1, day);
      if (!isNaN(d)) item.expiry = d.toISOString().split("T")[0];
      remaining = remaining.replace(dateDE[0],"").trim();
    } else if (dateName) {
      const day=parseInt(dateName[1]);
      const monthName=dateName[2];
      const month = MONTHS[monthName];
      if (month) {
        const d = new Date(new Date().getFullYear(), month-1, day);
        if (d < new Date()) d.setFullYear(d.getFullYear()+1);
        item.expiry = d.toISOString().split("T")[0];
      }
      remaining = remaining.replace(dateName[0],"").trim();
    }

    // Menge + Einheit erkennen: "2 liter", "500 gramm", "3 stück"
    const qtyUnit = remaining.match(/(\d+(?:[.,]\d+)?)\s*([a-zäöü]+)?/);
    if (qtyUnit) {
      const num = qtyUnit[1];
      const maybeUnit = (qtyUnit[2]||"").toLowerCase();
      if (UNITS.includes(maybeUnit)) {
        item.qty = num;
        // Normalisiere Einheit
        const unitMap = {liter:"L",l:"L",kilogramm:"kg",kg:"kg",gramm:"g",g:"g",milliliter:"ml",ml:"ml",
          stück:"Stk",stk:"Stk",dosen:"Dosen",dose:"Dosen",kopf:"Kopf",bund:"Bund",päckli:"Päckli",packung:"Päckli"};
        item.unit = unitMap[maybeUnit]||maybeUnit;
        remaining = remaining.replace(qtyUnit[0],"").trim();
      } else if (/^\d/.test(remaining)) {
        // Nur Zahl ohne Einheit
        item.qty = num;
        remaining = remaining.replace(num,"").trim();
      }
    }

    // Rest ist der Produktname — bereinigen
    item.name = remaining
      .replace(/\b(in|am|bis|ablauf|ablaufdatum|läuft ab)\b/g,"")
      .replace(/\s+/g," ")
      .trim();

    // Ersten Buchstaben gross
    if (item.name) {
      item.name = item.name.charAt(0).toUpperCase() + item.name.slice(1);
      results.push(item);
    }
  }
  return results;
}

function VoiceModal({ onClose, onAddMany }) {
  const [phase, setPhase] = useState("idle"); // idle | listening | result | confirm
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [parsed, setParsed] = useState([]);
  const [selected, setSelected] = useState({});
  const [editExpiry, setEditExpiry] = useState({});
  const [err, setErr] = useState("");
  const recogRef = useRef(null);

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SR;

  function startListening() {
    if (!supported) { setErr("Spracherkennung wird in diesem Browser nicht unterstützt. Bitte Safari auf iPhone verwenden."); return; }
    setErr(""); setTranscript(""); setInterimText(""); setPhase("listening");

    const r = new SR();
    r.lang = "de-CH";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    recogRef.current = r;

    r.onresult = e => {
      let final = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + " ";
        else interim += t;
      }
      if (final) setTranscript(p => p + final);
      setInterimText(interim);
    };
    r.onerror = e => {
      if (e.error === "not-allowed") setErr("Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.");
      else if (e.error !== "aborted") setErr(`Fehler: ${e.error}`);
      setPhase("idle");
    };
    r.onend = () => {
      setInterimText("");
      setPhase(p => p === "listening" ? "result" : p);
    };
    r.start();
  }

  function stopListening() {
    recogRef.current?.stop();
    setPhase("result");
  }

  function analyse() {
    const full = (transcript + " " + interimText).trim();
    if (!full) { setErr("Nichts aufgenommen. Bitte nochmal versuchen."); setPhase("idle"); return; }
    const items = parseVoiceText(full);
    if (!items.length) { setErr("Konnte keine Produkte erkennen. Bitte klarer sprechen."); setPhase("idle"); return; }
    const sel = {}; items.forEach((_,i)=>{ sel[i]=true; });
    const exp = {}; items.forEach((it,i)=>{ exp[i]=it.expiry; });
    setParsed(items); setSelected(sel); setEditExpiry(exp);
    setPhase("confirm");
  }

  function confirm() {
    const toAdd = parsed.filter((_,i)=>selected[i]).map((it,i)=>({...it,expiry:editExpiry[i]||it.expiry}));
    if (toAdd.length>0) onAddMany(toAdd);
    onClose();
  }

  const selCount = parsed.filter((_,i)=>selected[i]).length;

  return (
    <Sheet onClose={onClose} title="Per Sprache hinzufügen">

      {/* Instructions */}
      {(phase==="idle"||phase==="result") && (
        <div style={{background:"#6B46C115",border:"1px solid #6B46C130",borderRadius:14,padding:"14px",marginBottom:18}}>
          <div style={{fontSize:13,fontWeight:700,color:"#6B46C1",marginBottom:6}}>So funktioniert's</div>
          <div style={{fontSize:13,color:C.sub,lineHeight:1.7}}>
            Sprich einfach was du eingekauft hast, z.B.:<br/>
            <em style={{color:C.text}}>"Vollmilch 2 Liter in 5 Tagen, Joghurt 3 Stück in 2 Wochen, Spaghetti 500 Gramm"</em>
          </div>
        </div>
      )}

      {/* Error */}
      {err && <ErrBox msg={err} />}

      {/* IDLE — Startbutton */}
      {phase==="idle" && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,padding:"8px 0 16px"}}>
          {!supported && (
            <div style={{fontSize:13,color:C.sub,textAlign:"center",lineHeight:1.6}}>
              Spracherkennung nicht verfügbar.<br/>Bitte in Safari auf dem iPhone öffnen.
            </div>
          )}
          <button onClick={startListening} disabled={!supported} className="tap"
            style={{width:90,height:90,borderRadius:"50%",background:supported?"#6B46C1":C.card2,border:"none",cursor:supported?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:supported?"0 6px 24px #6B46C140":"none"}}>
            <Ic n="mic" s={36} col="#fff" />
          </button>
          <div style={{fontSize:13,color:C.sub,fontWeight:600}}>Tippen zum Starten</div>
        </div>
      )}

      {/* LISTENING */}
      {phase==="listening" && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,padding:"8px 0"}}>
          {/* pulsing ring */}
          <div style={{position:"relative",width:100,height:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{position:"absolute",width:100,height:100,borderRadius:"50%",background:"#6B46C120",animation:"pulse-ring 1.4s ease infinite"}} />
            <div style={{position:"absolute",width:80,height:80,borderRadius:"50%",background:"#6B46C115",animation:"pulse-ring 1.4s ease .4s infinite"}} />
            <button onClick={stopListening} className="tap"
              style={{width:72,height:72,borderRadius:"50%",background:"#6B46C1",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 24px #6B46C140",zIndex:1}}>
              <Ic n="mic" s={30} col="#fff" />
            </button>
          </div>
          <div style={{fontSize:14,fontWeight:700,color:"#6B46C1"}}>Höre zu… Tippen zum Stoppen</div>
          {/* live transcript */}
          <div style={{width:"100%",background:C.card2,borderRadius:14,padding:"13px 14px",minHeight:60,fontSize:14,color:C.text,lineHeight:1.6}}>
            {transcript && <span>{transcript}</span>}
            {interimText && <span style={{color:C.sub}}>{interimText}</span>}
            {!transcript && !interimText && <span style={{color:C.sub}}>Spreche jetzt…</span>}
          </div>
        </div>
      )}

      {/* RESULT — transcript fertig, noch nicht geparst */}
      {phase==="result" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <FL>Aufgenommener Text</FL>
            <textarea
              value={transcript}
              onChange={e=>setTranscript(e.target.value)}
              rows={4}
              style={{...IS(false),resize:"none"}}
            />
            <div style={{fontSize:11,color:C.sub,marginTop:4}}>Du kannst den Text noch korrigieren.</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setTranscript("");setPhase("idle");}} className="tap"
              style={{flex:1,background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px",fontSize:13,fontWeight:700,color:C.sub,cursor:"pointer",fontFamily:"inherit"}}>
              Nochmal
            </button>
            <button onClick={analyse} className="tap"
              style={{flex:2,background:"#6B46C1",border:"none",borderRadius:12,padding:"13px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Ic n="check" s={16} col="#fff" sw={2.5} />
              Produkte erkennen
            </button>
          </div>
        </div>
      )}

      {/* CONFIRM — geparste Produkte bestätigen */}
      {phase==="confirm" && (
        <div>
          <div style={{fontSize:13,color:C.sub,marginBottom:12}}>
            <strong style={{color:C.text}}>{selCount}</strong> von {parsed.length} erkannten Produkten ausgewählt
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
            {parsed.map((item,i)=>(
              <div key={i} onClick={()=>setSelected(s=>({...s,[i]:!s[i]}))} className="tap"
                style={{background:C.card,border:`1.5px solid ${selected[i]?"#6B46C1":C.border}`,borderRadius:14,padding:"13px 14px",cursor:"pointer",transition:"border-color .15s"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:selected[i]?8:0}}>
                  <div style={{width:22,height:22,borderRadius:6,background:selected[i]?"#6B46C1":C.card2,border:`1.5px solid ${selected[i]?"#6B46C1":C.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                    {selected[i]&&<Ic n="check" s={13} col="#fff" sw={2.5} />}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{item.name}</div>
                    <div style={{fontSize:12,color:C.sub,marginTop:1}}>{item.qty} {item.unit}</div>
                  </div>
                </div>
                {selected[i] && (
                  <div onClick={e=>e.stopPropagation()} style={{paddingLeft:32}}>
                    <FL>Ablaufdatum</FL>
                    <input type="date" value={editExpiry[i]||item.expiry}
                      onChange={e=>setEditExpiry(m=>({...m,[i]:e.target.value}))}
                      style={{...IS(false),fontSize:13}} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setPhase("idle");setTranscript("");}} className="tap"
              style={{flex:1,background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px",fontSize:13,fontWeight:700,color:C.sub,cursor:"pointer",fontFamily:"inherit"}}>
              Nochmal
            </button>
            <button onClick={confirm} disabled={selCount===0} className="tap"
              style={{flex:2,background:selCount===0?C.card2:"#6B46C1",border:"none",borderRadius:12,padding:"13px",fontSize:13,fontWeight:700,color:selCount===0?C.sub:"#fff",cursor:selCount===0?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:selCount===0?"none":"0 4px 14px #6B46C140"}}>
              {selCount===0?"Nichts ausgewählt":`${selCount} Produkt${selCount>1?"e":""} hinzufügen`}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-ring {
          0%   { transform:scale(1);   opacity:.6; }
          50%  { transform:scale(1.15);opacity:.2; }
          100% { transform:scale(1);   opacity:.6; }
        }
      `}</style>
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ITEM MODAL
════════════════════════════════════════════════════════════════════════ */
const CATS=["Milchprodukte","Fleisch","Gemüse","Obst","Pasta & Reis","Konserven","Getränke","Brot & Gebäck","Snacks","Saucen","Öle","Tiefkühl","Sonstiges"];
const UNITS=["Stk","g","kg","ml","L","Dosen","Kopf","Bund","Päckli"];

function ItemModal({ onClose, onSave, item }) {
  const [f,setF]=useState(item||{name:"",cat:"Sonstiges",qty:"1",unit:"Stk",expiry:daysFromNow(14)});
  const [err,setErr]=useState("");
  function save(){if(!f.name.trim()){setErr("Bitte einen Namen eingeben.");return;}onSave(f);onClose();}
  return (
    <Sheet onClose={onClose} title={item?"Produkt bearbeiten":"Produkt hinzufügen"}>
      {err&&<ErrBox msg={err}/>}
      <FL>Name</FL>
      <input value={f.name} onChange={e=>{setF(p=>({...p,name:e.target.value}));setErr("");}} placeholder="z.B. Vollmilch" style={{...IS(false),marginBottom:14}} />
      <FL>Ablaufdatum</FL>
      <input type="date" value={f.expiry} onChange={e=>setF(p=>({...p,expiry:e.target.value}))} style={{...IS(false),marginBottom:14}} />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div><FL>Menge</FL><input type="number" value={f.qty} onChange={e=>setF(p=>({...p,qty:e.target.value}))} style={IS(false)} /></div>
        <div><FL>Einheit</FL><select value={f.unit} onChange={e=>setF(p=>({...p,unit:e.target.value}))} style={IS(false)}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></div>
      </div>
      <FL>Kategorie</FL>
      <select value={f.cat} onChange={e=>setF(p=>({...p,cat:e.target.value}))} style={{...IS(false),marginBottom:20}}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
      <PBtn onClick={save} text={item?"Speichern":"Hinzufügen"} col={C.orange} />
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   RECIPE FORM
════════════════════════════════════════════════════════════════════════ */
function RecipeForm({ onClose, onSave }) {
  const [f,setF]=useState({name:"",time:30,diff:"Einfach",diet:"vegetarisch",ings:"",stepsText:"",gen:false});
  const [err,setErr]=useState("");
  function save(){
    if(!f.name.trim()){setErr("Bitte einen Namen eingeben.");return;}
    if(!f.ings.trim()){setErr("Bitte mindestens eine Zutat eingeben.");return;}
    onSave({...f,ing:f.ings.split("\n").filter(Boolean),steps:f.stepsText.split("\n").filter(Boolean)});
    onClose();
  }
  return (
    <Sheet onClose={onClose} title="Rezept erstellen">
      {err&&<ErrBox msg={err}/>}
      <FL>Name</FL>
      <input value={f.name} onChange={e=>{setF(p=>({...p,name:e.target.value}));setErr("");}} placeholder="z.B. Gemüse-Curry" style={{...IS(false),marginBottom:14}} />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        <div><FL>Zeit (Min)</FL><input type="number" value={f.time} onChange={e=>setF(p=>({...p,time:+e.target.value}))} style={IS(false)} /></div>
        <div><FL>Schwierigk.</FL><select value={f.diff} onChange={e=>setF(p=>({...p,diff:e.target.value}))} style={IS(true)}>{["Einfach","Mittel","Schwer"].map(d=><option key={d}>{d}</option>)}</select></div>
        <div><FL>Ernährung</FL><select value={f.diet} onChange={e=>setF(p=>({...p,diet:e.target.value}))} style={IS(true)}>{["vegetarisch","vegan","fleisch"].map(d=><option key={d}>{d}</option>)}</select></div>
      </div>
      <FL>Zutaten (eine pro Zeile)</FL>
      <textarea value={f.ings} onChange={e=>{setF(p=>({...p,ings:e.target.value}));setErr("");}} rows={3} placeholder={"400g Spaghetti\n2 Eier"} style={{...IS(false),resize:"none",marginBottom:14}} />
      <FL>Schritte (einer pro Zeile)</FL>
      <textarea value={f.stepsText} onChange={e=>setF(p=>({...p,stepsText:e.target.value}))} rows={3} placeholder={"Wasser kochen\nPasta kochen"} style={{...IS(false),resize:"none",marginBottom:20}} />
      <PBtn onClick={save} text="Rezept speichern" col={C.green} />
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   AI MODAL
════════════════════════════════════════════════════════════════════════ */
function AiModal({ onClose, items, onSave }) {
  const [time,setTime]=useState(30);
  const [diet,setDiet]=useState("egal");
  const [diff,setDiff]=useState("Einfach");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  async function generate(){
    setLoading(true);setErr("");
    const list=items.map(i=>i.name).join(", ");
    const prompt=`Du bist ein Schweizer Küchenchef. Erstelle ein leckeres Rezept mit diesen Zutaten: ${list}.
Maximalzeit: ${time} Min. Ernährung: ${diet==="egal"?"beliebig":diet}. Schwierigkeit: ${diff}.
Salz, Pfeffer, Wasser kannst du voraussetzen.
Antworte NUR mit einem validen JSON-Objekt ohne Markdown:
{"name":"...","time":20,"diff":"Einfach","diet":"vegetarisch","ing":["Menge Zutat","..."],"steps":["Schritt..."],"gen":true}`;
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:MODEL,max_tokens:1200,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      const text=data.content?.find(b=>b.type==="text")?.text||"";
      const recipe=JSON.parse(text.replace(/```json|```/g,"").trim());
      onSave(recipe);
    } catch {
      setErr("Fehler beim Generieren. Bitte nochmal versuchen.");
      setLoading(false);
    }
  }
  return (
    <Sheet onClose={onClose} title="KI-Rezept generieren">
      <div style={{background:C.greenL,border:`1px solid ${C.greenM}`,borderRadius:12,padding:"13px 14px",marginBottom:18,fontSize:13,color:C.sub,lineHeight:1.6}}>
        KI analysiert deine <strong style={{color:C.green}}>{items.length} Produkte</strong> und kocht ein passendes Rezept.
      </div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,color:C.sub,marginBottom:8}}>Maximalzeit: {time} Minuten</div>
        <input type="range" min={10} max={120} step={5} value={time} onChange={e=>setTime(+e.target.value)} style={{width:"100%",accentColor:C.green}} />
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.sub,marginTop:3}}><span>10 Min</span><span>120 Min</span></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
        <div><FL>Ernährung</FL><select value={diet} onChange={e=>setDiet(e.target.value)} style={IS(false)}>{["egal","vegetarisch","vegan","fleisch"].map(d=><option key={d}>{d}</option>)}</select></div>
        <div><FL>Schwierigkeit</FL><select value={diff} onChange={e=>setDiff(e.target.value)} style={IS(false)}>{["Einfach","Mittel","Schwer"].map(d=><option key={d}>{d}</option>)}</select></div>
      </div>
      {err&&<ErrBox msg={err}/>}
      <PBtn onClick={generate} text={<><Ic n="sparkle" s={18} col="#fff" /><span>Rezept generieren</span></>} col={C.green} loading={loading} />
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   RECIPE VIEW
════════════════════════════════════════════════════════════════════════ */
function RecipeView({ onClose, recipe }) {
  return (
    <Sheet onClose={onClose} title={recipe.name}>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:20}}>
        <Chip icon="clock" text={`${recipe.time} Min`} col={C.orange} />
        <Chip text={recipe.diff} col={C.sub} />
        {recipe.diet&&<Chip icon="leaf" text={recipe.diet} col={C.green} />}
        {recipe.gen&&<Chip icon="sparkle" text="KI generiert" col={C.purple} />}
      </div>
      <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Zutaten</div>
      {recipe.ing?.map((ing,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:C.green,flexShrink:0}} />
          <span style={{fontSize:14}}>{ing}</span>
        </div>
      ))}
      <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:"0.1em",marginTop:22,marginBottom:14}}>Zubereitung</div>
      {recipe.steps?.map((step,i)=>(
        <div key={i} style={{display:"flex",gap:13,marginBottom:16}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:C.orangeL,border:`1.5px solid ${C.orange}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,fontWeight:800,color:C.orange}}>{i+1}</div>
          <div style={{fontSize:14,lineHeight:1.65,paddingTop:4}}>{step}</div>
        </div>
      ))}
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ROOT APP
════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [profile,  setProfile]  = useState(()=>loadProfile());
  const [tab,      setTab]      = useState("home");
  const [items,    setItems]    = useState(SEED_ITEMS);
  const [recipes,  setRecipes]  = useState(SEED_RECIPES);
  const [nid,      setNid]      = useState(500);
  const [modal,    setModal]    = useState(null);

  const soon = items.filter(i=>daysLeft(i.expiry)<=3);

  function newId(){ const id=nid; setNid(id+1); return id; }
  function addItem(item){ setItems(p=>[...p,{...item,id:newId(),added:todayStr()}]); }
  function addItems(arr){ let base=nid; setNid(base+arr.length); setItems(p=>[...p,...arr.map((it,i)=>({...it,id:base+i,added:todayStr()}))]); }
  function updateItem(u){ setItems(p=>p.map(i=>i.id===u.id?u:i)); }
  function removeItem(id){ setItems(p=>p.filter(i=>i.id!==id)); }
  function addRecipe(r){ const id=newId(); const full={...r,id}; setRecipes(p=>[...p,full]); return full; }

  function handleOnboardingDone(p) { saveProfile(p); setProfile(p); }
  function resetProfile() { try{localStorage.removeItem("freshly_profile");}catch{} setProfile(null); }

  if (!profile) return <Onboarding onDone={handleOnboardingDone} />;

  return (
    <div style={{fontFamily:"'Outfit',sans-serif",background:C.bg,minHeight:"100dvh",maxWidth:430,margin:"0 auto",position:"relative",overflowX:"hidden",color:C.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        ::-webkit-scrollbar{display:none;}
        input,textarea,select{font-family:'Outfit',sans-serif;}
        @keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .fu{animation:fu .26s cubic-bezier(.22,1,.36,1) both;}
        .slide-up{animation:slideUp .3s cubic-bezier(.22,1,.36,1) both;}
        .fade-in{animation:fadeIn .2s ease both;}
        .tap:active{transform:scale(.96);transition:transform .1s;}
      `}</style>

      <div style={{height:"env(safe-area-inset-top,44px)",background:C.card}} />

      <header style={{padding:"12px 20px 10px",background:C.card,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:40,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:24,fontWeight:900,letterSpacing:"-0.8px",lineHeight:1}}>
              <span style={{color:C.text}}>fresh</span><span style={{color:C.green}}>ly</span>
            </div>
            <div style={{fontSize:11,color:C.sub,fontWeight:500,marginTop:1}}>{greet(profile?.name)}</div>
          </div>
          {soon.length>0 && (
            <button onClick={()=>setTab("pantry")} className="tap"
              style={{background:C.redL,border:`1px solid ${C.red}28`,borderRadius:10,padding:"7px 12px",display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontFamily:"inherit"}}>
              <Ic n="warning" s={14} col={C.red} />
              <span style={{fontSize:12,color:C.red,fontWeight:700}}>{soon.length} bald ab</span>
            </button>
          )}
        </div>
      </header>

      <main style={{paddingBottom:88}}>
        {tab==="home"    &&<HomeTab    items={items} recipes={recipes} soon={soon} setTab={setTab} setModal={setModal} profile={profile} />}
        {tab==="pantry"  &&<PantryTab  items={items} removeItem={removeItem} setModal={setModal} />}
        {tab==="recipes" &&<RecipesTab recipes={recipes} items={items} setModal={setModal} />}
        {tab==="settings"&&<SettingsTab profile={profile} onResetProfile={resetProfile} />}
      </main>

      <BottomNav tab={tab} setTab={setTab} />

      {modal?.type==="receipt"   &&<ReceiptModal  onClose={()=>setModal(null)} onAddMany={addItems} />}
      {modal?.type==="voice"     &&<VoiceModal    onClose={()=>setModal(null)} onAddMany={addItems} />}
      {modal?.type==="addItem"   &&<ItemModal     onClose={()=>setModal(null)} onSave={modal.edit?updateItem:addItem} item={modal.edit||null} />}
      {modal?.type==="addRecipe" &&<RecipeForm    onClose={()=>setModal(null)} onSave={addRecipe} />}
      {modal?.type==="ai"        &&<AiModal       onClose={()=>setModal(null)} items={items} onSave={r=>{const full=addRecipe(r);setModal({type:"view",data:full});}} />}
      {modal?.type==="view"      &&<RecipeView    onClose={()=>setModal(null)} recipe={modal.data} />}
    </div>
  );
}
