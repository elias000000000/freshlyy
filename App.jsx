import { useState, useRef, useEffect } from "react";

const MODEL = "claude-sonnet-4-20250514";

/* ─── utils ─────────────────────────────────────────────────────────── */
function daysFromNow(n){const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().split("T")[0];}
function todayStr(){return new Date().toISOString().split("T")[0];}
function daysLeft(s){return Math.ceil((new Date(s)-new Date())/86400000);}
function expiryColor(s){const d=daysLeft(s);return d<=3?"#C53030":d<=7?"#B7791F":"#276749";}
function expiryLabel(s){const d=daysLeft(s);if(d<=0)return"Abgelaufen";if(d===1)return"Morgen";return`${d} Tage`;}
function greet(name){const h=new Date().getHours();const g=h<12?"Guten Morgen":h<18?"Guten Tag":"Guten Abend";return name?`${g}, ${name}`:g;}
function loadProfile(){try{const r=localStorage.getItem("freshly_profile");return r?JSON.parse(r):null;}catch{return null;}}
function saveProfile(p){try{localStorage.setItem("freshly_profile",JSON.stringify(p));}catch{}}

/* ─── voice parser ───────────────────────────────────────────────────── */
// Wandelt Zahlwörter in Ziffern
const WORD_NUMS = {
  ein:1,eine:1,einer:1,zwei:2,drei:3,vier:4,fünf:5,sechs:6,sieben:7,acht:8,
  neun:9,zehn:10,elf:11,zwölf:12,dreizehn:13,vierzehn:14,fünfzehn:15,
  sechzehn:16,siebzehn:17,achtzehn:18,neunzehn:19,zwanzig:20,
  "ein halbes":0.5,"einen halben":0.5,"anderthalb":1.5,
};
const MONTHS_DE = {
  jan:1,januar:1,feb:2,februar:2,"mär":3,märz:3,apr:4,april:4,
  mai:5,jun:6,juni:6,jul:7,juli:7,aug:8,august:8,
  sep:9,september:9,okt:10,oktober:10,nov:11,november:11,dez:12,dezember:12,
};
const UNIT_MAP = {
  liter:"L",l:"L",
  kilogramm:"kg",kilo:"kg",kg:"kg",
  gramm:"g",gram:"g",g:"g",
  milliliter:"ml",ml:"ml",
  stück:"Stk",stk:"Stk",stücke:"Stk",stuck:"Stk",
  packung:"Päckli",packungen:"Päckli",päckli:"Päckli",päckchen:"Päckli",pack:"Päckli",
  flasche:"L",flaschen:"L",
  dose:"Dosen",dosen:"Dosen",büchse:"Dosen",büchsen:"Dosen",
  kopf:"Kopf",köpfe:"Kopf",
  bund:"Bund",bunde:"Bund",
  becher:"Stk",karton:"Stk",
  sechserpack:"Stk",viererpack:"Stk",achterpack:"Stk",zwölfpack:"Stk",
};
const PACK_SIZES = {sechserpack:6,viererpack:4,achterpack:8,zwölfpack:12,"sechser pack":6,"vierer pack":4};

function wordToNum(w){
  if(!isNaN(parseFloat(w)))return parseFloat(w);
  return WORD_NUMS[w.toLowerCase()]||null;
}

// Erkennt Datum aus Text: "28. April", "28.04", "28.04.2025", "28. April 2025"
function parseDate(text){
  const t = text.toLowerCase().trim();
  const curYear = new Date().getFullYear();

  // "28. april 2025" oder "28 april"
  const mName = t.match(/(\d{1,2})\.?\s+([a-zä]+)(?:\s+(\d{2,4}))?/);
  if(mName){
    const day=parseInt(mName[1]);
    const mon=MONTHS_DE[mName[2]];
    if(mon){
      let year=mName[3]?parseInt(mName[3]):curYear;
      if(year<100)year+=2000;
      const d=new Date(year,mon-1,day);
      if(d<new Date()&&!mName[3])d.setFullYear(d.getFullYear()+1);
      return d.toISOString().split("T")[0];
    }
  }
  // "28.04.2025" oder "28.04" oder "28.4"
  const mNum = t.match(/(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?/);
  if(mNum){
    const day=parseInt(mNum[1]);
    const mon=parseInt(mNum[2]);
    let year=mNum[3]?parseInt(mNum[3]):curYear;
    if(year<100)year+=2000;
    if(day>=1&&day<=31&&mon>=1&&mon<=12){
      const d=new Date(year,mon-1,day);
      if(d<new Date()&&!mNum[3])d.setFullYear(d.getFullYear()+1);
      return d.toISOString().split("T")[0];
    }
  }
  return null;
}

// Splittet Sprache in einzelne Produkt-Chunks
// Trennzeichen: Komma, "und", "dann", "noch", Pause (mehrere Leerzeichen)
function splitIntoChunks(text){
  return text
    .split(/\s*(?:,|;\s*und|\s+und\s+|\s+dann\s+|\s+noch\s+|\s+sowie\s+)\s*/i)
    .map(s=>s.trim())
    .filter(s=>s.length>1);
}

// Hauptparser: ein Chunk → ein Produkt
function parseChunk(raw){
  let s = raw.toLowerCase().trim();
  const item = {name:"",qty:"1",unit:"Stk",expiry:daysFromNow(14)};

  // 1. Datum rausziehen — alles nach "bis", "ablauf", "mindestens", oder direkte Datumsmuster
  const datePatterns = [
    /(?:bis|ab|ablauf|haltbar bis|mindestens haltbar bis|mhd)\s+([\d.]+\s*[a-zä]*\s*[\d]*)/i,
    /(?:bis|ab|ablauf|haltbar bis|mindestens haltbar bis|mhd)\s+(\d{1,2}\.\s*[a-zä]+(?:\s+\d{2,4})?)/i,
    // Datum ohne Schlüsselwort am Ende: "Milch 28. April"
    /(\d{1,2}[.\-\/]\d{1,2}(?:[.\-\/]\d{2,4})?)\s*$/,
    /(\d{1,2}\.?\s+[a-zä]{3,}(?:\s+\d{2,4})?)\s*$/i,
  ];
  for(const pat of datePatterns){
    const m=s.match(pat);
    if(m){
      const d=parseDate(m[1]);
      if(d){item.expiry=d;s=s.replace(m[0],"").trim();break;}
    }
  }

  // 2. Menge + Einheit rausziehen
  // Sechserpack, Viererpack etc.
  for(const [pack,num] of Object.entries(PACK_SIZES)){
    if(s.includes(pack)){
      item.qty=String(num);
      item.unit="Stk";
      s=s.replace(pack,"").trim();
      break;
    }
  }

  if(item.qty==="1"){
    // "2 liter", "500 gramm", "drei stück" etc.
    // Zahl (ziffern oder wort) gefolgt von Einheit
    const qMatch=s.match(/^(\d+(?:[.,]\d+)?|[a-zä]+)\s+(liter|l|kilo(?:gramm)?|kilogramm|gramm|gram|g|milliliter|ml|stück(?:e)?|stk|packung(?:en)?|päckli|päckchen|pack|flasche[n]?|dose[n]?|büchse[n]?|kopf|köpfe|bund(?:e)?|becher|karton|sechserpack|viererpack|achterpack|zwölfpack)\b/i);
    if(qMatch){
      const n=wordToNum(qMatch[1]);
      if(n!==null){
        item.qty=String(n);
        const u=UNIT_MAP[qMatch[2].toLowerCase()];
        if(u)item.unit=u;
        s=s.replace(qMatch[0],"").trim();
      }
    } else {
      // Nur Zahl am Anfang ohne Einheit: "6 Eier" → qty=6, unit=Stk
      const numOnly=s.match(/^(\d+|[a-zä]+)\s+(?!\d)/i);
      if(numOnly){
        const n=wordToNum(numOnly[1]);
        if(n!==null&&n>0&&n<1000){
          item.qty=String(n);
          s=s.replace(numOnly[1],"").trim();
        }
      }
    }
  }

  // 3. Rest ist Produktname — bereinigen
  s = s
    .replace(/\b(bio|frisch|frische|schweizer|natürlich|natürliche|coop|migros|lidl|aldi)\b/gi,"$1") // Labels behalten
    .replace(/\b(ein|eine|einen|einem)\b/gi,"")
    .replace(/\s+/g," ")
    .trim();

  // Ersten Buchstaben gross, Rest wie gesprochen
  if(s) item.name = s.charAt(0).toUpperCase()+s.slice(1);

  return item;
}

function parseVoiceText(text){
  const chunks=splitIntoChunks(text);
  return chunks
    .map(parseChunk)
    .filter(it=>it.name.length>0);
}

/* ─── seed ───────────────────────────────────────────────────────────── */
const SEED_ITEMS=[
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
const SEED_RECIPES=[{
  id:1,name:"Spaghetti Aglio e Olio",time:20,diff:"Einfach",diet:"vegetarisch",
  ing:["400g Spaghetti","4 Knoblauchzehen","6 EL Olivenöl","Peperoncino","Salz"],
  steps:["Spaghetti in reichlich Salzwasser bissfest kochen.","Knoblauch in Scheiben in Olivenöl goldbraun braten.","Peperoncino kurz mitrösten.","Pasta abgiessen, mit Öl und etwas Kochwasser vermengen."],
  gen:false
}];

/* ─── tokens ─────────────────────────────────────────────────────────── */
const C={
  bg:"#F9F7F3",card:"#FFFFFF",card2:"#F2EFE9",border:"#E9E4DC",
  text:"#1A1714",sub:"#7C746C",
  green:"#2D7D46",greenL:"#EBF5EE",greenM:"#C6E6CE",
  orange:"#C05621",orangeL:"#FEF0E7",
  red:"#C53030",redL:"#FEF2F2",
  amber:"#B7791F",purple:"#6B46C1",purpleL:"#F3F0FF",
};

/* ─── icons ──────────────────────────────────────────────────────────── */
const ICONS={
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
  warning:"M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  search:"M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
  check:"M20 6L9 17l-5-5",
  star:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  info:"M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z M12 8v4M12 16h.01",
  user:"M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  arrow:"M5 12h14M12 5l7 7-7 7",
  mic:"M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8",
  stop:"M18 18H6V6h12z",
  refresh:"M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15",
};
function Ic({n,s=22,col="currentColor",sw=1.8}){
  return(
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d={ICONS[n]||""}/>
    </svg>
  );
}

/* ─── shared small components ────────────────────────────────────────── */
function Chip({icon,text,col}){
  return(
    <div style={{display:"inline-flex",alignItems:"center",gap:5,background:`${col}18`,border:`1px solid ${col}30`,borderRadius:20,padding:"4px 10px"}}>
      {icon&&<Ic n={icon} s={11} col={col}/>}
      <span style={{fontSize:11,fontWeight:700,color:col}}>{text}</span>
    </div>
  );
}
function SecLabel({icon,col,label}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
      <Ic n={icon} s={14} col={col}/>
      <span style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:"0.09em"}}>{label}</span>
    </div>
  );
}
function FL({children}){return <div style={{fontSize:12,fontWeight:700,color:C.sub,marginBottom:6}}>{children}</div>;}
function ErrBox({msg}){return <div style={{background:C.redL,border:`1px solid ${C.red}30`,borderRadius:12,padding:"11px 14px",fontSize:13,color:C.red,marginBottom:14,lineHeight:1.5}}>{msg}</div>;}
function IS(small){return{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:small?"10px":"12px 13px",fontSize:small?12:14,outline:"none",color:C.text,fontFamily:"inherit"};}
function PBtn({onClick,text,col,disabled,loading}){
  return(
    <button onClick={onClick} disabled={disabled||loading} className="tap"
      style={{width:"100%",background:(disabled||loading)?C.card2:col,border:"none",borderRadius:14,padding:"15px",fontSize:14,fontWeight:800,color:(disabled||loading)?C.sub:"#fff",cursor:(disabled||loading)?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:(disabled||loading)?"none":`0 3px 12px ${col}35`,transition:"all .2s"}}>
      {loading?<><Spin white/><span>Lädt…</span></>:text}
    </button>
  );
}
function Spin({white}){
  return <div style={{width:18,height:18,border:`2.5px solid ${white?"rgba(255,255,255,0.3)":C.border}`,borderTopColor:white?"#fff":C.green,borderRadius:"50%",animation:"spin 0.9s linear infinite"}}/>;
}

/* ─── sheet ──────────────────────────────────────────────────────────── */
function Sheet({onClose,title,children}){
  return(
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"flex-end",background:"rgba(0,0,0,0.32)",backdropFilter:"blur(8px)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="slide-up" style={{width:"100%",maxWidth:430,margin:"0 auto",background:C.card,borderRadius:"24px 24px 0 0",padding:`20px 20px calc(24px + env(safe-area-inset-bottom,0px))`,maxHeight:"92dvh",overflowY:"auto",boxShadow:"0 -8px 32px rgba(0,0,0,0.10)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:17,fontWeight:800}}>{title}</div>
          <button onClick={onClose} className="tap" style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"7px",cursor:"pointer",display:"flex"}}>
            <Ic n="x" s={16} col={C.sub}/>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── bottom nav ─────────────────────────────────────────────────────── */
function BottomNav({tab,setTab}){
  const tabs=[
    {id:"home",icon:"home",label:"Start"},
    {id:"pantry",icon:"pantry",label:"Vorrat"},
    {id:"recipes",icon:"chef",label:"Rezepte"},
    {id:"settings",icon:"settings",label:"Einstellungen"},
  ];
  return(
    <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",paddingBottom:"env(safe-area-inset-bottom,0px)",zIndex:50,boxShadow:"0 -1px 14px rgba(0,0,0,0.06)"}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} className="tap"
          style={{flex:1,padding:"12px 4px 10px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <Ic n={t.icon} s={22} col={tab===t.id?C.green:C.sub}/>
          <span style={{fontSize:10,fontWeight:700,color:tab===t.id?C.green:C.sub}}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ONBOARDING
════════════════════════════════════════════════════════════════════════ */
const DIET_OPTIONS=[
  {id:"alles",label:"Alles",emoji:"🍽️"},
  {id:"vegetarisch",label:"Vegetarisch",emoji:"🥦"},
  {id:"vegan",label:"Vegan",emoji:"🌱"},
  {id:"glutenfrei",label:"Glutenfrei",emoji:"🌾"},
  {id:"laktosefrei",label:"Laktosefrei",emoji:"🥛"},
];
const SUPERMARKT_OPTIONS=[
  {id:"migros",label:"Migros",emoji:"🟠"},
  {id:"coop",label:"Coop",emoji:"🔴"},
  {id:"lidl",label:"Lidl",emoji:"🔵"},
  {id:"aldi",label:"Aldi",emoji:"🟡"},
  {id:"andere",label:"Andere",emoji:"🛒"},
];

function Onboarding({onDone}){
  const [step,setStep]=useState(0);
  const [name,setName]=useState("");
  const [diet,setDiet]=useState([]);
  const [markets,setMarkets]=useState([]);
  const [err,setErr]=useState("");

  function toggle(arr,setArr,id){setArr(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);}

  function next(){
    if(step===0&&!name.trim()){setErr("Bitte gib deinen Namen ein.");return;}
    setErr("");
    if(step<2){setStep(s=>s+1);return;}
    onDone({name:name.trim(),diet,markets});
  }

  return(
    <div style={{position:"fixed",inset:0,zIndex:200,background:C.bg,display:"flex",flexDirection:"column",fontFamily:"'Outfit',sans-serif"}}>
      <div style={{height:"env(safe-area-inset-top,44px)",background:C.bg}}/>
      <div style={{padding:"20px 24px 0"}}>
        <div style={{display:"flex",gap:6,marginBottom:32}}>
          {[0,1,2].map(i=>(
            <div key={i} style={{flex:1,height:3,borderRadius:10,background:i<=step?C.green:C.border,transition:"background .3s"}}/>
          ))}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"0 24px"}}>
        {step===0&&(
          <div className="fu">
            <div style={{marginBottom:32}}>
              <div style={{fontSize:32,fontWeight:900,letterSpacing:"-1px",lineHeight:1.1,marginBottom:8}}>
                Hallo bei <span style={{color:C.green}}>freshly</span> 👋
              </div>
              <div style={{fontSize:15,color:C.sub,lineHeight:1.6}}>Dein smarter Küchen-Assistent für den Schweizer Alltag.</div>
            </div>
            <FL>Wie heisst du?</FL>
            {err&&<ErrBox msg={err}/>}
            <input value={name} onChange={e=>{setName(e.target.value);setErr("");}} placeholder="Dein Vorname" autoFocus style={{...IS(false),marginBottom:12,fontSize:18,fontWeight:700}}/>
            <div style={{fontSize:12,color:C.sub,marginBottom:32}}>Nur für die persönliche Begrüssung, lokal gespeichert.</div>
            {[
              {icon:"mic",text:"Spracheingabe: Einfach sprechen was du eingekauft hast",col:C.purple},
              {icon:"sparkle",text:"KI generiert Rezepte aus deinem aktuellen Vorrat",col:C.purple},
              {icon:"fire",text:"Ablaufdatum-Warnungen damit nichts verschwendet wird",col:C.red},
            ].map(f=>(
              <div key={f.text} style={{display:"flex",alignItems:"center",gap:12,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 14px",marginBottom:10}}>
                <div style={{background:`${f.col}15`,borderRadius:10,padding:"8px",flexShrink:0}}><Ic n={f.icon} s={18} col={f.col}/></div>
                <div style={{fontSize:13,color:C.text,lineHeight:1.4}}>{f.text}</div>
              </div>
            ))}
          </div>
        )}
        {step===1&&(
          <div className="fu">
            <div style={{marginBottom:28}}>
              <div style={{fontSize:28,fontWeight:900,letterSpacing:"-0.5px",marginBottom:8}}>Ernährungsweise</div>
              <div style={{fontSize:14,color:C.sub}}>Mehrfachauswahl möglich.</div>
            </div>
            {DIET_OPTIONS.map(d=>{
              const sel=diet.includes(d.id);
              return(
                <button key={d.id} onClick={()=>toggle(diet,setDiet,d.id)} className="tap"
                  style={{width:"100%",background:sel?C.greenL:C.card,border:`2px solid ${sel?C.green:C.border}`,borderRadius:16,padding:"16px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"all .15s",marginBottom:10}}>
                  <span style={{fontSize:24}}>{d.emoji}</span>
                  <span style={{fontSize:15,fontWeight:700,color:sel?C.green:C.text}}>{d.label}</span>
                  {sel&&<div style={{marginLeft:"auto"}}><Ic n="check" s={18} col={C.green} sw={2.5}/></div>}
                </button>
              );
            })}
          </div>
        )}
        {step===2&&(
          <div className="fu">
            <div style={{marginBottom:28}}>
              <div style={{fontSize:28,fontWeight:900,letterSpacing:"-0.5px",marginBottom:8}}>Deine Supermärkte</div>
              <div style={{fontSize:14,color:C.sub}}>Wo kaufst du hauptsächlich ein?</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {SUPERMARKT_OPTIONS.map(m=>{
                const sel=markets.includes(m.id);
                return(
                  <button key={m.id} onClick={()=>toggle(markets,setMarkets,m.id)} className="tap"
                    style={{background:sel?C.greenL:C.card,border:`2px solid ${sel?C.green:C.border}`,borderRadius:16,padding:"18px 14px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
                    <span style={{fontSize:28}}>{m.emoji}</span>
                    <span style={{fontSize:14,fontWeight:700,color:sel?C.green:C.text}}>{m.label}</span>
                    {sel&&<Ic n="check" s={16} col={C.green} sw={2.5}/>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div style={{padding:`16px 24px calc(20px + env(safe-area-inset-bottom,0px))`,background:C.bg,borderTop:`1px solid ${C.border}`}}>
        <button onClick={next} className="tap"
          style={{width:"100%",background:`linear-gradient(135deg,${C.green},#1a5c32)`,border:"none",borderRadius:16,padding:"16px",fontSize:16,fontWeight:800,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:`0 4px 18px ${C.green}38`,fontFamily:"inherit"}}>
          <span>{step<2?"Weiter":"Los geht's"}</span>
          <Ic n="arrow" s={18} col="#fff"/>
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   HOME TAB
════════════════════════════════════════════════════════════════════════ */
function HomeTab({items,recipes,soon,setTab,setModal,profile}){
  const daily=recipes[0]||null;
  return(
    <div style={{padding:"20px 20px 0"}} className="fu">

      {/* Sprach-Shortcut prominent */}
      <div style={{marginBottom:22}}>
        <button onClick={()=>setModal({type:"voice"})} className="tap"
          style={{width:"100%",background:`linear-gradient(135deg,${C.purple},#553c9a)`,border:"none",borderRadius:20,padding:"20px",cursor:"pointer",display:"flex",alignItems:"center",gap:16,boxShadow:`0 6px 24px ${C.purple}40`,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",right:-20,top:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.07)"}}/>
          <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Ic n="mic" s={28} col="#fff"/>
          </div>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:17,fontWeight:800,color:"#fff",marginBottom:3}}>Einkauf einräumen</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",lineHeight:1.5}}>
              Einfach sprechen: <em>"6 Eier 28. April, Milch 2. Mai"</em>
            </div>
          </div>
        </button>
      </div>

      {/* Tagesrezept */}
      <div style={{marginBottom:20}}>
        <SecLabel icon="star" col={C.amber} label="Tagesrezept"/>
        {daily?(
          <div onClick={()=>setModal({type:"view",data:daily})} className="tap"
            style={{background:`linear-gradient(135deg,${C.green},#1a5c32)`,borderRadius:20,padding:"20px",cursor:"pointer",boxShadow:`0 6px 24px ${C.green}40`,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",right:-20,top:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.07)"}}/>
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Heute empfohlen</div>
            <div style={{fontSize:20,fontWeight:800,color:"#fff",marginBottom:10,lineHeight:1.2}}>{daily.name}</div>
            <div style={{display:"flex",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.15)",borderRadius:20,padding:"5px 10px"}}>
                <Ic n="clock" s={13} col="rgba(255,255,255,0.9)"/>
                <span style={{fontSize:12,color:"rgba(255,255,255,0.9)",fontWeight:600}}>{daily.time} Min</span>
              </div>
              {daily.diet&&(
                <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.15)",borderRadius:20,padding:"5px 10px"}}>
                  <Ic n="leaf" s={13} col="rgba(255,255,255,0.9)"/>
                  <span style={{fontSize:12,color:"rgba(255,255,255,0.9)",fontWeight:600}}>{daily.diet}</span>
                </div>
              )}
            </div>
            <div style={{marginTop:10,fontSize:12,color:"rgba(255,255,255,0.6)"}}>{daily.ing.slice(0,3).join(" · ")}</div>
          </div>
        ):(
          <div onClick={()=>setModal({type:"ai"})} className="tap"
            style={{background:C.greenL,border:`1.5px dashed ${C.greenM}`,borderRadius:20,padding:"24px",textAlign:"center",cursor:"pointer"}}>
            <Ic n="sparkle" s={28} col={C.green}/>
            <div style={{fontSize:14,fontWeight:700,color:C.green,marginTop:8}}>KI-Rezept generieren</div>
            <div style={{fontSize:12,color:C.sub,marginTop:4}}>Noch kein Tagesrezept</div>
          </div>
        )}
      </div>

      {/* Ablaufende bald */}
      {soon.length>0&&(
        <div style={{marginBottom:20}}>
          <SecLabel icon="fire" col={C.red} label="Läuft bald ab"/>
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
          {soon.length>3&&(
            <button onClick={()=>setTab("pantry")} className="tap"
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px",fontSize:13,fontWeight:600,color:C.sub,cursor:"pointer",fontFamily:"inherit"}}>
              +{soon.length-3} weitere ansehen
            </button>
          )}
        </div>
      )}

      {/* Quick tiles */}
      <div style={{marginBottom:20}}>
        <SecLabel icon="pantry" col={C.sub} label="Übersicht"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div onClick={()=>setTab("recipes")} className="tap"
            style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <Ic n="chef" s={22} col={C.green}/>
            <div style={{fontSize:28,fontWeight:900,letterSpacing:"-1px",marginTop:8,color:C.text}}>{recipes.length}</div>
            <div style={{fontSize:12,color:C.sub,fontWeight:600,marginTop:2}}>Rezepte</div>
          </div>
          <div onClick={()=>setTab("pantry")} className="tap"
            style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <Ic n="pantry" s={22} col={C.orange}/>
            <div style={{fontSize:28,fontWeight:900,letterSpacing:"-1px",marginTop:8,color:C.text}}>{items.length}</div>
            <div style={{fontSize:12,color:C.sub,fontWeight:600,marginTop:2}}>Produkte</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   PANTRY TAB
════════════════════════════════════════════════════════════════════════ */
function PantryTab({items,removeItem,setModal}){
  const [q,setQ]=useState("");
  const [cat,setCat]=useState("all");
  const cats=["all",...new Set(items.map(i=>i.cat))];
  const list=items
    .filter(i=>(cat==="all"||i.cat===cat)&&i.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a,b)=>daysLeft(a.expiry)-daysLeft(b.expiry));

  return(
    <div className="fu">
      {/* Sprach-Banner */}
      <div style={{margin:"14px 20px 0"}}>
        <button onClick={()=>setModal({type:"voice"})} className="tap"
          style={{width:"100%",background:C.purpleL,border:`1.5px solid ${C.purple}30`,borderRadius:16,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,fontFamily:"inherit"}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:C.purple,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:`0 4px 12px ${C.purple}40`}}>
            <Ic n="mic" s={20} col="#fff"/>
          </div>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:14,fontWeight:800,color:C.purple}}>Per Sprache hinzufügen</div>
            <div style={{fontSize:12,color:C.sub,marginTop:1}}>"6 Eier 28. April, Milch 500ml 2. Mai"</div>
          </div>
        </button>
      </div>

      <div style={{padding:"12px 20px 0"}}>
        <div style={{display:"flex",gap:8,marginBottom:11}}>
          <div style={{flex:1,position:"relative",display:"flex",alignItems:"center"}}>
            <div style={{position:"absolute",left:11,pointerEvents:"none",display:"flex"}}><Ic n="search" s={16} col={C.sub}/></div>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Suchen…"
              style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 12px 11px 36px",fontSize:14,outline:"none",fontFamily:"inherit",color:C.text}}/>
          </div>
          <button onClick={()=>setModal({type:"addItem"})} className="tap"
            style={{background:C.orange,border:"none",borderRadius:12,padding:"0 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,boxShadow:`0 2px 8px ${C.orange}30`}}>
            <Ic n="plus" s={20} col="#fff"/>
            <span style={{fontSize:12,fontWeight:700,color:"#fff"}}>Manuell</span>
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
        {list.length===0&&<div style={{textAlign:"center",padding:"50px 0"}}><Ic n="pantry" s={40} col={C.border}/><div style={{color:C.sub,fontSize:14,marginTop:12}}>Nichts gefunden.</div></div>}
        {list.map((item,i)=>(
          <div key={item.id} className="fu" style={{animationDelay:`${i*0.04}s`,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
              <div style={{fontSize:12,color:C.sub,marginTop:1}}>{item.cat} · {item.qty} {item.unit}</div>
              <div style={{marginTop:6,display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:expiryColor(item.expiry),flexShrink:0}}/>
                <span style={{fontSize:11,color:expiryColor(item.expiry),fontWeight:700}}>{expiryLabel(item.expiry)}</span>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginLeft:10}}>
              <button onClick={()=>setModal({type:"addItem",edit:item})} className="tap" style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px",cursor:"pointer",display:"flex"}}><Ic n="edit" s={15} col={C.sub}/></button>
              <button onClick={()=>removeItem(item.id)} className="tap" style={{background:C.redL,border:`1px solid ${C.red}25`,borderRadius:9,padding:"8px",cursor:"pointer",display:"flex"}}><Ic n="trash" s={15} col={C.red}/></button>
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
function RecipesTab({recipes,items,setModal}){
  const [diet,setDiet]=useState("all");
  const diets=["all","vegetarisch","vegan","fleisch"];
  const list=recipes.filter(r=>diet==="all"||r.diet===diet);
  const hasEnough=items.length>=3;
  return(
    <div className="fu">
      <div style={{padding:"14px 20px 0"}}>
        {hasEnough?(
          <button onClick={()=>setModal({type:"ai"})} className="tap"
            style={{width:"100%",background:`linear-gradient(135deg,${C.green},#1a5c32)`,border:"none",borderRadius:16,padding:"17px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10,boxShadow:`0 4px 18px ${C.green}38`,fontFamily:"inherit"}}>
            <Ic n="sparkle" s={20} col="#fff"/>
            <span style={{fontSize:15,fontWeight:800,color:"#fff"}}>KI-Rezept aus meinem Vorrat</span>
          </button>
        ):(
          <div style={{background:C.orangeL,border:`1.5px solid ${C.orange}30`,borderRadius:16,padding:"16px",marginBottom:10,display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{marginTop:2}}><Ic n="info" s={18} col={C.orange}/></div>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:C.orange,marginBottom:4}}>Zu wenig Zutaten</div>
              <div style={{fontSize:13,color:C.sub,lineHeight:1.6}}>Du hast erst <strong>{items.length}</strong> {items.length===1?"Produkt":"Produkte"} im Vorrat. Mindestens 3 werden benötigt.</div>
            </div>
          </div>
        )}
        <button onClick={()=>setModal({type:"addRecipe"})} className="tap"
          style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:"12px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",fontFamily:"inherit"}}>
          <Ic n="plus" s={17} col={C.orange}/>
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
        {list.length===0&&<div style={{textAlign:"center",padding:"50px 0"}}><Ic n="chef" s={40} col={C.border}/><div style={{color:C.sub,fontSize:14,marginTop:12}}>Noch keine Rezepte.</div></div>}
        {list.map((r,i)=>(
          <div key={r.id} onClick={()=>setModal({type:"view",data:r})} className="fu tap"
            style={{animationDelay:`${i*0.05}s`,background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",marginBottom:10,cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>{r.name}</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              <Chip icon="clock" text={`${r.time} Min`} col={C.orange}/>
              <Chip text={r.diff} col={C.sub}/>
              {r.diet&&<Chip icon="leaf" text={r.diet} col={C.green}/>}
              {r.gen&&<Chip icon="sparkle" text="KI" col={C.purple}/>}
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
function SettingsTab({profile,onResetProfile}){
  return(
    <div style={{padding:"20px"}} className="fu">
      <SecLabel icon="settings" col={C.orange} label="Einstellungen"/>
      {profile&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",marginBottom:12,display:"flex",alignItems:"center",gap:14,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:`linear-gradient(135deg,${C.green},#1a5c32)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:18,fontWeight:800,color:"#fff"}}>{profile.name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>{profile.name}</div>
            <div style={{fontSize:12,color:C.sub,marginTop:2}}>
              {profile.diet.length>0?profile.diet.join(", "):"Keine Präferenz"} · {profile.markets.length>0?profile.markets.join(", "):"Alle Märkte"}
            </div>
          </div>
        </div>
      )}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>Über Freshly</div>
        <div style={{fontSize:13,color:C.sub,lineHeight:1.8}}>Version 3.0 · Sprach-gestützte Lebensmittelverwaltung<br/>Optimiert für Schweizer Supermärkte</div>
      </div>
      <button onClick={onResetProfile} className="tap"
        style={{width:"100%",background:C.redL,border:`1px solid ${C.red}25`,borderRadius:14,padding:"14px",fontSize:14,fontWeight:700,color:C.red,cursor:"pointer",fontFamily:"inherit"}}>
        Profil zurücksetzen
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   VOICE MODAL
════════════════════════════════════════════════════════════════════════ */
function VoiceModal({onClose,onAddMany}){
  const [phase,setPhase]=useState("idle"); // idle | listening | result | confirm
  const [transcript,setTranscript]=useState("");
  const [interim,setInterim]=useState("");
  const [parsed,setParsed]=useState([]);
  const [selected,setSelected]=useState({});
  const [editItem,setEditItem]=useState({}); // per-index overrides
  const [err,setErr]=useState("");
  const recogRef=useRef(null);

  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const supported=!!SR;

  function startListening(){
    if(!supported){setErr("Spracherkennung nicht verfügbar. Bitte Safari auf dem iPhone verwenden.");return;}
    setErr("");setTranscript("");setInterim("");setPhase("listening");
    const r=new SR();
    r.lang="de-CH";r.continuous=true;r.interimResults=true;r.maxAlternatives=1;
    recogRef.current=r;
    r.onresult=e=>{
      let fin="",tmp="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        const t=e.results[i][0].transcript;
        if(e.results[i].isFinal)fin+=t+" ";else tmp+=t;
      }
      if(fin)setTranscript(p=>p+fin);
      setInterim(tmp);
    };
    r.onerror=e=>{
      if(e.error==="not-allowed")setErr("Mikrofon-Zugriff verweigert. Bitte in Safari-Einstellungen erlauben.");
      else if(e.error!=="aborted")setErr(`Fehler: ${e.error}`);
      setPhase("idle");
    };
    r.onend=()=>{setInterim("");setPhase(p=>p==="listening"?"result":p);};
    r.start();
  }

  function stopListening(){recogRef.current?.stop();setPhase("result");}

  function analyse(){
    const full=(transcript+" "+interim).trim();
    if(!full){setErr("Nichts aufgenommen. Bitte nochmal versuchen.");setPhase("idle");return;}
    const items=parseVoiceText(full);
    if(!items.length){setErr("Konnte keine Produkte erkennen. Klarer sprechen oder Text unten korrigieren.");setPhase("result");return;}
    const sel={};items.forEach((_,i)=>{sel[i]=true;});
    const edits={};items.forEach((it,i)=>{edits[i]={...it};});
    setParsed(items);setSelected(sel);setEditItem(edits);
    setPhase("confirm");
  }

  function confirm(){
    const toAdd=parsed.filter((_,i)=>selected[i]).map((_,i)=>editItem[i]||parsed[i]);
    if(toAdd.length>0)onAddMany(toAdd);
    onClose();
  }

  const selCount=parsed.filter((_,i)=>selected[i]).length;

  // Format date for display
  function fmtDate(s){
    if(!s)return"";
    const d=new Date(s);
    return d.toLocaleDateString("de-CH",{day:"numeric",month:"short"});
  }

  return(
    <Sheet onClose={onClose} title="Per Sprache hinzufügen">

      {/* Beispiele */}
      {(phase==="idle"||phase==="result")&&(
        <div style={{background:C.purpleL,border:`1px solid ${C.purple}25`,borderRadius:14,padding:"14px",marginBottom:18}}>
          <div style={{fontSize:12,fontWeight:700,color:C.purple,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Beispiele</div>
          {[
            "6 Eier 28. April",
            "Milch 2 Liter 2. Mai",
            "500 Gramm Hackfleisch 25.04.",
            "Joghurt 3 Stück 15. Mai, Butter 29.04.",
            "Sechserpack Bier 30.06.",
          ].map(ex=>(
            <div key={ex} style={{fontSize:12,color:C.sub,padding:"3px 0",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:6}}>
              <span style={{color:C.purple,fontSize:10}}>▸</span>
              <em style={{color:C.text}}>"{ex}"</em>
            </div>
          ))}
          <div style={{fontSize:11,color:C.sub,marginTop:8,lineHeight:1.5}}>
            Mehrere Produkte mit Komma oder "und" trennen.
          </div>
        </div>
      )}

      {err&&<ErrBox msg={err}/>}

      {/* IDLE */}
      {phase==="idle"&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:"8px 0 16px"}}>
          <button onClick={startListening} disabled={!supported} className="tap"
            style={{width:96,height:96,borderRadius:"50%",background:supported?C.purple:C.card2,border:"none",cursor:supported?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:supported?`0 8px 28px ${C.purple}45`:"none",transition:"transform .15s"}}>
            <Ic n="mic" s={40} col="#fff"/>
          </button>
          <div style={{fontSize:14,fontWeight:700,color:C.purple}}>Tippen zum Starten</div>
          {!supported&&<div style={{fontSize:12,color:C.sub,textAlign:"center"}}>Nur in Safari auf dem iPhone verfügbar.</div>}
        </div>
      )}

      {/* LISTENING */}
      {phase==="listening"&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,padding:"8px 0"}}>
          <style>{`@keyframes pr{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.18);opacity:.15}}`}</style>
          <div style={{position:"relative",width:110,height:110,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{position:"absolute",width:110,height:110,borderRadius:"50%",background:`${C.purple}22`,animation:"pr 1.3s ease infinite"}}/>
            <div style={{position:"absolute",width:88,height:88,borderRadius:"50%",background:`${C.purple}15`,animation:"pr 1.3s ease .35s infinite"}}/>
            <button onClick={stopListening} className="tap"
              style={{width:72,height:72,borderRadius:"50%",background:C.purple,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 6px 24px ${C.purple}45`,zIndex:1}}>
              <Ic n="stop" s={26} col="#fff" sw={0}/>
            </button>
          </div>
          <div style={{fontSize:14,fontWeight:700,color:C.purple}}>Höre zu… Tippen zum Stoppen</div>
          <div style={{width:"100%",background:C.card2,borderRadius:14,padding:"14px",minHeight:72,fontSize:14,color:C.text,lineHeight:1.65,border:`1px solid ${C.border}`}}>
            {transcript&&<span>{transcript}</span>}
            {interim&&<span style={{color:C.sub}}>{interim}</span>}
            {!transcript&&!interim&&<span style={{color:C.sub}}>Sprich jetzt…</span>}
          </div>
        </div>
      )}

      {/* RESULT — Text korrigieren */}
      {phase==="result"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <FL>Aufgenommener Text — bei Bedarf korrigieren</FL>
            <textarea value={transcript} onChange={e=>setTranscript(e.target.value)} rows={4}
              style={{...IS(false),resize:"none"}}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setTranscript("");setPhase("idle");}} className="tap"
              style={{flex:1,background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px",fontSize:13,fontWeight:700,color:C.sub,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Ic n="refresh" s={15} col={C.sub}/> Nochmal
            </button>
            <button onClick={analyse} className="tap"
              style={{flex:2,background:C.purple,border:"none",borderRadius:12,padding:"13px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Ic n="check" s={16} col="#fff" sw={2.5}/> Produkte erkennen
            </button>
          </div>
        </div>
      )}

      {/* CONFIRM */}
      {phase==="confirm"&&(
        <div>
          <div style={{fontSize:13,color:C.sub,marginBottom:14}}>
            <strong style={{color:C.text}}>{selCount}</strong> von {parsed.length} erkannt · Datum und Menge anpassen falls nötig
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
            {parsed.map((item,i)=>{
              const ed=editItem[i]||item;
              const sel=selected[i];
              return(
                <div key={i}
                  style={{background:C.card,border:`1.5px solid ${sel?C.purple:C.border}`,borderRadius:16,padding:"14px",transition:"border-color .15s"}}>
                  {/* header row — tap to toggle */}
                  <div onClick={()=>setSelected(s=>({...s,[i]:!s[i]}))} className="tap"
                    style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:sel?12:0}}>
                    <div style={{width:22,height:22,borderRadius:6,background:sel?C.purple:C.card2,border:`1.5px solid ${sel?C.purple:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                      {sel&&<Ic n="check" s={13} col="#fff" sw={2.5}/>}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14}}>{ed.name}</div>
                      <div style={{fontSize:12,color:C.sub,marginTop:1}}>
                        {ed.qty} {ed.unit} · <span style={{color:expiryColor(ed.expiry),fontWeight:700}}>{fmtDate(ed.expiry)}</span>
                      </div>
                    </div>
                  </div>
                  {/* editable fields when selected */}
                  {sel&&(
                    <div onClick={e=>e.stopPropagation()} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      <div>
                        <FL>Name</FL>
                        <input value={ed.name} onChange={e=>setEditItem(m=>({...m,[i]:{...ed,name:e.target.value}}))}
                          style={{...IS(true),fontSize:13}}/>
                      </div>
                      <div>
                        <FL>Menge</FL>
                        <input type="number" value={ed.qty} onChange={e=>setEditItem(m=>({...m,[i]:{...ed,qty:e.target.value}}))}
                          style={{...IS(true),fontSize:13}}/>
                      </div>
                      <div>
                        <FL>Datum</FL>
                        <input type="date" value={ed.expiry} onChange={e=>setEditItem(m=>({...m,[i]:{...ed,expiry:e.target.value}}))}
                          style={{...IS(true),fontSize:11}}/>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setPhase("idle");setTranscript("");}} className="tap"
              style={{flex:1,background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px",fontSize:13,fontWeight:700,color:C.sub,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Ic n="refresh" s={15} col={C.sub}/> Nochmal
            </button>
            <button onClick={confirm} disabled={selCount===0} className="tap"
              style={{flex:2,background:selCount===0?C.card2:C.purple,border:"none",borderRadius:12,padding:"13px",fontSize:13,fontWeight:700,color:selCount===0?C.sub:"#fff",cursor:selCount===0?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:selCount===0?"none":`0 4px 14px ${C.purple}40`}}>
              {selCount===0?"Nichts ausgewählt":`${selCount} Produkt${selCount>1?"e":""} hinzufügen`}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ITEM MODAL (manuell)
════════════════════════════════════════════════════════════════════════ */
const CATS=["Milchprodukte","Fleisch","Gemüse","Obst","Pasta & Reis","Konserven","Getränke","Brot & Gebäck","Snacks","Saucen","Öle","Tiefkühl","Sonstiges"];
const UNITS=["Stk","g","kg","ml","L","Dosen","Kopf","Bund","Päckli"];

function ItemModal({onClose,onSave,item}){
  const [f,setF]=useState(item||{name:"",cat:"Sonstiges",qty:"1",unit:"Stk",expiry:daysFromNow(14)});
  const [err,setErr]=useState("");
  function save(){if(!f.name.trim()){setErr("Bitte einen Namen eingeben.");return;}onSave(f);onClose();}
  return(
    <Sheet onClose={onClose} title={item?"Produkt bearbeiten":"Manuell hinzufügen"}>
      {err&&<ErrBox msg={err}/>}
      <FL>Name</FL>
      <input value={f.name} onChange={e=>{setF(p=>({...p,name:e.target.value}));setErr("");}} placeholder="z.B. Vollmilch" style={{...IS(false),marginBottom:14}}/>
      <FL>Ablaufdatum (von der Packung)</FL>
      <input type="date" value={f.expiry} onChange={e=>setF(p=>({...p,expiry:e.target.value}))} style={{...IS(false),marginBottom:14}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div><FL>Menge</FL><input type="number" value={f.qty} onChange={e=>setF(p=>({...p,qty:e.target.value}))} style={IS(false)}/></div>
        <div><FL>Einheit</FL><select value={f.unit} onChange={e=>setF(p=>({...p,unit:e.target.value}))} style={IS(false)}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></div>
      </div>
      <FL>Kategorie</FL>
      <select value={f.cat} onChange={e=>setF(p=>({...p,cat:e.target.value}))} style={{...IS(false),marginBottom:20}}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
      <PBtn onClick={save} text={item?"Speichern":"Hinzufügen"} col={C.orange}/>
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   RECIPE FORM
════════════════════════════════════════════════════════════════════════ */
function RecipeForm({onClose,onSave}){
  const [f,setF]=useState({name:"",time:30,diff:"Einfach",diet:"vegetarisch",ings:"",stepsText:"",gen:false});
  const [err,setErr]=useState("");
  function save(){
    if(!f.name.trim()){setErr("Bitte einen Namen eingeben.");return;}
    if(!f.ings.trim()){setErr("Bitte mindestens eine Zutat eingeben.");return;}
    onSave({...f,ing:f.ings.split("\n").filter(Boolean),steps:f.stepsText.split("\n").filter(Boolean)});
    onClose();
  }
  return(
    <Sheet onClose={onClose} title="Rezept erstellen">
      {err&&<ErrBox msg={err}/>}
      <FL>Name</FL>
      <input value={f.name} onChange={e=>{setF(p=>({...p,name:e.target.value}));setErr("");}} placeholder="z.B. Gemüse-Curry" style={{...IS(false),marginBottom:14}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        <div><FL>Zeit (Min)</FL><input type="number" value={f.time} onChange={e=>setF(p=>({...p,time:+e.target.value}))} style={IS(false)}/></div>
        <div><FL>Schwierigk.</FL><select value={f.diff} onChange={e=>setF(p=>({...p,diff:e.target.value}))} style={IS(true)}>{["Einfach","Mittel","Schwer"].map(d=><option key={d}>{d}</option>)}</select></div>
        <div><FL>Ernährung</FL><select value={f.diet} onChange={e=>setF(p=>({...p,diet:e.target.value}))} style={IS(true)}>{["vegetarisch","vegan","fleisch"].map(d=><option key={d}>{d}</option>)}</select></div>
      </div>
      <FL>Zutaten (eine pro Zeile)</FL>
      <textarea value={f.ings} onChange={e=>{setF(p=>({...p,ings:e.target.value}));setErr("");}} rows={3} placeholder={"400g Spaghetti\n2 Eier"} style={{...IS(false),resize:"none",marginBottom:14}}/>
      <FL>Schritte (einer pro Zeile)</FL>
      <textarea value={f.stepsText} onChange={e=>setF(p=>({...p,stepsText:e.target.value}))} rows={3} placeholder={"Wasser kochen\nPasta kochen"} style={{...IS(false),resize:"none",marginBottom:20}}/>
      <PBtn onClick={save} text="Rezept speichern" col={C.green}/>
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   AI MODAL
════════════════════════════════════════════════════════════════════════ */
function AiModal({onClose,items,onSave}){
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
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:MODEL,max_tokens:1200,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      const text=data.content?.find(b=>b.type==="text")?.text||"";
      const recipe=JSON.parse(text.replace(/```json|```/g,"").trim());
      onSave(recipe);
    }catch{
      setErr("Fehler beim Generieren. Bitte nochmal versuchen.");
      setLoading(false);
    }
  }
  return(
    <Sheet onClose={onClose} title="KI-Rezept generieren">
      <div style={{background:C.greenL,border:`1px solid ${C.greenM}`,borderRadius:12,padding:"13px 14px",marginBottom:18,fontSize:13,color:C.sub,lineHeight:1.6}}>
        KI analysiert deine <strong style={{color:C.green}}>{items.length} Produkte</strong> und kocht ein passendes Rezept.
      </div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,color:C.sub,marginBottom:8}}>Maximalzeit: {time} Minuten</div>
        <input type="range" min={10} max={120} step={5} value={time} onChange={e=>setTime(+e.target.value)} style={{width:"100%",accentColor:C.green}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.sub,marginTop:3}}><span>10 Min</span><span>120 Min</span></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
        <div><FL>Ernährung</FL><select value={diet} onChange={e=>setDiet(e.target.value)} style={IS(false)}>{["egal","vegetarisch","vegan","fleisch"].map(d=><option key={d}>{d}</option>)}</select></div>
        <div><FL>Schwierigkeit</FL><select value={diff} onChange={e=>setDiff(e.target.value)} style={IS(false)}>{["Einfach","Mittel","Schwer"].map(d=><option key={d}>{d}</option>)}</select></div>
      </div>
      {err&&<ErrBox msg={err}/>}
      <PBtn onClick={generate} text={<><Ic n="sparkle" s={18} col="#fff"/><span>Rezept generieren</span></>} col={C.green} loading={loading}/>
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   RECIPE VIEW
════════════════════════════════════════════════════════════════════════ */
function RecipeView({onClose,recipe}){
  return(
    <Sheet onClose={onClose} title={recipe.name}>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:20}}>
        <Chip icon="clock" text={`${recipe.time} Min`} col={C.orange}/>
        <Chip text={recipe.diff} col={C.sub}/>
        {recipe.diet&&<Chip icon="leaf" text={recipe.diet} col={C.green}/>}
        {recipe.gen&&<Chip icon="sparkle" text="KI generiert" col={C.purple}/>}
      </div>
      <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Zutaten</div>
      {recipe.ing?.map((ing,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:C.green,flexShrink:0}}/>
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
export default function App(){
  const [profile,setProfile]=useState(()=>loadProfile());
  const [tab,setTab]=useState("home");
  const [items,setItems]=useState(SEED_ITEMS);
  const [recipes,setRecipes]=useState(SEED_RECIPES);
  const [nid,setNid]=useState(500);
  const [modal,setModal]=useState(null);

  const soon=items.filter(i=>daysLeft(i.expiry)<=3);

  function newId(){const id=nid;setNid(id+1);return id;}
  function addItem(item){setItems(p=>[...p,{...item,id:newId(),added:todayStr()}]);}
  function addItems(arr){let base=nid;setNid(base+arr.length);setItems(p=>[...p,...arr.map((it,i)=>({...it,id:base+i,added:todayStr()}))]);}
  function updateItem(u){setItems(p=>p.map(i=>i.id===u.id?u:i));}
  function removeItem(id){setItems(p=>p.filter(i=>i.id!==id));}
  function addRecipe(r){const id=newId();const full={...r,id};setRecipes(p=>[...p,full]);return full;}
  function handleOnboardingDone(p){saveProfile(p);setProfile(p);}
  function resetProfile(){try{localStorage.removeItem("freshly_profile");}catch{}setProfile(null);}

  if(!profile)return <Onboarding onDone={handleOnboardingDone}/>;

  return(
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

      <div style={{height:"env(safe-area-inset-top,44px)",background:C.card}}/>
      <header style={{padding:"12px 20px 10px",background:C.card,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:40,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:24,fontWeight:900,letterSpacing:"-0.8px",lineHeight:1}}>
              <span style={{color:C.text}}>fresh</span><span style={{color:C.green}}>ly</span>
            </div>
            <div style={{fontSize:11,color:C.sub,fontWeight:500,marginTop:1}}>{greet(profile?.name)}</div>
          </div>
          {soon.length>0&&(
            <button onClick={()=>setTab("pantry")} className="tap"
              style={{background:C.redL,border:`1px solid ${C.red}28`,borderRadius:10,padding:"7px 12px",display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontFamily:"inherit"}}>
              <Ic n="warning" s={14} col={C.red}/>
              <span style={{fontSize:12,color:C.red,fontWeight:700}}>{soon.length} bald ab</span>
            </button>
          )}
        </div>
      </header>

      <main style={{paddingBottom:88}}>
        {tab==="home"    &&<HomeTab    items={items} recipes={recipes} soon={soon} setTab={setTab} setModal={setModal} profile={profile}/>}
        {tab==="pantry"  &&<PantryTab  items={items} removeItem={removeItem} setModal={setModal}/>}
        {tab==="recipes" &&<RecipesTab recipes={recipes} items={items} setModal={setModal}/>}
        {tab==="settings"&&<SettingsTab profile={profile} onResetProfile={resetProfile}/>}
      </main>

      <BottomNav tab={tab} setTab={setTab}/>

      {modal?.type==="voice"     &&<VoiceModal    onClose={()=>setModal(null)} onAddMany={addItems}/>}
      {modal?.type==="addItem"   &&<ItemModal     onClose={()=>setModal(null)} onSave={modal.edit?updateItem:addItem} item={modal.edit||null}/>}
      {modal?.type==="addRecipe" &&<RecipeForm    onClose={()=>setModal(null)} onSave={addRecipe}/>}
      {modal?.type==="ai"        &&<AiModal       onClose={()=>setModal(null)} items={items} onSave={r=>{const full=addRecipe(r);setModal({type:"view",data:full});}}/>}
      {modal?.type==="view"      &&<RecipeView    onClose={()=>setModal(null)} recipe={modal.data}/>}
    </div>
  );
}
