"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Paperclip, Star, ArrowUp, ChatText, FileText, MagnifyingGlass, GearSix, DotsThreeOutlineVertical, DownloadSimple, Lightning, Sparkle, Asterisk, FunnelSimple, ChatsCircle, CurrencyDollar, UserPlus, Timer, ClockAfternoon, ShieldCheck, ChartLineUp, TrendUp, CaretDown, FilePdf, X, ArrowRight, SlidersHorizontal, Archive, User, Buildings, Palette, Bell, CreditCard, TrashSimple, Moon, SunDim, Shield, LockSimple } from "@phosphor-icons/react";
import { apiCreateRun, uploadSigned, apiSubmit, listenEvents, apiResult, apiChatQnA, apiChatHistory } from "@/lib/client";
import { UserButton, SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import FilesList from "@/components/FilesList";

// Detect domain based on prompt and file names
function detectDomain(prompt: string, files: File[]): string {
  const text = `${prompt} ${files.map(f => f.name).join(' ')}`.toLowerCase();
  
  if (text.includes('chip') || text.includes('microcontroller') || text.includes('processor') || 
      text.includes('voltage') || text.includes('current') || text.includes('frequency') ||
      text.includes('datasheet') || text.includes('mcu') || text.includes('ic')) {
    return 'CHIP';
  }
  
  if (text.includes('api') || text.includes('endpoint') || text.includes('rest') || 
      text.includes('graphql') || text.includes('webhook') || text.includes('rate limit')) {
    return 'API';
  }
  
  // Default to SaaS if no clear indicators
  return 'SAAS';
}

function Sidebar({ active, onSelect }: { active: 'chat'|'files'|'archive'|'settings'; onSelect: (t:'chat'|'files'|'archive'|'settings')=>void }) {
  return (
    <aside className="h-full w-[68px] panel rounded-[16px] p-3 flex flex-col justify-between">
      <div className="flex flex-col gap-3 items-center">
        <div className="h-12 w-12 rounded-[12px] bg-[#0d0d0d] border border-[#2a2a2a] flex items-center justify-center">
          <Image src="/logo1pdf.png" alt="logo" width={22} height={22} />
        </div>
        <button onClick={()=>onSelect('chat')} className={`h-12 w-12 rounded-[12px] bg-[#0d0d0d] border border-[#2a2a2a] flex items-center justify-center ${active==='chat'?'ring-1 ring-[#3a3a3a]':''} text-[--muted]`}><ChatText size={22} weight="regular" /></button>
        <button onClick={()=>onSelect('files')} className={`h-12 w-12 rounded-[12px] bg-[#0d0d0d] border border-[#2a2a2a] flex items-center justify-center ${active==='files'?'ring-1 ring-[#3a3a3a]':''} text-[--muted]`}><FileText size={22} weight="regular" /></button>
        <button onClick={()=>onSelect('archive')} className={`h-12 w-12 rounded-[12px] bg-[#0d0d0d] border border-[#2a2a2a] flex items-center justify-center ${active==='archive'?'ring-1 ring-[#3a3a3a]':''} text-[--muted]`}><Archive size={22} weight="regular" /></button>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 flex items-center justify-center">
          <UserButton afterSignOutUrl="https://trybriefai.com" appearance={{ elements: { userButtonAvatarBox: "h-10 w-10", userButtonTrigger: "h-10 w-10" } }} />
        </div>
        <button onClick={()=>onSelect('settings')} className={`h-12 w-12 rounded-[12px] bg-[#0d0d0d] border border-[#2a2a2a] flex items-center justify-center ${active==='settings'?'ring-1 ring-[#3a3a3a]':''} text-[--muted]`}><GearSix size={22} weight="regular" /></button>
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <></>
  );
}

function ChatCard({ onSubmit, stage, setStage, onDone }: { onSubmit: (prompt: string, files: File[]) => void; stage: "idle"|"extracting"|"normalizing"|"building"; setStage: (s: any)=>void; onDone: ()=>void }) {
  const [prompt, setPrompt] = useState("");
  const [editing, setEditing] = useState(false);
  const words = ["Software", "API", "Chip"] as const;
  const [wordIndex, setWordIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [pause, setPause] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [model, setModel] = useState("Claude 3.5 Sonnet");
  const [files, setFiles] = useState<File[]>([]);

  // Type/delete loop for preview when not editing and no prompt
  useEffect(() => {
    if (editing || prompt) return;
    const current = words[wordIndex];
    const speed = deleting ? 38 : 68; // più fluido
    if (pause) {
      const t = setTimeout(() => setPause(false), 420);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      if (!deleting) {
        const next = current.substring(0, typed.length + 1);
        setTyped(next);
        if (next === current) {
          setPause(true); // breve pausa a fine parola
          setDeleting(true);
        }
      } else {
        const next = current.substring(0, typed.length - 1);
        setTyped(next);
        if (next.length === 0) {
          setDeleting(false);
          setWordIndex((wordIndex + 1) % words.length);
          setPause(true); // pausa prima di ricominciare
        }
      }
    }, speed);
    return () => clearTimeout(t);
  }, [typed, deleting, wordIndex, words, editing, prompt, pause]);



  return (
    <div className="relative w-[740px] max-w-[92vw] mt-40">
      <div className="p-5">
        <div className="text-center font-instrument text-[48px] leading-tight text-[#c0c0c0] opacity-90 mb-2 whitespace-nowrap">
          Compare specs across any product or service
        </div>
        <div className="text-center text-sm text-[#9a9a9a] -mt-1 mb-8 font-mono-ui font-medium">Our AI extracts, cleans, and compares</div>
        <div className="rounded-[14px] panel card-shadow p-4">
          {/* Uploaded files chips */}
          {files.length > 0 && (
            <div className="mb-3 flex items-center gap-2 overflow-x-auto scroll-smooth">
              {files.map((f, idx) => (
                <div key={idx} className="pill-dark px-3 py-1 text-[--muted] flex items-center gap-2">
                  <FilePdf size={16} />
                  <span className="text-xs font-mono-ui whitespace-nowrap max-w-[180px] truncate">{f.name}</span>
                  <button onClick={() => setFiles(files.filter((_,i)=>i!==idx))} aria-label="remove" className="text-[#6f6f6f] hover:text-[#a0a0a0]">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-[--muted]">
            <Image className={`icon-shadow ${stage !== "idle" ? 'spin-logo' : ''}`} src="/logo1pdf.png" alt="logo" width={16} height={16} />
            {stage === "idle" ? (
              <>
                {!editing && !prompt && (
                  <button onClick={()=>{ setEditing(true); setTyped(""); }} className="font-mono-ui text-[15px] tracking-[0.01em] text-left flex-1 opacity-50 caret">
                    {`Compare this two ${typed}`}
                  </button>
                )}
                {(editing || prompt) && (
                  <input
                    autoFocus
                    value={prompt}
                    onChange={(e)=>setPrompt(e.target.value)}
                    onBlur={()=>setEditing(false)}
                    className="font-mono-ui text-[15px] tracking-[0.01em] flex-1 bg-transparent outline-none"
                  />
                )}
              </>
            ) : (
              <div className="font-mono-ui text-[15px] tracking-[0.06em] text-[#d9d9d9] flex-1">
                {stage === "extracting" && 'Extracting…'}
                {stage === "normalizing" && 'Normalizing…'}
                {stage === "building" && 'Building…'}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-[8px] mt-3 pr-2 relative">
            {/* Attach */}
            <label className="btn-icon h-10 w-10 rounded-full flex items-center justify-center cursor-pointer">
              <input type="file" className="hidden" multiple accept="application/pdf,.pdf" onChange={(e)=>{
                const selected = Array.from(e.target.files || []).filter(f => /pdf$/i.test(f.type) || f.name.toLowerCase().endsWith('.pdf'));
                if (selected.length) setFiles(prev=>[...prev, ...selected].slice(0,5));
              }} />
              <Paperclip size={24} weight="regular" color="#5F5F5F" />
            </label>

            {/* Model menu */}
            <div className="relative">
              <button onClick={()=>setShowModel(v=>!v)} aria-label="model" className="btn-icon h-10 w-10 rounded-full flex items-center justify-center">
                <Sparkle size={24} weight="fill" color="#5F5F5F" />
              </button>
              {showModel && (
                <div className="absolute right-0 top-12 z-10 panel rounded-[12px] p-2 w-[220px]">
                  <div className="px-2 py-1 text-xs text-[#9a9a9a] font-mono-ui">AI Model</div>
                  {[
                    'Claude 3.5 Sonnet',
                    'Claude 3 Haiku',
                    'Claude 4 (preview)',
                    'GPT-4o',
                    'GPT-4.1 mini',
                  ].map(m => (
                    <button key={m} onClick={()=>{ setModel(m); setShowModel(false); }} className={`w-full text-left px-3 py-2 rounded-[10px] hover:bg-[#1e1e1e] ${model===m ? 'bg-[#1a1a1a] border border-[#2a2a2a]' : ''}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[#d9d9d9] text-sm font-mono-ui">{m}</span>
                        {model===m && <CaretDown size={14} />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send */}
            <button onClick={async ()=>{ 
              await onSubmit(prompt, files); 
            }} aria-label="send" className="btn-send h-16 w-16 rounded-full flex items-center justify-center active:shadow-none">
              <ArrowUp size={26} weight="bold" color="#5F5F5F" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type Row = { icon: string; label: string; a?: string; b?: string; ok?: boolean };

function Results({ runId }: { runId?: string }) {
  const [tableData, setTableData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Fetch real results when component mounts
  useEffect(() => {
    async function fetchResults() {
      if (!runId) {
        setLoading(false);
        return;
      }
      
      try {
        console.log(`📊 Fetching results for run: ${runId}`);
        const result = await apiResult(runId);
        console.log(`📊 Results received:`, result);
        setTableData(result);
      } catch (error) {
        console.error(`❌ Failed to fetch results:`, error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchResults();
  }, [runId]);
  
  // Convert real data to display format
  const rows: Row[] = useMemo(() => {
    if (!tableData?.table?.rows || !tableData?.table?.columns) {
      // Fallback to empty or minimal data
      return [
        { icon: "pricing", label: "NO DATA", a: "Processing...", ok: false }
      ];
    }
    
    const { rows: tableRows, columns } = tableData.table;
    
    return tableRows.map((row: any, index: number) => {
      // API returns simple array format: ["Field Name", "Value 1", "Value 2"]
      const fieldName = row[0] || `Field ${index + 1}`;
      const value1 = row[1] || '';
      const value2 = row[2] || '';
      
      return {
        icon: "pricing", // Default icon, could be made dynamic  
        label: fieldName.replace(/_/g, ' ').toUpperCase(),
        a: value1,
        b: value2, // Always show value2, even if same as value1
        ok: value1 !== 'Processing failed' && value1 !== 'Processing...'
      };
    });
  }, [tableData]);

  // Etichette colonne dinamiche dai risultati
  const colLabels = useMemo(() => {
    const cols = tableData?.table?.columns || [];
    return [
      cols[0]?.name || cols[0] || 'Field', 
      cols[1]?.name || cols[1] || 'DOC 1', 
      cols[2]?.name || cols[2] || 'DOC 2'
    ];
  }, [tableData]);

  const [miniChatOpen, setMiniChatOpen] = useState(false);
  const [miniMessages, setMiniMessages] = useState<{id:number; role:'user'|'ai'; content:string; thinking?:boolean;}[]>([]);
  const [miniInput, setMiniInput] = useState("");
  const [miniStage, setMiniStage] = useState<'idle'|'thinking'>("idle");
  const tableFileInput = useRef<HTMLInputElement|null>(null);

  // Load chat history when chat opens
  useEffect(() => {
    async function loadChatHistory() {
      if (!miniChatOpen || !runId || miniMessages.length > 0) return;
      
      try {
        const history = await apiChatHistory(runId);
        if (history.messages && history.messages.length > 0) {
          const formattedMessages = history.messages.map((msg: any, index: number) => ({
            id: Date.now() + index,
            role: msg.role === 'user' ? 'user' : 'ai',
            content: msg.content
          }));
          setMiniMessages(formattedMessages);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    }
    
    loadChatHistory();
  }, [miniChatOpen, runId, miniMessages.length]);

  async function handleMiniSend() {
    const text = miniInput.trim();
    if (!text || !runId || miniStage === 'thinking') return;
    
    const userMsg = { id: Date.now(), role: 'user' as const, content: text };
    const thinkingMsg = { id: Date.now()+1, role: 'ai' as const, content: 'Thinking…', thinking: true };
    
    setMiniMessages(prev => [...prev, userMsg, thinkingMsg]);
    setMiniInput("");
    setMiniStage('thinking');
    
    try {
      const response = await apiChatQnA(runId, text);
      
      setMiniMessages(prev => {
        const withoutThinking = prev.filter(m => !m.thinking);
        return [...withoutThinking, { 
          id: Date.now()+2, 
          role: 'ai', 
          content: response.reply || 'Sorry, I could not generate a response.' 
        }];
      });
      
    } catch (error) {
      console.error('Chat error:', error);
      
      setMiniMessages(prev => {
        const withoutThinking = prev.filter(m => !m.thinking);
        return [...withoutThinking, { 
          id: Date.now()+2, 
          role: 'ai', 
          content: 'Sorry, I encountered an error while processing your question. Please try again.' 
        }];
      });
    } finally {
      setMiniStage('idle');
    }
  }
  return (
    <div className="panel rounded-[16px] p-4 relative card-shadow min-h-[520px] flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <div className="pill-dark px-3 py-1 flex items-center gap-2">
          <Image src="/logo1pdf.png" alt="logo" width={16} height={16} />
          <span className="font-mono-ui text-[#d9d9d9]">SAAS comparison</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="pill px-2.5 py-1.5 flex items-center gap-2 bg-[#e6e6e6] text-black border border-[#cfcfcf]">
            <SlidersHorizontal size={16} />
            <span className="font-mono-ui text-sm">Filter</span>
          </button>
          <ExportCSV className="bg-[#e6e6e6] border border-[#cfcfcf] px-2.5 py-1.5" />
        </div>
      </div>

      <div className="bg-black rounded-[12px] p-6 shadow-inner-soft flex-1 overflow-hidden relative">
        {/* Mini Chat overlay */}
        {miniChatOpen && (
          <div className="absolute inset-0 z-20 p-6">
            <div id="mini-chat-sheet" className={`h-full w-full rounded-[14px] panel flex flex-col sheet-in`}>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2 text-[#d9d9d9]">
                  <Image src="/logo1pdf.png" alt="logo" width={18} height={18} />
                  <span className="font-mono-ui">Ask AI about this table</span>
                </div>
                <button onClick={()=>{
                  const sheet = document.getElementById('mini-chat-sheet');
                  if (sheet) {
                    sheet.classList.remove('sheet-in');
                    sheet.classList.add('sheet-dismiss');
                    setTimeout(()=>setMiniChatOpen(false), 300);
                  } else {
                    setMiniChatOpen(false);
                  }
                }} className="btn-icon h-10 w-10 rounded-full flex items-center justify-center"><X size={20} color="#5F5F5F" /></button>
              </div>
              <div className="flex-1 p-4 text-[#9a9a9a] font-mono-ui overflow-y-auto space-y-3">
                {miniMessages.length === 0 && (
                  <div className="opacity-60">Type a question to the assistant…</div>
                )}
                {miniMessages.map(m => (
                  <div key={m.id} className={`flex items-start gap-3 ${m.role==='user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role==='ai' && (
                      <div className={`h-8 w-8 rounded-full bg-[#0d0d0d] border border-[#2a2a2a] flex items-center justify-center ${m.thinking ? 'spin-logo' : ''}`}>
                        <Image src="/logo1pdf.png" alt="ai" width={16} height={16} />
                      </div>
                    )}
                    <div className={`max-w-[70%] ${m.role==='user' ? 'bg-[#1a1a1a]' : 'bg-[#121212]'} border border-[#2a2a2a] rounded-[12px] px-3 py-2 text-[#d9d9d9]`}>{m.content}</div>
                    {m.role==='user' && (
                      <div className="h-8 w-8 rounded-full bg-[#0d0d0d] border border-[#2a2a2a] text-xs text-[#d9d9d9] flex items-center justify-center">LC</div>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-4">
                <div className="rounded-[12px] panel p-3 flex items-center gap-2">
                  <Image src="/logo1pdf.png" alt="logo" width={14} height={14} />
                  <input value={miniInput} onChange={e=>setMiniInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); handleMiniSend(); } }} className="flex-1 bg-transparent outline-none font-mono-ui" placeholder="Ask a question about the comparison…" />
                  <button onClick={handleMiniSend} className="btn-send h-12 w-12 rounded-full flex items-center justify-center">
                    <ArrowUp size={22} color="#5F5F5F" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-[260px_1fr_1fr_60px] items-center mb-6">
          <div className="justify-self-start">
            <div className="pill-dark text-[#d9d9d9] px-3 py-1 flex items-center gap-2"><GearSix size={14} /><span className="font-mono-ui">SPEC</span></div>
          </div>
          <div className="justify-self-start">
            <div className="pill-dark text-[#d9d9d9] px-3 py-1 flex items-center gap-2"><DotsThreeOutlineVertical size={14} weight="bold" /><span className="font-mono-ui">{colLabels[1]}</span><span className="dot-green ml-1"/></div>
          </div>
          <div className="justify-self-start">
            <div className="pill-dark text-[#d9d9d9] px-3 py-1 flex items-center gap-2"><DotsThreeOutlineVertical size={14} weight="bold" /><span className="font-mono-ui">{colLabels[2]}</span><span className="w-3 h-3 rounded-full bg-red-600"/></div>
          </div>
          <div className="justify-self-end">
            <div className="pill-dark px-3 py-1 flex items-center gap-2"><Lightning size={14} /><span className="font-mono-ui">AI</span></div>
          </div>
        </div>

        <div className="grid grid-cols-[260px_1fr_1fr_60px] gap-6 h-full overflow-y-auto pr-2">
          {rows.map((r)=> (
            <div key={r.label} className="contents">
              <div className="flex items-center gap-3 text-[#9a9a9a] font-mono">
                {r.icon === "pricing" && <CurrencyDollar size={18} />}
                {r.icon === "onboarding" && <UserPlus size={18} />}
                {r.icon === "latency" && <Timer size={18} />}
                {r.icon === "sla" && <ClockAfternoon size={18} />}
                {r.icon === "security" && <ShieldCheck size={18} />}
                {r.icon === "nps" && <ChartLineUp size={18} />}
                {r.icon === "ltv" && <TrendUp size={18} />}
                <span>{r.label}</span>
              </div>
              <div className="text-[#d9d9d9]">{r.a ?? ""}</div>
              <div className="text-[#d9d9d9]">{r.b ?? ""}</div>
              <div className="flex items-center justify-center">{r.ok ? <span className="dot-green"/> : <span className="w-3 h-3 rounded-full bg-[#2a2a2a]"/>}</div>
            </div>
          ))}
        </div>
      </div>

      {!miniChatOpen && (
        <div className="absolute right-4 bottom-4 z-30">
          <div className="fab-pill p-[6px] flex items-center gap-1">
            <button onClick={()=>tableFileInput.current?.click()} className="btn-icon h-10 w-10 rounded-full flex items-center justify-center"><Paperclip size={22} color="#5F5F5F" /></button>
            <button className="btn-icon h-10 w-10 rounded-full flex items-center justify-center"><Sparkle size={22} weight="fill" color="#5F5F5F" /></button>
            <button onClick={()=>setMiniChatOpen(true)} className="btn-fab h-16 w-16 rounded-full flex items-center justify-center ml-1">
              <ChatsCircle size={26} color="#FFFFFF" />
            </button>
          </div>
          <input ref={tableFileInput} type="file" accept="application/pdf,.pdf" className="hidden" multiple />
        </div>
      )}
    </div>
  );
}

function ExportCSV({ className = "" }: { className?: string }) {
  const csv = "spec,saas1,saas2\nPRICING,19.5$,\nONBOARDING,12 MONTHS,25 MONTHS";
  const blob = typeof window !== "undefined" ? new Blob([csv], { type: "text/csv;charset=utf-8;" }) : null;
  const url = blob ? URL.createObjectURL(blob) : undefined;
  return (
    <a href={url} download="comparison.csv" className={`pill px-3 py-1 flex items-center gap-2 ${className}`}>
      <DownloadSimple size={16} />
      <span className="font-mono-ui text-sm">Export in CSV</span>
    </a>
  );
}

function ActionBubble() {
  return (
    <div className="fab-pill p-[6px] flex items-center gap-1">
      <button className="btn-icon h-10 w-10 rounded-full flex items-center justify-center"><Paperclip size={22} color="#5F5F5F" /></button>
      <button className="btn-icon h-10 w-10 rounded-full flex items-center justify-center"><Sparkle size={22} weight="fill" color="#5F5F5F" /></button>
      <button className="btn-fab h-16 w-16 rounded-full flex items-center justify-center ml-1">
        <ChatsCircle size={26} color="#FFFFFF" weight="regular" />
      </button>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="panel rounded-[14px] card-shadow h-full grid grid-cols-1 md:grid-cols-[260px_1fr]">
      <div className="border-r border-[#2a2a2a] p-4 space-y-2">
        <div className="text-[#9a9a9a] text-xs mb-2 font-mono-ui">Settings</div>
        <button className="w-full text-left rounded-[10px] panel p-3 flex items-center gap-2 hover:bg-[#1b1b1b]"><User size={16} /> <span className="font-mono-ui text-[#d9d9d9]">Profile</span></button>
        <button className="w-full text-left rounded-[10px] panel p-3 flex items-center gap-2 hover:bg-[#1b1b1b]"><Buildings size={16} /> <span className="font-mono-ui text-[#d9d9d9]">Workspace</span></button>
        <button className="w-full text-left rounded-[10px] panel p-3 flex items-center gap-2 hover:bg-[#1b1b1b]"><Palette size={16} /> <span className="font-mono-ui text-[#d9d9d9]">Appearance</span></button>
        <button className="w-full text-left rounded-[10px] panel p-3 flex items-center gap-2 hover:bg-[#1b1b1b]"><Bell size={16} /> <span className="font-mono-ui text-[#d9d9d9]">Notifications</span></button>
        <button className="w-full text-left rounded-[10px] panel p-3 flex items-center gap-2 hover:bg-[#1b1b1b]"><CreditCard size={16} /> <span className="font-mono-ui text-[#d9d9d9]">Billing</span></button>
        <button className="w-full text-left rounded-[10px] panel p-3 flex items-center gap-2 hover:bg-[#1b1b1b]"><Shield size={16} /> <span className="font-mono-ui text-[#d9d9d9]">Privacy</span></button>
      </div>
      <div className="p-6 space-y-6">
        <div className="rounded-[12px] panel p-4">
          <div className="flex items-center gap-2 mb-3 text-[#d9d9d9]"><User size={18} /> <span className="font-mono-ui">Profile</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-[#9a9a9a]">Name</div>
              <input className="panel rounded-[8px] px-3 py-2 bg-transparent outline-none" defaultValue="Leonardo" />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[#9a9a9a]">Email</div>
              <input className="panel rounded-[8px] px-3 py-2 bg-transparent outline-none" defaultValue="leonardo@example.com" />
            </div>
          </div>
        </div>

        <div className="rounded-[12px] panel p-4">
          <div className="flex items-center gap-2 mb-3 text-[#d9d9d9]"><Palette size={18} /> <span className="font-mono-ui">Appearance</span></div>
          <div className="flex items-center gap-3">
            <button className="pill px-3 py-1 flex items-center gap-2"><SunDim size={16} /> <span className="font-mono-ui text-sm">Light</span></button>
            <button className="pill px-3 py-1 flex items-center gap-2"><Moon size={16} /> <span className="font-mono-ui text-sm">Dark</span></button>
          </div>
        </div>

        <div className="rounded-[12px] panel p-4">
          <div className="flex items-center gap-2 mb-3 text-[#d9d9d9]"><LockSimple size={18} /> <span className="font-mono-ui">Security</span></div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-[#d9d9d9]" defaultChecked /> <span className="text-[#d9d9d9]">Two‑factor auth</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-[#d9d9d9]" /> <span className="text-[#d9d9d9]">Email alerts</span></label>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button className="pill px-3 py-1 flex items-center gap-2"><CreditCard size={16} /> <span className="font-mono-ui text-sm">Manage plan</span></button>
          <button className="pill px-3 py-1 flex items-center gap-2"><TrashSimple size={16} /> <span className="font-mono-ui text-sm">Delete workspace</span></button>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-[--background] px-6 py-6">
      <div className="h-full rounded-[24px] bg-[#111] border border-[#1f1f1f] flex items-center justify-center">
        <div className="w-[740px] max-w-[92vw]">
          <div className="panel rounded-[14px] card-shadow p-8">
            <div className="text-center space-y-8">
              <div className="flex flex-col items-center gap-4 mb-8">
                <div className="h-16 w-16 rounded-[16px] bg-[#0d0d0d] border border-[#2a2a2a] flex items-center justify-center">
                  <Image src="/logo1pdf.png" alt="Brief AI" width={32} height={32} />
                </div>
                <h1 className="font-instrument text-[48px] leading-tight text-[#c0c0c0] italic whitespace-nowrap">
                  Brief AI
                </h1>
                <p className="text-[#9a9a9a] font-mono-ui font-medium text-sm">
                  Our AI extracts, cleans, and compares
                </p>
              </div>
              
              <div className="space-y-4 max-w-[400px] mx-auto">
                <SignInButton>
                  <button className="w-full btn-send h-16 rounded-full bg-[#d9d9d9] text-black font-mono-ui font-medium hover:bg-[#c0c0c0] transition-colors shadow-[0_6px_6px_rgba(0,0,0,.30)] active:shadow-[0_5px_5px_rgba(0,0,0,.30)] active:transform active:translate-y-[1px]">
                    Sign In
                  </button>
                </SignInButton>
                
                <SignUpButton>
                  <button className="w-full h-16 rounded-full bg-transparent border-2 border-[#2a2a2a] text-[#d9d9d9] font-mono-ui font-medium hover:bg-[#161616] transition-colors">
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MainApp() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState<"idle"|"extracting"|"normalizing"|"building"|"done">("idle");
  const [activeTab, setActiveTab] = useState<'chat'|'files'|'archive'|'results'|'settings'>('chat');
  const [lastCompletedRunId, setLastCompletedRunId] = useState<string | null>(null);
  const [selectedFilesFromList, setSelectedFilesFromList] = useState<{filename: string, fileId: string}[]>([]);
  
  // Handle adding file from Files tab to chat
  const handleAddFileToChat = (filename: string, fileId: string) => {
    console.log(`📎 Adding file to chat: ${filename} (${fileId})`);
    
    // Switch to chat tab
    setActiveTab('chat');
    
    // Add to selected files (prevent duplicates)
    setSelectedFilesFromList(prev => {
      const exists = prev.find(f => f.fileId === fileId);
      if (exists) return prev;
      return [...prev, { filename, fileId }];
    });
  };
  
  // Gestione completa della pipeline dall'app principale
  const handleSubmit = async (prompt: string, files: File[]) => {
    console.log(`🚀 MainApp: Starting pipeline with prompt: "${prompt}" and ${files.length} files`);
    setSubmitted(true);
    setLoading('extracting');
    
    try {
      const workspaceId = '00000000-0000-0000-0000-000000000001'; // Demo workspace UUID
      
      // 1. Create run
      const create = await apiCreateRun(files.length || 1, workspaceId);
      const { runId, uploadUrls } = create;
      console.log(`📋 Created run: ${runId}`);
      
      // 2. Upload files
      for (let i = 0; i < uploadUrls.length; i++) {
        const f = files[i];
        if (!f) throw new Error('Missing file for upload slot');
        console.log(`📤 Uploading file ${i + 1}/${files.length}: ${f.name}`);
        await uploadSigned(uploadUrls[i].signedUrl, f);
      }
      
      // 3. Detect domain and submit
      const detectedDomain = detectDomain(prompt, files);
      console.log(`🎯 Detected domain: ${detectedDomain}`);
      const filesForSubmit = uploadUrls.map((u: any, i: number) => ({ ...u, filename: files[i]?.name || `document-${i+1}.pdf` }));
      await apiSubmit({ runId, workspaceId, prompt, files: filesForSubmit, useOcr: true, domain: detectedDomain });
      
      // 4. Wait a moment for database to be consistent
      console.log(`⏳ Waiting for database consistency...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 secondo di attesa
      
      // 5. Listen to events
      const stop = listenEvents(runId, async (ev) => {
        console.log(`📡 Event received:`, ev);
        if (ev.type === 'status') {
          if (ev.status === 'QUEUED') setLoading('extracting');
          if (ev.status === 'PROCESSING') setLoading('normalizing');
          if (ev.status === 'READY') {
            stop();
            console.log(`✅ Pipeline completed successfully!`);
            setLastCompletedRunId(runId);
            setLoading("done");
            setActiveTab('results');
          }
        }
        if (ev.type === 'error') {
          console.error(`❌ Pipeline error:`, ev.error);
          stop();
          setLoading('idle');
          alert(`Pipeline failed: ${ev.error?.message || 'Unknown error'}`);
        }
      });
      
    } catch (error: any) {
      console.error(`❌ Pipeline failed:`, error);
      setLoading('idle');
      alert(`Pipeline failed: ${error.message}`);
    }
  };
  
  return (
    <div className="min-h-screen px-6 py-6 grid" style={{gridTemplateColumns: "80px 1fr"}}>
      <div className="h-full">
        <Sidebar active={activeTab==='results'?'chat':(activeTab as any)} onSelect={(t)=>{ if(t==='chat'){ setLoading('idle'); setSubmitted(false); setActiveTab('chat'); } else { setActiveTab(t as any); } }} />
      </div>
      <div className="flex flex-col gap-4">
        <div className="relative flex-1 rounded-[24px] bg-[#111] border border-[#1f1f1f] p-6">
          {activeTab==='chat' ? (
            loading !== "done" ? (
              <div className="flex flex-col items-center">
                <ChatCard onSubmit={handleSubmit} stage={(loading as any)} setStage={setLoading} onDone={()=>{ setLoading("done"); setActiveTab('results'); }} />
              </div>
            ) : (
              <div className="max-w-[1200px] mx-auto reveal h-full">
                <Results runId={lastCompletedRunId || ''} />
              </div>
            )
          ) : activeTab==='files' ? (
            <FilesList onAddFileToChat={handleAddFileToChat} />
          ) : activeTab==='archive' ? (
            <div className="max-w-[1100px] mx-auto w-full h-full">
              {/* Archive mock list */}
              <div className="panel rounded-[14px] card-shadow h-full flex flex-col">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#d9d9d9]"><Archive size={18} /> <span className="font-mono-ui">Archive</span></div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid gap-3 grid-cols-1 md:grid-cols-2">
                  {new Array(8).fill(0).map((_,i)=> (
                    <button key={i} onClick={()=>setActiveTab('results')} className="text-left rounded-[12px] panel p-4 hover:bg-[#1b1b1b] transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <Image src="/logo1pdf.png" alt="logo" width={16} height={16} />
                        <span className="font-mono-ui text-[#d9d9d9]">{`Comparison #${i+1}`}</span>
                      </div>
                      <div className="text-[#9a9a9a] text-xs">{`2025-08-${(5+i).toString().padStart(2,'0')}`} • {2 + (i%3)} docs</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab==='results' ? (
            <div className="max-w-[1200px] mx-auto reveal h-full">
              <Results runId={lastCompletedRunId || ''} />
            </div>
          ) : activeTab==='settings' ? (
            <div className="max-w-[1000px] mx-auto w-full h-full">
              <SettingsTab />
            </div>
          ) : (
            <div className="max-w-[1200px] mx-auto reveal h-full">
              <Results runId={lastCompletedRunId || ''} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <SignedOut>
        <LandingPage />
      </SignedOut>
      <SignedIn>
        <MainApp />
      </SignedIn>
    </>
  );
}
