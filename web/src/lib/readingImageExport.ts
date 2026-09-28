type ExportTone = 'plain' | 'favorable' | 'caution' | 'love' | 'date' | 'system'
type ExportResult = { pages: number; shared: boolean; cancelled: boolean }
type ExportCard = { eyebrow?: string; title: string; body?: string; meta?: string; tone: ExportTone; emphasis?: boolean }
type ExportSection = { title?: string; cards: ExportCard[] }
type ExportModel = { title: string; date: string; hero: string; subtitle?: string; sections: ExportSection[] }

const PAGE_WIDTH = 1206
const PAGE_HEIGHT = 1608
const PAGE_PADDING = 72
const HEADER_HEIGHT = 205
const FOOTER_HEIGHT = 78
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_PADDING * 2
const BODY_SIZE = 41
const BODY_LINE = 56
const SMALL_SIZE = 29
const SMALL_LINE = 41
const CARD_GAP = 30

const COLORS = {
  ink:'#35415e', inkSoft:'#53617a', muted:'#78859c', paper:'#f8fbff', line:'rgba(118,135,172,.20)', white:'rgba(255,255,255,.76)',
  favorable:['rgba(218,249,238,.80)','rgba(239,255,249,.64)'], caution:['rgba(255,231,237,.82)','rgba(255,247,231,.62)'],
  love:['rgba(237,226,255,.82)','rgba(255,235,245,.64)'], date:['rgba(221,239,255,.84)','rgba(236,247,255,.64)'],
  system:['rgba(255,248,211,.66)','rgba(235,246,255,.60)'], plain:['rgba(255,255,255,.78)','rgba(244,248,255,.62)'],
} as const

function normalizeText(value: unknown) { return String(value ?? '').replace(/\s+/g,' ').trim() }
function firstSentences(value: unknown, limit = 2) { const text=normalizeText(value); if(!text)return ''; return text.replace(/([.!?])\s+/g,'$1\n').split('\n').map(v=>v.trim()).filter(Boolean).slice(0,limit).join(' ') }
function textOf(root: ParentNode, selector: string) { return normalizeText(root.querySelector<HTMLElement>(selector)?.innerText ?? '') }
function directParagraphs(root: HTMLElement) { return Array.from(root.querySelectorAll<HTMLElement>(':scope > p')).map(p=>normalizeText(p.innerText)).filter(Boolean) }
function toneOf(element: HTMLElement): ExportTone {
  const explicit=element.closest<HTMLElement>('[data-reading-export-tone]')?.dataset.readingExportTone
  if(explicit==='favorable'||explicit==='caution'||explicit==='love'||explicit==='date'||explicit==='system')return explicit
  const cls=`${element.className||''} ${element.parentElement?.className||''}`
  if(/caution|warning|avoid|주의/i.test(cls))return 'caution'; if(/good|favorable|best|change/i.test(cls))return 'favorable'; if(/love|relationship|reunion|contact/i.test(cls))return 'love'; if(/date|timing|timeline|window/i.test(cls))return 'date'; if(/system|social|interpersonal/i.test(cls))return 'system'; return 'plain'
}

function periodModel(root: HTMLElement, label: string): ExportModel {
  const date=textOf(root,'.reading-period-date')||textOf(root,'.result-headline span'), hero=firstSentences(textOf(root,'.period-ai-head h3'),2), subtitle=firstSentences(textOf(root,'.reading-hero-subtitle'),2)
  const sections:ExportSection[]=[]
  for(const section of Array.from(root.querySelectorAll<HTMLElement>('.flow-section'))){
    const cards=Array.from(section.querySelectorAll<HTMLElement>('.flow-tile')).map(tile=>({eyebrow:textOf(tile,'.flow-band'),title:textOf(tile,'.flow-tile-heading strong'),body:firstSentences(textOf(tile,'p'),1),meta:textOf(tile,'.flow-score')?`상대지수 ${textOf(tile,'.flow-score')}`:'',tone:toneOf(tile)} satisfies ExportCard)).filter(card=>card.title)
    if(cards.length)sections.push({title:textOf(section,':scope > h4')||'한눈에 보는 흐름',cards})
  }
  const loveCards=Array.from(root.querySelectorAll<HTMLElement>('.love-context-card-v3')).map(card=>({title:textOf(card,':scope > strong'),body:firstSentences(textOf(card,':scope > p'),2),tone:'love' as const})).filter(card=>card.title&&card.body)
  if(loveCards.length)sections.push({title:'내 상황에 맞춰 읽기',cards:loveCards})
  const interpersonal=root.querySelector<HTMLElement>('.interpersonal-reading-v3 .editorial-focus-card-v3')
  if(interpersonal){const ps=directParagraphs(interpersonal);sections.push({title:'대인관계',cards:[{title:'사람 사이의 역할·거리·협력',body:[textOf(interpersonal,':scope > b'),...ps].filter(Boolean).join(' '),tone:'system'}]})}
  const contactCards:ExportCard[]=[]
  const activation=root.querySelector<HTMLElement>('.contact-activation-v3')
  const direction=root.querySelector<HTMLElement>('.contact-direction-summary-v3')
  if(activation){
    const directionText=direction?textOf(direction,':scope > b'):''
    const time=textOf(activation,':scope > time')
    contactCards.push({eyebrow:'연락 전체',title:textOf(activation,':scope > strong')||'연락 전체 활성도',body:[textOf(activation,':scope > b'),...directParagraphs(activation)].filter(Boolean).join(' '),meta:[time,directionText?`선연락 방향 · ${directionText}`:''].filter(Boolean).join('   ·   '),tone:'date'})
  } else if(direction) {
    contactCards.push({eyebrow:'선연락 방향',title:textOf(direction,':scope > strong')||'누가 먼저 움직이는가',body:textOf(direction,':scope > b'),tone:'love'})
  }
  if(contactCards.length)sections.push({title:'연락·소식',cards:contactCards})
  const focus=Array.from(root.querySelectorAll<HTMLElement>('.period-ai-user-focus .period-ai-topic')).map(article=>({title:textOf(article,':scope > strong'),body:[textOf(article,':scope > b'),...directParagraphs(article)].filter(Boolean).join(' '),tone:toneOf(article)} satisfies ExportCard)).filter(card=>card.title&&card.body)
  if(focus.length)sections.push({title:'중요 분야',cards:focus.slice(0,5)})
  const dates:ExportCard[]=[];for(const group of Array.from(root.querySelectorAll<HTMLElement>('.period-ai-user-windows .reading-event-list > ol > li, .period-ai-user-windows .reading-more ol > li')).slice(0,6)){const d=textOf(group,':scope > time');for(const event of Array.from(group.querySelectorAll<HTMLElement>('.reading-event')).slice(0,2))dates.push({eyebrow:textOf(event,'.reading-state')||textOf(event,'.reading-badge'),title:d,body:firstSentences(textOf(event,':scope > p'),1),tone:toneOf(event)})}
  if(dates.length)sections.push({title:'기억할 시기',cards:dates})
  return {title:label,date,hero,subtitle,sections}
}

function reunionModel(root: HTMLElement,label:string):ExportModel{
  const date=textOf(root,'.reunion-result-meta strong'),hero=firstSentences(textOf(root,'.reunion-v3-hero p')||textOf(root,'.reading-conclusion'),2),sections:ExportSection[]=[]
  const lead:ExportCard[]=[];for(const card of Array.from(root.querySelectorAll<HTMLElement>('.reunion-v3-grid .reunion-v3-card, .reunion-v3-change')))lead.push({eyebrow:textOf(card,':scope > small'),title:textOf(card,':scope > h4'),body:[textOf(card,':scope > b'),...directParagraphs(card)].filter(Boolean).join(' '),meta:textOf(card,':scope > time'),tone:toneOf(card),emphasis:true})
  if(lead.length)sections.push({title:'핵심 판단',cards:lead})
  const dates:ExportCard[]=[];for(const group of Array.from(root.querySelectorAll<HTMLElement>('.reunion-v3-timing .reading-event-list > ol > li, .reunion-v3-timing .reading-more ol > li'))){const d=textOf(group,':scope > time');for(const event of Array.from(group.querySelectorAll<HTMLElement>('.reading-event')))dates.push({eyebrow:textOf(event,'.reading-state')||'주목',title:d,body:firstSentences(textOf(event,':scope > p'),1),tone:'date'})}
  if(dates.length)sections.push({title:'기억할 시기',cards:dates.slice(0,5)})
  const meaning=Array.from(root.querySelectorAll<HTMLElement>('.reunion-v3-meaning .reunion-v3-card')).map(card=>({title:textOf(card,':scope > h4'),body:[...directParagraphs(card),...Array.from(card.querySelectorAll<HTMLElement>('li')).map(li=>normalizeText(li.innerText))].filter(Boolean).join(' '),tone:toneOf(card)} satisfies ExportCard)).filter(card=>card.title)
  if(meaning.length)sections.push({title:'관계를 판단할 기준',cards:meaning})
  const situations=Array.from(root.querySelectorAll<HTMLElement>('.reunion-v3-situation')).map(card=>({title:textOf(card,':scope > strong'),body:firstSentences(textOf(card,':scope > p'),2),tone:'love' as const})).filter(card=>card.title)
  if(situations.length)sections.push({title:'내 현재 상황에 맞춰 읽기',cards:situations})
  return {title:label,date,hero,sections}
}

function genericModel(root:HTMLElement,label:string):ExportModel{const date=textOf(root,'.reading-period-date')||textOf(root,'.result-headline span')||textOf(root,'.reunion-result-meta strong'),hero=firstSentences(textOf(root,'.reading-hero h3')||textOf(root,'.period-ai-head h3')||textOf(root,'h3'),2),cards:ExportCard[]=[];for(const section of Array.from(root.querySelectorAll<HTMLElement>('section, article'))){if(section.closest('[data-reading-export-ignore="true"]'))continue;const title=textOf(section,':scope > h4')||textOf(section,':scope > h3')||textOf(section,':scope > strong'),body=firstSentences(directParagraphs(section).join(' '),2);if(title&&body&&!cards.some(card=>card.title===title&&card.body===body))cards.push({title,body,tone:toneOf(section)})}return {title:label,date,hero,sections:cards.length?[{cards:cards.slice(0,12)}]:[]}}
export function buildReadingExportModel(root:HTMLElement,label:string):ExportModel{if(root.matches('[data-reading-export-root="period-fortune"]'))return periodModel(root,label);if(root.querySelector('.reunion-ui-v3'))return reunionModel(root,label);return genericModel(root,label)}

function createCanvas(){const canvas=document.createElement('canvas');canvas.width=PAGE_WIDTH;canvas.height=PAGE_HEIGHT;const ctx=canvas.getContext('2d')!;drawAuroraBackground(ctx);return {canvas,ctx}}
function drawAuroraBackground(ctx:CanvasRenderingContext2D){const base=ctx.createLinearGradient(0,0,PAGE_WIDTH,PAGE_HEIGHT);base.addColorStop(0,'#f8fcff');base.addColorStop(.48,'#fbf9ff');base.addColorStop(1,'#f7fffb');ctx.fillStyle=base;ctx.fillRect(0,0,PAGE_WIDTH,PAGE_HEIGHT);const glow=(x:number,y:number,r:number,inner:string)=>{const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,inner);g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)};glow(170,130,330,'rgba(191,235,255,.36)');glow(1020,180,360,'rgba(223,201,255,.34)');glow(820,1340,420,'rgba(199,246,227,.28)');glow(120,1250,330,'rgba(255,219,235,.22)')}
function roundRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){const q=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+q,y);ctx.arcTo(x+w,y,x+w,y+h,q);ctx.arcTo(x+w,y+h,x,y+h,q);ctx.arcTo(x,y+h,x,y,q);ctx.arcTo(x,y,x+w,y,q);ctx.closePath()}
function wrap(ctx:CanvasRenderingContext2D,text:string,width:number){const out:string[]=[];let line='';for(const ch of normalizeText(text)){const next=line+ch;if(line&&ctx.measureText(next).width>width){out.push(line.trimEnd());line=ch.trimStart()}else line=next}if(line)out.push(line.trimEnd());return out}
function font(ctx:CanvasRenderingContext2D,size:number,weight=500){ctx.font=`${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", sans-serif`}
function linesHeight(lines:number,lineHeight:number){return Math.max(1,lines)*lineHeight}
function toneGradient(ctx:CanvasRenderingContext2D,tone:ExportTone,x:number,y:number,w:number,h:number){const colors=COLORS[tone]??COLORS.plain;const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,colors[0]);g.addColorStop(1,colors[1]);return g}
function measureCard(ctx:CanvasRenderingContext2D,card:ExportCard){font(ctx,36,760);const titleLines=wrap(ctx,card.title,CONTENT_WIDTH-60).slice(0,2);font(ctx,BODY_SIZE,480);const bodyLines=card.body?wrap(ctx,card.body,CONTENT_WIDTH-60).slice(0,card.emphasis?5:6):[];font(ctx,SMALL_SIZE,650);const metaLines=card.meta?wrap(ctx,card.meta,CONTENT_WIDTH-60).slice(0,2):[];const eyebrow=card.eyebrow?38:0;return 36+eyebrow+linesHeight(titleLines.length,48)+(bodyLines.length?16+linesHeight(bodyLines.length,BODY_LINE):0)+(metaLines.length?14+linesHeight(metaLines.length,SMALL_LINE):0)+30}
function drawGlassCard(ctx:CanvasRenderingContext2D,card:ExportCard,y:number){const h=measureCard(ctx,card),x=PAGE_PADDING,w=CONTENT_WIDTH;ctx.save();ctx.shadowColor='rgba(68,83,118,.09)';ctx.shadowBlur=24;ctx.shadowOffsetY=10;roundRect(ctx,x,y,w,h,34);ctx.fillStyle=toneGradient(ctx,card.tone,x,y,w,h);ctx.fill();ctx.restore();roundRect(ctx,x,y,w,h,34);ctx.strokeStyle='rgba(123,140,180,.18)';ctx.lineWidth=2;ctx.stroke();const shine=ctx.createLinearGradient(0,y,0,y+h*.48);shine.addColorStop(0,'rgba(255,255,255,.74)');shine.addColorStop(1,'rgba(255,255,255,0)');roundRect(ctx,x+2,y+2,w-4,Math.max(62,h*.48),32);ctx.fillStyle=shine;ctx.fill();let cy=y+36;if(card.eyebrow){font(ctx,27,780);ctx.fillStyle=card.tone==='caution'?'#b06e7c':card.tone==='favorable'?'#498a78':card.tone==='love'?'#7e68aa':card.tone==='date'?'#597fa9':'#71809a';ctx.fillText(card.eyebrow,x+30,cy);cy+=38}font(ctx,36,760);ctx.fillStyle=COLORS.ink;const titleLines=wrap(ctx,card.title,w-60).slice(0,2);titleLines.forEach((line,i)=>ctx.fillText(line,x+30,cy+i*48));cy+=linesHeight(titleLines.length,48);if(card.body){cy+=16;font(ctx,BODY_SIZE,480);ctx.fillStyle=COLORS.inkSoft;const body=wrap(ctx,card.body,w-60).slice(0,card.emphasis?5:6);body.forEach((line,i)=>ctx.fillText(line,x+30,cy+i*BODY_LINE));cy+=linesHeight(body.length,BODY_LINE)}if(card.meta){cy+=14;font(ctx,SMALL_SIZE,650);ctx.fillStyle=COLORS.muted;const meta=wrap(ctx,card.meta,w-60).slice(0,2);meta.forEach((line,i)=>ctx.fillText(line,x+30,cy+i*SMALL_LINE))}return y+h}
function drawHeader(ctx:CanvasRenderingContext2D,model:ExportModel,page:number,total:number){font(ctx,30,720);ctx.fillStyle='#71809a';ctx.fillText('별빛의 운명',PAGE_PADDING,62);font(ctx,57,800);ctx.fillStyle=COLORS.ink;const title=normalizeText(model.title.replace(/\s*·\s*\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2})?$/,''));wrap(ctx,title,CONTENT_WIDTH-210).slice(0,2).forEach((line,i)=>ctx.fillText(line,PAGE_PADDING,126+i*65));if(model.date){font(ctx,29,700);const tw=ctx.measureText(model.date).width+40;roundRect(ctx,PAGE_WIDTH-PAGE_PADDING-tw,77,tw,54,27);ctx.fillStyle='rgba(255,255,255,.62)';ctx.fill();ctx.strokeStyle='rgba(123,140,180,.16)';ctx.stroke();ctx.fillStyle='#677895';ctx.fillText(model.date,PAGE_WIDTH-PAGE_PADDING-tw+20,113)}font(ctx,27,650);ctx.fillStyle='#8a94a8';ctx.fillText(`${page}/${total}`,PAGE_WIDTH-PAGE_PADDING-56,176)}
function drawFooter(ctx:CanvasRenderingContext2D,page:number,total:number){const y=PAGE_HEIGHT-FOOTER_HEIGHT;ctx.strokeStyle='rgba(123,140,180,.14)';ctx.beginPath();ctx.moveTo(PAGE_PADDING,y);ctx.lineTo(PAGE_WIDTH-PAGE_PADDING,y);ctx.stroke();font(ctx,24,550);ctx.fillStyle='#96a0b2';ctx.fillText('점수는 사건 확률이 아니라 선택 기간 안의 상대적 활성도야.',PAGE_PADDING,y+47);font(ctx,24,650);ctx.fillText(`${page} / ${total}`,PAGE_WIDTH-PAGE_PADDING-72,y+47)}
function drawSectionTitle(ctx:CanvasRenderingContext2D,title:string,y:number){font(ctx,31,800);ctx.fillStyle='#64718b';ctx.fillText(title,PAGE_PADDING,y+31);return y+54}
function pageCapacity(){return PAGE_HEIGHT-FOOTER_HEIGHT-42}
function itemHeight(ctx:CanvasRenderingContext2D,item:{section?:string;card:ExportCard}){return (item.section?60:0)+measureCard(ctx,item.card)+CARD_GAP}
function layoutCards(ctx:CanvasRenderingContext2D,model:ExportModel){const groups:Array<{section?:string;card:ExportCard}>=[];if(model.hero)groups.push({section:'핵심 요약',card:{title:'전체를 통틀어 보면',body:model.hero+(model.subtitle?` ${model.subtitle}`:''),tone:'love',emphasis:true}});for(const section of model.sections)section.cards.forEach((card,index)=>groups.push({section:index===0?section.title:undefined,card}));const pages:Array<Array<{section?:string;card:ExportCard}>>=[[]],heights:number[]=[HEADER_HEIGHT];for(const item of groups){const h=itemHeight(ctx,item);let p=pages.length-1;if(heights[p]+h>pageCapacity()&&pages[p].length){pages.push([]);heights.push(HEADER_HEIGHT);p++}pages[p].push(item);heights[p]+=h}for(let pass=0;pass<2;pass++){for(let p=pages.length-1;p>0;p--){while(heights[p]-HEADER_HEIGHT<690&&pages[p-1].length>2){const candidate=pages[p-1][pages[p-1].length-1],h=itemHeight(ctx,candidate);if(heights[p]+h>pageCapacity())break;pages[p-1].pop();heights[p-1]-=h;pages[p].unshift(candidate);heights[p]+=h}}}return pages.filter(page=>page.length)}
function renderPages(model:ExportModel){const probe=createCanvas(),layouts=layoutCards(probe.ctx,model),canvases:HTMLCanvasElement[]=[];layouts.forEach((items,index)=>{const {canvas,ctx}=createCanvas();drawHeader(ctx,model,index+1,layouts.length);let y=HEADER_HEIGHT;for(const item of items){if(item.section)y=drawSectionTitle(ctx,item.section,y);y=drawGlassCard(ctx,item.card,y)+CARD_GAP}drawFooter(ctx,index+1,layouts.length);canvases.push(canvas)});return canvases}
function safeFileName(value:string){return normalizeText(value).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'-').slice(0,72)||'별빛의운명'}
function localDateStamp(){const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`}
function canvasToBlob(canvas:HTMLCanvasElement){return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('이미지를 만들지 못했어.')),'image/png'))}
export async function exportReadingImages(root:HTMLElement,label:string):Promise<ExportResult>{const model=buildReadingExportModel(root,label);if(!model.hero&&!model.sections.some(section=>section.cards.length))throw new Error('저장할 결과 내용을 찾지 못했어.');const canvases=renderPages(model),blobs=await Promise.all(canvases.map(canvasToBlob)),base=safeFileName(label),stamp=localDateStamp(),files=blobs.map((blob,index)=>new File([blob],`${base}_${stamp}_${index+1}of${blobs.length}.png`,{type:'image/png'}));try{if(typeof navigator!=='undefined'&&typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files})){await navigator.share({files,title:label,text:`별빛의 운명 · ${label}`});return {pages:files.length,shared:true,cancelled:false}}}catch(error){if(error instanceof DOMException&&error.name==='AbortError')return {pages:files.length,shared:false,cancelled:true}}for(const file of files){const href=URL.createObjectURL(file),anchor=document.createElement('a');anchor.href=href;anchor.download=file.name;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(href),1200)}return {pages:files.length,shared:false,cancelled:false}}
