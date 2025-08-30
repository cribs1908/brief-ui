## Chat Tab — UI/UX Spec (v1)

Questa specifica descrive l'interfaccia attuale del primo tab (Chat) dell’app Brief AI. Serve come sorgente di verità per mantenere coerenza visiva e comportamentale nelle iterazioni future. Non include la tabella di comparazione.

### Palette e token
- **Colori principali**
  - `--background` = `#000000`
  - `--surface` = `#161616`
  - `--border` = `#2A2A2A`
  - `--foreground` = `#D9D9D9`
  - `--muted` = `#C0C0C0`
  - `--accent` (status dot) = `#19FF6A`

- **Ombre**
  - `card-shadow` (card chat): `0 24px 60px rgba(0,0,0,.55)`
  - `btn-send` (pulsante invio): `0 6px 6px rgba(0,0,0,.30)`; stato active `0 5px 5px rgba(0,0,0,.30)`

- **Raggi**
  - Sidebar & contenitori: `16px`
  - Card chat: `14px`
  - Main content (canvas): `24px`
  - Pulsante invio: cerchio (full)

- **Bordi**
  - Default: `1px solid #2A2A2A`
  - Pulsante invio: `2px` con stroke gradiente (vedi sezione componenti)

### Tipografia
- Titolo hero: `Instrument Serif` italic, 48px, `#C0C0C0`, `whitespace-nowrap`, `text-center`.
- Sottotitolo: `Geist Mono` (classe `font-mono-ui`) peso medio, 14px, `#9A9A9A`, `text-center`.
- Testo inline prompt: `Geist Mono`, 15px, tracking leggermente positivo (`tracking-[0.01em]`).

### Icone
- Libreria: Phosphor Icons React `@phosphor-icons/react@2.1.3`.
- Sidebar: `ChatText`, `FileText`, `MagnifyingGlass` (22px, weight `regular`, colore `--muted`).
- Impostazioni: `GearSix` (18px, in basso nella sidebar).
- Card chat — azioni: `Paperclip` e `Sparkle` (24px, colore `#5F5F5F`, senza background).
- Pulsante invio: `ArrowUp` (26px, `#5F5F5F`).
- Logo: `public/logo1pdf.png` (22px in sidebar; 16px accanto al testo prompt).

### Layout generale
- Griglia pagina: 2 colonne (`80px` sidebar, `1fr` main), padding canvas `px-6 py-6`.
- Sidebar: larghezza `68px`, `panel` scuro con padding `12px` e due gruppi (top: logo + 3 icone; bottom: avatar `LC` + impostazioni).
- Main: canvas scuro con bordo `#1F1F1F` e raggio `24px`.
- Card chat: larghezza massima `740px` (`max-w-[92vw]`), posizionata con `mt-40` (spazio sopra il fold), `panel` + `card-shadow`.

### Componenti e stili
- `panel`
  - Background: `#161616`
  - Border: `1px solid #2A2A2A`

- Bottoni icona piccoli (`btn-icon`)
  - Background: trasparente, nessun bordo
  - Colore icone: `#5F5F5F`
  - Spaziatura tra allega e sparkle: `8px`

- Pulsante invio (`btn-send`)
  - Dimensioni: `64×64px` (`h-16 w-16`)
  - Fill: `#D9D9D9`
  - Stroke: `2px` gradiente sul border-box: `linear-gradient(180deg, #EBEBEB 0%, #7C7C7C 32%, #EBEBEB 100%)`
  - Ombra outside: `0 6px 6px rgba(0,0,0,.30)`
  - Stato active: `transform: translateY(1px)`
  - Icona: `ArrowUp` 26px `#5F5F5F`

- Caret del placeholder (`.caret::after`)
  - Spessore 1px, altezza `1em`, colore `#7C7C7C`
  - Allineamento ottico: `transform: translateY(3px)`
  - Animazione blink: `1s steps(1) infinite`

### Comportamento del prompt (preview → input)
1. Stato iniziale: riga con logo (16px) + testo preview in `Geist Mono` 15px, opacità 50%.
2. Animazione preview: stringa “Compare this two <word>” con ciclo parole
   - Lista: `Software → API → Chip → Software → …`
   - Typing: 68ms per carattere
   - Deleting: 38ms per carattere
   - Pause: 420ms a fine parola e prima della successiva
   - Cursore: caret lampeggiante accanto alla parola animata
3. Interazione: clic sulla riga → il preview scompare; appare un `<input>` inline (trasparente, senza placeholder) che eredita stesso stile tipografico. L’animazione si ferma durante l’editing o quando `prompt` contiene testo.
4. Azioni a destra: `Paperclip`, `Sparkle`, `Send` con spacing `8px`; l’invio è mock e può triggerare il passaggio alla vista successiva.

### Sidebar — dettagli
- Contenitore: `68px` larghezza, `panel`, `rounded-16`, `p-3`.
- Gruppo superiore: logo quadrato (container 12px radius, bg `#0D0D0D`, bordo `#2A2A2A`), poi tre icone verticali (22px) con `gap-3`.
- Gruppo inferiore: avatar `LC` (10×10, rounded-full) e pulsante impostazioni (8×8 container, icona 18px).

### Accessibilità e UX
- Contrasto: testo principale `#D9D9D9` su `#000`/`#161616` soddisfa requisiti per UI scura.
- Icon button: area clic pari al contenitore (≥ 40×40); hint di focus delegato ai browser di default.
- Stato active dei pulsanti: invio con `translateY(1px)` per feedback tattile.
- Testo hero non va a capo (`whitespace-nowrap`) per mantenere la composizione tipografica del mock.

### Responsività
- Breakpoint unici (v1): card centrata con `max-w-[92vw]`; sidebar fissa `68px`.
- Spaziature: manteniamo `mt-40` della card anche su small; eventuali regolazioni future verranno annotate qui.

### File e classi principali
- `src/app/globals.css`
  - Token: `glass`, `panel`, `pill`, `dot-green`, `ring-soft`, `shadow-inner-soft`, `btn-ghost`, `btn-elevated`, `btn-icon`, `btn-send`, `card-shadow`, `caret`.
- `src/app/page.tsx`
  - Componenti locali: `Sidebar`, `ChatCard` (con animazione), `Home`.

### Note implementative
- Font caricati via Next Fonts: `Instrument Serif` (italic) e `Geist/Geist Mono`.
- Icone via Phosphor React: import diretto dei singoli componenti, pesi `regular/bold/fill` secondo contesto.
- Nessun backend in questa vista: invio e transizioni sono mock.


