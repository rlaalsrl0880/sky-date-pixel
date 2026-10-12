import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabaseClient'

type Invitation = {id:string;created_at:string;date_plans:{id:string;date:string;time:string;activities:string[];message:string;created_at:string}[]}

export default function Dashboard(){
  const [session,setSession]=useState<Session|null>(null)
  const [checking,setChecking]=useState(true)
  const [mode,setMode]=useState<'login'|'signup'>('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [items,setItems]=useState<Invitation[]>([])
  const [copied,setCopied]=useState('')

  useEffect(()=>{
    let active=true
    supabase.auth.getSession().then(({data,error})=>{
      if(!active)return
      setSession(data.session);setChecking(false)
      if(error)setError('로그인 상태를 확인하지 못했어요.')
    })
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>setSession(session))
    return ()=>{active=false;data.subscription.unsubscribe()}
  },[])
  useEffect(()=>{if(session)void load();else setItems([])},[session?.user.id])

  async function load(){
    setLoading(true);setError('')
    const {data,error}=await supabase.from('invitations')
      .select('id,created_at,date_plans(id,date,time,activities,message,created_at)')
      .order('created_at',{ascending:false})
    if(error)setError('초대장 목록을 불러오지 못했어요. SQL 설정을 확인해주세요.')
    else setItems((data??[]) as Invitation[])
    setLoading(false)
  }
  async function auth(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');setNotice('')
    const result=mode==='login'
      ? await supabase.auth.signInWithPassword({email,password})
      : await supabase.auth.signUp({email,password})
    if(result.error)setError(result.error.message)
    else if(mode==='signup'&&!result.data.session)setNotice('회원가입 요청이 완료됐어요. 이메일 인증 후 로그인해주세요.')
    else if(mode==='signup')setNotice('회원가입 완료!')
    setBusy(false)
  }
  async function create(){
    if(!session)return
    setBusy(true);setError('')
    const {error}=await supabase.from('invitations').insert({owner_id:session.user.id})
    if(error)setError('초대장 생성에 실패했어요: '+error.message)
    else await load()
    setBusy(false)
  }
  async function copy(id:string){
    const link=window.location.origin+window.location.pathname+'?invite='+id
    try{await navigator.clipboard.writeText(link);setCopied(id)}
    catch{window.prompt('링크를 복사해주세요',link)}
  }
  async function remove(id:string){
    if(!window.confirm('초대장과 답변을 모두 삭제할까요?'))return
    setBusy(true);setError('')
    const {error}=await supabase.from('invitations').delete().eq('id',id)
    if(error)setError('삭제에 실패했어요: '+error.message)
    else await load()
    setBusy(false)
  }
  async function logout(){await supabase.auth.signOut();setNotice('');setError('')}
  return <main className="app dashboard-app"><div className="sky-decor clouds"/>
    <section className="dash-wrap">
      <p className="eyebrow">☁️ SKY DATE ☁️</p>
      <h1>{session?'MY INVITATIONS':'데이트 초대장 만들기'}</h1>
      {checking?<div className="pixel-card">로그인 상태 확인 중...</div>:
      !session?<div className="pixel-card dash-auth">
        <h2>{mode==='login'?'로그인':'회원가입'}</h2>
        <p>내 초대 링크를 만들고 답변을 확인해요 ♡</p>
        <form onSubmit={auth} className="dash-form">
          <input type="email" required placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)}/>
          <input type="password" required minLength={6} placeholder="비밀번호 (6자 이상)" value={password} onChange={e=>setPassword(e.target.value)}/>
          <button className="pixel-button primary" disabled={busy}>{busy?'처리 중...':mode==='login'?'로그인':'회원가입'}</button>
        </form>
        <button className="dash-text-btn" onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');setNotice('')}}>
          {mode==='login'?'계정이 없나요? 회원가입':'이미 계정이 있나요? 로그인'}
        </button>
      </div>:<>
        <div className="dash-toolbar"><span>☁️ {session.user.email}</span><button className="pixel-button primary" disabled={busy} onClick={create}>+ 새 초대 만들기</button><button className="dash-text-btn" onClick={logout}>로그아웃</button></div>
        {loading?<div className="pixel-card">초대장을 불러오는 중... ☁️</div>:
          items.length===0?<div className="pixel-card">아직 초대장이 없어요. 새 초대를 만들어보세요 ♡</div>:
          <div className="dash-grid">{items.map((item,index)=>{
            const answer=item.date_plans?.[0]
            return <article className="pixel-card dash-invite" key={item.id}>
              <div className="dash-card-head"><strong>💌 초대장 #{items.length-index}</strong><span>{new Date(item.created_at).toLocaleDateString('ko-KR')}</span></div>
              <p className="dash-status">{answer?'💙 답변 도착':'☁️ 답변 기다리는 중'}</p>
              {answer?<div className="dash-answer">
                <p><b>날짜</b> {answer.date}</p><p><b>시간</b> {answer.time}</p>
                <p><b>활동</b> {answer.activities?.join(' · ')||'없음'}</p>
                <p><b>메시지</b> {answer.message||'없음'}</p>
                <small>제출: {new Date(answer.created_at).toLocaleString('ko-KR')}</small>
              </div>:<p className="dash-muted">링크를 복사해서 상대방에게 보내주세요.</p>}
              <div className="dash-card-actions"><button onClick={()=>void copy(item.id)} className="pixel-button primary">{copied===item.id?'복사 완료 ✓':'링크 복사'}</button>
              <button className="pixel-button secondary" onClick={()=>window.open('?invite='+item.id,'_blank')}>미리보기</button>
              <button className="dash-delete" disabled={busy} onClick={()=>void remove(item.id)}>삭제</button></div>
            </article>
          })}</div>}
        <button className="dash-text-btn" disabled={loading} onClick={()=>void load()}>↻ 새로고침</button>
      </>}
      {error&&<p role="alert" className="error">⚠️ {error}</p>}
      {notice&&<p className="dash-notice">{notice}</p>}
    </section>
  </main>
}
