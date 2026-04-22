import { useState, useRef, useEffect } from "react";

/* ─── utils ─────────────────────────────────────────────────────────── */
function daysFromNow(n){const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().split("T")[0];}
function todayStr(){return new Date().toISOString().split("T")[0];}
function daysLeft(s){return Math.ceil((new Date(s)-new Date())/86400000);}
function expiryColor(s){const d=daysLeft(s);return d<=3?"#C53030":d<=7?"#B7791F":"#276749";}
function expiryLabel(s){const d=daysLeft(s);if(d<=0)return"Abgelaufen";if(d===1)return"Morgen";return`${d} Tage`;}
function greet(name){const h=new Date().getHours();const g=h<12?"Guten Morgen":h<18?"Guten Tag":"Guten Abend";return name?`${g}, ${name}`:g;}

// Daily recipe index: changes at midnight, based on date
function getDailyRecipe(menuPlan,profileDiet){
  const d=new Date();
  const seed=d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
  const dayName=["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"][d.getDay()];
  const planPref=menuPlan?menuPlan[dayName]:"beliebig";
  let dietFilter=null;
  if(planPref&&planPref!=="beliebig"&&planPref!=="frei"){
    dietFilter=planPref;
  } else if(profileDiet&&profileDiet.length>0&&!profileDiet.includes("alles")){
    const pref=profileDiet.find(x=>x!=="alles"&&x!=="glutenfrei"&&x!=="laktosefrei");
    if(pref)dietFilter=pref;
  }
  let candidates=RECIPE_DB;
  if(dietFilter)candidates=RECIPE_DB.filter(r=>r.diet===dietFilter);
  if(candidates.length===0)candidates=RECIPE_DB;
  return candidates[seed%candidates.length];
}

function loadProfile(){try{const r=localStorage.getItem("freshly_profile");return r?JSON.parse(r):null;}catch{return null;}}
function saveProfile(p){try{localStorage.setItem("freshly_profile",JSON.stringify(p));}catch{}}
function loadMenuPlan(){try{const r=localStorage.getItem("freshly_menuplan");return r?JSON.parse(r):{};}catch{return{};}}
function saveMenuPlan(p){try{localStorage.setItem("freshly_menuplan",JSON.stringify(p));}catch{}}

/* ─── auto category ──────────────────────────────────────────────────── */
const CAT_RULES=[
  {cat:"Milchprodukte",words:["milch","rahm","butter","käse","joghurt","quark","emmentaler","gruyère","mozzarella","parmesan","frischkäse","hüttenkäse","sahne","crème","ei","eier","kefir","buttermilch","appenzeller","tilsiter","raclette","ricotta"]},
  {cat:"Fleisch",words:["fleisch","hack","hackfleisch","poulet","hühnchen","hähnchen","huhn","schwein","rind","lamm","kalb","speck","schinken","wurst","salami","cervelat","landjäger","bratwurst","aufschnitt","steak","filet","schnitzel","gehacktes","mett","speck"]},
  {cat:"Fisch",words:["fisch","lachs","thunfisch","forelle","kabeljau","garnelen","crevetten","muscheln","shrimps","sushi","sardinen","hering"]},
  {cat:"Gemüse",words:["tomaten","gurke","salat","spinat","brokkoli","karotten","karotte","zwiebel","zwiebeln","knoblauch","paprika","zucchini","aubergine","champignons","pilze","sellerie","lauch","peperoni","kohl","blumenkohl","rüebli","fenchel","erbsen","mais","bohnen","linsen","kichererbsen","avocado","spargel","artischocke","randen","tofu"]},
  {cat:"Obst",words:["apfel","äpfel","birne","banane","orange","zitronen","limette","erdbeeren","himbeeren","blaubeeren","trauben","mango","ananas","kiwi","pfirsich","aprikose","pflaume","kirschen","melone","beeren","früchte"]},
  {cat:"Pasta & Reis",words:["spaghetti","pasta","nudeln","penne","fusilli","rigatoni","tagliatelle","lasagne","reis","basmatireis","jasminreis","risotto","couscous","quinoa","bulgur","polenta","gnocchi","vollkornnudeln","hörnli"]},
  {cat:"Brot & Gebäck",words:["brot","brötchen","toast","vollkornbrot","ruchbrot","zopf","croissant","baguette","mehl","weissmehl","vollkornmehl","backpulver","hefe","hafer","haferflocken","müsli","knäckebrot","dinkel"]},
  {cat:"Konserven",words:["dose","dosen","konserve","tomatenmark","tomatensauce","passata","suppe","bouillon","coconut","kokosmilch","oliven","kapern","sauerkraut"]},
  {cat:"Getränke",words:["wasser","mineralwasser","saft","orangensaft","apfelsaft","cola","limonade","bier","wein","rotwein","weisswein","kaffee","tee","espresso","energydrink"]},
  {cat:"Saucen",words:["sauce","saucen","ketchup","mayo","mayonnaise","senf","dressing","pesto","sojasosse","worcester","tabasco","chutney","aioli","hummus","sambal"]},
  {cat:"Öle",words:["öl","olivenöl","rapsöl","sonnenblumenöl","kokosöl","margarine","ghee","essig","balsamico"]},
  {cat:"Snacks",words:["chips","cracker","popcorn","nüsse","mandeln","cashews","erdnüsse","schokolade","riegel","kekse","guetzli","gipfeli","plätzchen","waffeln","gummibären","bonbons","studentenfutter"]},
  {cat:"Tiefkühl",words:["tiefkühl","gefroren","frozen","tiefgekühlte","pommes","glacé","sorbet"]},
];
function guessCategory(name){const n=name.toLowerCase();for(const r of CAT_RULES){if(r.words.some(w=>n.includes(w)))return r.cat;}return"Sonstiges";}

/* ─── recipe database ────────────────────────────────────────────────── */
const RECIPE_DB=[
  {id:"r1",name:"Spaghetti Aglio e Olio",time:20,diff:"Einfach",diet:"vegetarisch",cat:"Pasta",servings:4,ing:["400g Spaghetti","4 Knoblauchzehen","6 EL Olivenöl","1 TL Peperoncino","Salz"],steps:["Spaghetti in Salzwasser bissfest kochen.","Knoblauch in Scheiben schneiden, in Olivenöl goldbraun braten.","Peperoncino kurz mitrösten.","Pasta abgiessen, mit Öl und etwas Kochwasser vermengen."]},
  {id:"r2",name:"Carbonara",time:25,diff:"Mittel",diet:"fleisch",cat:"Pasta",servings:4,ing:["400g Spaghetti","150g Speck","3 Eier","80g Parmesan","Pfeffer"],steps:["Spaghetti in Salzwasser kochen.","Speck in Würfeln knusprig braten.","Eier mit geriebenem Parmesan verquirlen.","Pasta vom Feuer nehmen, Ei-Mischung einrühren, Speck dazu."]},
  {id:"r3",name:"Penne Arrabiata",time:25,diff:"Einfach",diet:"vegan",cat:"Pasta",servings:4,ing:["400g Penne","400g Tomaten (Dose)","3 Knoblauchzehen","1 TL Chili","3 EL Olivenöl"],steps:["Penne in Salzwasser kochen.","Knoblauch und Chili in Öl anbraten.","Tomaten dazu, 10 Min köcheln, würzen.","Mit Pasta vermengen."]},
  {id:"r4",name:"Lachs-Pasta mit Rahm",time:30,diff:"Einfach",diet:"fleisch",cat:"Pasta",servings:4,ing:["400g Pasta","300g Lachs","200ml Rahm","1 Zwiebel","1 Bund Dill","1 Zitrone"],steps:["Pasta kochen.","Zwiebel andünsten, Lachs würfeln und dazugeben.","Rahm eingiessen, 5 Min köcheln.","Mit Dill und Zitrone abschmecken."]},
  {id:"r5",name:"Risotto ai Funghi",time:35,diff:"Mittel",diet:"vegetarisch",cat:"Pasta",servings:4,ing:["300g Risottoreis","300g Champignons","1 Zwiebel","150ml Weisswein","1L Gemüsebouillon","80g Parmesan","30g Butter"],steps:["Zwiebel andünsten, Reis zugeben.","Mit Wein ablöschen, verdampfen lassen.","Schöpflöffelweise Bouillon zugeben, ca. 20 Min rühren.","Pilze separat braten, untermengen. Mit Parmesan und Butter verfeinern."]},
  {id:"r6",name:"Zürcher Geschnetzeltes",time:30,diff:"Mittel",diet:"fleisch",cat:"Fleisch",servings:4,ing:["600g Kalbsgeschnetzeltes","300g Champignons","1 Zwiebel","200ml Rahm","100ml Weisswein","30g Butter","Salz, Pfeffer"],steps:["Fleisch scharf anbraten, beiseite stellen.","Pilze und Zwiebeln andünsten.","Mit Wein ablöschen, Rahm zugeben.","5 Min köcheln, Fleisch beigeben. Mit Rösti servieren."]},
  {id:"r7",name:"Poulet im Ofen",time:65,diff:"Einfach",diet:"fleisch",cat:"Fleisch",servings:4,ing:["1 Poulet (ca. 1.5kg)","3 EL Olivenöl","2 Zweige Rosmarin","2 Zweige Thymian","4 Knoblauchzehen","1 Zitrone","Salz, Pfeffer"],steps:["Ofen auf 200°C vorheizen.","Poulet mit Öl, Kräutern, Salz und Pfeffer einreiben.","Zitrone und Knoblauch in die Höhle stecken.","Ca. 60 Min backen bis goldbraun, 10 Min ruhen lassen."]},
  {id:"r8",name:"Hackbällchen in Tomatensauce",time:35,diff:"Einfach",diet:"fleisch",cat:"Fleisch",servings:4,ing:["500g Hackfleisch","1 Ei","50g Semmelbrösel","400g Tomaten (Dose)","3 Knoblauchzehen","1 TL Oregano"],steps:["Hackbällchen aus Fleisch, Ei und Bröseln formen.","Anbraten bis braun.","Knoblauch kurz mitbraten, Tomaten und Oregano dazu.","20 Min köcheln."]},
  {id:"r9",name:"Chicken Tikka Masala",time:40,diff:"Mittel",diet:"fleisch",cat:"Fleisch",servings:4,ing:["600g Pouletbrust","400g Tomaten (Dose)","200ml Rahm","1 Zwiebel","2 EL Tikka Masala Gewürz","3 Knoblauchzehen","20g Ingwer"],steps:["Poulet würfeln, mit Gewürz marinieren.","Zwiebeln andünsten, Fleisch anbraten.","Tomaten und Rahm zugeben, 20 Min köcheln.","Mit Basmatireis servieren."]},
  {id:"r10",name:"Gemüse-Curry",time:30,diff:"Einfach",diet:"vegan",cat:"Vegetarisch",servings:4,ing:["1 Zucchini","1 Paprika","400g Kichererbsen (Dose)","400ml Kokosmilch","2 EL Curry","3 Knoblauchzehen","20g Ingwer","300g Reis"],steps:["Gemüse würfeln und anbraten.","Curry, Knoblauch, Ingwer kurz mitbraten.","Kokosmilch und Kichererbsen dazu.","15 Min köcheln, mit Reis servieren."]},
  {id:"r11",name:"Spinat-Ricotta-Quiche",time:55,diff:"Mittel",diet:"vegetarisch",cat:"Vegetarisch",servings:6,ing:["1 Mürbeteig (rund)","300g Spinat (TK)","250g Ricotta","3 Eier","100ml Rahm","1 Prise Muskat","Salz, Pfeffer"],steps:["Ofen auf 180°C vorheizen. Teig in Form legen.","Spinat auftauen, gut ausdrücken.","Mit Ricotta, Eiern, Rahm, Muskat vermengen.","Füllung auf Teig giessen, 40 Min backen."]},
  {id:"r12",name:"Ofengemüse mit Feta",time:45,diff:"Einfach",diet:"vegetarisch",cat:"Vegetarisch",servings:4,ing:["2 Paprika","2 Zucchini","1 Aubergine","200g Feta","4 EL Olivenöl","1 TL Thymian","3 Knoblauchzehen"],steps:["Gemüse in grobe Stücke schneiden.","Mit Öl, Thymian und Knoblauch auf Blech geben.","Feta drüber bröseln.","35 Min bei 200°C backen."]},
  {id:"r13",name:"Linsensuppe",time:40,diff:"Einfach",diet:"vegan",cat:"Suppe",servings:4,ing:["300g rote Linsen","2 Karotten","2 Stangen Sellerie","1 Zwiebel","1L Gemüsebouillon","1 TL Cumin","1 TL Paprika"],steps:["Zwiebeln andünsten.","Gemüse würfeln, kurz mitbraten.","Linsen und Bouillon zugeben.","25 Min kochen bis weich, nach Wunsch pürieren."]},
  {id:"r14",name:"Tomatensuppe",time:30,diff:"Einfach",diet:"vegan",cat:"Suppe",servings:4,ing:["800g Tomaten","1 Zwiebel","2 Knoblauchzehen","2 EL Olivenöl","400ml Gemüsebouillon","1 Bund Basilikum"],steps:["Tomaten und Zwiebeln in Öl anbraten.","Bouillon zugeben, 15 Min köcheln.","Pürieren, abschmecken.","Mit Basilikum servieren."]},
  {id:"r15",name:"Kürbissuppe",time:35,diff:"Einfach",diet:"vegan",cat:"Suppe",servings:4,ing:["1kg Kürbis","1 Zwiebel","20g Ingwer","400ml Kokosmilch","600ml Gemüsebouillon","2 EL Kürbiskernöl"],steps:["Kürbis würfeln, mit Zwiebeln andünsten.","Bouillon zugeben, 20 Min köcheln.","Kokosmilch dazu, pürieren.","Mit Kürbiskernöl garnieren."]},
  {id:"r16",name:"Griechischer Salat",time:15,diff:"Einfach",diet:"vegetarisch",cat:"Salat",servings:4,ing:["4 Tomaten","1 Gurke","1 rote Zwiebel","200g Feta","100g schwarze Oliven","4 EL Olivenöl","1 TL Oregano"],steps:["Gemüse grob würfeln.","In Schüssel geben.","Feta drüber bröseln, Oliven dazu.","Mit Öl und Oregano anmachen."]},
  {id:"r17",name:"Caesar Salad",time:20,diff:"Einfach",diet:"fleisch",cat:"Salat",servings:4,ing:["1 Romanasalat","2 Pouletbrüste","50g Parmesan","100g Croutons","4 EL Caesar-Dressing"],steps:["Poulet würzen und braten, in Streifen schneiden.","Salat zerzupfen, mit Dressing mischen.","Croutons und Parmesan drüber.","Poulet obendrauf."]},
  {id:"r18",name:"Birchermüesli",time:10,diff:"Einfach",diet:"vegetarisch",cat:"Frühstück",servings:2,ing:["100g Haferflocken","150ml Milch","1 Apfel","2 EL Joghurt","1 EL Honig","30g Nüsse"],steps:["Haferflocken mit Milch einweichen (mind. 10 Min).","Apfel raspeln, untermengen.","Joghurt und Honig dazu.","Mit Nüssen garnieren."]},
  {id:"r19",name:"Avocado-Toast",time:10,diff:"Einfach",diet:"vegan",cat:"Frühstück",servings:2,ing:["4 Scheiben Vollkornbrot","2 Avocados","1 Zitrone","1 TL Chiliflocken","Salz"],steps:["Brot toasten.","Avocado zerdrücken, mit Zitrone und Salz würzen.","Auf Toast streichen.","Mit Chiliflocken bestreuen."]},
  {id:"r20",name:"Rühreier mit Speck",time:10,diff:"Einfach",diet:"fleisch",cat:"Frühstück",servings:2,ing:["4 Eier","100g Speck","20g Butter","1 Bund Schnittlauch","Salz, Pfeffer"],steps:["Speck knusprig braten, beiseite legen.","Eier verquirlen, würzen.","In Butter bei mittlerer Hitze cremig stocken.","Mit Speck und Schnittlauch servieren."]},
  {id:"r21",name:"Mousse au Chocolat",time:25,diff:"Mittel",diet:"vegetarisch",cat:"Dessert",servings:4,ing:["200g Zartbitterschokolade","4 Eier","200ml Rahm","2 EL Zucker","1 Prise Salz"],steps:["Schokolade im Wasserbad schmelzen, abkühlen lassen.","Eigelb mit Zucker schaumig schlagen, Schokolade einrühren.","Rahm und Eiweiss getrennt steif schlagen.","Alles vorsichtig unterheben, mind. 2 Std kühlen."]},
  {id:"r22",name:"Apfelkuchen",time:65,diff:"Mittel",diet:"vegetarisch",cat:"Dessert",servings:8,ing:["3 Äpfel","200g Mehl","150g Butter","150g Zucker","2 Eier","1 TL Backpulver","1 TL Zimt"],steps:["Ofen auf 180°C vorheizen.","Butter und Zucker schaumig rühren, Eier dazu.","Mehl und Backpulver untermengen.","Äpfel würfeln, dazu geben. 50 Min backen."]},
  {id:"r23",name:"Rösti",time:30,diff:"Einfach",diet:"vegetarisch",cat:"Schweizer",servings:4,ing:["800g mehligkochende Kartoffeln","40g Butter","1 TL Salz"],steps:["Kartoffeln vorkochen (ca. 15 Min), erkalten lassen, reiben.","Mit Salz würzen.","In heisser Butter zu flachem Kuchen formen.","Bei mittlerer Hitze je 8–10 Min goldbraun braten, wenden."]},
  {id:"r24",name:"Käsefondue",time:25,diff:"Einfach",diet:"vegetarisch",cat:"Schweizer",servings:4,ing:["400g Gruyère","400g Appenzeller","300ml Weisswein","1 Knoblauchzehe","1 EL Maizena","2 EL Kirschwasser","800g Brot"],steps:["Caquelon mit Knoblauch einreiben.","Wein erhitzen, Käse portionsweise unter Rühren schmelzen.","Maizena mit Kirschwasser verrühren, einrühren.","Mit Brot servieren, Hitze niedrig halten."]},
  {id:"r25",name:"Älplermagronen",time:40,diff:"Einfach",diet:"vegetarisch",cat:"Schweizer",servings:4,ing:["400g Hörnlipasta","400g Kartoffeln","200ml Rahm","200g Bergkäse","2 Zwiebeln","40g Butter","Salz"],steps:["Kartoffeln schälen, würfeln. Mit Pasta zusammen kochen.","Abgiessen, Rahm und geriebenen Käse untermengen.","Zwiebeln in Butter goldbraun braten.","Auf Pasta geben, mit Apfelmus servieren."]},
  {id:"r26",name:"Lachs mit Zitronenbutter",time:20,diff:"Einfach",diet:"fleisch",cat:"Fisch",servings:4,ing:["4 Lachsfilets (à 180g)","40g Butter","1 Zitrone","1 Bund Dill","2 Knoblauchzehen","Salz, Pfeffer"],steps:["Lachs würzen.","In heisser Butter je 4 Min pro Seite braten.","Knoblauch kurz mitbraten, Zitronensaft dazu.","Mit Dill garniert servieren."]},
  {id:"r27",name:"Garnelen-Pfanne",time:15,diff:"Einfach",diet:"fleisch",cat:"Fisch",servings:4,ing:["500g Garnelen","3 Knoblauchzehen","40g Butter","100ml Weisswein","1 Bund Petersilie","1 Zitrone"],steps:["Knoblauch in Butter andünsten.","Garnelen zugeben, 3 Min braten.","Mit Wein ablöschen, kurz einkochen.","Petersilie und Zitrone dazu, sofort servieren."]},
  {id:"r28",name:"Vollkornnudeln mit Gemüse",time:25,diff:"Einfach",diet:"vegan",cat:"Pasta",servings:4,ing:["400g Vollkornnudeln","1 Zucchini","1 Paprika","200g Kirschtomaten","4 EL Olivenöl","1 Bund Basilikum"],steps:["Nudeln kochen.","Gemüse würfeln und in Öl braten.","Tomaten kurz mitbraten.","Mit Nudeln vermengen, Basilikum drüber."]},
  {id:"r29",name:"Omelette mit Käse",time:10,diff:"Einfach",diet:"vegetarisch",cat:"Vegetarisch",servings:2,ing:["4 Eier","80g Emmentaler","20g Butter","Salz, Pfeffer","1 Bund Schnittlauch"],steps:["Eier verquirlen, würzen.","Butter in Pfanne erhitzen.","Eier eingiessen, bei mittlerer Hitze stocken lassen.","Käse drüber, zusammenklappen, servieren."]},
  {id:"r30",name:"Minestrone",time:45,diff:"Einfach",diet:"vegan",cat:"Suppe",servings:6,ing:["2 Karotten","2 Stangen Sellerie","1 Zucchini","400g Tomaten (Dose)","100g Pasta","400g Bohnen (Dose)","3 Knoblauchzehen","3 EL Olivenöl"],steps:["Gemüse würfeln, in Öl andünsten.","Tomaten und 1L Bouillon zugeben.","20 Min köcheln, Pasta und Bohnen dazu.","Weitere 10 Min garen, abschmecken."]},
  {id:"r31",name:"Buddha Bowl",time:30,diff:"Einfach",diet:"vegan",cat:"Vegetarisch",servings:2,ing:["200g Quinoa","1 Avocado","400g Kichererbsen (Dose)","2 Karotten","3 EL Tahini","1 Zitrone","1 Knoblauchzehe"],steps:["Quinoa kochen.","Kichererbsen in Öl knusprig rösten.","Karotten raspeln oder rösten.","Alles in Schüssel anrichten, mit Tahini-Zitronendressing begiessen."]},
  {id:"r32",name:"Rüeblisalat",time:15,diff:"Einfach",diet:"vegan",cat:"Salat",servings:4,ing:["4 Karotten","3 EL Orangensaft","2 EL Olivenöl","1 Bund Koriander","Salz, Pfeffer"],steps:["Karotten fein raspeln.","Mit Orangensaft und Öl anmachen.","Koriander untermengen.","15 Min ziehen lassen."]},
  {id:"r33",name:"Kartoffelgratin",time:65,diff:"Einfach",diet:"vegetarisch",cat:"Schweizer",servings:4,ing:["1kg Kartoffeln","300ml Rahm","150g Gruyère","1 Knoblauchzehe","20g Butter","1 Prise Muskat","Salz, Pfeffer"],steps:["Ofen auf 180°C vorheizen.","Kartoffeln dünn hobeln.","Form mit Knoblauch einreiben, buttern.","Kartoffeln schichten, Rahm drüber, Käse oben. 55 Min backen."]},
  {id:"r34",name:"Zopf",time:120,diff:"Schwer",diet:"vegetarisch",cat:"Schweizer",servings:8,ing:["500g Weissmehl","7g Trockenhefe","250ml Milch (lauwarm)","100g Butter","1 TL Salz","1 Ei"],steps:["Hefe in Milch auflösen, mit Mehl, Butter, Salz und Ei zu glattem Teig kneten.","1 Std gehen lassen.","In 2 Stränge teilen, flechten.","Bei 200°C ca. 30 Min backen bis goldbraun."]},
  {id:"r35",name:"Thunfischsalat",time:10,diff:"Einfach",diet:"fleisch",cat:"Fisch",servings:2,ing:["2 Dosen Thunfisch","1 rote Zwiebel","2 EL Kapern","1 Zitrone","3 EL Olivenöl","1 Bund Petersilie"],steps:["Thunfisch abtropfen lassen.","Zwiebel fein hacken.","Alles vermengen, mit Zitrone und Öl anmachen.","Mit Brot servieren."]},
  {id:"r36",name:"Rindsgulasch",time:90,diff:"Mittel",diet:"fleisch",cat:"Fleisch",servings:6,ing:["800g Rindfleisch","3 Zwiebeln","2 EL Paprikapulver","400g Tomaten (Dose)","500ml Rindbouillon","2 Lorbeerblätter"],steps:["Fleisch würfeln und scharf anbraten.","Zwiebeln andünsten, Paprika zugeben.","Tomaten und Bouillon dazu.","Ca. 1 Std bei niedriger Hitze schmoren."]},
  {id:"r37",name:"Frittatensuppe",time:25,diff:"Einfach",diet:"fleisch",cat:"Suppe",servings:4,ing:["1L Rindsbouillon","3 Eier","100ml Milch","50g Mehl","1 Bund Schnittlauch","Salz"],steps:["Aus Eiern, Milch und Mehl Pfannkuchenteig rühren.","Dünne Pfannkuchen backen, auskühlen lassen.","In feine Streifen rollen und schneiden.","Bouillon erhitzen, Fritatten reingeben, Schnittlauch drüber."]},
  {id:"r38",name:"Schweinskoteletts mit Senf",time:25,diff:"Einfach",diet:"fleisch",cat:"Fleisch",servings:4,ing:["4 Schweinskoteletts (à ca. 220g)","2 EL Dijonsenf","1 TL Rosmarin","3 EL Olivenöl","Salz, Pfeffer"],steps:["Koteletts mit Senf, Rosmarin, Salz und Pfeffer einreiben.","In heissem Öl je 4 Min pro Seite braten.","5 Min ruhen lassen.","Mit Salzkartoffeln oder Rösti servieren."]},
  {id:"r39",name:"Schokoladenmousse vegan",time:20,diff:"Mittel",diet:"vegan",cat:"Dessert",servings:4,ing:["400ml Kokosmilch (über Nacht gekühlt)","150g Zartbitterschokolade","2 EL Ahornsirup","1 TL Vanilleextrakt"],steps:["Kokosmilch kühlen (über Nacht).","Schokolade schmelzen, abkühlen.","Kokoscreme steif schlagen.","Schokolade und Sirup unterheben, mind. 1 Std kühlen."]},
  {id:"r40",name:"Erbsensuppe",time:35,diff:"Einfach",diet:"vegan",cat:"Suppe",servings:4,ing:["500g TK-Erbsen","1 Zwiebel","2 Knoblauchzehen","800ml Gemüsebouillon","200ml Kokosmilch","1 Bund Minze"],steps:["Zwiebeln und Knoblauch andünsten.","Erbsen und Bouillon zugeben, 10 Min köcheln.","Kokosmilch dazu, pürieren.","Mit Minze servieren."]},
];

const RECIPE_CATS=["Alle","Pasta","Fleisch","Vegetarisch","Suppe","Salat","Frühstück","Dessert","Schweizer","Fisch"];
const DAYS_DE=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];

/* ─── voice parser ───────────────────────────────────────────────────── */
const WORD_NUMS={ein:1,eine:1,einer:1,zwei:2,drei:3,vier:4,fünf:5,sechs:6,sieben:7,acht:8,neun:9,zehn:10,elf:11,zwölf:12,dreizehn:13,vierzehn:14,fünfzehn:15,sechzehn:16,siebzehn:17,achtzehn:18,neunzehn:19,zwanzig:20};
const MONTHS_DE={jan:1,januar:1,feb:2,februar:2,"mär":3,märz:3,apr:4,april:4,mai:5,jun:6,juni:6,jul:7,juli:7,aug:8,august:8,sep:9,september:9,okt:10,oktober:10,nov:11,november:11,dez:12,dezember:12};
const UNIT_MAP={liter:"L",l:"L",kilogramm:"kg",kilo:"kg",kg:"kg",gramm:"g",gram:"g",g:"g",milliliter:"ml",ml:"ml",stück:"Stk",stk:"Stk",stücke:"Stk",packung:"Päckli",packungen:"Päckli",päckli:"Päckli",päckchen:"Päckli",pack:"Päckli",flasche:"L",flaschen:"L",dose:"Dosen",dosen:"Dosen",büchse:"Dosen",kopf:"Kopf",bund:"Bund",sechserpack:"Stk",viererpack:"Stk",achterpack:"Stk",zwölfpack:"Stk"};
const PACK_SIZES={sechserpack:6,viererpack:4,achterpack:8,zwölfpack:12};
function wordToNum(w){if(!isNaN(parseFloat(w)))return parseFloat(w);return WORD_NUMS[w.toLowerCase()]||null;}
function parseDate(text){
  const t=text.toLowerCase().trim();const cy=new Date().getFullYear();
  const mN=t.match(/(\d{1,2})\.?\s+([a-zä]+)(?:\s+(\d{2,4}))?/);
  if(mN){const day=parseInt(mN[1]);const mon=MONTHS_DE[mN[2]];if(mon){let y=mN[3]?parseInt(mN[3]):cy;if(y<100)y+=2000;const d=new Date(y,mon-1,day);if(d<new Date()&&!mN[3])d.setFullYear(d.getFullYear()+1);return d.toISOString().split("T")[0];}}
  const mD=t.match(/(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?/);
  if(mD){const day=parseInt(mD[1]);const mon=parseInt(mD[2]);let y=mD[3]?parseInt(mD[3]):cy;if(y<100)y+=2000;if(day>=1&&day<=31&&mon>=1&&mon<=12){const d=new Date(y,mon-1,day);if(d<new Date()&&!mD[3])d.setFullYear(d.getFullYear()+1);return d.toISOString().split("T")[0];}}
  return null;
}
function parseChunk(raw){
  let s=raw.toLowerCase().trim();
  const item={name:"",qty:"1",unit:"Stk",expiry:daysFromNow(14)};
  const dPats=[/(?:bis|ab|ablauf|haltbar bis|mhd)\s+([\d.]+\s*[a-zä]*\s*[\d]*)/i,/(?:bis|ab|ablauf|haltbar bis|mhd)\s+(\d{1,2}\.\s*[a-zä]+(?:\s+\d{2,4})?)/i,/(\d{1,2}[.\-\/]\d{1,2}(?:[.\-\/]\d{2,4})?)\s*$/,/(\d{1,2}\.?\s+[a-zä]{3,}(?:\s+\d{2,4})?)\s*$/i];
  for(const p of dPats){const m=s.match(p);if(m){const d=parseDate(m[1]);if(d){item.expiry=d;s=s.replace(m[0],"").trim();break;}}}
  for(const[pk,n]of Object.entries(PACK_SIZES)){if(s.includes(pk)){item.qty=String(n);item.unit="Stk";s=s.replace(pk,"").trim();break;}}
  if(item.qty==="1"){
    const qM=s.match(/^(\d+(?:[.,]\d+)?|[a-zä]+)\s+(liter|l|kilo(?:gramm)?|kilogramm|gramm|g|milliliter|ml|stück(?:e)?|stk|packung(?:en)?|päckli|päckchen|pack|flasche[n]?|dose[n]?|büchse[n]?|kopf|köpfe|bund(?:e)?)\b/i);
    if(qM){const n=wordToNum(qM[1]);if(n!==null){item.qty=String(n);const u=UNIT_MAP[qM[2].toLowerCase()];if(u)item.unit=u;s=s.replace(qM[0],"").trim();}}
    else{const nO=s.match(/^(\d+|[a-zä]+)\s+(?!\d)/i);if(nO){const n=wordToNum(nO[1]);if(n!==null&&n>0&&n<1000){item.qty=String(n);s=s.replace(nO[1],"").trim();}}}
  }
  s=s.replace(/\b(ein|eine|einen|einem)\b/gi,"").replace(/\s+/g," ").trim();
  if(s)item.name=s.charAt(0).toUpperCase()+s.slice(1);
  return item;
}
function parseVoiceText(text){
  return text.split(/\s*(?:,|;\s*und|\s+und\s+|\s+dann\s+|\s+noch\s+)\s*/i)
    .map(s=>s.trim()).filter(s=>s.length>1)
    .map(parseChunk).filter(it=>it.name.length>0);
}

/* ─── scale recipe ingredients ───────────────────────────────────────── */
function scaleIngredients(ing,from,to){
  const factor=to/from;
  return ing.map(line=>{
    // Match leading number (int or decimal) optionally followed by unit
    return line.replace(/^(\d+(?:[.,]\d+)?)/,(_,num)=>{
      const scaled=parseFloat(num.replace(",","."))*factor;
      const rounded=Math.round(scaled*10)/10;
      return String(rounded).replace(".",",");
    });
  });
}

/* ─── match recipe with pantry ───────────────────────────────────────── */
function getMatchInfo(recipe,items){
  const myItems=items.map(i=>i.name.toLowerCase());
  const have=[];const missing=[];
  for(const ing of recipe.ing){
    const ingLower=ing.toLowerCase();
    // Extract the main food word (skip numbers and units)
    const foodWord=ingLower.replace(/^\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|el|tl|stk|stück|dosen|dose|bund|kopf|prise|pkg|pakung|päckli)?\s*/,"").split(/[,(]/)[0].trim();
    const found=myItems.some(mi=>foodWord.includes(mi)||mi.includes(foodWord.split(" ")[0])||foodWord.split(" ").some(w=>w.length>3&&mi.includes(w)));
    if(found)have.push(ing);else missing.push(ing);
  }
  return{have,missing};
}

/* ─── tokens ─────────────────────────────────────────────────────────── */
const C={bg:"#F9F7F3",card:"#FFFFFF",card2:"#F2EFE9",border:"#E9E4DC",text:"#1A1714",sub:"#7C746C",green:"#2D7D46",greenL:"#EBF5EE",greenM:"#C6E6CE",orange:"#C05621",orangeL:"#FEF0E7",red:"#C53030",redL:"#FEF2F2",amber:"#B7791F",purple:"#6B46C1",purpleL:"#F3F0FF"};

/* ─── icons ──────────────────────────────────────────────────────────── */
const ICONS={home:"M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z M9 21V12h6v9",pantry:"M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12",chef:"M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z M9 21h6",settings:"M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",plus:"M12 5v14M5 12h14",trash:"M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2",edit:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",clock:"M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z M12 6v6l4 2",fire:"M12 23c-4.97 0-9-3.58-9-8 0-3.31 1.99-5.86 4-7.5.29 1.77 1.5 3.37 3 4 0-3 1.5-5.5 4-7 0 3 2 5.5 2 8 1.19-.75 2-2.16 2-3.5 1.16 1.29 2 3.2 2 5 0 4.42-4.03 9-8 9z",x:"M18 6L6 18M6 6l12 12",sparkle:"M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z",leaf:"M2 22c3-3 6-8 6-13 3 0 7 2 9 5-1-3 0-6 2-8 1 6-1 11-5 14-1 1-2 2-4 2H2z",warning:"M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",search:"M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",check:"M20 6L9 17l-5-5",star:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",info:"M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z M12 8v4M12 16h.01",arrow:"M5 12h14M12 5l7 7-7 7",mic:"M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8",stop:"M18 18H6V6h12z",refresh:"M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15",filter:"M22 3H2l8 9.46V19l4 2v-8.54L22 3z",book:"M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 014 17V5a2 2 0 012-2h14v15",users:"M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",calendar:"M3 4h18v18H3zM16 2v4M8 2v4M3 10h18"};
function Ic({n,s=22,col="currentColor",sw=1.8}){return(<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d={ICONS[n]||""}/></svg>);}

/* ─── shared ─────────────────────────────────────────────────────────── */
function Chip({icon,text,col}){return(<div style={{display:"inline-flex",alignItems:"center",gap:5,background:`${col}18`,border:`1px solid ${col}30`,borderRadius:20,padding:"4px 10px"}}>{icon&&<Ic n={icon} s={11} col={col}/>}<span style={{fontSize:11,fontWeight:700,color:col}}>{text}</span></div>);}
function SL({icon,col,label}){return(<div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}><Ic n={icon} s={14} col={col}/><span style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:"0.09em"}}>{label}</span></div>);}
function FL({children}){return <div style={{fontSize:12,fontWeight:700,color:C.sub,marginBottom:6}}>{children}</div>;}
function ErrBox({msg}){return <div style={{background:C.redL,border:`1px solid ${C.red}30`,borderRadius:12,padding:"11px 14px",fontSize:13,color:C.red,marginBottom:14,lineHeight:1.5}}>{msg}</div>;}
function IS(small){return{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:small?"10px":"12px 13px",fontSize:small?12:14,outline:"none",color:C.text,fontFamily:"inherit"};}
function PBtn({onClick,text,col,disabled,loading}){return(<button onClick={onClick} disabled={disabled||loading} className="tap" style={{width:"100%",background:(disabled||loading)?C.card2:col,border:"none",borderRadius:14,padding:"15px",fontSize:14,fontWeight:800,color:(disabled||loading)?C.sub:"#fff",cursor:(disabled||loading)?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:(disabled||loading)?"none":`0 3px 12px ${col}35`,transition:"all .2s"}}>{loading?<><Spin white/><span>Lädt…</span></>:text}</button>);}
function Spin({white}){return <div style={{width:18,height:18,border:`2.5px solid ${white?"rgba(255,255,255,0.3)":C.border}`,borderTopColor:white?"#fff":C.green,borderRadius:"50%",animation:"spin 0.9s linear infinite"}}/>;}
function Sheet({onClose,title,children}){
  return(<div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"flex-end",background:"rgba(0,0,0,0.32)",backdropFilter:"blur(8px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="slide-up" style={{width:"100%",maxWidth:430,margin:"0 auto",background:C.card,borderRadius:"24px 24px 0 0",padding:`20px 20px calc(24px + env(safe-area-inset-bottom,0px))`,maxHeight:"92dvh",overflowY:"auto",boxShadow:"0 -8px 32px rgba(0,0,0,0.10)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:17,fontWeight:800}}>{title}</div>
        <button onClick={onClose} className="tap" style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"7px",cursor:"pointer",display:"flex"}}><Ic n="x" s={16} col={C.sub}/></button>
      </div>
      {children}
    </div>
  </div>);
}
function BottomNav({tab,setTab}){
  const tabs=[{id:"home",icon:"home",label:"Start"},{id:"pantry",icon:"pantry",label:"Vorrat"},{id:"recipes",icon:"chef",label:"Rezepte"},{id:"settings",icon:"settings",label:"Mehr"}];
  return(<nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",paddingBottom:"env(safe-area-inset-bottom,0px)",zIndex:50,boxShadow:"0 -1px 14px rgba(0,0,0,0.06)"}}>
    {tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} className="tap" style={{flex:1,padding:"12px 4px 10px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><Ic n={t.icon} s={22} col={tab===t.id?C.green:C.sub}/><span style={{fontSize:10,fontWeight:700,color:tab===t.id?C.green:C.sub}}>{t.label}</span></button>))}
  </nav>);
}

/* ════════════════════════════════════════════════════════════════════════
   ONBOARDING
════════════════════════════════════════════════════════════════════════ */
function Onboarding({onDone}){
  const [step,setStep]=useState(0);
  const [name,setName]=useState("");
  const [diet,setDiet]=useState([]);
  const [markets,setMarkets]=useState([]);
  const [err,setErr]=useState("");
  function toggle(arr,setArr,id){setArr(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);}
  function next(){if(step===0&&!name.trim()){setErr("Bitte gib deinen Namen ein.");return;}setErr("");if(step<2){setStep(s=>s+1);return;}onDone({name:name.trim(),diet,markets});}
  const DIETS=[{id:"alles",label:"Alles",emoji:"🍽️"},{id:"vegetarisch",label:"Vegetarisch",emoji:"🥦"},{id:"vegan",label:"Vegan",emoji:"🌱"},{id:"glutenfrei",label:"Glutenfrei",emoji:"🌾"},{id:"laktosefrei",label:"Laktosefrei",emoji:"🥛"}];
  const MKTS=[{id:"migros",label:"Migros",emoji:"🟠"},{id:"coop",label:"Coop",emoji:"🔴"},{id:"lidl",label:"Lidl",emoji:"🔵"},{id:"aldi",label:"Aldi",emoji:"🟡"},{id:"andere",label:"Andere",emoji:"🛒"}];
  return(
    <div style={{position:"fixed",inset:0,zIndex:200,background:C.bg,display:"flex",flexDirection:"column",fontFamily:"'Outfit',sans-serif"}}>
      <div style={{height:"env(safe-area-inset-top,44px)",background:C.bg}}/>
      <div style={{padding:"20px 24px 0"}}><div style={{display:"flex",gap:6,marginBottom:32}}>{[0,1,2].map(i=>(<div key={i} style={{flex:1,height:3,borderRadius:10,background:i<=step?C.green:C.border,transition:"background .3s"}}/>))}</div></div>
      <div style={{flex:1,overflowY:"auto",padding:"0 24px"}}>
        {step===0&&(<div className="fu">
          <div style={{marginBottom:32}}><div style={{fontSize:32,fontWeight:900,letterSpacing:"-1px",lineHeight:1.1,marginBottom:8}}>Hallo bei <span style={{color:C.green}}>freshly</span> 👋</div><div style={{fontSize:15,color:C.sub,lineHeight:1.6}}>Dein smarter Küchen-Assistent.</div></div>
          <FL>Wie heisst du?</FL>{err&&<ErrBox msg={err}/>}
          <input value={name} onChange={e=>{setName(e.target.value);setErr("");}} placeholder="Dein Vorname" autoFocus style={{...IS(false),marginBottom:12,fontSize:18,fontWeight:700}}/>
          <div style={{fontSize:12,color:C.sub,marginBottom:28}}>Nur für die persönliche Begrüssung.</div>
          {[{icon:"mic",text:"Spracheingabe: Einfach sprechen was du eingekauft hast",col:C.purple},{icon:"book",text:"40 eingebaute Rezepte, nach Kategorie und Zeit filterbar",col:C.green},{icon:"calendar",text:"Wochenplan: Für jeden Tag ein Rezept festlegen",col:C.orange}].map(f=>(<div key={f.text} style={{display:"flex",alignItems:"center",gap:12,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 14px",marginBottom:10}}><div style={{background:`${f.col}15`,borderRadius:10,padding:"8px",flexShrink:0}}><Ic n={f.icon} s={18} col={f.col}/></div><div style={{fontSize:13,color:C.text,lineHeight:1.4}}>{f.text}</div></div>))}
        </div>)}
        {step===1&&(<div className="fu"><div style={{marginBottom:28}}><div style={{fontSize:28,fontWeight:900,letterSpacing:"-0.5px",marginBottom:8}}>Ernährungsweise</div><div style={{fontSize:14,color:C.sub}}>Beeinflusst Rezeptvorschläge.</div></div>
          {DIETS.map(d=>{const sel=diet.includes(d.id);return(<button key={d.id} onClick={()=>toggle(diet,setDiet,d.id)} className="tap" style={{width:"100%",background:sel?C.greenL:C.card,border:`2px solid ${sel?C.green:C.border}`,borderRadius:16,padding:"16px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"all .15s",marginBottom:10}}><span style={{fontSize:24}}>{d.emoji}</span><span style={{fontSize:15,fontWeight:700,color:sel?C.green:C.text}}>{d.label}</span>{sel&&<div style={{marginLeft:"auto"}}><Ic n="check" s={18} col={C.green} sw={2.5}/></div>}</button>);})}
        </div>)}
        {step===2&&(<div className="fu"><div style={{marginBottom:28}}><div style={{fontSize:28,fontWeight:900,letterSpacing:"-0.5px",marginBottom:8}}>Deine Supermärkte</div><div style={{fontSize:14,color:C.sub}}>Wo kaufst du hauptsächlich ein?</div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{MKTS.map(m=>{const sel=markets.includes(m.id);return(<button key={m.id} onClick={()=>toggle(markets,setMarkets,m.id)} className="tap" style={{background:sel?C.greenL:C.card,border:`2px solid ${sel?C.green:C.border}`,borderRadius:16,padding:"18px 14px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}><span style={{fontSize:28}}>{m.emoji}</span><span style={{fontSize:14,fontWeight:700,color:sel?C.green:C.text}}>{m.label}</span>{sel&&<Ic n="check" s={16} col={C.green} sw={2.5}/>}</button>);})}</div>
        </div>)}
      </div>
      <div style={{padding:`16px 24px calc(20px + env(safe-area-inset-bottom,0px))`,background:C.bg,borderTop:`1px solid ${C.border}`}}>
        <button onClick={next} className="tap" style={{width:"100%",background:`linear-gradient(135deg,${C.green},#1a5c32)`,border:"none",borderRadius:16,padding:"16px",fontSize:16,fontWeight:800,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:`0 4px 18px ${C.green}38`,fontFamily:"inherit"}}><span>{step<2?"Weiter":"Los geht's"}</span><Ic n="arrow" s={18} col="#fff"/></button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   HOME TAB
════════════════════════════════════════════════════════════════════════ */
function HomeTab({items,soon,setTab,setModal,menuPlan,profileDiet}){
  const daily=getDailyRecipe(menuPlan,profileDiet);
  const {missing}=getMatchInfo(daily,items);
  return(
    <div style={{padding:"20px 20px 0"}} className="fu">
      <button onClick={()=>setModal({type:"voice"})} className="tap"
        style={{width:"100%",background:`linear-gradient(135deg,${C.purple},#553c9a)`,border:"none",borderRadius:20,padding:"20px",cursor:"pointer",display:"flex",alignItems:"center",gap:16,boxShadow:`0 6px 24px ${C.purple}40`,marginBottom:22,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-20,top:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.07)"}}/>
        <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic n="mic" s={28} col="#fff"/></div>
        <div style={{textAlign:"left"}}><div style={{fontSize:17,fontWeight:800,color:"#fff",marginBottom:3}}>Einkauf einräumen</div><div style={{fontSize:12,color:"rgba(255,255,255,0.75)",lineHeight:1.5}}>Einfach sprechen: <em>"6 Eier 28. April, Milch 2. Mai"</em></div></div>
      </button>

      <div style={{marginBottom:20}}>
        <SL icon="star" col={C.amber} label="Tagesrezept"/>
        <div onClick={()=>setModal({type:"viewRecipe",data:daily})} className="tap"
          style={{background:`linear-gradient(135deg,${C.green},#1a5c32)`,borderRadius:20,padding:"20px",cursor:"pointer",boxShadow:`0 6px 24px ${C.green}40`,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",right:-20,top:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.07)"}}/>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Heute empfohlen</div>
          <div style={{fontSize:20,fontWeight:800,color:"#fff",marginBottom:10,lineHeight:1.2}}>{daily.name}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:missing.length>0?10:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.15)",borderRadius:20,padding:"5px 10px"}}><Ic n="clock" s={13} col="rgba(255,255,255,0.9)"/><span style={{fontSize:12,color:"rgba(255,255,255,0.9)",fontWeight:600}}>{daily.time} Min</span></div>
            <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.15)",borderRadius:20,padding:"5px 10px"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.9)",fontWeight:600}}>{daily.diff}</span></div>
            {daily.diet&&<div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.15)",borderRadius:20,padding:"5px 10px"}}><Ic n="leaf" s={13} col="rgba(255,255,255,0.9)"/><span style={{fontSize:12,color:"rgba(255,255,255,0.9)",fontWeight:600}}>{daily.diet}</span></div>}
          </div>
          {missing.length>0&&<div style={{fontSize:12,color:"rgba(255,200,100,0.9)",fontWeight:600}}>⚠ {missing.length} Zutat{missing.length>1?"en":""} fehlt{missing.length===1?"":"en"} noch</div>}
        </div>
      </div>

      {soon.length>0&&(
        <div style={{marginBottom:20}}>
          <SL icon="fire" col={C.red} label="Läuft bald ab"/>
          {soon.slice(0,3).map((item,i)=>(<div key={item.id} className="fu" style={{animationDelay:`${i*0.06}s`,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}><div><div style={{fontWeight:700,fontSize:14}}>{item.name}</div><div style={{fontSize:11,color:expiryColor(item.expiry),fontWeight:700,marginTop:2}}>{expiryLabel(item.expiry)}</div></div><div style={{background:`${expiryColor(item.expiry)}18`,border:`1px solid ${expiryColor(item.expiry)}30`,borderRadius:20,padding:"4px 10px"}}><span style={{fontSize:12,color:expiryColor(item.expiry),fontWeight:700}}>{item.qty} {item.unit}</span></div></div>))}
          {soon.length>3&&<button onClick={()=>setTab("pantry")} className="tap" style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px",fontSize:13,fontWeight:600,color:C.sub,cursor:"pointer",fontFamily:"inherit"}}>+{soon.length-3} weitere</button>}
        </div>
      )}

      <div style={{marginBottom:20}}>
        <SL icon="pantry" col={C.sub} label="Übersicht"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div onClick={()=>setTab("recipes")} className="tap" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}><Ic n="book" s={22} col={C.green}/><div style={{fontSize:28,fontWeight:900,letterSpacing:"-1px",marginTop:8,color:C.text}}>{RECIPE_DB.length}</div><div style={{fontSize:12,color:C.sub,fontWeight:600,marginTop:2}}>Rezepte</div></div>
          <div onClick={()=>setTab("pantry")} className="tap" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}><Ic n="pantry" s={22} col={C.orange}/><div style={{fontSize:28,fontWeight:900,letterSpacing:"-1px",marginTop:8,color:C.text}}>{items.length}</div><div style={{fontSize:12,color:C.sub,fontWeight:600,marginTop:2}}>Produkte</div></div>
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
  const list=items.filter(i=>(cat==="all"||i.cat===cat)&&i.name.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>daysLeft(a.expiry)-daysLeft(b.expiry));
  return(
    <div className="fu">
      <div style={{margin:"14px 20px 0"}}>
        <button onClick={()=>setModal({type:"voice"})} className="tap" style={{width:"100%",background:C.purpleL,border:`1.5px solid ${C.purple}30`,borderRadius:16,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,fontFamily:"inherit"}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:C.purple,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:`0 4px 12px ${C.purple}40`}}><Ic n="mic" s={20} col="#fff"/></div>
          <div style={{textAlign:"left"}}><div style={{fontSize:14,fontWeight:800,color:C.purple}}>Per Sprache hinzufügen</div><div style={{fontSize:12,color:C.sub,marginTop:1}}>"6 Eier 28. April, Milch 500ml 2. Mai"</div></div>
        </button>
      </div>
      <div style={{padding:"12px 20px 0"}}>
        <div style={{display:"flex",gap:8,marginBottom:11}}>
          <div style={{flex:1,position:"relative",display:"flex",alignItems:"center"}}>
            <div style={{position:"absolute",left:11,pointerEvents:"none",display:"flex"}}><Ic n="search" s={16} col={C.sub}/></div>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Suchen…" style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 12px 11px 36px",fontSize:14,outline:"none",fontFamily:"inherit",color:C.text}}/>
          </div>
          <button onClick={()=>setModal({type:"addItem"})} className="tap" style={{background:C.orange,border:"none",borderRadius:12,padding:"0 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,boxShadow:`0 2px 8px ${C.orange}30`}}><Ic n="plus" s={20} col="#fff"/><span style={{fontSize:12,fontWeight:700,color:"#fff"}}>Manuell</span></button>
        </div>
        <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:12}}>
          {cats.map(ct=>(<button key={ct} onClick={()=>setCat(ct)} className="tap" style={{flexShrink:0,background:cat===ct?C.green:C.card,border:`1px solid ${cat===ct?C.green:C.border}`,borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,color:cat===ct?"#fff":C.sub,cursor:"pointer",fontFamily:"inherit"}}>{ct==="all"?"Alle":ct}</button>))}
        </div>
      </div>
      <div style={{padding:"0 20px"}}>
        {list.length===0&&<div style={{textAlign:"center",padding:"50px 0"}}><Ic n="pantry" s={40} col={C.border}/><div style={{color:C.sub,fontSize:14,marginTop:12}}>Noch leer. Per Sprache oder manuell hinzufügen.</div></div>}
        {list.map((item,i)=>(<div key={item.id} className="fu" style={{animationDelay:`${i*0.04}s`,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
          <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div><div style={{fontSize:12,color:C.sub,marginTop:1}}>{item.cat} · {item.qty} {item.unit}</div><div style={{marginTop:6,display:"flex",alignItems:"center",gap:5}}><div style={{width:7,height:7,borderRadius:"50%",background:expiryColor(item.expiry),flexShrink:0}}/><span style={{fontSize:11,color:expiryColor(item.expiry),fontWeight:700}}>{expiryLabel(item.expiry)}</span></div></div>
          <div style={{display:"flex",gap:6,marginLeft:10}}>
            <button onClick={()=>setModal({type:"addItem",edit:item})} className="tap" style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px",cursor:"pointer",display:"flex"}}><Ic n="edit" s={15} col={C.sub}/></button>
            <button onClick={()=>removeItem(item.id)} className="tap" style={{background:C.redL,border:`1px solid ${C.red}25`,borderRadius:9,padding:"8px",cursor:"pointer",display:"flex"}}><Ic n="trash" s={15} col={C.red}/></button>
          </div>
        </div>))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   RECIPES TAB
════════════════════════════════════════════════════════════════════════ */
function RecipesTab({items,setModal,savedRecipes,removeRecipe,profileDiet,hiddenRecipes}){
  const [cat,setCat]=useState("Alle");
  const [diet,setDiet]=useState("alle");
  const [maxTime,setMaxTime]=useState(120);
  const [search,setSearch]=useState("");
  const [showFilters,setShowFilters]=useState(false);

  // Profile diet filter: if user set vegetarisch/vegan, only show those
  const profileDietFilter=(()=>{
    if(!profileDiet||profileDiet.includes("alles")||profileDiet.length===0)return null;
    if(profileDiet.includes("vegan"))return"vegan";
    if(profileDiet.includes("vegetarisch"))return"vegetarisch";
    return null;
  })();
  const all=[...RECIPE_DB.filter(r=>!hiddenRecipes.includes(r.id)),...savedRecipes];
  const filtered=all.filter(r=>{
    if(cat!=="Alle"&&r.cat!==cat)return false;
    if(diet!=="alle"&&r.diet!==diet)return false;
    if(profileDietFilter&&r.diet!==profileDietFilter)return false;
    if(r.time>maxTime)return false;
    if(search&&!r.name.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  function missingCount(r){return getMatchInfo(r,items).missing.length;}
  const sorted=[...filtered].sort((a,b)=>missingCount(a)-missingCount(b));
  const diffColor={Einfach:C.green,Mittel:C.amber,Schwer:C.red};

  return(
    <div className="fu">
      <div style={{padding:"14px 20px 0"}}>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <div style={{flex:1,position:"relative",display:"flex",alignItems:"center"}}>
            <div style={{position:"absolute",left:11,pointerEvents:"none",display:"flex"}}><Ic n="search" s={16} col={C.sub}/></div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rezept suchen…" style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 12px 11px 36px",fontSize:14,outline:"none",fontFamily:"inherit",color:C.text}}/>
          </div>
          <button onClick={()=>setShowFilters(s=>!s)} className="tap" style={{background:showFilters?C.green:C.card,border:`1px solid ${showFilters?C.green:C.border}`,borderRadius:12,padding:"0 14px",cursor:"pointer",display:"flex",alignItems:"center"}}><Ic n="filter" s={18} col={showFilters?"#fff":C.sub}/></button>
        </div>
        {showFilters&&(<div className="fu" style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:16,padding:"14px",marginBottom:10}}>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Ernährung</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {["alle","vegetarisch","vegan","fleisch"].map(d=>(<button key={d} onClick={()=>setDiet(d)} className="tap" style={{background:diet===d?C.orange:C.card,border:`1px solid ${diet===d?C.orange:C.border}`,borderRadius:20,padding:"5px 12px",fontSize:12,fontWeight:700,color:diet===d?"#fff":C.sub,cursor:"pointer",fontFamily:"inherit"}}>{d==="alle"?"Alle":d.charAt(0).toUpperCase()+d.slice(1)}</button>))}
            </div>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Max. Zeit: {maxTime===120?"Egal":`${maxTime} Min`}</div>
            <input type="range" min={10} max={120} step={5} value={maxTime} onChange={e=>setMaxTime(+e.target.value)} style={{width:"100%",accentColor:C.green}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.sub,marginTop:2}}><span>10 Min</span><span>Egal</span></div>
          </div>
        </div>)}
        <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:12}}>
          {RECIPE_CATS.map(c=>(<button key={c} onClick={()=>setCat(c)} className="tap" style={{flexShrink:0,background:cat===c?C.green:C.card,border:`1px solid ${cat===c?C.green:C.border}`,borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,color:cat===c?"#fff":C.sub,cursor:"pointer",fontFamily:"inherit"}}>{c}</button>))}
        </div>
        {items.length>0&&<div style={{background:C.greenL,border:`1px solid ${C.greenM}`,borderRadius:12,padding:"10px 13px",marginBottom:10,fontSize:12,color:C.sub}}>✓ Sortiert nach fehlenden Zutaten — oben kochen, was du hast</div>}
      </div>
      <div style={{padding:"0 20px"}}>
        {sorted.length===0&&<div style={{textAlign:"center",padding:"40px 0"}}><Ic n="chef" s={40} col={C.border}/><div style={{color:C.sub,fontSize:14,marginTop:12}}>Keine Rezepte gefunden.</div></div>}
        {sorted.map((r,i)=>{
          const{have,missing}=getMatchInfo(r,items);
          const noMissing=missing.length===0&&r.ing.length>0;
          const badge=noMissing?"✓ Alle Zutaten":missing.length===0?"":missing.length===1?"1 Zutat fehlt":`${missing.length} Zutaten fehlen`;
          const badgeCol=noMissing?C.green:C.red;
          return(<div key={r.id} className="fu" style={{animationDelay:`${i*0.04}s`,background:C.card,border:`1px solid ${noMissing?C.greenM:C.border}`,borderRadius:16,padding:"16px",marginBottom:10,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",position:"relative"}}>
            <div onClick={()=>setModal({type:"viewRecipe",data:r})} className="tap" style={{cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div style={{fontWeight:800,fontSize:15,flex:1,paddingRight:8}}>{r.name}</div>
                {badge&&<div style={{background:`${badgeCol}15`,border:`1px solid ${badgeCol}30`,borderRadius:20,padding:"3px 9px",flexShrink:0,marginRight:32}}><span style={{fontSize:11,fontWeight:700,color:badgeCol}}>{badge}</span></div>}
              </div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                <Chip icon="clock" text={`${r.time} Min`} col={C.orange}/>
                <Chip text={r.diff} col={diffColor[r.diff]||C.sub}/>
                {r.diet&&<Chip icon="leaf" text={r.diet} col={C.green}/>}
                <Chip text={r.cat} col={C.sub}/>
              </div>
            </div>
            <button onClick={e=>{e.stopPropagation();if(window.confirm(`"${r.name}" wirklich löschen?`))removeRecipe(r.id);}} className="tap"
              style={{position:"absolute",top:12,right:12,background:C.redL,border:`1px solid ${C.red}25`,borderRadius:8,padding:"7px",cursor:"pointer",display:"flex"}}>
              <Ic n="trash" s={14} col={C.red}/>
            </button>
          </div>);
        })}
        <button onClick={()=>setModal({type:"addRecipe"})} className="tap" style={{width:"100%",background:C.card2,border:`1px dashed ${C.border}`,borderRadius:16,padding:"14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,marginBottom:12,fontFamily:"inherit"}}>
          <Ic n="plus" s={17} col={C.sub}/><span style={{fontSize:13,fontWeight:700,color:C.sub}}>Eigenes Rezept hinzufügen</span>
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   SETTINGS TAB — editable preferences + menu plan
════════════════════════════════════════════════════════════════════════ */
function SettingsTab({profile,setProfile,onResetProfile}){
  const [menuPlan,setMenuPlanState]=useState(()=>loadMenuPlan());
  const [expandMenuPlan,setExpandMenuPlan]=useState(false);

  const DIETS=[{id:"alles",label:"Alles",emoji:"🍽️"},{id:"vegetarisch",label:"Vegetarisch",emoji:"🥦"},{id:"vegan",label:"Vegan",emoji:"🌱"},{id:"glutenfrei",label:"Glutenfrei",emoji:"🌾"},{id:"laktosefrei",label:"Laktosefrei",emoji:"🥛"}];
  const MKTS=[{id:"migros",label:"Migros",emoji:"🟠"},{id:"coop",label:"Coop",emoji:"🔴"},{id:"lidl",label:"Lidl",emoji:"🔵"},{id:"aldi",label:"Aldi",emoji:"🟡"},{id:"andere",label:"Andere",emoji:"🛒"}];

  function toggleDiet(id){
    const updated={...profile,diet:profile.diet.includes(id)?profile.diet.filter(x=>x!==id):[...profile.diet,id]};
    setProfile(updated);saveProfile(updated);
  }
  function toggleMarket(id){
    const updated={...profile,markets:profile.markets.includes(id)?profile.markets.filter(x=>x!==id):[...profile.markets,id]};
    setProfile(updated);saveProfile(updated);
  }
  function updateName(name){const updated={...profile,name};setProfile(updated);saveProfile(updated);}

  function setDayPref(day,pref){
    const updated={...menuPlan,[day]:pref};
    setMenuPlanState(updated);saveMenuPlan(updated);
  }

  const dayPrefs=[
    {id:"beliebig",label:"Beliebig",col:C.sub},
    {id:"vegetarisch",label:"Vegetarisch",col:C.green},
    {id:"vegan",label:"Vegan",col:"#16a34a"},
    {id:"fleisch",label:"Fleisch",col:C.orange},
    {id:"frei",label:"Kein Plan",col:C.sub},
  ];

  return(
    <div style={{padding:"20px"}} className="fu">
      {/* Name */}
      <SL icon="settings" col={C.orange} label="Profil"/>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <FL>Dein Name</FL>
        <input value={profile.name} onChange={e=>updateName(e.target.value)} style={{...IS(false),marginBottom:0}}/>
      </div>

      {/* Diet prefs */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Ernährungsweise</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {DIETS.map(d=>{
            const sel=profile.diet.includes(d.id);
            return(<button key={d.id} onClick={()=>toggleDiet(d.id)} className="tap"
              style={{display:"flex",alignItems:"center",gap:12,background:sel?C.greenL:C.card2,border:`1.5px solid ${sel?C.green:C.border}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
              <span style={{fontSize:20}}>{d.emoji}</span>
              <span style={{fontSize:14,fontWeight:600,color:sel?C.green:C.text,flex:1,textAlign:"left"}}>{d.label}</span>
              <div style={{width:20,height:20,borderRadius:"50%",background:sel?C.green:C.card,border:`1.5px solid ${sel?C.green:C.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {sel&&<Ic n="check" s={12} col="#fff" sw={2.5}/>}
              </div>
            </button>);
          })}
        </div>
      </div>

      {/* Markets */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Supermärkte</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {MKTS.map(m=>{
            const sel=profile.markets.includes(m.id);
            return(<button key={m.id} onClick={()=>toggleMarket(m.id)} className="tap"
              style={{background:sel?C.greenL:C.card2,border:`1.5px solid ${sel?C.green:C.border}`,borderRadius:12,padding:"12px 10px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
              <span style={{fontSize:18}}>{m.emoji}</span>
              <span style={{fontSize:13,fontWeight:600,color:sel?C.green:C.text,flex:1,textAlign:"left"}}>{m.label}</span>
              {sel&&<Ic n="check" s={14} col={C.green} sw={2.5}/>}
            </button>);
          })}
        </div>
      </div>

      {/* Menu plan */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <button onClick={()=>setExpandMenuPlan(s=>!s)} className="tap"
          style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{background:`${C.orange}15`,borderRadius:9,padding:"7px"}}><Ic n="calendar" s={18} col={C.orange}/></div>
            <div style={{textAlign:"left"}}><div style={{fontWeight:700,fontSize:14}}>Menüplan personalisieren</div><div style={{fontSize:12,color:C.sub,marginTop:1}}>Pro Wochentag eine Präferenz</div></div>
          </div>
          <div style={{fontSize:18,color:C.sub,transform:expandMenuPlan?"rotate(180deg)":"none",transition:"transform .2s"}}>›</div>
        </button>
        {expandMenuPlan&&(
          <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
            {DAYS_DE.map(day=>{
              const cur=menuPlan[day]||"beliebig";
              return(<div key={day} style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text,width:90,flexShrink:0}}>{day}</div>
                <div style={{display:"flex",gap:6,overflowX:"auto",flex:1}}>
                  {dayPrefs.map(p=>(<button key={p.id} onClick={()=>setDayPref(day,p.id)} className="tap"
                    style={{flexShrink:0,background:cur===p.id?p.col:C.card2,border:`1px solid ${cur===p.id?p.col:C.border}`,borderRadius:20,padding:"5px 10px",fontSize:11,fontWeight:700,color:cur===p.id?"#fff":C.sub,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
                    {p.label}
                  </button>))}
                </div>
              </div>);
            })}
          </div>
        )}
      </div>

      {/* App info */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>Über Freshly</div>
        <div style={{fontSize:13,color:C.sub,lineHeight:1.8}}>Version 4.0 · {RECIPE_DB.length} eingebaute Rezepte<br/>Sprach-Eingabe mit Datum-Erkennung</div>
      </div>

      <button onClick={onResetProfile} className="tap" style={{width:"100%",background:C.redL,border:`1px solid ${C.red}25`,borderRadius:14,padding:"14px",fontSize:14,fontWeight:700,color:C.red,cursor:"pointer",fontFamily:"inherit"}}>Profil zurücksetzen & neu starten</button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   VOICE MODAL
════════════════════════════════════════════════════════════════════════ */
function VoiceModal({onClose,onAddMany}){
  const [phase,setPhase]=useState("idle");
  const [transcript,setTranscript]=useState("");
  const [interim,setInterim]=useState("");
  const [parsed,setParsed]=useState([]);
  const [selected,setSelected]=useState({});
  const [editItem,setEditItem]=useState({});
  const [err,setErr]=useState("");
  const recogRef=useRef(null);
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const supported=!!SR;

  function startListening(){
    if(!supported){setErr("Spracherkennung nicht verfügbar. Bitte Safari auf dem iPhone verwenden.");return;}
    setErr("");setTranscript("");setInterim("");setPhase("listening");
    const r=new SR();r.lang="de-CH";r.continuous=true;r.interimResults=true;r.maxAlternatives=1;
    recogRef.current=r;
    r.onresult=e=>{let fin="",tmp="";for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)fin+=t+" ";else tmp+=t;}if(fin)setTranscript(p=>p+fin);setInterim(tmp);};
    r.onerror=e=>{if(e.error==="not-allowed")setErr("Mikrofon-Zugriff verweigert.");else if(e.error!=="aborted")setErr(`Fehler: ${e.error}`);setPhase("idle");};
    r.onend=()=>{setInterim("");setPhase(p=>p==="listening"?"result":p);};
    r.start();
  }
  function stopListening(){recogRef.current?.stop();setPhase("result");}
  function analyse(){
    const full=(transcript+" "+interim).trim();
    if(!full){setErr("Nichts aufgenommen.");setPhase("idle");return;}
    const items=parseVoiceText(full);
    if(!items.length){setErr("Konnte keine Produkte erkennen. Text unten korrigieren.");setPhase("result");return;}
    const withCat=items.map(it=>({...it,cat:guessCategory(it.name)}));
    const sel={};withCat.forEach((_,i)=>{sel[i]=true;});
    const edits={};withCat.forEach((it,i)=>{edits[i]={...it};});
    setParsed(withCat);setSelected(sel);setEditItem(edits);setPhase("confirm");
  }
  function confirm(){const toAdd=parsed.filter((_,i)=>selected[i]).map((_,i)=>editItem[i]||parsed[i]);if(toAdd.length>0)onAddMany(toAdd);onClose();}
  const selCount=parsed.filter((_,i)=>selected[i]).length;
  function fmtDate(s){if(!s)return"";const d=new Date(s);return d.toLocaleDateString("de-CH",{day:"numeric",month:"short"});}
  const ALL_CATS_V=["Milchprodukte","Fleisch","Fisch","Gemüse","Obst","Pasta & Reis","Konserven","Getränke","Brot & Gebäck","Snacks","Saucen","Öle","Tiefkühl","Sonstiges"];

  return(
    <Sheet onClose={onClose} title="Per Sprache hinzufügen">
      {(phase==="idle"||phase==="result")&&(<div style={{background:C.purpleL,border:`1px solid ${C.purple}25`,borderRadius:14,padding:"14px",marginBottom:18}}>
        <div style={{fontSize:12,fontWeight:700,color:C.purple,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Beispiele</div>
        {["6 Eier 28. April","Milch 2 Liter 2. Mai","500g Hackfleisch 25.04.","200g Butter 15. Mai, Joghurt 3 Stück 29.04."].map(ex=>(<div key={ex} style={{fontSize:12,color:C.sub,padding:"3px 0",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:6}}><span style={{color:C.purple,fontSize:10}}>▸</span><em style={{color:C.text}}>"{ex}"</em></div>))}
        <div style={{fontSize:11,color:C.sub,marginTop:8}}>Mehrere Produkte mit Komma trennen.</div>
      </div>)}
      {err&&<ErrBox msg={err}/>}
      {phase==="idle"&&(<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:"8px 0 16px"}}>
        <button onClick={startListening} disabled={!supported} className="tap" style={{width:96,height:96,borderRadius:"50%",background:supported?C.purple:C.card2,border:"none",cursor:supported?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:supported?`0 8px 28px ${C.purple}45`:"none"}}><Ic n="mic" s={40} col="#fff"/></button>
        <div style={{fontSize:14,fontWeight:700,color:C.purple}}>Tippen zum Starten</div>
        {!supported&&<div style={{fontSize:12,color:C.sub,textAlign:"center"}}>Nur in Safari auf dem iPhone verfügbar.</div>}
      </div>)}
      {phase==="listening"&&(<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,padding:"8px 0"}}>
        <style>{`@keyframes pr{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.18);opacity:.15}}`}</style>
        <div style={{position:"relative",width:110,height:110,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{position:"absolute",width:110,height:110,borderRadius:"50%",background:`${C.purple}22`,animation:"pr 1.3s ease infinite"}}/>
          <div style={{position:"absolute",width:88,height:88,borderRadius:"50%",background:`${C.purple}15`,animation:"pr 1.3s ease .35s infinite"}}/>
          <button onClick={stopListening} className="tap" style={{width:72,height:72,borderRadius:"50%",background:C.purple,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 6px 24px ${C.purple}45`,zIndex:1}}><Ic n="stop" s={26} col="#fff" sw={0}/></button>
        </div>
        <div style={{fontSize:14,fontWeight:700,color:C.purple}}>Höre zu… Tippen zum Stoppen</div>
        <div style={{width:"100%",background:C.card2,borderRadius:14,padding:"14px",minHeight:72,fontSize:14,color:C.text,lineHeight:1.65,border:`1px solid ${C.border}`}}>
          {transcript&&<span>{transcript}</span>}{interim&&<span style={{color:C.sub}}>{interim}</span>}{!transcript&&!interim&&<span style={{color:C.sub}}>Sprich jetzt…</span>}
        </div>
      </div>)}
      {phase==="result"&&(<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div><FL>Aufgenommener Text — bei Bedarf korrigieren</FL><textarea value={transcript} onChange={e=>setTranscript(e.target.value)} rows={4} style={{...IS(false),resize:"none"}}/></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setTranscript("");setPhase("idle");}} className="tap" style={{flex:1,background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px",fontSize:13,fontWeight:700,color:C.sub,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ic n="refresh" s={15} col={C.sub}/> Nochmal</button>
          <button onClick={analyse} className="tap" style={{flex:2,background:C.purple,border:"none",borderRadius:12,padding:"13px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ic n="check" s={16} col="#fff" sw={2.5}/> Produkte erkennen</button>
        </div>
      </div>)}
      {phase==="confirm"&&(<div>
        <div style={{fontSize:13,color:C.sub,marginBottom:14}}><strong style={{color:C.text}}>{selCount}</strong> von {parsed.length} erkannt · Kategorie und Datum prüfen</div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
          {parsed.map((item,i)=>{
            const ed=editItem[i]||item;const sel=selected[i];
            return(<div key={i} style={{background:C.card,border:`1.5px solid ${sel?C.purple:C.border}`,borderRadius:16,padding:"14px",transition:"border-color .15s"}}>
              <div onClick={()=>setSelected(s=>({...s,[i]:!s[i]}))} className="tap" style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:sel?12:0}}>
                <div style={{width:22,height:22,borderRadius:6,background:sel?C.purple:C.card2,border:`1.5px solid ${sel?C.purple:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>{sel&&<Ic n="check" s={13} col="#fff" sw={2.5}/>}</div>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{ed.name}</div><div style={{fontSize:12,color:C.sub,marginTop:1}}>{ed.cat} · {ed.qty} {ed.unit} · <span style={{color:expiryColor(ed.expiry),fontWeight:700}}>{fmtDate(ed.expiry)}</span></div></div>
              </div>
              {sel&&(<div onClick={e=>e.stopPropagation()} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div><FL>Kategorie</FL><select value={ed.cat} onChange={e=>setEditItem(m=>({...m,[i]:{...ed,cat:e.target.value}}))} style={IS(true)}>{ALL_CATS_V.map(c=><option key={c}>{c}</option>)}</select></div>
                <div><FL>Ablaufdatum</FL><input type="date" value={ed.expiry} onChange={e=>setEditItem(m=>({...m,[i]:{...ed,expiry:e.target.value}}))} style={{...IS(true),fontSize:11}}/></div>
              </div>)}
            </div>);
          })}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setPhase("idle");setTranscript("");}} className="tap" style={{flex:1,background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px",fontSize:13,fontWeight:700,color:C.sub,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ic n="refresh" s={15} col={C.sub}/> Nochmal</button>
          <button onClick={confirm} disabled={selCount===0} className="tap" style={{flex:2,background:selCount===0?C.card2:C.purple,border:"none",borderRadius:12,padding:"13px",fontSize:13,fontWeight:700,color:selCount===0?C.sub:"#fff",cursor:selCount===0?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:selCount===0?"none":`0 4px 14px ${C.purple}40`}}>
            {selCount===0?"Nichts ausgewählt":`${selCount} Produkt${selCount>1?"e":""} hinzufügen`}
          </button>
        </div>
      </div>)}
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ITEM MODAL
════════════════════════════════════════════════════════════════════════ */
const ALL_CATS=["Milchprodukte","Fleisch","Fisch","Gemüse","Obst","Pasta & Reis","Konserven","Getränke","Brot & Gebäck","Snacks","Saucen","Öle","Tiefkühl","Sonstiges"];
const UNITS=["Stk","g","kg","ml","L","Dosen","Kopf","Bund","Päckli","EL","TL","Portion"];

function ItemModal({onClose,onSave,item}){
  const [f,setF]=useState(item||{name:"",cat:"Sonstiges",qty:"1",unit:"g",expiry:daysFromNow(14)});
  const [err,setErr]=useState("");
  function handleName(name){const cat=item?f.cat:guessCategory(name);setF(p=>({...p,name,cat}));setErr("");}
  function save(){if(!f.name.trim()){setErr("Bitte einen Namen eingeben.");return;}onSave(f);onClose();}
  return(
    <Sheet onClose={onClose} title={item?"Produkt bearbeiten":"Manuell hinzufügen"}>
      {err&&<ErrBox msg={err}/>}
      <FL>Name</FL>
      <input value={f.name} onChange={e=>handleName(e.target.value)} placeholder="z.B. Butter" style={{...IS(false),marginBottom:6}}/>
      {!item&&f.name.length>2&&<div style={{fontSize:11,color:C.green,marginBottom:10,fontWeight:600}}>→ Kategorie erkannt: {guessCategory(f.name)}</div>}
      {item&&<div style={{marginBottom:8}}/>}
      <FL>Ablaufdatum (von der Packung)</FL>
      <input type="date" value={f.expiry} onChange={e=>setF(p=>({...p,expiry:e.target.value}))} style={{...IS(false),marginBottom:14}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div><FL>Menge</FL><input type="number" value={f.qty} onChange={e=>setF(p=>({...p,qty:e.target.value}))} style={IS(false)}/></div>
        <div><FL>Einheit</FL><select value={f.unit} onChange={e=>setF(p=>({...p,unit:e.target.value}))} style={IS(false)}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></div>
      </div>
      <FL>Kategorie</FL>
      <select value={f.cat} onChange={e=>setF(p=>({...p,cat:e.target.value}))} style={{...IS(false),marginBottom:20}}>{ALL_CATS.map(c=><option key={c}>{c}</option>)}</select>
      <PBtn onClick={save} text={item?"Speichern":"Hinzufügen"} col={C.orange}/>
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   RECIPE FORM
════════════════════════════════════════════════════════════════════════ */
function RecipeForm({onClose,onSave}){
  const [f,setF]=useState({name:"",time:30,diff:"Einfach",diet:"vegetarisch",cat:"Vegetarisch",ings:"",stepsText:"",servings:4,gen:false});
  const [err,setErr]=useState("");
  function save(){
    if(!f.name.trim()){setErr("Bitte einen Namen eingeben.");return;}
    if(!f.ings.trim()){setErr("Bitte mindestens eine Zutat eingeben.");return;}
    onSave({...f,id:`custom_${Date.now()}`,ing:f.ings.split("\n").filter(Boolean),steps:f.stepsText.split("\n").filter(Boolean)});
    onClose();
  }
  return(
    <Sheet onClose={onClose} title="Eigenes Rezept">
      {err&&<ErrBox msg={err}/>}
      <FL>Name</FL><input value={f.name} onChange={e=>{setF(p=>({...p,name:e.target.value}));setErr("");}} placeholder="Rezeptname" style={{...IS(false),marginBottom:14}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        <div><FL>Kategorie</FL><select value={f.cat} onChange={e=>setF(p=>({...p,cat:e.target.value}))} style={IS(true)}>{RECIPE_CATS.filter(c=>c!=="Alle").map(c=><option key={c}>{c}</option>)}</select></div>
        <div><FL>Zeit (Min)</FL><input type="number" value={f.time} onChange={e=>setF(p=>({...p,time:+e.target.value}))} style={IS(true)}/></div>
        <div><FL>Portionen</FL><input type="number" value={f.servings} onChange={e=>setF(p=>({...p,servings:+e.target.value}))} style={IS(true)} min={1}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        <div><FL>Schwierigkeit</FL><select value={f.diff} onChange={e=>setF(p=>({...p,diff:e.target.value}))} style={IS(true)}>{["Einfach","Mittel","Schwer"].map(d=><option key={d}>{d}</option>)}</select></div>
        <div><FL>Ernährung</FL><select value={f.diet} onChange={e=>setF(p=>({...p,diet:e.target.value}))} style={IS(true)}>{["vegetarisch","vegan","fleisch"].map(d=><option key={d}>{d}</option>)}</select></div>
      </div>
      <FL>Zutaten (eine pro Zeile, mit Menge)</FL>
      <textarea value={f.ings} onChange={e=>{setF(p=>({...p,ings:e.target.value}));setErr("");}} rows={4} placeholder={"400g Spaghetti\n3 Eier\n150g Speck"} style={{...IS(false),resize:"none",marginBottom:14}}/>
      <FL>Schritte (einer pro Zeile)</FL>
      <textarea value={f.stepsText} onChange={e=>setF(p=>({...p,stepsText:e.target.value}))} rows={4} placeholder={"Wasser kochen\nPasta kochen\nSauce zubereiten"} style={{...IS(false),resize:"none",marginBottom:20}}/>
      <PBtn onClick={save} text="Rezept speichern" col={C.green}/>
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   RECIPE VIEW — with portions + missing ingredients highlighted
════════════════════════════════════════════════════════════════════════ */
function RecipeView({onClose,recipe,items}){
  const baseServings=recipe.servings||4;
  const [servings,setServings]=useState(baseServings);
  const scaledIng=scaleIngredients(recipe.ing,baseServings,servings);
  const {have,missing}=getMatchInfo(recipe,items);
  const diffColor={Einfach:C.green,Mittel:C.amber,Schwer:C.red};

  function isMissing(ing){
    // Check if this ingredient is in the missing list
    const ingLow=ing.toLowerCase();
    return missing.some(m=>m.toLowerCase()===recipe.ing[recipe.ing.indexOf(ing)]?.toLowerCase()||ingLow.includes(m.toLowerCase().replace(/^\d+[^a-z]*/,"").split(" ")[0]));
  }

  // Map scaled ingredients to missing status based on original index
  const ingWithStatus=scaledIng.map((scaledLine,idx)=>{
    const originalLine=recipe.ing[idx]||"";
    const origLow=originalLine.toLowerCase();
    const foodWord=origLow.replace(/^\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|el|tl|stk|stück|dosen|dose|bund|kopf|prise|päckli)?\s*/,"").split(/[,(]/)[0].trim();
    const myItems=items.map(i=>i.name.toLowerCase());
    const found=myItems.some(mi=>foodWord.includes(mi)||mi.includes(foodWord.split(" ")[0])||foodWord.split(" ").some(w=>w.length>3&&mi.includes(w)));
    return{line:scaledLine,found};
  });

  return(
    <Sheet onClose={onClose} title={recipe.name}>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:16}}>
        <Chip icon="clock" text={`${recipe.time} Min`} col={C.orange}/>
        <Chip text={recipe.diff} col={diffColor[recipe.diff]||C.sub}/>
        {recipe.diet&&<Chip icon="leaf" text={recipe.diet} col={C.green}/>}
        <Chip text={recipe.cat} col={C.sub}/>
      </div>

      {/* Portionen-Regler */}
      <div style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px",marginBottom:18}}>
        <div style={{fontSize:12,fontWeight:700,color:C.sub,marginBottom:10}}>PORTIONEN ANPASSEN</div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setServings(s=>Math.max(1,s-1))} className="tap" style={{width:36,height:36,borderRadius:"50%",background:C.card,border:`1px solid ${C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:C.text,fontWeight:700}}>−</button>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{fontSize:26,fontWeight:900,color:C.text,letterSpacing:"-1px"}}>{servings}</div>
            <div style={{fontSize:12,color:C.sub}}>Personen</div>
          </div>
          <button onClick={()=>setServings(s=>s+1)} className="tap" style={{width:36,height:36,borderRadius:"50%",background:C.green,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"#fff",fontWeight:700}}>+</button>
        </div>
      </div>

      {/* Missing summary */}
      {missing.length>0&&(
        <div style={{background:C.redL,border:`1px solid ${C.red}25`,borderRadius:12,padding:"11px 14px",marginBottom:16,fontSize:13,color:C.red,fontWeight:600}}>
          ⚠ {missing.length} Zutat{missing.length>1?"en":""} fehlt{missing.length===1?"":"en"} noch im Vorrat
        </div>
      )}
      {missing.length===0&&recipe.ing.length>0&&items.length>0&&(
        <div style={{background:C.greenL,border:`1px solid ${C.greenM}`,borderRadius:12,padding:"11px 14px",marginBottom:16,fontSize:13,color:C.green,fontWeight:600}}>
          ✓ Alle Zutaten vorhanden
        </div>
      )}

      <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Zutaten {servings!==baseServings&&<span style={{color:C.orange}}>({servings} Personen)</span>}</div>
      {ingWithStatus.map(({line,found},i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.border}`,background:!found&&items.length>0?`${C.red}08`:"transparent",borderRadius:4,paddingLeft:found||items.length===0?0:6}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:items.length===0?C.green:found?C.green:C.red,flexShrink:0}}/>
          <span style={{fontSize:14,color:!found&&items.length>0?C.red:C.text,fontWeight:!found&&items.length>0?600:400}}>{line}</span>
          {!found&&items.length>0&&<span style={{fontSize:11,color:C.red,marginLeft:"auto",flexShrink:0}}>fehlt</span>}
        </div>
      ))}

      <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:"0.1em",marginTop:22,marginBottom:14}}>Zubereitung</div>
      {recipe.steps?.map((step,i)=>(<div key={i} style={{display:"flex",gap:13,marginBottom:16}}><div style={{width:28,height:28,borderRadius:"50%",background:C.orangeL,border:`1.5px solid ${C.orange}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,fontWeight:800,color:C.orange}}>{i+1}</div><div style={{fontSize:14,lineHeight:1.65,paddingTop:4}}>{step}</div></div>))}
    </Sheet>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ROOT APP
════════════════════════════════════════════════════════════════════════ */
export default function App(){
  const [profile,setProfile]=useState(()=>loadProfile());
  const [tab,setTab]=useState("home");
  const [items,setItems]=useState([]); // start empty
  const [savedRecipes,setSavedRecipes]=useState([]);
  const [hiddenRecipes,setHiddenRecipes]=useState([]);
  const [nid,setNid]=useState(1);
  const [modal,setModal]=useState(null);
  const soon=items.filter(i=>daysLeft(i.expiry)<=3);
  function newId(){const id=nid;setNid(id+1);return id;}
  function addItem(item){setItems(p=>[...p,{...item,id:newId(),added:todayStr()}]);}
  function addItems(arr){let base=nid;setNid(base+arr.length);setItems(p=>[...p,...arr.map((it,i)=>({...it,id:base+i,added:todayStr()}))]);}
  function updateItem(u){setItems(p=>p.map(i=>i.id===u.id?u:i));}
  function removeItem(id){setItems(p=>p.filter(i=>i.id!==id));}
  function addRecipe(r){setSavedRecipes(p=>[...p,{...r,id:`c${newId()}`}]);}
  function removeRecipe(id){
    // For DB recipes: add to hidden list; for saved: remove
    if(String(id).startsWith("c")){
      setSavedRecipes(p=>p.filter(r=>r.id!==id));
    } else {
      setHiddenRecipes(p=>[...p,id]);
    }
  }
  function handleOnboardingDone(p){saveProfile(p);setProfile(p);}
  function resetProfile(){try{localStorage.removeItem("freshly_profile");localStorage.removeItem("freshly_menuplan");}catch{}setProfile(null);}
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
          <div><div style={{fontSize:24,fontWeight:900,letterSpacing:"-0.8px",lineHeight:1}}><span style={{color:C.text}}>fresh</span><span style={{color:C.green}}>ly</span></div><div style={{fontSize:11,color:C.sub,fontWeight:500,marginTop:1}}>{greet(profile?.name)}</div></div>
          {soon.length>0&&(<button onClick={()=>setTab("pantry")} className="tap" style={{background:C.redL,border:`1px solid ${C.red}28`,borderRadius:10,padding:"7px 12px",display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontFamily:"inherit"}}><Ic n="warning" s={14} col={C.red}/><span style={{fontSize:12,color:C.red,fontWeight:700}}>{soon.length} bald ab</span></button>)}
        </div>
      </header>
      <main style={{paddingBottom:88}}>
        {tab==="home"    &&<HomeTab    items={items} soon={soon} setTab={setTab} setModal={setModal} menuPlan={loadMenuPlan()} profileDiet={profile?.diet||[]}/>}
        {tab==="pantry"  &&<PantryTab  items={items} removeItem={removeItem} setModal={setModal}/>}
        {tab==="recipes" &&<RecipesTab items={items} setModal={setModal} savedRecipes={savedRecipes} removeRecipe={removeRecipe} profileDiet={profile?.diet||[]} hiddenRecipes={hiddenRecipes}/>}
        {tab==="settings"&&<SettingsTab profile={profile} setProfile={setProfile} onResetProfile={resetProfile}/>}
      </main>
      <BottomNav tab={tab} setTab={setTab}/>
      {modal?.type==="voice"      &&<VoiceModal    onClose={()=>setModal(null)} onAddMany={addItems}/>}
      {modal?.type==="addItem"    &&<ItemModal     onClose={()=>setModal(null)} onSave={modal.edit?updateItem:addItem} item={modal.edit||null}/>}
      {modal?.type==="addRecipe"  &&<RecipeForm    onClose={()=>setModal(null)} onSave={addRecipe}/>}
      {modal?.type==="viewRecipe" &&<RecipeView    onClose={()=>setModal(null)} recipe={modal.data} items={items}/>}
    </div>
  );
}
