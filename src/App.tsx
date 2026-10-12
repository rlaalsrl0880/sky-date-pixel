import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { supabase } from './lib/supabaseClient'
import Dashboard from './Dashboard'

type DatePlan = {
  date: string
  time: string
  activities: string[]
  message: string
}

const noMessages = [
  '정말요?',
  '한 번만 다시 생각해봐요!',
  '진짜 안 할 거예요?',
  'NO가 도망가고 있어요!',
  '어어... 잡지 마세요!',
  '어라?',
  'NO가 사라졌어요 ☁️',
]

const activities = ['🍰 맛있는 거 먹기', '🎬 영화 보기', '🌳 산책하기', '🎮 같이 게임하기', '☕ 카페 가기', '📷 사진 찍기']
const times = ['12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00']

export default function App() {
  const token = new URLSearchParams(window.location.search).get('invite')
  if (!token) return <Dashboard />
  return <InvitationGate token={token} />
}

function InvitationGate({token}:{token:string}) {
  const [state,setState]=useState<'loading'|'ready'|'answered'|'error'>('loading')
  useEffect(()=>{
    let active=true
    supabase.rpc('get_public_invitation',{p_token:token}).then(({data,error})=>{
      if(!active)return
      if(error || !data || !Array.isArray(data) || data.length===0) setState('error')
      else setState(data[0].answered?'answered':'ready')
    })
    return ()=>{active=false}
  },[token])
  if(state==='loading')return <main className="app"><section className="screen"><p className="eyebrow">☁️ LOADING</p><h2>초대장을 여는 중...</h2></section></main>
  if(state==='error')return <main className="app"><section className="screen"><h2>초대장을 찾을 수 없어요 ☁️</h2><p>링크를 다시 확인해주세요.</p></section></main>
  if(state==='answered')return <main className="app"><section className="screen"><h2>이미 답변이 도착한 초대장이에요 ♡</h2><p>이 초대장은 한 번만 제출할 수 있어요.</p></section></main>
  return <DateApp token={token} />
}

function DateApp({token}:{token:string}) {
  const [step, setStep] = useState(0)
  const [noCount, setNoCount] = useState(0)
  const [noVisible, setNoVisible] = useState(true)
  const [noPosition, setNoPosition] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const noButtonRef = useRef<HTMLButtonElement | null>(null)
  const cooldown = useRef(false)

  const [plan, setPlan] = useState<DatePlan>({
    date: '', time: '', activities: [], message: ''
  })

  const updatePlan = <K extends keyof DatePlan>(key: K, value: DatePlan[K]) =>
    setPlan(p => ({ ...p, [key]: value }))

  const escapeNo = () => {
    if (!noVisible || cooldown.current) return
    cooldown.current = true
    window.setTimeout(() => { cooldown.current = false }, 180)

    setNoCount(current => {
      const next = current + 1
      if (next >= 7) setNoVisible(false)
      return next
    })

    const maxX = Math.min(170, window.innerWidth * 0.25)
    const maxY = Math.min(120, window.innerHeight * 0.16)
    let x = (Math.random() * 2 - 1) * maxX
    let y = (Math.random() * 2 - 1) * maxY
    if (Math.abs(x) < 70) x += x < 0 ? -90 : 90
    if (Math.abs(y) < 45) y += y < 0 ? -55 : 55
    setNoPosition({ x, y })
  }

  useEffect(() => {
    if (step !== 0 || !noVisible) return
    const move = (e: MouseEvent) => {
      const b = noButtonRef.current
      if (!b || cooldown.current) return
      const r = b.getBoundingClientRect()
      const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2))
      if (d < 85) escapeNo()
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [step, noVisible])

  const savePlan = async () => {
    setSaving(true)
    setSaveError('')
    const { error } = await supabase.rpc('submit_invitation_response', {
      p_token: token,
      p_date: plan.date,
      p_time: plan.time,
      p_activities: plan.activities,
      p_message: plan.message,
    })
    setSaving(false)
    if (error) {
      console.error(error)
      setSaveError('저장에 실패했어요. 잠시 후 다시 눌러주세요.')
      return
    }
    setStep(7)
  }

  const back = () => setStep(s => Math.max(0, s - 1))

  return (
    <main className="app">
      <div className="sky-decor clouds" />
      {step > 0 && step < 7 && <button className="back" onClick={back}>← BACK</button>}

      {step === 0 && (
        <StartScreen
          noCount={noCount}
          noVisible={noVisible}
          noPosition={noPosition}
          noButtonRef={noButtonRef}
          message={noCount === 0 ? '하늘 아래 우리만의 하루를 만들어봐요.' : noMessages[Math.min(noCount - 1, noMessages.length - 1)]}
          onYes={() => setStep(1)}
          onNo={escapeNo}
        />
      )}
      {step === 1 && <DateScreen value={plan.date} onChange={v => updatePlan('date', v)} onNext={() => setStep(2)} />}
      {step === 2 && <TimeScreen value={plan.time} onChange={v => updatePlan('time', v)} onNext={() => setStep(3)} />}
      {step === 3 && <ActivityScreen values={plan.activities} onChange={v => updatePlan('activities', v)} onNext={() => setStep(4)} />}
      {step === 4 && <MessageScreen value={plan.message} onChange={v => updatePlan('message', v)} onNext={() => setStep(5)} />}
      {step === 5 && <SummaryScreen plan={plan} onEdit={() => setStep(4)} onConfirm={savePlan} saving={saving} error={saveError} />}
      {step === 7 && <FinalScreen plan={plan} />}
    </main>
  )
}

function StartScreen({ noCount, noVisible, noPosition, noButtonRef, message, onYes, onNo }: {
  noCount: number; noVisible: boolean; noPosition: {x:number;y:number}
  noButtonRef: RefObject<HTMLButtonElement | null>; message: string
  onYes: () => void; onNo: () => void
}) {
  return <section className="screen start">
    <PixelCharacter />
    <p className="eyebrow">☁️ A LITTLE DATE QUEST ☁️</p>
    <h1>저랑 데이트<br />하실래요?</h1>
    <p className="speech">{message}</p>
    <div className="button-row">
      <button className="pixel-button primary" onClick={onYes}>YES ♡</button>
      {noVisible ? <button ref={noButtonRef} className="pixel-button secondary no-button"
        onMouseEnter={onNo} onTouchStart={onNo} onClick={onNo}
        style={{transform:`translate(${noPosition.x}px,${noPosition.y}px) scale(${Math.max(.55,1-noCount*.07)})`, opacity:Math.max(.25,1-noCount*.1)}}>NO</button>
        : <span className="gone">어라...? NO가 사라졌어요 ☁️</span>}
    </div>
  </section>
}

function DateScreen({value,onChange,onNext}:{value:string;onChange:(v:string)=>void;onNext:()=>void}) {
  return <section className="screen"><p className="eyebrow">STEP 01</p><h2>우리 언제 만날까요?</h2>
    <div className="pixel-card form-card"><input className="date-input" type="date" value={value} onChange={e=>onChange(e.target.value)} />
      {value && <strong>{new Date(value+'T00:00:00').toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'})}</strong>}
    </div><NextButton disabled={!value} onClick={onNext}/></section>
}

function TimeScreen({value,onChange,onNext}:{value:string;onChange:(v:string)=>void;onNext:()=>void}) {
  return <section className="screen"><p className="eyebrow">STEP 02</p><h2>몇 시에 만날까요?</h2>
    <div className="grid">{times.map(t=><button key={t} className={`choice ${value===t?'selected':''}`} onClick={()=>onChange(t)}>{t}</button>)}</div>
    <NextButton disabled={!value} onClick={onNext}/></section>
}

function ActivityScreen({values,onChange,onNext}:{values:string[];onChange:(v:string[])=>void;onNext:()=>void}) {
  const toggle=(a:string)=>onChange(values.includes(a)?values.filter(x=>x!==a):[...values,a])
  return <section className="screen"><p className="eyebrow">STEP 03</p><h2>그날 뭐 할까요?</h2>
    <div className="grid activities">{activities.map(a=><button key={a} className={`choice ${values.includes(a)?'selected':''}`} onClick={()=>toggle(a)}>{a}</button>)}</div>
    <NextButton disabled={!values.length} onClick={onNext}/></section>
}

function MessageScreen({value,onChange,onNext}:{value:string;onChange:(v:string)=>void;onNext:()=>void}) {
  return <section className="screen"><p className="eyebrow">STEP 04</p><h2>마지막으로 하고 싶은 말을 적어주세요.</h2>
    <div className="pixel-card message-card"><textarea maxLength={100} value={value} onChange={e=>onChange(e.target.value)} placeholder="하고 싶은 말을 적어주세요..." /><small>{value.length} / 100</small></div>
    <NextButton onClick={onNext}/></section>
}

function SummaryScreen({plan,onEdit,onConfirm,saving,error}:{plan:DatePlan;onEdit:()=>void;onConfirm:()=>void;saving:boolean;error:string}) {
  return <section className="screen"><p className="eyebrow">CHECK</p><h2>우리의 약속을 확인해요 ☁️</h2>
    <div className="pixel-card summary"><p><b>DATE</b><span>{plan.date}</span></p><p><b>TIME</b><span>{plan.time}</span></p><p><b>PLAN</b><span>{plan.activities.join(' · ')}</span></p><p><b>MESSAGE</b><span>{plan.message || '♡'}</span></p></div>
    {error && <p className="error">{error}</p>}
    <div className="button-row"><button className="pixel-button secondary" onClick={onEdit}>수정하기</button><button className="pixel-button primary" onClick={onConfirm} disabled={saving}>{saving?'저장 중...':'이대로 할게요! ♡'}</button></div>
  </section>
}

function FinalScreen({plan}:{plan:DatePlan}) {
  return <section className="screen final"><div className="confetti">✦　☁️　✧　♡　✦</div>
    <div className="pixel-card final-card"><p className="eyebrow">OUR SPECIAL DAY</p><h2>우리의 특별한 하루</h2>
      <p>{plan.date} · {plan.time}</p><p>{plan.activities.join(' · ')}</p>
      <div className="message-bubble">{plan.message || '오늘은 우리 둘만의 특별한 날이에요 ♡'}</div><h3>그날 만나요 ♡</h3>
    </div><p className="success-note">답변이 전달됐어요 ☁️</p></section>
}

function NextButton({disabled=false,onClick}:{disabled?:boolean;onClick:()=>void}) {
  return <button className="pixel-button primary next" disabled={disabled} onClick={onClick}>다음 →</button>
}
function PixelCharacter(){return <div className="character" aria-hidden="true">☁️<span>◡</span>☁️</div>}
