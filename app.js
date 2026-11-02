/* Mercadim — PWA de notas de mercado (Supabase) */
(() => {
"use strict";

/* ===================== utilidades ===================== */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const brl = n => (Number(n)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const num2 = n => (Number(n)||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const qtyFmt = n => (Number(n)||0).toLocaleString("pt-BR",{maximumFractionDigits:3});
const parseNum = v => { if (typeof v === "number") return v; const s = String(v??"").trim().replace(/\s/g,""); if(!s) return 0; const t = s.includes(",") ? s.replace(/\./g,"").replace(",",".") : s; const n = parseFloat(t); return isFinite(n)?n:0; };
const norm = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const MESES_L = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const today = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const ymLabel = ym => { const [y,m]=ym.split("-"); return MESES_L[+m-1]+" de "+y; };
const fmtData = s => { const [y,m,d]=String(s).split("-"); return `${d}/${m}/${y}`; };
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const ALTA = 3; // % a partir do qual um aumento vira alerta
/* EAN de produto embalado (8, 12, 13 ou 14 dígitos); códigos que começam com 2 são internos da loja (pesáveis) */
const eanValido = c => /^\d{8}$|^\d{12,14}$/.test(String(c||"")) && !/^0*2/.test(String(c));
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true,3200); }

/* ===================== chave de acesso / QR Code ===================== */
const UF_COD = {11:"RO",12:"AC",13:"AM",14:"RR",15:"PA",16:"AP",17:"TO",21:"MA",22:"PI",23:"CE",24:"RN",25:"PB",26:"PE",27:"AL",28:"SE",29:"BA",31:"MG",32:"ES",33:"RJ",35:"SP",41:"PR",42:"SC",43:"RS",50:"MS",51:"MT",52:"GO",53:"DF"};
/* cUF(2) AAMM(4) CNPJ(14) modelo(2) série(3) número(9) tpEmis(1) código(8) DV(1) */
function dvChave(c43){ let s=0,w=2; for(let i=c43.length-1;i>=0;i--){ s+=(+c43[i])*w; w=w===9?2:w+1; } const r=s%11; return (r<2)?0:11-r; }
function lerChave(txt){
  const nums = String(txt||"").replace(/\s/g,"").match(/\d{44}/g) || [];
  for (const c of nums) {
    if (dvChave(c.slice(0,43)) !== +c[43]) continue;
    const uf = UF_COD[+c.slice(0,2)]; if (!uf) continue;
    return { chave:c, uf, aamm:"20"+c.slice(2,4)+"-"+c.slice(4,6), cnpj:c.slice(6,20), modelo:c.slice(20,22), numero:String(+c.slice(25,34)) };
  }
  return null;
}
const fmtCnpj = c => String(c||"").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5");
const fmtChave = c => String(c||"").replace(/(\d{4})(?=\d)/g,"$1 ");
async function lerQR(file){
  if (typeof window.jsQR !== "function") return null;
  let bmp; try { bmp = await createImageBitmap(file, {imageOrientation:"from-image"}); } catch(e){ try{ bmp = await createImageBitmap(file); }catch(e2){ return null; } }
  for (const lado of [2400, 1600, 1000]) {
    const k = Math.min(1, lado/Math.max(bmp.width,bmp.height));
    const w = Math.round(bmp.width*k), h = Math.round(bmp.height*k);
    const cv = document.createElement("canvas"); cv.width=w; cv.height=h;
    const cx = cv.getContext("2d",{willReadFrequently:true}); cx.drawImage(bmp,0,0,w,h);
    const r = window.jsQR(cx.getImageData(0,0,w,h).data, w, h, {inversionAttempts:"attemptBoth"});
    if (r && r.data) return r.data;
    if (k===1) break;
  }
  return null;
}

/* ===================== dados de exemplo (só enquanto não há notas) ===================== */
const EXEMPLO = (() => {
  const mk = (id,data,mercado,cidade,itens) => ({id,data,mercado,cidade,estado:"SP",exemplo:true,itens:itens.map(([d,m,q,u,p])=>({d,m,q,u,p,t:+(q*p).toFixed(2)}))});
  return [
    mk("ex1","2026-10-04","Mercado Bom Preço","Jacareí",[["Arroz branco tipo 1 5kg","Camil",1,"UN",27.9],["Feijão carioca 1kg","Kicaldo",2,"UN",8.49],["Leite integral 1L","Italac",6,"UN",4.79],["Café torrado e moído 500g","Pilão",1,"UN",21.9],["Banana nanica","",1.25,"KG",5.99]]),
    mk("ex2","2026-10-18","Supermercado Vale","São José dos Campos",[["Arroz branco tipo 1 5kg","Camil",1,"UN",25.49],["Leite integral 1L","Italac",6,"UN",4.99],["Óleo de soja 900ml","Liza",2,"UN",7.29],["Peito de frango","",1.8,"KG",18.9],["Detergente 500ml","Ypê",3,"UN",2.69]]),
    mk("ex3","2026-10-29","Mercado Bom Preço","Jacareí",[["Café torrado e moído 500g","Pilão",1,"UN",23.5],["Feijão carioca 1kg","Kicaldo",1,"UN",7.99],["Açúcar refinado 1kg","União",2,"UN",4.89],["Banana nanica","",1.1,"KG",6.49]])
  ];
})();

/* ===================== estado ===================== */
const CFG = window.MERCADIM_CONFIG || {};
let sb = null, user = null, casa = null, canalLista = null;
let compras = [], usandoExemplo = true, carregado = false;
let listaItens = [];
let tab = "compras";
const ui = { busca:"", mercadoSel:null, finMes:"", finMercado:"", finCidade:"", produtoAberto:null };
const lista = () => usandoExemplo ? EXEMPLO : compras;
const totalNota = c => c.itens.reduce((s,i)=>s+(Number(i.t)||0),0);

/* ===================== agregações ===================== */
let cacheProdutos = null;
function produtos() {
  if (cacheProdutos) return cacheProdutos;
  const map = new Map();
  // mesmo produto em mercados diferentes: o código de barras (EAN) une; sem ele, descrição + marca
  const nomeDoEan = new Map();
  for (const c of lista()) for (const it of c.itens) if (eanValido(it.c)) nomeDoEan.set(norm(it.d)+"|"+norm(it.m), "ean:"+it.c);
  for (const c of lista()) for (const it of c.itens) {
    const key = eanValido(it.c) ? "ean:"+it.c : (nomeDoEan.get(norm(it.d)+"|"+norm(it.m)) || norm(it.d)+"|"+norm(it.m));
    if (!map.has(key)) map.set(key,{key,d:it.d,m:it.m,u:it.u,c:it.c,hist:[]});
    map.get(key).hist.push({data:c.data,mercado:c.mercado,cidade:c.cidade,p:Number(it.p)||0,compraId:c.id});
  }
  for (const p of map.values()) {
    p.hist.sort((a,b)=>a.data<b.data?1:a.data>b.data?-1:0);
    p.ultimo = p.hist[0];
    p.min = Math.min(...p.hist.map(h=>h.p));
    p.prev = p.hist.find(h=>h.data<p.ultimo.data) || null;
    // alta/baixa: compara com a compra anterior no mesmo mercado; se não houver, com a anterior em qualquer mercado
    p.base = p.hist.find(h=>h.mercado===p.ultimo.mercado && h.data<p.ultimo.data) || p.prev;
    p.varPct = p.base && p.base.p ? (p.ultimo.p-p.base.p)/p.base.p*100 : 0;
  }
  return cacheProdutos = [...map.values()].sort((a,b)=>a.d.localeCompare(b.d,"pt-BR"));
}
function mercados() {
  const m = new Map();
  for (const c of lista()) { const k = c.mercado||"Sem mercado"; if(!m.has(k)) m.set(k,{nome:k,cidade:c.cidade,estado:c.estado,n:0,total:0}); const o=m.get(k); o.n++; o.total+=totalNota(c); }
  return [...m.values()].sort((a,b)=>b.n-a.n);
}
const rotulo = p => p.d + (p.m ? " · " + p.m : "");
function precosPorMercado(p) { const m = new Map(); for (const h of p.hist) if (!m.has(h.mercado)) m.set(h.mercado,h); return m; }

/* ===================== renderização ===================== */
function render() {
  cacheProdutos = null;
  $$(".tab").forEach(b=>b.setAttribute("aria-selected", String(b.dataset.tab===tab)));
  let h = "";
  if (carregado && usandoExemplo) h += `<div class="banner"><span>●</span><span><b>Dados de exemplo.</b> Toque em “Nova nota” para registrar seu primeiro cupom; os exemplos somem quando você salvar.</span></div>`;
  h += ({compras:vCompras, lista:vLista, produtos:vProdutos, mercados:vMercados, financeiro:vFinanceiro})[tab]();
  $("#main").innerHTML = h;
  const pend = listaItens.filter(i=>!i.feito).length, bd = $("#badgeLista");
  bd.hidden = !pend; bd.textContent = pend;
  bindView();
}

function vCompras() {
  if (!carregado) return `<div class="status" style="margin-top:20px"><span class="spin"></span><span>Carregando suas notas…</span></div>`;
  const cs = [...lista()].sort((a,b)=>a.data<b.data?1:-1);
  const mesAtual = today().slice(0,7);
  const gastoMes = cs.filter(c=>c.data.startsWith(mesAtual)).reduce((s,c)=>s+totalNota(c),0);
  let h = `<h2>Compras</h2><p class="sub">${cs.length} nota${cs.length===1?"":"s"} · ${brl(gastoMes)} em ${ymLabel(mesAtual)}</p>`;
  if (!cs.length) return h + `<div class="empty">Nenhuma nota ainda.</div>`;
  h += `<div class="list">`;
  for (const c of cs) {
    const [y,m,d] = c.data.split("-");
    h += `<button class="row-btn" data-open="${esc(c.id)}" type="button">
      <div class="date-tile"><strong>${d}</strong><span>${MESES[+m-1]} ${y.slice(2)}</span></div>
      <div class="row-main"><div class="t">${esc(c.mercado||"Sem mercado")}</div><div class="m">${esc(c.cidade||"")}${c.estado?" / "+esc(c.estado):""} · ${c.itens.length} ite${c.itens.length===1?"m":"ns"}</div></div>
      <div class="row-total">${brl(totalNota(c))}</div></button>`;
  }
  return h + `</div>`;
}

function vProdutos() {
  const ps = produtos();
  const q = norm(ui.busca);
  const fil = q ? ps.filter(p=>norm(p.d+" "+p.m).includes(q)) : ps;
  let h = `<h2>Produtos</h2><p class="sub">${ps.length} produtos · último preço pago em qualquer mercado. Toque para ver o histórico.</p>`;
  const altas = ps.filter(p=>p.varPct>=ALTA).sort((a,b)=>b.varPct-a.varPct);
  if (altas.length && !q) {
    h += `<div class="panel alerta"><h3>▲ Subiram desde a última compra</h3>`;
    for (const p of altas.slice(0,6)) h += `<div class="mrow"><span class="lbl">${esc(p.d)}</span><span class="pill up">+${p.varPct.toFixed(0)}%</span><span class="b">${brl(p.base.p)} → ${brl(p.ultimo.p)} · ${esc(p.ultimo.mercado)}${p.base.mercado!==p.ultimo.mercado?" (antes no "+esc(p.base.mercado)+")":""}</span><span></span></div>`;
    h += `</div>`;
  }
  h += `<input class="search" id="busca" type="search" placeholder="Buscar produto ou marca" value="${esc(ui.busca)}" autocomplete="off">
  <div class="receipt" style="margin-top:12px"><div class="tbl-wrap"><table><thead><tr><th>Produto</th><th class="r">Último</th><th>Onde</th><th class="r">Variação</th></tr></thead><tbody>`;
  if (!fil.length) h += `<tr><td colspan="4" class="empty">Nada encontrado.</td></tr>`;
  for (const p of fil) {
    const varH = Math.abs(p.varPct)>=0.5 ? `<span class="pill ${p.varPct>0?"up":"down"}">${p.varPct>0?"▲":"▼"} ${Math.abs(p.varPct).toFixed(0)}%</span>` : "";
    h += `<tr class="clickable" data-prod="${esc(p.key)}"><td><div class="d">${esc(p.d)}</div><div class="b">${esc(p.m||"—")} · ${esc(p.u||"UN")}</div></td>
      <td class="r num">${brl(p.ultimo.p)}</td><td><div style="font-size:13px">${esc(p.ultimo.mercado)}</div><div class="b">${fmtData(p.ultimo.data)}</div></td><td class="r">${varH}</td></tr>`;
    if (ui.produtoAberto===p.key) {
      h += `<tr><td colspan="4" style="background:var(--soft)"><div class="b" style="margin-bottom:6px">Histórico · menor preço ${brl(p.min)}</div>`;
      for (const x of p.hist) h += `<div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:3px 0"><span>${fmtData(x.data)} · ${esc(x.mercado)}</span><span class="num">${brl(x.p)}${x.p===p.min?' <span class="pill best">menor</span>':""}</span></div>`;
      h += `</td></tr>`;
    }
  }
  return h + `</tbody></table></div></div>`;
}

function vMercados() {
  const ms = mercados();
  if (!ms.length) return `<h2>Mercados</h2><div class="empty">Nenhum mercado ainda.</div>`;
  if (!ui.mercadoSel || !ms.find(m=>m.nome===ui.mercadoSel)) ui.mercadoSel = ms[0].nome;
  const sel = ms.find(m=>m.nome===ui.mercadoSel);
  const rows = [];
  for (const p of produtos()) {
    const pm = precosPorMercado(p), aqui = pm.get(sel.nome);
    if (!aqui) continue;
    rows.push({p,aqui,melhor:[...pm.values()].reduce((a,b)=>b.p<a.p?b:a),outros:pm.size});
  }
  let h = `<h2>Mercados</h2><p class="sub">Último preço de cada produto neste mercado, comparado com os outros.</p><div class="chips" role="group" aria-label="Mercado">`;
  for (const m of ms) h += `<button class="chip" type="button" data-merc="${esc(m.nome)}" aria-pressed="${m.nome===sel.nome}">${esc(m.nome)}</button>`;
  h += `</div><p class="sub" style="margin-top:-4px">${esc(sel.cidade||"")}${sel.estado?" / "+esc(sel.estado):""} · ${sel.n} nota${sel.n===1?"":"s"} · ${brl(sel.total)} no total</p>
  <div class="receipt"><div class="tbl-wrap"><table><thead><tr><th>Produto</th><th class="r">Preço aqui</th><th class="r">Comparação</th></tr></thead><tbody>`;
  for (const r of rows) {
    let cmp;
    if (r.outros<2) cmp = `<span class="b">só aqui</span>`;
    else if (r.aqui.p<=r.melhor.p) cmp = `<span class="pill best">mais barato</span>`;
    else { const d=(r.aqui.p-r.melhor.p)/r.melhor.p*100; cmp = `<span class="pill up">+${d.toFixed(0)}%</span><div class="b">${brl(r.melhor.p)} no ${esc(r.melhor.mercado)}</div>`; }
    h += `<tr><td><div class="d">${esc(r.p.d)}</div><div class="b">${esc(r.p.m||"—")} · ${fmtData(r.aqui.data)}</div></td><td class="r num">${brl(r.aqui.p)}</td><td class="r">${cmp}</td></tr>`;
  }
  return h + `</tbody></table></div></div>`;
}

function vFinanceiro() {
  const cs = lista();
  const meses = [...new Set(cs.map(c=>c.data.slice(0,7)))].sort().reverse();
  const mercs = [...new Set(cs.map(c=>c.mercado).filter(Boolean))].sort();
  const cids = [...new Set(cs.map(c=>c.cidade).filter(Boolean))].sort();
  if (ui.finMes && !meses.includes(ui.finMes)) ui.finMes = "";
  const base = cs.filter(c=>(!ui.finMercado||c.mercado===ui.finMercado)&&(!ui.finCidade||c.cidade===ui.finCidade));
  const doPeriodo = base.filter(c=>!ui.finMes||c.data.startsWith(ui.finMes));
  const total = doPeriodo.reduce((s,c)=>s+totalNota(c),0);
  const ticket = doPeriodo.length ? total/doPeriodo.length : 0;
  const opt = (v,l,cur) => `<option value="${esc(v)}"${v===cur?" selected":""}>${esc(l)}</option>`;
  let h = `<h2>Financeiro</h2><p class="sub">Quanto você gastou, por mês, por mercado e por cidade.</p>
  <div class="filters">
    <label>Mês<select id="fMes">${opt("","Todos os meses",ui.finMes)}${meses.map(m=>opt(m,ymLabel(m),ui.finMes)).join("")}</select></label>
    <label>Mercado<select id="fMerc">${opt("","Todos",ui.finMercado)}${mercs.map(m=>opt(m,m,ui.finMercado)).join("")}</select></label>
    <label>Cidade<select id="fCid">${opt("","Todas",ui.finCidade)}${cids.map(m=>opt(m,m,ui.finCidade)).join("")}</select></label>
  </div>
  <div class="kpis"><div class="kpi main"><span>Total gasto</span><strong>${brl(total)}</strong></div>
    <div class="kpi"><span>Notas</span><strong>${doPeriodo.length}</strong></div>
    <div class="kpi"><span>Ticket médio</span><strong>${brl(ticket)}</strong></div></div>`;
  const porMes = new Map(); for (const c of base) { const k=c.data.slice(0,7); porMes.set(k,(porMes.get(k)||0)+totalNota(c)); }
  h += `<div class="panel"><h3>Gasto por mês</h3>${barChart(lastMonths(6).map(m=>({k:m,v:porMes.get(m)||0})))}</div>`;
  h += `<div class="panel"><h3>Por mercado${ui.finMes?" · "+ymLabel(ui.finMes):""}</h3>${hbars(groupSum(doPeriodo,c=>c.mercado||"Sem mercado"))}</div>`;
  h += `<div class="panel"><h3>Por cidade${ui.finMes?" · "+ymLabel(ui.finMes):""}</h3>${hbars(groupSum(doPeriodo,c=>(c.cidade||"Sem cidade")+(c.estado?" / "+c.estado:"")))}</div>`;
  return h;
}
function lastMonths(n){ const d=new Date(); const out=[]; for(let i=n-1;i>=0;i--){ const x=new Date(d.getFullYear(),d.getMonth()-i,1); out.push(x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")); } return out; }
function groupSum(cs,fn){ const m=new Map(); for(const c of cs){const k=fn(c); m.set(k,(m.get(k)||0)+totalNota(c));} return [...m.entries()].sort((a,b)=>b[1]-a[1]); }
function hbars(rows){ if(!rows.length) return `<div class="b">Sem compras no período.</div>`; const max=rows[0][1]||1; return `<div class="hbars">`+rows.map(([k,v])=>`<div class="hbar"><span class="lbl">${esc(k)}</span><span class="num">${brl(v)}</span><div class="track"><div class="fill" style="width:${(v/max*100).toFixed(1)}%"></div></div></div>`).join("")+`</div>`; }
function niceMax(v){ if(v<=0) return 100; const p=Math.pow(10,Math.floor(Math.log10(v))); for(const s of [1,2,2.5,5,10]) if(s*p>=v) return s*p; return 10*p; }
function barChart(data){
  const W=600,H=200,L=56,R=8,T=12,B=26, max=niceMax(Math.max(...data.map(d=>d.v))), bw=(W-L-R)/data.length;
  const k = v => v>=1000 ? (v/1000).toLocaleString("pt-BR",{maximumFractionDigits:1})+" mil" : v.toFixed(0);
  let s=`<div class="tbl-wrap"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:320px;display:block" role="img" aria-label="Gasto por mês">`;
  for(let i=0;i<=4;i++){ const v=max*i/4, y=T+(H-T-B)*(1-i/4); s+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${L-6}" y="${y+4}" text-anchor="end">${k(v)}</text>`; }
  data.forEach((d,i)=>{ const h=(H-T-B)*(d.v/max), x=L+i*bw+bw*0.2, w=bw*0.6, y=H-B-h, last=i===data.length-1;
    s+=`<rect x="${x}" y="${y}" width="${w}" height="${Math.max(h,0)}" rx="3" fill="${last?"var(--accent)":"var(--muted)"}" opacity="${last?1:.45}"><title>${ymLabel(d.k)}: ${brl(d.v)}</title></rect>`;
    const [y4,m]=d.k.split("-"); s+=`<text x="${x+w/2}" y="${H-8}" text-anchor="middle">${MESES[+m-1]}/${y4.slice(2)}</text>`;
    if(d.v>0) s+=`<text x="${x+w/2}" y="${y-4}" text-anchor="middle" style="fill:var(--ink)">${k(d.v)}</text>`; });
  return s+`</svg></div>`;
}

/* ===================== lista da próxima compra (compartilhada pela casa) ===================== */
function estimativa() {
  const ps = produtos(), pmap = new Map(ps.map(p=>[p.key,p]));
  const linhas = listaItens.map(i => {
    const p = (i.key && pmap.get(i.key)) || ps.find(x=>norm(x.d+(x.m?" "+x.m:""))===norm(i.nome)) || null;
    if (!p) return {i, p:null};
    const pm = precosPorMercado(p);
    return {i, p, pm, melhor:[...pm.values()].reduce((a,b)=>b.p<a.p?b:a)};
  });
  const ativos = listaItens.filter(i=>!i.feito).length;
  const comPreco = linhas.filter(l=>l.p && !l.i.feito);
  const totalMelhor = comPreco.reduce((s,l)=>s+l.melhor.p*l.i.q,0);
  const mercadosMelhor = new Set(comPreco.map(l=>l.melhor.mercado));
  const todos = new Set(); comPreco.forEach(l=>l.pm.forEach((_,k)=>todos.add(k)));
  const porMercado = [...todos].map(nome => {
    let total=0, tem=0; for (const l of comPreco) { const h=l.pm.get(nome); if (h) { total+=h.p*l.i.q; tem++; } }
    return {nome,total,tem};
  }).sort((a,b)=> b.tem-a.tem || a.total-b.total);
  return {linhas, ativos, comPreco:comPreco.length, totalMelhor, mercadosMelhor, porMercado};
}

function vLista() {
  const ps = produtos(), e = estimativa();
  let h = `<h2>Lista da próxima compra</h2><p class="sub">Some o que precisa comprar. O Mercadim estima o gasto com os últimos preços das suas notas e mostra onde cada item sai mais barato.</p>
  <div class="shared"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4 1.5 4 4"/></svg>
  <span>${casa?`Lista da casa “${esc(casa.nome)}”${casa.membros>1?` · ${casa.membros} pessoas`:""}. Para incluir alguém, toque na sua foto no alto.`:"Carregando a lista…"}</span></div>
  <form class="add" id="addForm" autocomplete="off">
    <input class="inp" id="addNome" list="dlProd" placeholder="Produto (ex.: Arroz)" aria-label="Produto">
    <input class="inp mono" id="addQtd" inputmode="decimal" value="1" aria-label="Quantidade">
    <button class="btn" type="submit">Adicionar</button>
    <datalist id="dlProd">${ps.map(p=>`<option value="${esc(rotulo(p))}">`).join("")}</datalist>
  </form>`;
  const naLista = new Set(listaItens.map(i=>i.key).filter(Boolean));
  const sugs = ps.filter(p=>!naLista.has(p.key)).sort((a,b)=>b.hist.length-a.hist.length).slice(0,8);
  if (sugs.length) h += `<div class="sugs" aria-label="Sugestões">${sugs.map(p=>`<button class="sug" type="button" data-sug="${esc(p.key)}">+ ${esc(p.d)}</button>`).join("")}</div>`;
  if (!listaItens.length) return h + `<div class="empty" style="margin-top:14px">A lista está vazia. Digite um produto acima ou toque numa sugestão.</div>`;

  const melhorUnico = e.porMercado[0];
  h += `<div class="est">
    <div class="kpi main"><span>Comprando cada item onde é mais barato</span><strong>${brl(e.totalMelhor)}</strong><small>${e.mercadosMelhor.size} mercado${e.mercadosMelhor.size===1?"":"s"} · ${e.comPreco} de ${e.ativos} itens com preço</small></div>
    <div class="kpi"><span>Tudo num só mercado</span><strong>${melhorUnico?brl(melhorUnico.total):"—"}</strong><small>${melhorUnico?esc(melhorUnico.nome)+(melhorUnico.tem<e.comPreco?` · ${melhorUnico.tem} de ${e.comPreco} itens`:""):"Sem preços ainda"}</small></div>
  </div>`;
  if (e.porMercado.length > 1) {
    h += `<div class="panel"><h3>Quanto sai em cada mercado</h3>`;
    for (const m of e.porMercado) {
      const falta = e.comPreco - m.tem;
      h += `<div class="mrow"><span class="lbl">${esc(m.nome)}</span><span class="num">${brl(m.total)}</span>
        <span class="b">${falta?`sem preço para ${falta} ite${falta===1?"m":"ns"} da lista`:"tem preço de todos os itens"}</span>${m===melhorUnico&&!falta?`<span class="pill best" style="justify-self:end">melhor opção</span>`:"<span></span>"}</div>`;
    }
    h += `</div>`;
  }
  h += `<div class="receipt">`;
  for (const l of e.linhas) {
    const i = l.i, un = l.p?.u || i.u || "UN", passo = /^(KG|L)$/i.test(un) ? 0.5 : 1;
    let w;
    if (!l.p) w = `<span class="w">Sem preço ainda. Aparece depois que este item estiver numa nota.</span>`;
    else {
      const outros = [...l.pm.values()].filter(x=>x.mercado!==l.melhor.mercado).sort((a,b)=>a.p-b.p);
      const alta = l.p.varPct>=ALTA ? `<br><span class="pill up" style="margin-top:4px">▲ subiu ${l.p.varPct.toFixed(0)}% no ${esc(l.p.ultimo.mercado)}</span>` : "";
      w = `<span class="w"><b>${brl(l.melhor.p)}</b> no ${esc(l.melhor.mercado)} · ${fmtData(l.melhor.data)}${outros.length?`<br>${outros.slice(0,2).map(o=>`${brl(o.p)} no ${esc(o.mercado)}`).join(" · ")}`:""}${alta}</span>`;
    }
    h += `<div class="li${i.feito?" feito":""}">
      <input type="checkbox" id="ck-${esc(i.id)}" data-ck="${esc(i.id)}" ${i.feito?"checked":""} aria-label="Já peguei ${esc(i.nome)}">
      <div style="min-width:0"><label class="n" for="ck-${esc(i.id)}">${esc(i.nome)}</label><br>${w}</div>
      <div class="right">
        ${l.p?`<span class="num" style="font-weight:600">${brl(l.melhor.p*i.q)}</span>`:""}
        <div style="display:flex;gap:6px"><span class="step"><button type="button" data-menos="${esc(i.id)}" data-passo="${passo}" aria-label="Diminuir">−</button><span>${qtyFmt(i.q)} ${esc(un.toLowerCase())}</span><button type="button" data-mais="${esc(i.id)}" data-passo="${passo}" aria-label="Aumentar">+</button></span>
        <button class="x" type="button" data-rm="${esc(i.id)}" aria-label="Tirar da lista">✕</button></div>
      </div></div>`;
  }
  h += `</div>`;
  const feitos = listaItens.filter(i=>i.feito).length;
  h += `<div class="actions"><span class="b" style="font-size:13px;align-self:center">${feitos?`${feitos} marcado${feitos===1?"":"s"} como pego${feitos===1?"":"s"}`:"Marque os itens conforme for pegando."}</span>
    ${feitos?`<button class="btn ghost" type="button" id="limparFeitos">Tirar os marcados</button>`:""}</div>`;
  return h;
}

const rowParaItem = r => ({id:r.id, nome:r.nome, key:r.chave_produto, u:r.unidade||"UN", q:Number(r.qtd)||1, feito:!!r.feito});
async function carregarLista() {
  if (!casa) return;
  const { data, error } = await sb.from("lista_itens").select("*").eq("casa_id", casa.id).order("criado_em");
  if (!error) { listaItens = data.map(rowParaItem); render(); }
}
async function opLista(fnLocal, fnRemota) {
  const antes = listaItens.map(i=>({...i}));
  fnLocal(); render();
  const { error } = await fnRemota();
  if (error) { listaItens = antes; render(); toast("Não consegui salvar na lista. Verifique a conexão."); }
}
function addItem(nome, q, p) {
  const ps = produtos();
  p = p || ps.find(x=>norm(rotulo(x))===norm(nome)) || ps.find(x=>norm(x.d)===norm(nome));
  if (!p) { const n = norm(nome), cands = ps.filter(x=>norm(x.d).includes(n)); if (n.length>=3 && cands.length===1) p = cands[0]; }
  const key = p?.key || null;
  const ja = key && listaItens.find(i=>i.key===key);
  if (ja) {
    const nq = +(ja.q + q).toFixed(3);
    return opLista(()=>{ ja.q=nq; ja.feito=false; }, ()=>sb.from("lista_itens").update({qtd:nq, feito:false}).eq("id", ja.id));
  }
  const novo = {id: crypto.randomUUID(), nome: p ? p.d + (p.m?" "+p.m:"") : nome.trim(), key, u:p?.u||"UN", q, feito:false};
  return opLista(()=>listaItens.push(novo), ()=>sb.from("lista_itens").insert({id:novo.id, casa_id:casa.id, nome:novo.nome, chave_produto:key, unidade:novo.u, qtd:q}));
}
function bindLista() {
  const f = $("#addForm"); if (!f) return;
  f.onsubmit = e => { e.preventDefault(); if (!casa) return; const nome=$("#addNome").value.trim(); if(!nome) return; const q=parseNum($("#addQtd").value)||1; addItem(nome,q); setTimeout(()=>$("#addNome")?.focus(),0); };
  $$("[data-sug]").forEach(b=>b.onclick=()=>{ const p=produtos().find(x=>x.key===b.dataset.sug); if(p && casa) addItem(p.d,1,p); });
  const achar = id => listaItens.find(x=>x.id===id);
  $$("[data-ck]").forEach(c=>c.onchange=()=>{ const i=achar(c.dataset.ck); if(!i) return; const v=c.checked; opLista(()=>i.feito=v, ()=>sb.from("lista_itens").update({feito:v}).eq("id",i.id)); });
  const mudaQ = (id, delta, passo) => { const i=achar(id); if(!i) return; const nq=Math.max(passo, +(i.q+delta).toFixed(3)); opLista(()=>i.q=nq, ()=>sb.from("lista_itens").update({qtd:nq}).eq("id",i.id)); };
  $$("[data-mais]").forEach(b=>b.onclick=()=>mudaQ(b.dataset.mais, +b.dataset.passo, +b.dataset.passo));
  $$("[data-menos]").forEach(b=>b.onclick=()=>mudaQ(b.dataset.menos, -b.dataset.passo, +b.dataset.passo));
  $$("[data-rm]").forEach(b=>b.onclick=()=>{ const id=b.dataset.rm; opLista(()=>listaItens=listaItens.filter(x=>x.id!==id), ()=>sb.from("lista_itens").delete().eq("id",id)); });
  const lf = $("#limparFeitos"); if (lf) lf.onclick = () => { const ids=listaItens.filter(x=>x.feito).map(x=>x.id); opLista(()=>listaItens=listaItens.filter(x=>!x.feito), ()=>sb.from("lista_itens").delete().in("id",ids)); };
}

/* ===================== eventos das abas ===================== */
function bindView() {
  const main = $("#main");
  $$("[data-open]", main).forEach(b=>b.onclick=()=>{ const c=lista().find(x=>x.id===b.dataset.open); if(c) abrirEditor(c); });
  const busca = $("#busca"); if (busca) busca.oninput = () => { ui.busca = busca.value; const pos=busca.selectionStart; render(); const nb=$("#busca"); nb.focus(); try{nb.setSelectionRange(pos,pos);}catch(e){} };
  $$("[data-prod]", main).forEach(tr=>tr.onclick=()=>{ ui.produtoAberto = ui.produtoAberto===tr.dataset.prod?null:tr.dataset.prod; render(); });
  $$("[data-merc]", main).forEach(b=>b.onclick=()=>{ ui.mercadoSel=b.dataset.merc; render(); });
  const fm=$("#fMes"), fme=$("#fMerc"), fc=$("#fCid");
  if (fm) { fm.onchange=()=>{ui.finMes=fm.value;render();}; fme.onchange=()=>{ui.finMercado=fme.value;render();}; fc.onchange=()=>{ui.finCidade=fc.value;render();}; }
  bindLista();
}
$$(".tab").forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; try{localStorage.setItem("mercadim-tab",tab);}catch(e){} render(); window.scrollTo(0,0); });

/* ===================== editor de nota ===================== */
let ed = null;
function abrirSheet(){ $("#sheet").hidden=false; document.body.style.overflow="hidden"; }
function fecharSheet(){ $("#sheet").hidden=true; $("#sheet").innerHTML=""; document.body.style.overflow=""; }
function abrirEditor(c) {
  ed = c ? JSON.parse(JSON.stringify(c)) : { data:today(), mercado:"", cidade:"", estado:"SP", itens:[] };
  ed.fotos = []; ed.confirmarExcluir=false; ed.novo=!c;
  abrirSheet(); renderEditor();
}
function fecharEditor(){ (ed?.fotos||[]).forEach(f=>URL.revokeObjectURL(f.url)); ed=null; fecharSheet(); }

function renderEditor() {
  const mercs = [...new Set(compras.map(c=>c.mercado).filter(Boolean))];
  const cids = [...new Set(compras.map(c=>c.cidade).filter(Boolean))];
  const ps = produtos();
  const soma = ed.itens.reduce((s,i)=>s+(+i.t||0),0);
  let h = `<div class="wrap"><header><h2>${ed.novo?"Nova nota":"Editar nota"}</h2><button class="btn ghost" type="button" id="edFechar">Fechar</button></header>`;
  if (ed.novo) {
    h += `<label class="drop" id="drop" for="foto">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
      <strong>${ed.fotos.length?"Trocar foto":"Fotografar o QR Code da nota"}</strong>
      <p>O QR Code identifica a nota e o mercado e evita salvar a mesma nota duas vezes. Tire a foto de perto do QR. Os itens você digita abaixo.</p>
    </label><input id="foto" type="file" accept="image/*" capture="environment" multiple hidden>`;
    if (ed.fotos.length) h += `<div class="thumbs">${ed.fotos.map((f,i)=>`<img alt="Foto ${i+1} da nota" src="${f.url}">`).join("")}</div>`;
  }
  h += blocoChave();
  h += `<div class="meta">
    <label>Data<input class="inp" type="date" id="mData" value="${esc(ed.data)}"></label>
    <label>Estado<select id="mUF">${UFS.map(u=>`<option${u===ed.estado?" selected":""}>${u}</option>`).join("")}</select></label>
    <label class="wide">Supermercado<input class="inp" id="mMerc" list="dlMerc" value="${esc(ed.mercado)}" placeholder="Ex.: Tauste" autocomplete="off"></label>
    <label class="wide">Cidade<input class="inp" id="mCid" list="dlCid" value="${esc(ed.cidade)}" placeholder="Ex.: São José dos Campos" autocomplete="off"></label>
    <datalist id="dlMerc">${mercs.map(m=>`<option value="${esc(m)}">`).join("")}</datalist>
    <datalist id="dlCid">${cids.map(m=>`<option value="${esc(m)}">`).join("")}</datalist>
    <datalist id="dlProdEd">${ps.map(p=>`<option value="${esc(rotulo(p))}">`).join("")}</datalist>
  </div>
  <h2 style="font-size:16px;margin-top:20px">Itens <span style="font:400 13px var(--f-body);color:var(--muted)">(${ed.itens.length})</span></h2>
  <p class="sub" style="margin:0">Comece a digitar e escolha um produto que você já comprou: marca, unidade e último preço vêm preenchidos.</p>
  <div class="items" id="itens">`;
  if (!ed.itens.length) h += `<div class="empty">Nenhum item ainda.</div>`;
  ed.itens.forEach((it,i)=>{
    h += `<div class="item" data-i="${i}">
      <div class="full"><input id="d${i}" data-f="d" list="dlProdEd" value="${esc(it.d)}" placeholder="Descrição" aria-label="Descrição"><button class="x" type="button" data-del="${i}" aria-label="Remover item">✕</button></div>
      ${it.c?`<div class="code">${eanValido(it.c)?"EAN":"Cód."} ${esc(it.c)}</div>`:""}
      <div class="nums">
        <label>Marca<input id="m${i}" data-f="m" value="${esc(it.m)}"></label>
        <label>Qtd<input id="q${i}" data-f="q" class="mono" inputmode="decimal" value="${esc(qtyFmt(it.q))}"></label>
        <label>Un.<input id="u${i}" data-f="u" value="${esc(it.u||"UN")}"></label>
        <label>Preço un.<input id="p${i}" data-f="p" class="mono" inputmode="decimal" value="${esc(num2(it.p))}"></label>
        <label style="grid-column:1/-1">Total do item<input id="t${i}" data-f="t" class="mono" inputmode="decimal" value="${esc(num2(it.t))}"></label>
      </div></div>`;
  });
  h += `</div><div class="actions" style="justify-content:flex-start"><button class="btn ghost" type="button" id="edAdd">+ Adicionar item</button></div>
  <div class="sumbar"><span>Total da nota</span><strong id="edTotal">${brl(soma)}</strong></div>
  <div class="actions">${!ed.novo && !ed.exemplo ? `<button class="btn danger" type="button" id="edDel">Excluir nota</button>`:"<span></span>"}
    <button class="btn" type="button" id="edSalvar">Salvar nota</button></div>
  ${ed.confirmarExcluir?`<div class="confirm"><span>Excluir esta nota de vez?</span><button class="btn danger" type="button" id="edDelSim">Excluir</button><button class="btn ghost" type="button" id="edDelNao">Cancelar</button></div>`:""}
  ${ed.exemplo?`<div class="notice">Esta é uma nota de exemplo. Salvar cria uma nota sua com esses dados.</div>`:""}
  ${ed.msg?`<div class="status err">${esc(ed.msg)}</div>`:""}
  </div>`;
  $("#sheet").innerHTML = h;
  bindEditor();
}
function blocoChave() {
  if (!ed.chave) {
    if (ed.procurandoQR) return `<div class="status"><span class="spin"></span><span>Procurando o QR Code…</span></div>`;
    if (ed.qrTentado && ed.fotos.length) return `<div class="notice">Não consegui ler o QR Code nesta foto. Tente de novo mais de perto, com o QR inteiro, reto e nítido. Dá para salvar a nota mesmo sem ele.</div>`;
    return "";
  }
  const dup = compras.find(c=>c.chave===ed.chave && c.id!==ed.id);
  let h = `<div class="chave${dup?" dup":""}">`;
  if (dup) h += `<strong>Esta nota já foi salva</strong><span>${esc(dup.mercado)} · ${fmtData(dup.data)} · ${brl(totalNota(dup))}. Salvar de novo duplica os gastos.</span><span><button class="btn ghost" type="button" id="abrirDup" style="padding:6px 10px">Abrir a nota salva</button></span>`;
  h += `<span style="color:var(--muted)">Chave de acesso</span><span class="mono">${fmtChave(ed.chave)}</span>
    <span>CNPJ ${fmtCnpj(ed.cnpj)}${ed.mercadoPorCnpj?" · mercado reconhecido pelas suas notas anteriores":""}</span>
    ${ed.qrUrl?`<a href="${esc(ed.qrUrl)}" target="_blank" rel="noopener">Ver a nota oficial na Sefaz ↗</a>`:""}</div>`;
  return h;
}
function lerCampos() {
  if (!$("#mData")) return;
  ed.data = $("#mData").value || today();
  ed.estado = $("#mUF").value; ed.mercado = $("#mMerc").value.trim(); ed.cidade = $("#mCid").value.trim();
}
function bindEditor() {
  $("#edFechar").onclick = fecharEditor;
  ["mData","mUF","mMerc","mCid"].forEach(id=>{ $("#"+id).onchange = lerCampos; });
  const foto = $("#foto");
  if (foto) {
    foto.onchange = () => setFotos(foto.files);
    const drop = $("#drop");
    drop.ondragover = e=>{e.preventDefault();drop.classList.add("over");};
    drop.ondragleave = ()=>drop.classList.remove("over");
    drop.ondrop = e=>{e.preventDefault();drop.classList.remove("over"); if(e.dataTransfer.files.length) setFotos(e.dataTransfer.files);};
  }
  const itens = $("#itens");
  itens.addEventListener("input", e => {
    const inp = e.target, row = inp.closest(".item"); if(!row) return;
    const i = +row.dataset.i, f = inp.dataset.f, it = ed.itens[i];
    if (f==="d"||f==="m"||f==="u") it[f]=inp.value;
    else { it[f]=parseNum(inp.value); if (f==="q"||f==="p") { it.t=+(it.q*it.p).toFixed(2); $("#t"+i).value=num2(it.t); } }
    $("#edTotal").textContent = brl(ed.itens.reduce((s,x)=>s+(+x.t||0),0));
  });
  // escolheu um produto conhecido na descrição: preenche marca, unidade, preço e código
  itens.addEventListener("change", e => {
    const inp = e.target; if (inp.dataset.f!=="d") return;
    const p = produtos().find(x=>rotulo(x)===inp.value); if (!p) return;
    lerCampos();
    const i = +inp.closest(".item").dataset.i, it = ed.itens[i];
    const ultimoAqui = p.hist.find(h=>h.mercado===ed.mercado) || p.ultimo;
    Object.assign(it, {d:p.d, m:p.m||"", u:p.u||"UN", p:ultimoAqui.p, c:p.c||""}); it.t=+(it.q*it.p).toFixed(2);
    renderEditor(); $("#q"+i)?.focus();
  });
  $$("[data-del]", itens).forEach(b=>b.onclick=()=>{ lerCampos(); ed.itens.splice(+b.dataset.del,1); renderEditor(); });
  $("#edAdd").onclick = ()=>{ lerCampos(); ed.itens.push({d:"",m:"",q:1,u:"UN",p:0,t:0}); renderEditor(); $("#d"+(ed.itens.length-1))?.focus(); };
  $("#edSalvar").onclick = salvar;
  const del=$("#edDel"); if(del) del.onclick=()=>{ lerCampos(); ed.confirmarExcluir=true; renderEditor(); };
  const sim=$("#edDelSim"); if(sim) sim.onclick=excluir;
  const nao=$("#edDelNao"); if(nao) nao.onclick=()=>{ ed.confirmarExcluir=false; renderEditor(); };
  const ad=$("#abrirDup"); if(ad) ad.onclick=()=>{ const d=compras.find(c=>c.chave===ed.chave && c.id!==ed.id); fecharEditor(); if(d) abrirEditor(d); };
}
function setFotos(files) {
  lerCampos();
  ed.fotos.forEach(f=>URL.revokeObjectURL(f.url));
  ed.fotos = [...files].slice(0,4).map(f=>({file:f,url:URL.createObjectURL(f)}));
  ed.procurandoQR = true; ed.qrTentado = false; renderEditor();
  const alvo = ed;
  (async () => {
    for (const f of alvo.fotos) {
      const data = await lerQR(f.file).catch(()=>null);
      let txt = data; try { txt = decodeURIComponent(data); } catch(e){}
      const info = data && lerChave(txt);
      if (info) { aplicarChave(info, /^https?:\/\//i.test(data) ? data : ""); break; }
    }
    if (ed === alvo) { ed.procurandoQR = false; ed.qrTentado = true; renderEditor(); }
  })();
}
function aplicarChave(info, url) {
  if (!ed) return;
  lerCampos();
  ed.chave = info.chave; ed.cnpj = info.cnpj; if (url) ed.qrUrl = url;
  if (UFS.includes(info.uf)) ed.estado = info.uf;
  if (ed.novo && ed.data===today()) { /* mantém a data de hoje; a chave só traz ano e mês */ }
  const conhecido = compras.find(c=>c.cnpj===info.cnpj && c.mercado);
  if (conhecido) { ed.mercado = conhecido.mercado; if (conhecido.cidade) ed.cidade = conhecido.cidade; ed.mercadoPorCnpj = true; }
}

/* o cupom lista o mesmo produto em várias linhas (ex.: 4 iogurtes): vira um item só com a quantidade somada */
function juntarRepetidos(itens) {
  const out = [], idx = new Map();
  for (const i of itens) {
    const id = (eanValido(i.c) ? i.c : norm(i.d)+"|"+norm(i.m)) + "|" + i.p + "|" + i.u;
    const ja = idx.get(id);
    if (ja) { ja.q = +(ja.q+i.q).toFixed(3); ja.t = +(ja.t+i.t).toFixed(2); }
    else { const n = {...i}; idx.set(id,n); out.push(n); }
  }
  return out;
}

async function salvar() {
  lerCampos();
  const limpos = ed.itens.filter(i=>String(i.d).trim()).map(i=>{ const o={d:String(i.d).trim(),m:String(i.m||"").trim(),q:+i.q||0,u:String(i.u||"UN").toUpperCase(),p:+i.p||0,t:+i.t||0}; if (i.c) o.c=String(i.c); return o; });
  const itens = juntarRepetidos(limpos);
  const erro = m => { ed.msg = m; renderEditor(); ed.msg=""; };
  if (!itens.length) return erro("Adicione pelo menos um item antes de salvar.");
  if (!ed.mercado) return erro("Informe o supermercado.");
  const row = { data:ed.data, mercado:ed.mercado, cidade:ed.cidade, estado:ed.estado, itens, total:+itens.reduce((s,i)=>s+i.t,0).toFixed(2),
                chave:ed.chave||null, cnpj:ed.cnpj||null, qr_url:ed.qrUrl||null, atualizado_em:new Date().toISOString() };
  const btn = $("#edSalvar"); btn.disabled = true; btn.textContent = "Salvando…";
  const novo = ed.novo || ed.exemplo;
  const q = novo ? sb.from("compras").insert(row).select().single() : sb.from("compras").update(row).eq("id", ed.id).select().single();
  const { data, error } = await q;
  if (error) {
    btn.disabled=false; btn.textContent="Salvar nota";
    return erro(error.code==="23505" ? "Esta nota já está salva (mesma chave de acesso)." : "Não consegui salvar. Verifique a conexão e tente de novo.");
  }
  const c = rowParaCompra(data);
  compras = compras.filter(x=>x.id!==c.id).concat([c]); usandoExemplo = compras.length===0;
  fecharEditor(); tab="compras"; render(); toast("Nota salva");
}
async function excluir() {
  const { error } = await sb.from("compras").delete().eq("id", ed.id);
  if (error) { ed.confirmarExcluir=false; ed.msg="Não consegui excluir. Tente de novo."; renderEditor(); ed.msg=""; return; }
  compras = compras.filter(c=>c.id!==ed.id); usandoExemplo = compras.length===0;
  fecharEditor(); render(); toast("Nota excluída");
}

/* ===================== conta, casa e instalação ===================== */
let promptInstalar = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); promptInstalar = e; });
const ehIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalado = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function abrirConta() {
  abrirSheet();
  const nome = user.user_metadata?.full_name || user.email;
  let h = `<div class="wrap"><header><h2>Conta</h2><button class="btn ghost" type="button" id="cFechar">Fechar</button></header>
  <div class="card"><h3>${esc(nome)}</h3><span class="b" style="font-size:13px">${esc(user.email||"")}</span></div>`;
  if (casa) h += `<div class="card"><h3>Casa: ${esc(casa.nome)}</h3>
    <span class="b" style="font-size:13px">A lista de compras é da casa: todos que entram nela veem e editam a mesma lista. As notas e os gastos continuam só seus. ${casa.membros} pessoa${casa.membros===1?"":"s"} na casa.</span>
    <span class="b">Código para convidar</span>
    <div class="row"><span class="codigo" id="codigo">${esc(casa.codigo)}</span><button class="btn ghost" type="button" id="copiar">Copiar</button></div>
    <span class="b" style="font-size:13px">A outra pessoa entra no Mercadim com a conta Google dela, abre Conta e digita este código.</span></div>
    <div class="card"><h3>Entrar na casa de outra pessoa</h3>
    <div class="row"><input class="inp mono" id="codigoNovo" maxlength="6" placeholder="Código" autocapitalize="characters" style="flex:1;text-transform:uppercase"><button class="btn" type="button" id="entrarCasa">Entrar</button></div>
    <span class="b" id="casaMsg"></span></div>`;
  if (!instalado()) h += `<div class="card"><h3>Instalar o app</h3>${promptInstalar?`<button class="btn" type="button" id="instalar">Instalar o Mercadim</button>`:ehIOS?`<span style="font-size:14px">No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</span>`:`<span style="font-size:14px">No menu do navegador, escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</span>`}</div>`;
  h += `<div class="actions"><button class="btn danger" type="button" id="sair">Sair da conta</button></div></div>`;
  $("#sheet").innerHTML = h;
  $("#cFechar").onclick = fecharSheet;
  $("#sair").onclick = async () => { await sb.auth.signOut(); location.reload(); };
  const inst = $("#instalar"); if (inst) inst.onclick = async () => { promptInstalar.prompt(); await promptInstalar.userChoice.catch(()=>{}); promptInstalar=null; abrirConta(); };
  const cp = $("#copiar"); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(casa.codigo); toast("Código copiado"); } catch(e){ const r=document.createRange(); r.selectNodeContents($("#codigo")); const s=getSelection(); s.removeAllRanges(); s.addRange(r); } };
  const ec = $("#entrarCasa"); if (ec) ec.onclick = async () => {
    const cod = $("#codigoNovo").value.trim().toUpperCase(); const msg = $("#casaMsg");
    if (cod.length < 6) { msg.textContent = "O código tem 6 caracteres."; return; }
    if (cod === casa.codigo) { msg.textContent = "Você já está nesta casa."; return; }
    ec.disabled = true; msg.textContent = "Entrando…";
    const { data, error } = await sb.rpc("entrar_na_casa", { p_codigo: cod });
    ec.disabled = false;
    if (error) { msg.textContent = /nao_encontrada/.test(error.message) ? "Código não encontrado. Confira com quem te convidou." : "Não consegui entrar. Tente de novo."; return; }
    await definirCasa(Array.isArray(data)?data[0]:data); abrirConta(); toast("Você entrou na casa "+casa.nome);
  };
}

/* ===================== dados (Supabase) ===================== */
const rowParaCompra = r => ({ id:r.id, data:r.data, mercado:r.mercado, cidade:r.cidade||"", estado:r.estado||"", chave:r.chave||null, cnpj:r.cnpj||null, qrUrl:r.qr_url||null, itens:Array.isArray(r.itens)?r.itens:[] });
async function carregarCompras() {
  $("#sync").textContent = "Atualizando…";
  const { data, error } = await sb.from("compras").select("*").order("data", {ascending:false});
  if (error) { $("#sync").textContent = "Sem conexão"; carregado = true; render(); return; }
  compras = data.map(rowParaCompra); usandoExemplo = compras.length===0; carregado = true;
  $("#sync").textContent = "Notas de mercado"; render();
}
async function definirCasa(c) {
  if (!c) return;
  const { count } = await sb.from("casa_membros").select("*", {count:"exact", head:true}).eq("casa_id", c.id);
  casa = { id:c.id, nome:c.nome, codigo:c.codigo, membros: count || 1 };
  if (canalLista) sb.removeChannel(canalLista);
  canalLista = sb.channel("lista-"+casa.id)
    .on("postgres_changes", { event:"*", schema:"public", table:"lista_itens", filter:"casa_id=eq."+casa.id }, () => carregarLista())
    .on("postgres_changes", { event:"DELETE", schema:"public", table:"lista_itens" }, () => carregarLista())
    .subscribe();
  await carregarLista();
}
async function iniciarApp() {
  $("#telaLogin").hidden = true; $("#app").hidden = false;
  const foto = user.user_metadata?.avatar_url, nome = user.user_metadata?.full_name || user.email || "?";
  $("#btnConta").innerHTML = foto ? `<img src="${esc(foto)}" alt="" referrerpolicy="no-referrer">` : esc(nome.trim()[0].toUpperCase());
  render();
  await carregarCompras();
  const { data, error } = await sb.rpc("minha_casa");
  if (!error) await definirCasa(Array.isArray(data)?data[0]:data);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { carregarCompras(); carregarLista(); } });
}

$("#btnNova").onclick = () => abrirEditor(null);
$("#btnConta").onclick = () => abrirConta();
try { const t=localStorage.getItem("mercadim-tab"); if (["compras","lista","produtos","mercados","financeiro"].includes(t)) tab=t; } catch(e){}

(async () => {
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || !window.supabase) { $("#telaConfig").hidden = false; return; }
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
  $("#btnGoogle").onclick = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider:"google", options:{ redirectTo: location.origin + "/" } });
    if (error) { const e=$("#loginErro"); e.textContent = "Não consegui abrir o login do Google. Tente de novo."; e.hidden=false; }
  };
  const { data: { session } } = await sb.auth.getSession();
  if (session) { user = session.user; iniciarApp(); }
  else $("#telaLogin").hidden = false;
  sb.auth.onAuthStateChange((evento, s) => {
    if (evento === "SIGNED_IN" && s && !user) { user = s.user; iniciarApp(); }
  });
})();

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(()=>{}));
})();
