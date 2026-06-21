
const { useState, useEffect, useMemo } = React;

// ─── CONFIG ───────────────────────────────────────────────
const SUPABASE_URL = "https://vgituyuogkxsdkyjmjpc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaXR1eXVvZ2t4c2RreWptanBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMjIxMTIsImV4cCI6MjA5NzU5ODExMn0.bgicLftweLKhv9ofxqJqjsjlfwflOGT7AANr3s601P8";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Telegram user id (или fallback для теста в браузере)
const tg = window.Telegram?.WebApp;
const USER_ID = tg?.initDataUnsafe?.user?.id?.toString() || "test_user";
tg?.expand?.();

// ─── CONSTANTS ────────────────────────────────────────────
const DAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const TYPES = ["Здоровье","Спорт","Обучение","Питание","Отдых","Продуктивность"];
const TYPE_EMOJI = {"Здоровье":"❤️","Спорт":"💪","Обучение":"📚","Питание":"🥗","Отдых":"😴","Продуктивность":"🎯"};
const LEVELS = [
  {name:"Новичок",min:0,max:100,color:"#888780"},
  {name:"Ученик",min:100,max:300,color:"#378ADD"},
  {name:"Практик",min:300,max:600,color:"#1D9E75"},
  {name:"Мастер",min:600,max:1000,color:"#7F77DD"},
  {name:"Легенда",min:1000,max:9999,color:"#D4537E"},
];
const todayIdx = (new Date().getDay()+6)%7;
const todayKey = new Date().toISOString().slice(0,10);

const D = {
  bg:"#0f0f13",card:"#1a1a24",card2:"#22222f",border:"#2a2a3a",
  text:"#e8e8f0",muted:"#888899",accent:"#7F77DD",accentBg:"#26215C",
  green:"#1D9E75",greenBg:"#04342C",amber:"#EF9F27",
};

function getLevel(xp){return LEVELS.slice().reverse().find(l=>xp>=l.min)||LEVELS[0];}
function getNext(xp){return LEVELS.find(l=>xp<l.max)||LEVELS[LEVELS.length-1];}
const btn=(bg=D.accent,cl="#fff")=>({background:bg,color:cl,border:`1px solid ${bg==="transparent"?D.border:bg}`,borderRadius:10,padding:"9px 18px",cursor:"pointer",fontSize:13,fontWeight:500});
const inp={background:D.card2,border:`1px solid ${D.border}`,borderRadius:8,padding:"8px 12px",color:D.text,fontSize:14,width:"100%",boxSizing:"border-box"};
const card={background:D.card,border:`1px solid ${D.border}`,borderRadius:14,padding:"14px 16px",marginBottom:12};

// ─── APP ──────────────────────────────────────────────────
function App(){
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [results, setResults] = useState([]);
  const [tab, setTab] = useState("today");
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [celebrate, setCelebrate] = useState(false);

  // form states
  const [hName,setHName]=useState("");
  const [hType,setHType]=useState("Спорт");
  const [hDays,setHDays]=useState([0,1,2,3,4]);
  const [rWeight,setRWeight]=useState("");
  const [rSteps,setRSteps]=useState("");
  const [rDate,setRDate]=useState(todayKey);

  // ── Load data ──
  useEffect(()=>{ loadAll(); },[]);

  async function loadAll(){
    setLoading(true);
    const [h,c,r] = await Promise.all([
      sb.from("habits").select("*").eq("user_id",USER_ID),
      sb.from("completions").select("*").eq("user_id",USER_ID),
      sb.from("results").select("*").eq("user_id",USER_ID).order("date"),
    ]);
    if(h.data) setHabits(h.data);
    if(c.data) setCompletions(c.data);
    if(r.data) setResults(r.data);
    setLoading(false);
  }

  // ── Toggle completion ──
  async function toggleHabit(habitId){
    const existing = completions.find(c=>c.habit_id===habitId && c.date===todayKey);
    if(existing){
      await sb.from("completions").delete().eq("id",existing.id);
      setCompletions(p=>p.filter(c=>c.id!==existing.id));
    } else {
      const {data} = await sb.from("completions").insert({habit_id:habitId,user_id:USER_ID,date:todayKey}).select().single();
      if(data){
        const newC=[...completions,data];
        setCompletions(newC);
        const todayHabits=habits.filter(h=>h.days.includes(todayIdx));
        const allDone=todayHabits.every(h=>newC.some(c=>c.habit_id===h.id&&c.date===todayKey));
        if(allDone&&todayHabits.length>0){setCelebrate(true);setTimeout(()=>setCelebrate(false),2500);}
      }
    }
  }

  // ── Add habit ──
  async function addHabit(){
    if(!hName.trim()||hDays.length===0)return;
    const {data}=await sb.from("habits").insert({user_id:USER_ID,name:hName.trim(),type:hType,days:hDays}).select().single();
    if(data){setHabits(p=>[...p,data]);}
    setHName("");setHType("Спорт");setHDays([0,1,2,3,4]);setModal(null);
  }

  // ── Remove habit ──
  async function removeHabit(id){
    await sb.from("habits").delete().eq("id",id);
    setHabits(p=>p.filter(h=>h.id!==id));
    setCompletions(p=>p.filter(c=>c.habit_id!==id));
  }

  // ── Add result ──
  async function addResult(){
    if(!rWeight&&!rSteps)return;
    const {data}=await sb.from("results").insert({user_id:USER_ID,date:rDate,weight:rWeight?parseFloat(rWeight):null,steps:rSteps?parseInt(rSteps):null}).select().single();
    if(data){setResults(p=>[...p,data].sort((a,b)=>a.date.localeCompare(b.date)));}
    setRWeight("");setRSteps("");setModal(null);
  }

  // ── Derived ──
  const todayHabits = habits.filter(h=>h.days.includes(todayIdx));
  const doneToday = todayHabits.filter(h=>completions.some(c=>c.habit_id===h.id&&c.date===todayKey));
  const getStreak = (habitId) => {
    const dates = completions.filter(c=>c.habit_id===habitId).map(c=>c.date).sort();
    let streak=0, d=new Date();
    while(true){
      const key=d.toISOString().slice(0,10);
      if(dates.includes(key)){streak++;d.setDate(d.getDate()-1);}
      else break;
    }
    return streak;
  };
  const xp = completions.length * 10;
  const level = getLevel(xp);
  const nextLvl = getNext(xp);
  const lvlPct = nextLvl.min===level.min?100:Math.round(((xp-level.min)/(nextLvl.max-level.min))*100);

  const byType = useMemo(()=>{
    const m={};
    habits.forEach(h=>{
      if(!m[h.type])m[h.type]={count:0,done:0};
      m[h.type].count++;
      m[h.type].done+=completions.filter(c=>c.habit_id===h.id).length;
    });
    return m;
  },[habits,completions]);

  const sortedResults=[...results].sort((a,b)=>a.date.localeCompare(b.date));
  const latestWeight=sortedResults.filter(r=>r.weight).slice(-1)[0];
  const latestSteps=sortedResults.filter(r=>r.steps).slice(-1)[0];
  const avgSteps=sortedResults.filter(r=>r.steps).length
    ?Math.round(sortedResults.filter(r=>r.steps).reduce((a,r)=>a+r.steps,0)/sortedResults.filter(r=>r.steps).length):null;

  const Row=({label,val,color})=>(
    <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${D.border}`}}>
      <span style={{color:D.muted,fontSize:13}}>{label}</span>
      <span style={{fontWeight:500,fontSize:13,color:color||D.text}}>{val}</span>
    </div>
  );

  if(loading) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",flexDirection:"column",gap:12}}>
      <div style={{fontSize:32}}>⏳</div>
      <div style={{color:D.muted}}>Загрузка...</div>
    </div>
  );

  return(
    <div style={{background:D.bg,minHeight:"100vh",color:D.text,fontFamily:"system-ui,sans-serif",paddingBottom:80}}>
      {celebrate&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,pointerEvents:"none"}}>
          <div style={{background:D.accentBg,border:`2px solid ${D.accent}`,borderRadius:20,padding:"24px 36px",textAlign:"center"}}>
            <div style={{fontSize:40}}>🎉</div>
            <div style={{fontSize:18,fontWeight:600,color:D.accent,marginTop:8}}>Все привычки выполнены!</div>
            <div style={{fontSize:13,color:D.muted,marginTop:4}}>+{todayHabits.length*10} XP</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:D.card,borderBottom:`1px solid ${D.border}`,padding:"14px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,color:D.muted,letterSpacing:1}}>УРОВЕНЬ</div>
            <div style={{fontSize:17,fontWeight:600,color:level.color}}>{level.name}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:D.muted}}>Опыт</div>
            <div style={{fontWeight:600}}>{xp} XP</div>
          </div>
        </div>
        <div style={{background:D.border,borderRadius:99,height:5,marginTop:8}}>
          <div style={{background:level.color,height:5,borderRadius:99,width:`${Math.min(lvlPct,100)}%`,transition:"width 0.5s"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
          <span style={{fontSize:11,color:D.muted}}>{lvlPct}% до «{nextLvl.name}»</span>
          <span style={{fontSize:11,color:D.muted}}>{xp}/{nextLvl.max} XP</span>
        </div>
      </div>

      {/* Summary */}
      <div style={{background:D.card2,borderBottom:`1px solid ${D.border}`,padding:"10px 20px",display:"flex",gap:24}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:700}}>{habits.length}</div>
          <div style={{fontSize:11,color:D.muted}}>Привычек</div>
        </div>
        <div style={{width:1,background:D.border}}/>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:700}}>{doneToday.length}/{todayHabits.length}</div>
          <div style={{fontSize:11,color:D.muted}}>Сегодня</div>
        </div>
        <div style={{width:1,background:D.border}}/>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:700,color:D.amber}}>{completions.length}</div>
          <div style={{fontSize:11,color:D.muted}}>Всего выполнено</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",background:D.card,borderBottom:`1px solid ${D.border}`}}>
        {[["today","Сегодня"],["habits","Привычки"],["stats","Статистика"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"12px 0",fontSize:13,cursor:"pointer",color:tab===k?D.accent:D.muted,background:"none",border:"none",borderBottom:tab===k?`2px solid ${D.accent}`:"2px solid transparent",fontWeight:tab===k?500:400}}>
            {l}
          </button>
        ))}
      </div>

      {/* TODAY */}
      {tab==="today"&&(
        <div style={{padding:"16px 20px"}}>
          <div style={{marginBottom:16}}>
            <div style={{fontWeight:500,fontSize:15}}>Активные задачи</div>
            <div style={{fontSize:12,color:D.muted,marginTop:2}}>{DAYS[todayIdx]} · {doneToday.length} из {todayHabits.length} выполнено</div>
          </div>
          {todayHabits.length===0&&(
            <div style={{textAlign:"center",color:D.muted,padding:"40px 0"}}>
              <div style={{fontSize:32}}>🌟</div>
              <div style={{marginTop:8}}>На сегодня задач нет</div>
            </div>
          )}
          {todayHabits.map(h=>{
            const done=completions.some(c=>c.habit_id===h.id&&c.date===todayKey);
            return(
              <div key={h.id} onClick={()=>toggleHabit(h.id)} style={{...card,display:"flex",alignItems:"center",gap:14,cursor:"pointer",background:done?D.accentBg:D.card,border:`1px solid ${done?D.accent:D.border}`,transition:"all 0.2s"}}>
                <div style={{width:26,height:26,borderRadius:"50%",border:`2px solid ${done?D.accent:D.muted}`,background:done?D.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {done&&<span style={{color:"#fff",fontSize:13}}>✓</span>}
                </div>
                <div style={{fontSize:20}}>{TYPE_EMOJI[h.type]}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:500}}>{h.name}</div>
                  <div style={{fontSize:12,color:D.muted,marginTop:2}}>{h.type} · 🔥 {getStreak(h.id)} дн.</div>
                </div>
              </div>
            );
          })}
          {doneToday.length>0&&doneToday.length===todayHabits.length&&todayHabits.length>0&&(
            <div style={{background:D.greenBg,border:`1px solid ${D.green}`,borderRadius:14,padding:"14px",textAlign:"center",marginTop:4}}>
              <div style={{fontWeight:500,color:D.green}}>✅ Отлично! Все задачи выполнены!</div>
            </div>
          )}
        </div>
      )}

      {/* HABITS */}
      {tab==="habits"&&(
        <div style={{padding:"16px 20px"}}>
          <div style={{display:"flex",gap:10,marginBottom:20}}>
            <button style={{...btn(),flex:1}} onClick={()=>setModal("add_habit")}>+ Привычка</button>
            <button style={{...btn(D.green),flex:1}} onClick={()=>setModal("add_result")}>📊 Результат</button>
          </div>
          {habits.map(h=>(
            <div key={h.id} style={card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:22}}>{TYPE_EMOJI[h.type]}</span>
                  <div>
                    <div style={{fontWeight:500}}>{h.name}</div>
                    <div style={{fontSize:12,color:D.muted,marginTop:2}}>{h.type} · 🔥 {getStreak(h.id)} дн. · {completions.filter(c=>c.habit_id===h.id).length} выполн.</div>
                  </div>
                </div>
                <button onClick={()=>removeHabit(h.id)} style={{background:"none",border:"none",color:D.muted,cursor:"pointer",fontSize:16}}>✕</button>
              </div>
              <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>
                {DAYS.map((d,i)=>(
                  <div key={i} style={{width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:500,background:h.days.includes(i)?D.accentBg:D.card2,border:`1px solid ${h.days.includes(i)?D.accent:D.border}`,color:h.days.includes(i)?D.accent:D.muted}}>
                    {d}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {habits.length===0&&<div style={{textAlign:"center",color:D.muted,padding:"40px 0"}}>Добавьте первую привычку!</div>}
        </div>
      )}

      {/* STATS */}
      {tab==="stats"&&(
        <div style={{padding:"16px 20px"}}>
          <div style={{fontWeight:500,marginBottom:10}}>По типу</div>
          <div style={card}>
            {Object.entries(byType).length===0&&<div style={{color:D.muted,fontSize:13}}>Нет данных</div>}
            {Object.entries(byType).map(([type,d])=>(
              <div key={type} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}>
                  <span>{TYPE_EMOJI[type]} {type} ({d.count} привычки)</span>
                  <span style={{color:D.accent,fontWeight:500}}>{d.done} выполн.</span>
                </div>
                <div style={{background:D.border,borderRadius:99,height:5}}>
                  <div style={{background:D.accent,height:5,borderRadius:99,width:`${Math.min((d.done/Math.max(1,...Object.values(byType).map(x=>x.done)))*100,100)}%`}}/>
                </div>
              </div>
            ))}
          </div>

          <div style={{fontWeight:500,margin:"16px 0 10px"}}>По привычкам</div>
          <div style={card}>
            {habits.length===0&&<div style={{color:D.muted,fontSize:13}}>Нет данных</div>}
            {[...habits].sort((a,b)=>getStreak(b.id)-getStreak(a.id)).map(h=>(
              <Row key={h.id} label={`${TYPE_EMOJI[h.type]} ${h.name}`} val={`🔥 ${getStreak(h.id)} дн. · ${completions.filter(c=>c.habit_id===h.id).length} выполн.`} color={D.accent}/>
            ))}
          </div>

          <div style={{fontWeight:500,margin:"16px 0 10px"}}>По введённым данным</div>
          <div style={card}>
            {results.length===0&&<div style={{color:D.muted,fontSize:13}}>Добавьте результаты во вкладке «Привычки»</div>}
            {latestWeight&&<Row label="Последний вес" val={`${latestWeight.weight} кг`} color={D.green}/>}
            {latestSteps&&<Row label="Последние шаги" val={latestSteps.steps.toLocaleString()} color={D.green}/>}
            {avgSteps&&<Row label="Среднее шагов/день" val={avgSteps.toLocaleString()} color={D.amber}/>}
            {sortedResults.length>0&&<Row label="Записей всего" val={sortedResults.length}/>}
            {sortedResults.filter(r=>r.steps).length>1&&(
              <div style={{marginTop:14}}>
                <div style={{fontSize:12,color:D.muted,marginBottom:6}}>Шаги по дням</div>
                <div style={{display:"flex",alignItems:"flex-end",gap:4,height:60}}>
                  {sortedResults.filter(r=>r.steps).slice(-10).map((r,i)=>{
                    const maxS=Math.max(...sortedResults.filter(x=>x.steps).map(x=>x.steps));
                    const h=Math.round((r.steps/maxS)*56);
                    return(
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                        <div style={{width:"100%",height:h,background:D.accent,borderRadius:"4px 4px 0 0",minHeight:4}}/>
                        <div style={{fontSize:9,color:D.muted}}>{r.date.slice(5)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Add Habit */}
      {modal==="add_habit"&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={()=>setModal(null)}>
          <div style={{background:D.card,border:`1px solid ${D.border}`,borderRadius:18,padding:24,width:340,maxWidth:"92vw"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:600,fontSize:16,marginBottom:16}}>Новая привычка</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:D.muted,marginBottom:5}}>Название</div>
              <input style={inp} placeholder="Например: Пить воду" value={hName} onChange={e=>setHName(e.target.value)}/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:D.muted,marginBottom:5}}>Тип</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                {TYPES.map(t=>(
                  <button key={t} onClick={()=>setHType(t)} style={{fontSize:12,padding:"5px 10px",borderRadius:8,cursor:"pointer",background:hType===t?D.accentBg:D.card2,border:`1px solid ${hType===t?D.accent:D.border}`,color:hType===t?D.accent:D.muted}}>
                    {TYPE_EMOJI[t]} {t}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,color:D.muted,marginBottom:5}}>Дни недели</div>
              <div style={{display:"flex",gap:6}}>
                {DAYS.map((d,i)=>(
                  <button key={i} onClick={()=>setHDays(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i].sort())} style={{width:34,height:34,borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer",background:hDays.includes(i)?D.accentBg:D.card2,border:`1px solid ${hDays.includes(i)?D.accent:D.border}`,color:hDays.includes(i)?D.accent:D.muted}}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setModal(null)} style={{...btn("transparent",D.muted),flex:1}}>Отмена</button>
              <button onClick={addHabit} style={{...btn(),flex:1}}>Добавить</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Result */}
      {modal==="add_result"&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={()=>setModal(null)}>
          <div style={{background:D.card,border:`1px solid ${D.border}`,borderRadius:18,padding:24,width:340,maxWidth:"92vw"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:600,fontSize:16,marginBottom:16}}>Добавить результат</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:D.muted,marginBottom:5}}>Дата</div>
              <input type="date" style={inp} value={rDate} onChange={e=>setRDate(e.target.value)}/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:D.muted,marginBottom:5}}>⚖️ Вес (кг)</div>
              <input type="number" style={inp} placeholder="Например: 75.5" value={rWeight} onChange={e=>setRWeight(e.target.value)}/>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,color:D.muted,marginBottom:5}}>👟 Шаги</div>
              <input type="number" style={inp} placeholder="Например: 8500" value={rSteps} onChange={e=>setRSteps(e.target.value)}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setModal(null)} style={{...btn("transparent",D.muted),flex:1}}>Отмена</button>
              <button onClick={addResult} style={{...btn(D.green),flex:1}}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
