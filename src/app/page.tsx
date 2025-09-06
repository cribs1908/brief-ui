"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Paperclip, Star, ArrowUp, ChatText, FileText, MagnifyingGlass, GearSix, DotsThreeOutlineVertical, DownloadSimple, Sparkle, Asterisk, FunnelSimple, ChatsCircle, CaretDown, FilePdf, X, ArrowRight, Archive, User, Buildings, Palette, Bell, CreditCard, TrashSimple, Moon, SunDim, Shield, LockSimple, Flag } from "@phosphor-icons/react";
import { apiCreateRun, uploadSigned, apiSubmit, listenEvents, apiResult, apiChatQnA, apiChatHistory, apiGetComparisons, apiSaveComparison, apiRenameComparison, apiDeleteComparison } from "@/lib/client";
import { UserButton, SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import FilesList from "@/components/FilesList";

// Parse value to extract number, unit, and confidence
function parseValue(value: string): { 
  displayValue: string; 
  unit: string; 
  confidence: number; 
  hasUnit: boolean 
} {
  if (!value || value === '-') {
    return { displayValue: '-', unit: '', confidence: 0, hasUnit: false };
  }
  
  // Extract unit patterns (V, mA, µA, °C, dB, dBm, MHz, GHz, Ω, mm, etc.)
  const unitMatch = value.match(/(\d+\.?\d*)\s*(V|mA|µA|mW|°C|dB|dBm|MHz|GHz|Ω|mm|kV)\b/i);
  const hasUnit = !!unitMatch;
  
  // Mock confidence based on value completeness (in real app, this would come from API)
  let confidence = 0.5;
  if (value.includes('/') || value.includes('-')) confidence += 0.2; // Range values
  if (hasUnit) confidence += 0.2; // Has proper units
  if (value.match(/@[\w\s,=]+/)) confidence += 0.1; // Has conditions
  confidence = Math.min(confidence, 1.0);
  
  return {
    displayValue: value,
    unit: unitMatch ? unitMatch[2] : '',
    confidence,
    hasUnit
  };
}

// Get confidence badge color and icon
function getConfidenceBadge(confidence: number): { color: string; icon: string } {
  if (confidence >= 0.85) return { color: '#19FF6A', icon: '●' }; // Green
  if (confidence >= 0.6) return { color: '#FFA500', icon: '●' }; // Orange  
  return { color: '#FF4444', icon: '●' }; // Red
}

// Domain pill component for headers
function DomainPill({ domain, deviceName }: { domain: string; deviceName: string }) {
  const domainColors = {
    'CHIP': { bg: '#1F2937', text: '#10B981', border: '#065F46' },
    'RF': { bg: '#1E1B4B', text: '#8B5CF6', border: '#4C1D95' },
    'PGA': { bg: '#7C2D12', text: '#F97316', border: '#9A3412' },
    'API': { bg: '#1E3A8A', text: '#3B82F6', border: '#1E40AF' },
    'SAAS': { bg: '#701A75', text: '#C084FC', border: '#86198F' }
  };
  
  // Detect specific device types
  let detectedDomain = domain;
  if (deviceName.toLowerCase().includes('trf') || deviceName.toLowerCase().includes('rf')) {
    detectedDomain = 'RF';
  } else if (deviceName.toLowerCase().includes('pga') || deviceName.toLowerCase().includes('amplifier')) {
    detectedDomain = 'PGA';
  }
  
  const colors = domainColors[detectedDomain as keyof typeof domainColors] || domainColors.CHIP;
  
  return (
    <span 
      className="text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase tracking-wide"
      style={{ 
        backgroundColor: colors.bg, 
        color: colors.text, 
        border: `1px solid ${colors.border}` 
      }}
    >
      {detectedDomain}
    </span>
  );
}

// Determine if a field is buyer-critical
function isBuyerCriticalField(fieldName: string): boolean {
  const criticalFields = [
    // Core identification and specs
    'part number', 'model', 'device type', 'package', 'pins',
    
    // Power and electrical (most critical for selection)
    'supply voltage', 'operating voltage', 'current consumption', 'power consumption',
    'input voltage', 'output voltage', 'max current', 'quiescent current',
    
    // Performance critical specs
    'frequency', 'bandwidth', 'gain', 'accuracy', 'resolution',
    'temperature range', 'operating temperature',
    
    // Protection and reliability  
    'esd protection', 'ovp', 'ocp', 'thermal protection',
    'breakdown voltage', 'max ratings',
    
    // Interface and compatibility
    'interface', 'communication', 'protocol', 'gpio', 'i2c', 'spi',
    
    // Packaging and availability
    'package type', 'mounting', 'price', 'availability', 'lead time',
    'automotive qualified', 'certifications'
  ];
  
  const normalizedField = fieldName.toLowerCase();
  return criticalFields.some(critical => 
    normalizedField.includes(critical) || critical.includes(normalizedField)
  );
}

// Determine if field is relevant for domain
function isFieldRelevantForDomain(fieldName: string, domain: string, deviceName: string): boolean {
  const lowerField = fieldName.toLowerCase();
  const lowerDevice = deviceName.toLowerCase();
  
  // Always show core identification fields
  const coreFields = [
    'part number', 'model', 'device type', 'package', 'pins',
    'supply voltage', 'operating voltage', 'temperature range',
    'current consumption', 'power consumption'
  ];
  
  if (coreFields.some(field => lowerField.includes(field))) {
    return true;
  }
  
  // RF-specific fields
  const rfFields = [
    'frequency', 'gain', 'noise figure', 'ip3', 'op1db', 'p1db',
    'bandwidth', 'vswr', 'isolation', 'rejection', 's-parameter',
    'input impedance', 'output impedance', 'matching'
  ];
  
  // Power management fields  
  const powerFields = [
    'efficiency', 'dropout', 'regulation', 'ripple', 'psrr',
    'load regulation', 'line regulation', 'switching frequency',
    'quiescent current', 'shutdown current', 'enable', 'soft start'
  ];
  
  // Amplifier/PGA fields
  const ampFields = [
    'gain', 'offset', 'drift', 'noise', 'thd', 'snr', 'cmrr',
    'input bias', 'input offset', 'slew rate', 'gbw', 'settling time',
    'bandwidth', 'distortion', 'dynamic range'
  ];
  
  // Digital/MCU fields
  const digitalFields = [
    'cpu', 'core', 'memory', 'flash', 'ram', 'gpio', 'timer',
    'adc', 'dac', 'spi', 'i2c', 'uart', 'can', 'usb', 'ethernet',
    'instruction', 'cache', 'dma', 'interrupt'
  ];
  
  // Check if field is RF-related but device is not RF
  const isRFField = rfFields.some(field => lowerField.includes(field));
  const isRFDevice = lowerDevice.includes('rf') || lowerDevice.includes('trf') || 
                    lowerDevice.includes('mixer') || lowerDevice.includes('amplifier');
  
  if (isRFField && !isRFDevice) return false;
  
  // Check if field is power management but device is not power-related
  const isPowerField = powerFields.some(field => lowerField.includes(field));
  const isPowerDevice = lowerDevice.includes('regulator') || lowerDevice.includes('converter') ||
                       lowerDevice.includes('psu') || lowerDevice.includes('power');
  
  if (isPowerField && !isPowerDevice && !lowerDevice.includes('pga')) return false;
  
  // Check if field is amplifier-specific
  const isAmpField = ampFields.some(field => lowerField.includes(field));
  const isAmpDevice = lowerDevice.includes('amplifier') || lowerDevice.includes('pga') ||
                     lowerDevice.includes('opamp') || lowerDevice.includes('amp');
  
  if (isAmpField && !isAmpDevice && !isRFDevice) return false;
  
  // Check if field is digital/MCU specific
  const isDigitalField = digitalFields.some(field => lowerField.includes(field));
  const isDigitalDevice = lowerDevice.includes('mcu') || lowerDevice.includes('processor') ||
                         lowerDevice.includes('controller') || lowerDevice.includes('cpu');
  
  if (isDigitalField && !isDigitalDevice) return false;
  
  return true;
}

// Detect red flags in values
function detectRedFlags(fieldName: string, value: string): { hasFlag: boolean; reason: string } {
  if (!value || value === '-') return { hasFlag: false, reason: '' };
  
  const lowerValue = value.toLowerCase();
  const lowerField = fieldName.toLowerCase();
  
  // Missing critical data
  if (lowerValue.includes('n/a') || lowerValue.includes('not available') || 
      lowerValue.includes('not specified') || lowerValue.includes('tbd') ||
      lowerValue.includes('to be determined')) {
    return { hasFlag: true, reason: 'Missing critical specification' };
  }
  
  // End of life or deprecated
  if (lowerValue.includes('eol') || lowerValue.includes('discontinued') || 
      lowerValue.includes('obsolete') || lowerValue.includes('deprecated')) {
    return { hasFlag: true, reason: 'Product end-of-life' };
  }
  
  // Supply voltage issues
  if (lowerField.includes('voltage') || lowerField.includes('supply')) {
    if (lowerValue.includes('0v') || lowerValue.includes('0 v')) {
      return { hasFlag: true, reason: 'Zero supply voltage' };
    }
  }
  
  // Temperature range issues
  if (lowerField.includes('temperature')) {
    if (lowerValue.includes('unlimited') || lowerValue.includes('no limit')) {
      return { hasFlag: true, reason: 'Suspicious temperature spec' };
    }
  }
  
  // Package/availability issues
  if (lowerField.includes('package') || lowerField.includes('mounting')) {
    if (lowerValue.includes('bare die') || lowerValue.includes('wafer')) {
      return { hasFlag: true, reason: 'Not production-ready' };
    }
  }
  
  // Extremely long lead times
  if (lowerField.includes('lead time') || lowerField.includes('delivery')) {
    if (lowerValue.includes('year') || lowerValue.includes('52 week') || 
        lowerValue.includes('>1 year')) {
      return { hasFlag: true, reason: 'Extended lead time' };
    }
  }
  
  // Compliance issues
  if (lowerField.includes('rohs') || lowerField.includes('reach')) {
    if (lowerValue.includes('non-compliant') || lowerValue.includes('no')) {
      return { hasFlag: true, reason: 'Compliance issue' };
    }
  }
  
  return { hasFlag: false, reason: '' };
}

// Enhanced cell component with confidence badge and unit highlighting
function EnhancedCell({ 
  parsed, 
  fieldName = '', 
  isCategory = false 
}: { 
  parsed: { displayValue: string; unit: string; confidence: number; hasUnit: boolean }; 
  fieldName?: string;
  isCategory?: boolean;
}) {
  if (isCategory || !parsed || parsed.displayValue === '-') {
    return <div className="text-[#d9d9d9]">{parsed?.displayValue || ''}</div>;
  }

  const badge = getConfidenceBadge(parsed.confidence);
  const redFlag = detectRedFlags(fieldName, parsed.displayValue);
  
  return (
    <div className="flex items-center gap-2 text-[#d9d9d9] group">
      <span className="flex-1">{parsed.displayValue}</span>
      
      {/* Red flag indicator */}
      {redFlag.hasFlag && (
        <Flag 
          size={14}
          weight="fill"
          className="text-red-500 cursor-help" 
          title={redFlag.reason}
        />
      )}
      
      {/* Confidence badge */}
      {parsed.confidence > 0 && (
        <span 
          style={{ color: badge.color }}
          className="text-xs opacity-70 group-hover:opacity-100 transition-opacity cursor-help"
          title={`Confidence: ${(parsed.confidence * 100).toFixed(0)}%`}
        >
          {badge.icon}
        </span>
      )}
      
      {/* Unit badge */}
      {parsed.hasUnit && (
        <span className="text-[10px] text-[#7C7C7C] bg-[#1F1F1F] px-1 py-0.5 rounded opacity-60 group-hover:opacity-100 transition-opacity">
          {parsed.unit}
        </span>
      )}
    </div>
  );
}

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

type Row = { 
  icon: string; 
  label: string; 
  a?: string; 
  b?: string; 
  ok?: boolean; 
  isCategory?: boolean;
  parsedA?: { displayValue: string; unit: string; confidence: number; hasUnit: boolean };
  parsedB?: { displayValue: string; unit: string; confidence: number; hasUnit: boolean };
};

function getComparisonTitle(domain: string): string {
  if (!domain) return "Comparison";
  
  const domainUpper = domain.toUpperCase();
  switch (domainUpper) {
    case 'CHIP':
      return "CHIP Comparison";
    case 'SAAS':
      return "SAAS Comparison";
    case 'API':
      return "API Comparison";
    default:
      return `${domainUpper} Comparison`;
  }
}

function Results({ runId, domain }: { runId?: string; domain?: string }) {
  const [tableData, setTableData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [buyerCritical, setBuyerCritical] = useState(false);
  const [domainRelevant, setDomainRelevant] = useState(false);
  
  // Fetch real results when component mounts
  useEffect(() => {
    async function fetchResults() {
      if (!runId || runId.trim() === '') {
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
  const allRows: Row[] = useMemo(() => {
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
      const rawValue1 = row[1] || '';
      const rawValue2 = row[2] || '';
      
      // Parse values for enhanced display
      const parsedValue1 = parseValue(rawValue1);
      const parsedValue2 = parseValue(rawValue2);
      
      // Clean up field name - remove "FIELD GROUP:" prefix and improve formatting
      const cleanLabel = fieldName
        .replace(/^FIELD GROUP:\s*/i, '') // Remove "FIELD GROUP:" prefix
        .replace(/🔹\s*/g, '') // Remove bullet points
        .replace(/_/g, ' ')
        .toUpperCase();
      
      // Check if this is a category separator (starts with 🔹 and no meaningful values)
      const isCategory = fieldName.includes('🔹') || (!rawValue1 && !rawValue2 && fieldName.includes(':'));
      
      return {
        icon: "pricing", // Default icon, could be made dynamic  
        label: cleanLabel,
        a: rawValue1,
        b: rawValue2,
        parsedA: parsedValue1,
        parsedB: parsedValue2,
        ok: rawValue1 !== 'Processing failed' && rawValue1 !== 'Processing...',
        isCategory: isCategory
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

  // Filter rows based on toggles
  const rows = useMemo(() => {
    let filteredRows = allRows;
    
    // Apply domain relevance filter first
    if (domainRelevant) {
      filteredRows = filteredRows.filter(row => {
        // Always show category rows
        if (row.isCategory) return true;
        
        // Check relevance for both devices
        const device1 = colLabels[1] || '';
        const device2 = colLabels[2] || '';
        const isRelevant1 = isFieldRelevantForDomain(row.label, domain || 'CHIP', device1);
        const isRelevant2 = isFieldRelevantForDomain(row.label, domain || 'CHIP', device2);
        
        // Show field if relevant for either device
        return isRelevant1 || isRelevant2;
      });
    }
    
    // Apply buyer-critical filter
    if (buyerCritical) {
      filteredRows = filteredRows.filter(row => {
        // Always show category rows
        if (row.isCategory) return true;
        
        // Show only buyer-critical fields
        return isBuyerCriticalField(row.label);
      });
    }
    
    // Apply only differences filter
    if (onlyDifferences) {
      filteredRows = filteredRows.filter(row => {
        // Always show category rows
        if (row.isCategory) return true;
        
        // Show rows where values are different (normalize for comparison)
        const valueA = (row.a || '').toString().toLowerCase().trim();
        const valueB = (row.b || '').toString().toLowerCase().trim();
        
        // Skip empty or processing rows
        if (!valueA || !valueB || valueA === 'processing...' || valueB === 'processing...' || 
            valueA === 'processing failed' || valueB === 'processing failed') {
          return true;
        }
        
        return valueA !== valueB;
      });
    }
    
    return filteredRows;
  }, [allRows, onlyDifferences, buyerCritical, domainRelevant, colLabels, domain]);

  const [miniChatOpen, setMiniChatOpen] = useState(false);
  const [miniMessages, setMiniMessages] = useState<{id:number; role:'user'|'ai'; content:string; thinking?:boolean;}[]>([]);
  const [miniInput, setMiniInput] = useState("");
  const [miniStage, setMiniStage] = useState<'idle'|'thinking'>("idle");
  const tableFileInput = useRef<HTMLInputElement|null>(null);

  // Load chat history when chat opens
  useEffect(() => {
    async function loadChatHistory() {
      if (!miniChatOpen || !runId || runId.trim() === '' || miniMessages.length > 0) return;
      
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
    if (!text || !runId || runId.trim() === '' || miniStage === 'thinking') {
      console.log('Cannot send message: missing runId or empty text');
      return;
    }
    
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
          <span className="font-mono-ui text-[#d9d9d9]">{getComparisonTitle(domain || "")}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setBuyerCritical(!buyerCritical)}
            className={`px-2.5 py-1.5 rounded-[8px] border font-mono-ui text-xs transition-all duration-300 transform ${
              buyerCritical 
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-blue-500 shadow-lg scale-105' 
                : 'bg-[#e6e6e6] text-gray-700 border-[#cfcfcf] hover:bg-[#d9d9d9] hover:scale-102'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Star size={12} weight={buyerCritical ? 'fill' : 'regular'} />
              <span className="font-medium">Buyer-critical</span>
            </div>
          </button>
          <button
            onClick={() => setOnlyDifferences(!onlyDifferences)}
            className={`px-2.5 py-1.5 rounded-[8px] border font-mono-ui text-xs transition-all duration-300 transform ${
              onlyDifferences 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-500 shadow-lg scale-105' 
                : 'bg-[#e6e6e6] text-gray-700 border-[#cfcfcf] hover:bg-[#d9d9d9] hover:scale-102'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FunnelSimple size={12} weight={onlyDifferences ? 'fill' : 'regular'} />
              <span className="font-medium">Only differences</span>
            </div>
          </button>
          <ExportCSV className="bg-[#e6e6e6] border border-[#cfcfcf] px-2.5 py-1.5" tableData={tableData} />
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
                {!runId || runId.trim() === '' ? (
                  <div className="opacity-60 text-center py-8">
                    <div className="text-[#d9d9d9] mb-2">No comparison data available</div>
                    <div className="text-sm">Complete a comparison first to use AI chat</div>
                  </div>
                ) : miniMessages.length === 0 ? (
                  <div className="opacity-60">Type a question to the assistant…</div>
                ) : null}
                {runId && runId.trim() !== '' && miniMessages.map(m => (
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
                  <input 
                    value={miniInput} 
                    onChange={e=>setMiniInput(e.target.value)} 
                    onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); handleMiniSend(); } }} 
                    disabled={!runId || runId.trim() === ''}
                    className={`flex-1 bg-transparent outline-none font-mono-ui ${!runId || runId.trim() === '' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder={!runId || runId.trim() === '' ? "Complete a comparison to enable chat" : "Ask a question about the comparison…"}
                  />
                  <button 
                    onClick={handleMiniSend} 
                    disabled={!runId || runId.trim() === ''}
                    className={`btn-send h-12 w-12 rounded-full flex items-center justify-center ${!runId || runId.trim() === '' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <ArrowUp size={22} color="#5F5F5F" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-[260px_1fr_1fr] items-center mb-6">
          <div className="justify-self-start">
            <div className="pill-dark text-[#d9d9d9] px-3 py-1 flex items-center gap-2"><GearSix size={14} /><span className="font-mono-ui">SPEC</span></div>
          </div>
          <div className="justify-self-start">
            <div className="pill-dark text-[#d9d9d9] px-3 py-1 flex items-center gap-2">
              <DotsThreeOutlineVertical size={14} weight="bold" />
              <div className="flex items-center gap-2">
                <span className="font-mono-ui">{colLabels[1]}</span>
                <DomainPill domain={domain || 'CHIP'} deviceName={colLabels[1]} />
              </div>
            </div>
          </div>
          <div className="justify-self-start">
            <div className="pill-dark text-[#d9d9d9] px-3 py-1 flex items-center gap-2">
              <DotsThreeOutlineVertical size={14} weight="bold" />
              <div className="flex items-center gap-2">
                <span className="font-mono-ui">{colLabels[2]}</span>
                <DomainPill domain={domain || 'CHIP'} deviceName={colLabels[2]} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[260px_1fr_1fr] gap-6 h-full overflow-y-auto pr-2">
          {rows.map((r)=> (
            <div key={r.label} className="contents">
              <div className={`flex items-center font-mono ${r.isCategory ? 'text-white/90 font-medium' : 'text-[#9a9a9a]'}`}>
                <span>{r.label}</span>
              </div>
              <EnhancedCell parsed={r.parsedA!} fieldName={r.label} isCategory={r.isCategory} />
              <EnhancedCell parsed={r.parsedB!} fieldName={r.label} isCategory={r.isCategory} />
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

function ExportCSV({ className = "", tableData }: { className?: string, tableData?: any }) {
  // Generate CSV from real table data
  const csv = useMemo(() => {
    if (!tableData?.table?.columns || !tableData?.table?.rows) {
      return "Field,Product A,Product B\nNo data available,,";
    }

    const { columns, rows } = tableData.table;
    
    // Create header row
    const header = columns.join(',');
    
    // Create data rows, escaping commas and quotes
    const dataRows = rows.map((row: string[]) => {
      return row.map((cell: string) => {
        // Handle cells with commas or quotes by wrapping in quotes
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell || '';
      }).join(',');
    }).join('\n');
    
    return `${header}\n${dataRows}`;
  }, [tableData]);

  // Generate dynamic filename
  const filename = useMemo(() => {
    if (!tableData?.table?.columns) return "comparison.csv";
    
    const columns = tableData.table.columns;
    if (columns.length >= 3) {
      // Use product names from columns (skip first column which is usually "Field" or "Specification")
      const productNames = columns.slice(1)
        .map((name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '_')) // Clean filename
        .join('_vs_');
      return `${productNames}_comparison.csv`;
    }
    
    return "comparison.csv";
  }, [tableData]);

  const hasData = tableData?.table?.columns && tableData?.table?.rows && tableData.table.rows.length > 0;

  const blob = typeof window !== "undefined" ? new Blob([csv], { type: "text/csv;charset=utf-8;" }) : null;
  const url = blob ? URL.createObjectURL(blob) : undefined;
  
  const handleDownload = () => {
    if (!hasData || !url) return;
    
    // Clean up URL after download
    setTimeout(() => {
      if (url) URL.revokeObjectURL(url);
    }, 100);
  };
  
  if (!hasData) {
    return (
      <button 
        disabled
        className={`pill px-3 py-1 flex items-center gap-2 opacity-50 cursor-not-allowed ${className}`}
        title="No data available to export"
      >
        <DownloadSimple size={16} />
        <span className="font-mono-ui text-sm">Export in CSV</span>
      </button>
    );
  }
  
  return (
    <a 
      href={url} 
      download={filename} 
      onClick={handleDownload}
      className={`pill px-3 py-1 flex items-center gap-2 ${className}`}
    >
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

interface ComparisonCard {
  runId: string;
  domain: string;
  title: string;
  createdAt: string;
  documentCount: number;
}

interface ArchiveTabProps {
  archivedComparisons: ComparisonCard[];
  onOpenComparison: (runId: string, domain: string) => void;
  onRenameComparison: (runId: string, newName: string) => void;
  onDeleteComparison: (runId: string) => void;
}

function ArchiveTab({ archivedComparisons, onOpenComparison, onRenameComparison, onDeleteComparison }: ArchiveTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");

  const handleStartEdit = (runId: string, currentName: string) => {
    setEditingId(runId);
    setEditingName(currentName);
  };

  const handleSaveEdit = (runId: string) => {
    if (editingName.trim()) {
      onRenameComparison(runId, editingName.trim());
    }
    setEditingId(null);
    setEditingName("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  if (archivedComparisons.length === 0) {
    return (
      <div className="max-w-[1100px] mx-auto w-full h-full">
        <div className="panel rounded-[14px] card-shadow h-full flex flex-col">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#d9d9d9]">
              <Archive size={18} /> 
              <span className="font-mono-ui">Archive</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-[#9a9a9a]">
              <Archive size={48} className="mx-auto mb-4 opacity-50" />
              <h3 className="font-mono-ui text-[#d9d9d9] mb-2">No comparisons yet</h3>
              <p className="text-sm">Your completed comparisons will appear here</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto w-full h-full">
      <div className="panel rounded-[14px] card-shadow h-full flex flex-col">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#d9d9d9]">
            <Archive size={18} /> 
            <span className="font-mono-ui">Archive</span>
          </div>
          <div className="text-[#9a9a9a] font-mono-ui text-sm">
            {archivedComparisons.length} comparison{archivedComparisons.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {archivedComparisons.map((comparison) => (
            <div 
              key={comparison.runId} 
              className="rounded-[8px] panel p-2.5 hover:bg-[#1b1b1b] transition-colors min-h-[80px] max-h-[80px] flex flex-col justify-between cursor-pointer"
              onClick={() => onOpenComparison(comparison.runId, comparison.domain)}
            >
              <div className="flex items-center gap-2 mb-1 min-h-0">
                <Image src="/logo1pdf.png" alt="logo" width={16} height={16} />
                {editingId === comparison.runId ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(comparison.runId);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="flex-1 bg-transparent text-[#d9d9d9] font-mono-ui text-xs outline-none border-b border-[#2a2a2a] focus:border-[#5f5f5f]"
                      autoFocus
                    />
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveEdit(comparison.runId);
                      }}
                      className="text-[#19ff6a] hover:text-[#15cc55] text-xs"
                    >
                      ✓
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelEdit();
                      }}
                      className="text-[#ff6b6b] hover:text-[#e55555] text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <span 
                      className="font-mono-ui text-[#d9d9d9] flex-1 text-xs truncate"
                      title={comparison.title}
                    >
                      {comparison.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(comparison.runId, comparison.title);
                      }}
                      className="text-[#9a9a9a] hover:text-[#d9d9d9] text-xs mr-1"
                      title="Rename"
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this comparison?')) {
                          onDeleteComparison(comparison.runId);
                        }
                      }}
                      className="text-[#9a9a9a] hover:text-[#ff6b6b] text-xs"
                      title="Delete"
                    >
                      <TrashSimple size={12} />
                    </button>
                  </>
                )}
              </div>
              <div className="text-[#9a9a9a] text-[10px] truncate mt-auto">
                {comparison.createdAt} • {comparison.documentCount} docs • {comparison.domain}
              </div>
            </div>
          ))}
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
  const [currentDomain, setCurrentDomain] = useState<string>("");
  const [archivedComparisons, setArchivedComparisons] = useState<any[]>([]);
  const [selectedArchiveRun, setSelectedArchiveRun] = useState<{runId: string; domain: string} | null>(null);
  
  // Load archived comparisons on mount (always)
  useEffect(() => {
    async function loadArchivedComparisons() {
      try {
        console.log('📋 Loading archived comparisons...');
        const comparisonsResponse = await apiGetComparisons();
        if (comparisonsResponse.comparisons) {
          setArchivedComparisons(comparisonsResponse.comparisons);
          console.log(`📋 Loaded ${comparisonsResponse.comparisons.length} archived comparisons`);
        } else {
          console.log('📋 No archived comparisons found');
          setArchivedComparisons([]);
        }
      } catch (error) {
        console.error('❌ Error loading archived comparisons:', error);
        setArchivedComparisons([]);
      }
    }
    
    loadArchivedComparisons();
  }, []); // Only run once on mount
  
  // Load last completed run separately (only if we don't have one)
  useEffect(() => {
    async function loadLastCompletedRun() {
      if (lastCompletedRunId) return; // Already have one
      
      try {
        const response = await fetch('/api/chat/latest-run');
        if (response.ok) {
          const data = await response.json();
          if (data.runId) {
            setLastCompletedRunId(data.runId);
            console.log(`📋 Loaded last completed run: ${data.runId}`);
          }
        }
      } catch (error) {
        console.log('Error loading last completed run:', error);
      }
    }
    
    loadLastCompletedRun();
  }, [lastCompletedRunId]);
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
      // 1. Create run (API will use authenticated user's workspace)
      const create = await apiCreateRun(files.length || 1);
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
      setCurrentDomain(detectedDomain); // Salva il domain nello stato
      const filesForSubmit = uploadUrls.map((u: any, i: number) => ({ ...u, filename: files[i]?.name || `document-${i+1}.pdf` }));
      await apiSubmit({ runId, prompt, files: filesForSubmit, useOcr: true, domain: detectedDomain });
      
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
            
            // Save comparison to database
            try {
              const title = getComparisonTitle(detectedDomain);
              await apiSaveComparison(runId, detectedDomain, title, files.length);
              
              // Add to local state for immediate UI update
              const newComparison: ComparisonCard = {
                runId,
                domain: detectedDomain,
                title,
                createdAt: new Date().toLocaleDateString(),
                documentCount: files.length
              };
              setArchivedComparisons(prev => [newComparison, ...prev]);
              console.log('✅ Comparison saved to database and added to archive');
              
            } catch (error) {
              console.error('❌ Failed to save comparison:', error);
              // Still add to local state even if save fails
              const newComparison: ComparisonCard = {
                runId,
                domain: detectedDomain,
                title: getComparisonTitle(detectedDomain),
                createdAt: new Date().toLocaleDateString(),
                documentCount: files.length
              };
              setArchivedComparisons(prev => [newComparison, ...prev]);
            }
            
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
                <Results runId={lastCompletedRunId || ''} domain={currentDomain} />
              </div>
            )
          ) : activeTab==='files' ? (
            <FilesList onAddFileToChat={handleAddFileToChat} />
          ) : activeTab==='archive' ? (
            <ArchiveTab 
              archivedComparisons={archivedComparisons}
              onOpenComparison={(runId, domain) => {
                setSelectedArchiveRun({runId, domain});
                setActiveTab('results');
              }}
              onRenameComparison={async (runId, newName) => {
                try {
                  await apiRenameComparison(runId, newName);
                  setArchivedComparisons(prev => 
                    prev.map(comp => 
                      comp.runId === runId 
                        ? { ...comp, title: newName }
                        : comp
                    )
                  );
                  console.log('✅ Comparison renamed successfully:', runId, newName);
                } catch (error) {
                  console.error('❌ Failed to rename comparison:', error);
                  alert('Failed to rename comparison. Please try again.');
                }
              }}
              onDeleteComparison={async (runId) => {
                try {
                  await apiDeleteComparison(runId);
                  setArchivedComparisons(prev => prev.filter(comp => comp.runId !== runId));
                  
                  // If we're currently viewing this comparison, go back to chat
                  if (selectedArchiveRun?.runId === runId) {
                    setSelectedArchiveRun(null);
                    setActiveTab('chat');
                  }
                  
                  console.log('✅ Comparison deleted successfully:', runId);
                } catch (error) {
                  console.error('❌ Failed to delete comparison:', error);
                  alert('Failed to delete comparison. Please try again.');
                }
              }}
            />
          ) : activeTab==='results' ? (
            <div className="max-w-[1200px] mx-auto reveal h-full">
              <Results 
                runId={selectedArchiveRun?.runId || lastCompletedRunId || ''} 
                domain={selectedArchiveRun?.domain || currentDomain} 
              />
            </div>
          ) : activeTab==='settings' ? (
            <div className="max-w-[1000px] mx-auto w-full h-full">
              <SettingsTab />
            </div>
          ) : (
            <div className="max-w-[1200px] mx-auto reveal h-full">
              <Results runId={lastCompletedRunId || ''} domain={currentDomain} />
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
