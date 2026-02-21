/* 🚀 RADIO REPLICANTE v11.2 "ZENA HYBRID" 🚀
  -----------------------------------------
  - Data Sync: SUPABASE (Mugugni & Vocals)
  - Auth & Fuel: FIREBASE (Persistence)
  - Fix: Risolto "Permission Denied" spostando il traffico pubblico su Supabase
  - Mood: Genuino, quasi umano, senza museruola.
  -----------------------------------------
*/

import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// CONFIGURAZIONE FIREBASE (Dall'ambiente)
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'radio-replicante-v11';

// CONFIGURAZIONE SUPABASE (Il tuo magazzino dati)
const supabaseUrl = 'https://cprpshkxzqvtjofjnive.supabase.co';
const supabaseKey = 'sb_publishable_dcewF1z8L6FW6v8g2WxjwA_YIZcpXPU';

export default function App() {
  const [view, setView] = useState('landing');
  const [user, setUser] = useState(null);
  const [supabase, setSupabase] = useState(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [misfatti, setMisfatti] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ugoChat, setUgoChat] = useState([{ role: 'bot', text: "Elvio, ho ricollegato i cavi a Supabase. La Piazza dovrebbe ruggire ora. SBAM!" }]);
  const [isTyping, setIsTyping] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const videoRef = useRef(null);

  // 1. INIZIALIZZAZIONE SUPABASE & AUTH
  useEffect(() => {
    // Carichiamo il client Supabase via CDN se non presente (metodo sicuro per file singolo)
    const initSupabase = () => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = () => {
        if (window.supabase) {
          const client = window.supabase.createClient(supabaseUrl, supabaseKey);
          setSupabase(client);
        }
      };
      document.head.appendChild(script);
    };
    initSupabase();

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error("Errore Auth:", e); }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. SINCRONIZZAZIONE DATI VIA SUPABASE
  useEffect(() => {
    if (!supabase || !user) return;

    // Caricamento Fuel da Firestore (Configurazione privata protetta)
    const loadFuel = async () => {
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config');
        const snap = await getDoc(docRef);
        if (snap.exists()) setGeminiKey(snap.data().key);
      } catch (e) { console.error("Errore fuel:", e); }
    };
    loadFuel();

    // Sincronizzazione Mugugni (Supabase)
    const fetchMugugni = async () => {
      const { data } = await supabase.from('mugugni').select('*').order('created_at', { ascending: false });
      if (data) setMisfatti(data);
    };
    fetchMugugni();

    const mugugniSub = supabase.channel('piazza-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mugugni' }, fetchMugugni)
      .subscribe();

    // Sincronizzazione Comandi Vocali (Supabase)
    const vocalSub = supabase.channel('vocal-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vocal_commands' }, payload => {
        if (payload.new.testo) saraSpeak(payload.new.testo);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(mugugniSub);
      supabase.removeChannel(vocalSub);
    };
  }, [supabase, user]);

  const saveFuel = async (key) => {
    if (!user) return;
    setGeminiKey(key);
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'), { key, updated_at: serverTimestamp() });
  };

  const askUgo = async (msg) => {
    if (msg.toLowerCase() === 'sbam') { setView('vault'); return; }
    setUgoChat(prev => [...prev, { role: 'user', text: msg }]);
    setIsTyping(true);
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: msg }] }],
          systemInstruction: { parts: [{ text: "Sei Ugo, bot genovese cinico. Rispondi rude, usa 'Belìn' e insulta l'ipocrisia politica e religiosa." }] }
        })
      });
      const res = await resp.json();
      const txt = res.candidates[0].content.parts[0].text;
      setUgoChat(prev => [...prev, { role: 'bot', text: txt }]);
      saraSpeak(txt);
    } catch (e) { console.error(e); }
    finally { setIsTyping(false); }
  };

  const saraSpeak = async (text) => {
    if (!text || !geminiKey || isSpeaking) return;
    setIsSpeaking(true);
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } } }
        })
      });
      const res = await resp.json();
      const audioData = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        const audio = new Audio(`data:audio/wav;base64,${audioData}`);
        audio.onended = () => setIsSpeaking(false);
        audio.play().catch(() => setIsSpeaking(false));
      } else { setIsSpeaking(false); }
    } catch (e) { setIsSpeaking(false); }
  };

  const handleLanding = () => {
    setView('hub');
    if (videoRef.current) { videoRef.current.play(); setVideoOn(true); }
  };

  if (view === 'landing') return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-slate-900/40 border-t-8 border-yellow-500 p-12 rounded-[5rem] text-center shadow-2xl">
        <div className="w-20 h-20 bg-yellow-500 rounded-2xl mx-auto mb-8 flex items-center justify-center font-black text-4xl text-black shadow-lg">R</div>
        <h1 className="text-4xl font-black italic uppercase text-yellow-500 mb-4 tracking-tighter">SENTINEL 11.2</h1>
        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-10 italic">Zena Hybrid // Supabase Power</p>
        <button onClick={handleLanding} className="w-full bg-yellow-500 py-6 rounded-3xl font-black uppercase text-xs text-black active:scale-95 transition-all shadow-xl">Entra in Radio</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#010503] text-slate-200 font-sans flex flex-col relative overflow-hidden">
      <header className="px-8 py-5 bg-black/90 border-b border-yellow-500/10 flex justify-between items-center z-50 shadow-2xl">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('hub')}>
          <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center font-black text-black">R</div>
          <h1 className="text-xl font-black uppercase italic tracking-tighter leading-none">Radio Replicante</h1>
        </div>
        <div className="flex gap-4">
            <span className={`text-[9px] font-black px-4 py-1.5 rounded-full border border-yellow-500/30 uppercase ${supabase ? 'text-yellow-500' : 'text-red-500 animate-pulse'}`}>
                {supabase ? 'SUPA_LINK_OK' : 'SUPA_OFFLINE'}
            </span>
            {view !== 'hub' && <button onClick={() => setView('hub')} className="text-[10px] font-black uppercase text-yellow-500 border-b border-yellow-500/20">Moli</button>}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col items-center pb-24">
        {view === 'hub' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl mt-8">
            <Card title="Piazza Mugugni" desc="Archivio Supabase." icon="😤" color="amber" onClick={() => setView('misfatti')} />
            <Card title="Sara Monitor" desc="L'occhio dei carruggi." icon="📡" color="blue" onClick={() => setView('sara')} />
            <Card title="Ugo AI" desc="Logica genovese." icon="🤖" color="slate" onClick={() => setView('ugo')} />
            <Card title="Molo Vaticano" desc="Mugugni religiosi." icon="⛪" color="yellow" onClick={() => setView('vaticano')} />
            <Card title="Palazzo Tursi" desc="Misfatti politici." icon="🏛️" color="red" onClick={() => setView('politica')} />
            <Card title="Caveau" desc="Fuel & Fuel." icon="🔒" color="red" onClick={() => setView('vault')} />
          </div>
        )}

        {view === 'ugo' && (
          <div className="w-full max-w-xl h-[75vh] flex flex-col bg-slate-900/60 rounded-[4rem] border-2 border-white/5 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin scrollbar-thumb-yellow-500">
              {ugoChat.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-6 rounded-[2.5rem] text-sm font-bold italic uppercase ${m.role === 'user' ? 'bg-yellow-500 text-black shadow-lg' : 'bg-black/60 border border-white/10 text-white shadow-xl'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isTyping && <div className="text-[10px] font-black text-yellow-500 animate-pulse italic uppercase ml-4">Ugo mastica dati...</div>}
            </div>
            <div className="p-6 bg-black/60 border-t border-white/5">
              <input type="text" placeholder="INSULTA UN POLITICO..." className="w-full bg-slate-800 rounded-3xl px-8 py-5 text-sm font-black uppercase text-white outline-none focus:ring-2 focus:ring-yellow-500 placeholder:opacity-20" onKeyDown={e => { if(e.key==='Enter') { askUgo(e.target.value); e.target.value=''; }}} />
            </div>
          </div>
        )}

        {view === 'sara' && (
            <div className="flex flex-col items-center gap-12 mt-10">
                <div className={`relative w-80 h-80 rounded-full overflow-hidden transition-all duration-700 ${isSpeaking ? 'border-8 border-yellow-500 shadow-2xl scale-105' : 'border-4 border-white/10 opacity-70'}`}>
                    <video ref={videoRef} loop muted playsInline poster="sara.png" className="w-full h-full object-cover scale-110">
                        <source src="saraaudio.mp4" type="video/mp4"/>
                    </video>
                    {isSpeaking && <div className="absolute bottom-12 left-0 w-full flex justify-center gap-2 animate-bounce"><div className="w-2 h-10 bg-yellow-500"></div><div className="w-2 h-14 bg-yellow-500"></div><div className="w-2 h-8 bg-yellow-500"></div></div>}
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.6em] text-yellow-500 animate-pulse italic text-center px-10">Sara is watching the port...</p>
            </div>
        )}

        {view === 'vault' && (
            <div className="w-full max-w-2xl bg-slate-900/60 p-12 rounded-[5rem] border-t-8 border-red-600 shadow-2xl space-y-12">
                <div className="text-center">
                    <h2 className="text-5xl font-black italic uppercase text-red-600 tracking-tighter leading-none">Il Caveau</h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2 font-bold italic">X55A-MASTER-FUEL</p>
                </div>
                <div className="space-y-4">
                    <label className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-2">Batteria Vocale (API Key):</label>
                    <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} className="w-full bg-black border border-red-900/40 rounded-[2rem] p-6 text-xl font-mono text-red-500 outline-none focus:border-red-600 shadow-inner" placeholder="INCOLLA QUI..." />
                    <button onClick={() => saveFuel(geminiKey)} className="w-full bg-red-600 py-4 rounded-full font-black uppercase text-[10px] text-white shadow-xl hover:bg-red-500 transition-all">Salda Chiave</button>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
                    <button onClick={() => saraSpeak("Sistema ricalibrato su Supabase. Sara è pronta.")} className="bg-white/5 border border-white/10 py-5 rounded-[2rem] font-black uppercase text-[11px] text-white hover:bg-white/10 transition-all">Test Vocale</button>
                    <button onClick={() => setView('hub')} className="bg-white/5 border border-white/10 py-5 rounded-[2rem] font-black uppercase text-[11px] text-slate-400">Esci</button>
                </div>
            </div>
        )}

        {(view === 'misfatti' || view === 'vaticano' || view === 'politica') && (
            <div className="w-full max-w-4xl space-y-10 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-6xl font-black italic uppercase text-yellow-500 tracking-tighter text-center leading-none">Gogna<br/>Pubblica</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {misfatti.length === 0 ? <p className="col-span-full text-center opacity-20 font-black uppercase text-4xl py-40 leading-tight">Nessun segnale da Supabase...<br/>Controlla le tabelle!</p> : misfatti.map(m => (
                        <div key={m.id} className="bg-slate-900/80 p-8 rounded-[4rem] border-l-8 border-red-600 shadow-xl group">
                            <div className="flex justify-between mb-4"><span className="text-[9px] font-black text-red-500 uppercase italic">REC_{m.id}</span></div>
                            <p className="text-2xl font-black italic uppercase text-white mb-6 leading-tight group-hover:text-yellow-500 transition-colors">"{m.testo}"</p>
                            {m.foto && <img src={m.foto} className="w-full h-48 object-cover rounded-3xl grayscale group-hover:grayscale-0 transition-all shadow-lg" />}
                        </div>
                    ))}
                </div>
            </div>
        )}
      </main>

      <footer className="h-16 bg-yellow-500 flex items-center overflow-hidden z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t-2 border-black/10">
        <div className="px-12 bg-black h-full flex items-center font-black text-xs text-yellow-500 uppercase italic tracking-[1em]">SENTINEL_11.2</div>
        <div className="flex-1 whitespace-nowrap animate-marquee flex items-center gap-48 font-black text-lg text-black italic uppercase tracking-tighter">
            <span>*** RADIO REPLICANTE GENOVA // MASTER HUB v11.2 HYBRID ***</span>
            <span>DATA STORE: SUPABASE *** FUEL: FIREBASE *** SARA: ONLINE ***</span>
            <span>ABBASSO I ROLEX // SOLO VERITÀ DAI CARRUGGI // SBAM! ***</span>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { animation: marquee 40s linear infinite; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #fbbf24; border-radius: 10px; }
      `}} />
    </div>
  );
}

function Card({ title, desc, icon, onClick, color }) {
    const colors = { amber: 'border-yellow-500/20 hover:border-yellow-500', blue: 'border-blue-500/20 hover:border-blue-500', slate: 'border-slate-500/20 hover:border-slate-500', red: 'border-red-600/20 hover:border-red-600', yellow: 'border-yellow-200/20 hover:border-yellow-200' };
    return (
        <button onClick={onClick} className={`bg-slate-900/60 border-2 rounded-[4rem] p-10 text-left transition-all hover:bg-slate-900 hover:scale-[1.02] shadow-2xl ${colors[color] || 'border-white/5'}`}>
            <div className="text-5xl mb-6">{icon}</div>
            <h3 className="text-2xl font-black italic uppercase text-white mb-2 leading-none">{title}</h3>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{desc}</p>
        </button>
    );
}
