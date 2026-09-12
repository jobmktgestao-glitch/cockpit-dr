import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from "recharts";

/* ============ TOKENS ============ */
const C = {
  bg: "#141213", card: "#1F1D1E", cardSoft: "#2A2728", border: "#3A3637",
  text: "#E9E9E9", dim: "#9A9496", faint: "#6B6567",
  income: "#2DD4A7", expense: "#F0616D", accent: "#FF5A1F", blue: "#5B9CF5",
};
const FAINT = C.faint;
const fmt = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmt2 = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, ...style }}>
    {children}
  </div>
);
const KpiBox = ({ label, value, sub, color }) => (
  <Card style={{ flex: 1, minWidth: 150 }}>
    <div style={{ color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
    <div style={{ color: color || C.text, fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
    {sub && <div style={{ color: FAINT, fontSize: 11, marginTop: 2 }}>{sub}</div>}
  </Card>
);
const inputSt = { background: C.cardSoft, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 10px", fontSize: 13, colorScheme: "dark", outline: "none" };
const chip = (active, col) => ({
  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
  border: `1px solid ${active ? col : C.border}`,
  background: active ? "rgba(255,255,255,0.06)" : C.card,
  color: active ? col : C.dim, cursor: "pointer",
});

const STATUS = {
  conf: { label: "Confirmado", short: "C", color: C.income },
  aconf: { label: "A confirmar", short: "AC", color: C.accent },
  prov: { label: "Provisão", short: "P", color: C.blue },
};
const NEXT_ST = { conf: "aconf", aconf: "prov", prov: "conf" };
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/* ============ MOTOR ============ */
const HOJE = new Date();
const START = new Date(HOJE.getFullYear(), HOJE.getMonth(), 1);
const END = new Date(HOJE.getFullYear(), HOJE.getMonth() + 12, 0);
const MIDX = (d) => d.getFullYear() * 12 + d.getMonth();
const MLIST = Array.from({ length: 12 }, (_, i) => MIDX(START) + i);
const mDate = (mi, d) => new Date(Math.floor(mi / 12), mi % 12, d || 1);
const mLast = (mi) => new Date(Math.floor(mi / 12), (mi % 12) + 1, 0).getDate();

const mLabel = (mi) => MESES[mi % 12] + "/" + String(Math.floor(mi / 12)).slice(-2);
const iso0 = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ISO_START = iso0(START);
const ISO_END = iso0(END);
const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dKey = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
function fifthBusinessDay(y, m) {
  let c = 0;
  for (let d = 1; d <= 28; d++) {
    const wd = new Date(y, m, d).getDay();
    if (wd !== 0 && wd !== 6) { c++; if (c === 5) return d; }
  }
  return 5;
}
function mondayOf(d) { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const pdate = (v) => { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); };

const CAT_DEF = {
  out: ["Ferramentas", "Fornecedor", "Equipe", "Marketing", "Impostos", "Repasse Job", "Escritório", "Eventos", "Diversos"],
  in: ["Escalada no Digital", "Plano 45", "Consultoria e Mentoria", "Trade Marketing", "IA para Executivos", "Palestras/Workshops", "Outros"],
};
const DEF_ST = { Vendas: "prov", Eventuais: "aconf" };

function buildEvents(extras) {
  const ev = [];
  const push = (date, serie, amount, type, cat, grp) => {
    if (date < START || date > END) return;
    ev.push({ id: `${serie}__${iso(date)}`, date, name: serie, serie, amount, type, cat, grp: grp || cat });
  };
  (extras || []).forEach((x) => {
    const [yy, mm, dd] = x.date.split("-").map(Number);
    const base = new Date(yy, mm - 1, dd);
    const freq = x.freq || "once";
    const n = Number(x.vezes) || 0;
    const nome = x.name;
    const mc = x.cat || (x.type === "in" ? "Outros" : "Diversos");
    if (freq === "once") push(base, nome, Number(x.amount), x.type, mc, "Manual");
    else if (freq === "mensal") {
      const d0 = new Date(yy, mm - 1, 1); let c = 0;
      while (d0 <= END && (!n || c < n)) {
        const ld = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
        push(new Date(d0.getFullYear(), d0.getMonth(), Math.min(dd, ld)), nome, Number(x.amount), x.type, mc, "Manual");
        d0.setMonth(d0.getMonth() + 1, 1); c++;
      }
    } else if (freq === "semanal") {
      const d2 = new Date(base); let c = 0;
      while (d2 <= END && (!n || c < n)) { push(new Date(d2), nome, Number(x.amount), x.type, mc, "Manual"); d2.setDate(d2.getDate() + 7); c++; }
    }
  });
  ev.sort((a, b) => a.date - b.date || (a.type === "in" ? -1 : 1));
  return ev;
}

/* ============ APP ============ */
export default function Cockpit({ supabase, session, onLogout }) {
  const [tab, setTab] = useState("saude");
  const [loaded, setLoaded] = useState(false);

  const [banks, setBanks] = useState([{ id: "b1", nome: "Conta principal", saldo: 12000 }]);
  const [extras, setExtras] = useState([]);
  const [stItem, setStItem] = useState({});
  const [stSerie, setStSerie] = useState({});
  const [settle, setSettle] = useState({});
  const [scenClasses, setScenClasses] = useState({ conf: true, aconf: true, prov: true });

  const [expanded, setExpanded] = useState({});
  const [mesFiltro, setMesFiltro] = useState(MIDX(START));
  const [gran, setGran] = useState("mes");
  const [mesFiltro2, setMesFiltro2] = useState(-1);
  const [mesFiltro3, setMesFiltro3] = useState(-1);
  const [scenChartMode, setScenChartMode] = useState("mes");
  const [scenDe, setScenDe] = useState(ISO_START);
  const [scenAte, setScenAte] = useState(ISO_END);
  const [movMes, setMovMes] = useState(MIDX(START));
  const [movTipo, setMovTipo] = useState("todos");
  const [movStatus, setMovStatus] = useState("pend");
  const [movModo, setMovModo] = useState("mes");
  const [movBusca, setMovBusca] = useState("");
  const [movDe, setMovDe] = useState(ISO_START);
  const [movAte, setMovAte] = useState(ISO_END);
  const [movSt, setMovSt] = useState({ conf: true, aconf: true, prov: true });
  const [movCat, setMovCat] = useState("todas");
  const [ovr, setOvr] = useState({});
  const [cats, setCats] = useState(CAT_DEF);
  const [catSerie, setCatSerie] = useState({});
  const [novaCat, setNovaCat] = useState({ nome: "", tipo: "out" });
  const [saudeDe, setSaudeDe] = useState(ISO_START);
  const [saudeAte, setSaudeAte] = useState(ISO_END);
  const [fluxoModo, setFluxoModo] = useState("mes");
  const [fluxoDe, setFluxoDe] = useState(ISO_START);
  const [fluxoAte, setFluxoAte] = useState(ISO_END);
  const [editOpen, setEditOpen] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", amount: "", date: "", cat: "" });
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 700);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const [baixaOpen, setBaixaOpen] = useState(null);
  const [baixaForm, setBaixaForm] = useState({ bankId: "", valor: "", data: "" });
  const [novoBanco, setNovoBanco] = useState({ nome: "", saldo: "" });
  const [form, setForm] = useState({ name: "", amount: "", date: iso(HOJE), type: "out", freq: "once", vezes: "", cat: "Diversos" });
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  /* persistência */
  useEffect(() => {
    (async () => {
      try {
        const { data: row } = await supabase.from("dr_state").select("data").eq("user_id", session.user.id).maybeSingle();
        const s = row?.data;
        if (s && Object.keys(s).length) {
          if (Array.isArray(s.banks) && s.banks.length) setBanks(s.banks);
          else if (s.saldoInicial != null) setBanks([{ id: "b1", nome: "Conta principal", saldo: s.saldoInicial }]);
          if (s.extras) setExtras(s.extras);
          if (s.stItem) setStItem(s.stItem);
          if (s.stSerie) setStSerie(s.stSerie);
          else if (s.scenStatus) setStSerie(s.scenStatus);
          if (s.settle) setSettle(s.settle);
          if (s.ovr) setOvr(s.ovr);
          if (s.cats && s.cats.out && s.cats.in) setCats(s.cats);
          if (s.catSerie) setCatSerie(s.catSerie);
          if (s.scenClasses) setScenClasses(s.scenClasses);
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => {
      try {
        await supabase.from("dr_state").upsert({
          user_id: session.user.id,
          data: { banks, extras, stItem, stSerie, settle, ovr, cats, catSerie, scenClasses },
          updated_at: new Date().toISOString(),
        });
      } catch (e) {}
    }, 700);
    return () => clearTimeout(t);
  }, [banks, extras, stItem, stSerie, settle, ovr, cats, catSerie, scenClasses, loaded]);

  /* ===== DERIVADOS ===== */
  const rawEvents = useMemo(() => buildEvents(extras), [extras]);
  const events = useMemo(() => rawEvents
    .filter((e) => !ovr[e.id]?.deleted)
    .map((e) => {
      const o = ovr[e.id];
      if (!o) return e;
      let date = e.date;
      if (o.date) { const [y, m, d] = o.date.split("-").map(Number); date = new Date(y, m - 1, d); }
      return { ...e, name: o.name != null ? o.name : e.name, amount: o.amount != null ? Number(o.amount) : e.amount, date, editado: true };
    })
    .sort((a, b) => a.date - b.date || (a.type === "in" ? -1 : 1)), [rawEvents, ovr]);
  const nExcluidos = Object.values(ovr).filter((o) => o.deleted).length;
  const stOf = (e) => stItem[e.id] || stSerie[e.serie] || DEF_ST[e.grp] || "conf";
  const catOf = (e) => (ovr[e.id] && ovr[e.id].cat) || catSerie[e.serie] || e.cat;
  const isPaid = (e) => !!settle[e.id];
  const valOf = (e) => (settle[e.id] ? Number(settle[e.id].valor) : e.amount);
  const counts = (e) => isPaid(e) || scenClasses[stOf(e)];

  const saldoBase = banks.reduce((s, b) => s + Number(b.saldo || 0), 0);

  const realizado = useMemo(() => {
    let t = saldoBase;
    events.forEach((e) => { if (isPaid(e)) t += e.type === "in" ? valOf(e) : -valOf(e); });
    return t;
  }, [events, settle, banks]);

  const saldoPorBanco = useMemo(() => {
    const m = {};
    banks.forEach((b) => (m[b.id] = Number(b.saldo || 0)));
    events.forEach((e) => {
      const s = settle[e.id];
      if (!s) return;
      if (m[s.bankId] == null) return;
      m[s.bankId] += e.type === "in" ? Number(s.valor) : -Number(s.valor);
    });
    return m;
  }, [events, settle, banks]);

  const daily = useMemo(() => {
    let saldo = saldoBase;
    const rows = []; let cur = null;
    events.forEach((e) => {
      if (!counts(e)) return;
      const k = dKey(e.date);
      if (!cur || cur.key !== k) { cur = { key: k, date: e.date, items: [], inSum: 0, outSum: 0, saldo: 0 }; rows.push(cur); }
      cur.items.push(e);
      const v = valOf(e);
      if (e.type === "in") cur.inSum += v; else cur.outSum += v;
    });
    rows.forEach((r) => { saldo += r.inSum - r.outSum; r.saldo = saldo; });
    return rows;
  }, [events, banks, settle, stItem, stSerie, scenClasses]);

  const fIni = () => (fluxoModo === "mes" ? mDate(mesFiltro, 1) : pdate(fluxoDe));
  const fFim = () => (fluxoModo === "mes" ? mDate(mesFiltro, mLast(mesFiltro)) : pdate(fluxoAte));

  const flat = useMemo(() => {
    let saldo = saldoBase; const out = [];
    events.forEach((e) => {
      if (!counts(e)) return;
      const v = valOf(e);
      saldo += e.type === "in" ? v : -v;
      out.push({ e, rec: e.type === "in" ? v : 0, desp: e.type === "out" ? v : 0, saldo });
    });
    return out;
  }, [events, banks, settle, stItem, stSerie, scenClasses]);

  const weekly = useMemo(() => {
    const map = new Map();
    daily.forEach((r) => {
      const k = dKey(mondayOf(r.date));
      if (!map.has(k)) map.set(k, { key: k, dt: mondayOf(r.date), inSum: 0, outSum: 0, saldo: 0 });
      const w = map.get(k); w.inSum += r.inSum; w.outSum += r.outSum; w.saldo = r.saldo;
    });
    return [...map.values()];
  }, [daily]);

  const monthly = useMemo(() => {
    const map = new Map();
    daily.forEach((r) => {
      const k = MIDX(r.date);
      if (!map.has(k)) map.set(k, { m: k, nome: mLabel(k), inSum: 0, outSum: 0, saldo: 0 });
      const w = map.get(k); w.inSum += r.inSum; w.outSum += r.outSum; w.saldo = r.saldo;
    });
    return [...map.values()];
  }, [daily]);

  const kpi = useMemo(() => {
    let min = { saldo: Infinity, key: "" };
    daily.forEach((r) => { if (r.saldo < min.saldo) min = { saldo: r.saldo, key: r.key }; });
    const fim = daily.length ? daily[daily.length - 1].saldo : saldoBase;
    const ms = monthly;
    const mediaRes = ms.length ? ms.reduce((s, m) => s + m.inSum - m.outSum, 0) / ms.length : 0;
    const negDays = daily.filter((r) => r.saldo < 0).length;
    const aReceber = events.filter((e) => !isPaid(e) && e.type === "in" && counts(e)).reduce((s, e) => s + e.amount, 0);
    const aPagar = events.filter((e) => !isPaid(e) && e.type === "out" && counts(e)).reduce((s, e) => s + e.amount, 0);
    return { min, fim, mediaRes, negDays, aReceber, aPagar };
  }, [daily, monthly, events, settle, scenClasses, stItem, stSerie]);

  const kpiPer = useMemo(() => {
    const de = pdate(saudeDe), ate = pdate(saudeAte);
    const rows = daily.filter((r) => r.date >= de && r.date <= ate);
    let min = { saldo: Infinity, key: "—" };
    rows.forEach((r) => { if (r.saldo < min.saldo) min = { saldo: r.saldo, key: r.key }; });
    if (!rows.length) min = { saldo: saldoBase, key: "—" };
    const fim = rows.length ? rows[rows.length - 1].saldo : saldoBase;
    const inPer = (e) => e.date >= de && e.date <= ate;
    const aReceber = events.filter((e) => !isPaid(e) && e.type === "in" && counts(e) && inPer(e)).reduce((t, e) => t + e.amount, 0);
    const aPagar = events.filter((e) => !isPaid(e) && e.type === "out" && counts(e) && inPer(e)).reduce((t, e) => t + e.amount, 0);
    const rec = rows.reduce((t, r) => t + r.inSum, 0), desp = rows.reduce((t, r) => t + r.outSum, 0);
    const ini = rows.length ? rows[0].saldo - (rows[0].inSum - rows[0].outSum) : saldoBase;
    return { min, fim, ini, aReceber, aPagar, rec, desp, rows };
  }, [daily, events, saudeDe, saudeAte, settle, scenClasses, stItem, stSerie, banks]);
  const chartSaldo = kpiPer.rows.map((r) => ({ d: r.key, saldo: Math.round(r.saldo) }));
  const chartMes = monthly.map((m) => ({ nome: m.nome, Receitas: Math.round(m.inSum), Despesas: Math.round(m.outSum) }));

  /* ===== AÇÕES ===== */
  const cycleStatus = (e) => setStItem({ ...stItem, [e.id]: NEXT_ST[stOf(e)] });
  const setSerieStatus = (serie, st) => setStSerie({ ...stSerie, [serie]: st });
  const abrirBaixa = (e) => {
    setBaixaOpen(e.id);
    setBaixaForm({ bankId: banks[0]?.id || "", valor: String(e.amount.toFixed(2)), data: iso(e.date) });
  };
  const confirmarBaixa = (e) => {
    if (!baixaForm.bankId) return;
    setSettle({ ...settle, [e.id]: { bankId: baixaForm.bankId, valor: Number(baixaForm.valor) || e.amount, data: baixaForm.data } });
    setBaixaOpen(null);
  };
  const estornar = (e) => { const s = { ...settle }; delete s[e.id]; setSettle(s); };
  const addBanco = () => {
    if (!novoBanco.nome) return;
    setBanks([...banks, { id: "b" + Date.now(), nome: novoBanco.nome, saldo: Number(novoBanco.saldo) || 0 }]);
    setNovoBanco({ nome: "", saldo: "" });
  };
  const addExtra = () => {
    if (!form.name || !form.amount) return;
    setExtras([...extras, { ...form, id: Date.now() }]);
    setForm({ name: "", amount: "", date: form.date, type: form.type, freq: "once", vezes: "", cat: form.cat });
  };

  const sendChat = async () => {
    const q = chatInput.trim();
    if (!q || chatBusy) return;
    const hist = [...chat, { role: "user", content: q }];
    setChat(hist); setChatInput(""); setChatBusy(true);
    try {
      const ctx = {
        hoje: "21/07/2026", bancos: banks.map((b) => ({ nome: b.nome, saldoAtual: Math.round(saldoPorBanco[b.id] || 0) })),
        saldoRealizado: Math.round(realizado), aReceber: Math.round(kpi.aReceber), aPagar: Math.round(kpi.aPagar),
        lancamentosManuais: extras,
        resumoMensal: monthly.map((m) => ({ mes: m.nome, receitas: Math.round(m.inSum), despesas: Math.round(m.outSum), saldoFim: Math.round(m.saldo) })),
        kpis: { saldoFinal31dez: Math.round(kpi.fim), menorSaldo: Math.round(kpi.min.saldo), dataMenorSaldo: kpi.min.key, margemMediaNovDez: Math.round(kpi.margemNovDez) },
      };
      const instr =
        "Você é o copiloto financeiro da DR Marketing (consultoria e aceleração de vendas, Recife — sociedade de Demian Paes Barreto e Rodrigo Castro) dentro do Cockpit Financeiro DR. " +
        "Responda em português do Brasil, curto e prático. Contexto atual: " + JSON.stringify(ctx) + ". " +
        "Produtos da DR: Escalada no Digital, Plano 45, Consultoria e Mentoria, Trade Marketing, IA para Executivos, Palestras/Workshops. " +
        "Nunca informe preços de produtos nem cite casos de clientes. " +
        "Se pedirem ALTERAÇÃO, responda SOMENTE JSON puro: {\"reply\":\"...\",\"actions\":[...]}. Ações: " +
        '{"type":"add_extra","name":"...","amount":123,"date":"YYYY-MM-DD","kind":"in|out","freq":"once|mensal|semanal","vezes":0,"cat":"categoria"} | ' +
        '{"type":"remove_extra","name":"parte do nome"} | {"type":"add_bank","name":"...","saldo":0}. ' +
        "Datas permitidas entre " + ISO_START + " e " + ISO_END + ". " +
        "Para VÁRIOS lançamentos de uma vez, devolva TODAS as ações no mesmo array actions e mantenha reply curto (uma linha). " +
        "Dúvida ou análise: responda texto normal. Nunca invente números fora do contexto.";
      const apiMessages = hist.map((m, i) => (i === hist.length - 1 ? { role: m.role, content: instr + "\n\nMensagem do Demian: " + m.content } : m));
      const res = await fetch("/.netlify/functions/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = await res.json();
      const text = (data.text || "").trim();
      let reply = text || "Sem resposta.";
      const clean = text.replace(/```json|```/g, "").trim();
      let parsed = null;
      try { if (clean.startsWith("{")) parsed = JSON.parse(clean); } catch (e) {}
      if (!parsed && clean.includes('"type"')) {
        const acts = [];
        const re = /\{[^{}]*"type"\s*:\s*"(?:add_extra|remove_extra|set_eupet|add_bank)"[^{}]*\}/g;
        let m;
        while ((m = re.exec(clean))) { try { acts.push(JSON.parse(m[0])); } catch (e) {} }
        if (acts.length) {
          const rm = clean.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          parsed = { reply: rm ? rm[1].replace(/\\"/g, '"').replace(/\\n/g, "\n") : null, actions: acts };
        }
      }
      try {
        if (parsed) {
          const nAct = (parsed.actions || []).length;
          reply = parsed.reply || (nAct ? `✓ ${nAct} alteração(ões) aplicada(s).` : reply);
          (parsed.actions || []).forEach((a) => {
            if (a.type === "add_extra" && a.name && a.amount && a.date)
              setExtras((prev) => [...prev, { name: a.name, amount: Number(a.amount), date: a.date, type: a.kind === "in" ? "in" : "out", freq: ["mensal", "semanal"].includes(a.freq) ? a.freq : "once", vezes: Number(a.vezes) || "", cat: a.cat || (a.kind === "in" ? "Outros" : "Diversos"), id: Date.now() + Math.random() }]);
            if (a.type === "remove_extra" && a.name)
              setExtras((prev) => prev.filter((x) => !x.name.toLowerCase().includes(String(a.name).toLowerCase())));
            if (a.type === "add_bank" && a.name)
              setBanks((prev) => [...prev, { id: "b" + Date.now(), nome: a.name, saldo: Number(a.saldo) || 0 }]);
          });
        }
      } catch (e) {}
      setChat([...hist, { role: "assistant", content: reply }]);
    } catch (e) {
      setChat([...hist, { role: "assistant", content: "⚠ Não consegui conectar agora." }]);
    }
    setChatBusy(false);
  };

  const tooltipStyle = { background: C.cardSoft, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12 };
  const tabs = [["saude", "Saúde"], ["mov", "Movimentações"], ["bancos", "Bancos"], ["diario", "Diário"], ["semanal", "Semanal"], ["mensal", "Mensal"], ["receitas", "Receitas"], ["despesas", "Despesas"], ["cenarios", "Cenários"], ["cat", "Categorias"], ["lanc", "Config"]];

  /* linha de movimentação */
  const movRow = (e) => {
    const st = stOf(e), pago = isPaid(e), s = settle[e.id];
    const cor = e.type === "in" ? C.income : C.expense;
    const banco = pago ? banks.find((b) => b.id === s.bankId) : null;
    return (
      <div key={e.id} style={{ borderTop: `1px solid ${C.border}`, padding: "8px 0", opacity: pago ? 0.85 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ color: C.text, background: C.cardSoft, border: `1px solid ${C.border}`, borderRadius: 6, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{dKey(e.date)}</span>
          <span style={{ flex: 1, minWidth: 120, fontSize: 12.5, color: C.text }}>
            {e.name}
            {e.editado && <span style={{ color: C.accent, fontSize: 9, marginLeft: 4 }}>editado</span>}
            <span style={{ color: FAINT, fontSize: 10, marginLeft: 6 }}>{catOf(e)}</span>
            {pago && banco && <span style={{ color: C.blue, fontSize: 10, marginLeft: 6 }}>· {banco.nome}</span>}
          </span>
          {!pago ? (
            <select value={st} onChange={(ev) => setStItem({ ...stItem, [e.id]: ev.target.value })} title="Status do lançamento"
              style={{ ...inputSt, padding: "4px 6px", fontSize: 11, fontWeight: 700, borderColor: STATUS[st].color, color: STATUS[st].color }}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k} style={{ color: C.text }}>{v.label}</option>)}
            </select>
          ) : (
            <span style={{ background: "rgba(45,212,167,0.12)", border: `1px solid ${C.income}`, color: C.income, borderRadius: 7, padding: "3px 8px", fontSize: 10, fontWeight: 800 }}>✓ BAIXADO</span>
          )}
          <span style={{ color: cor, fontWeight: 700, fontSize: 13, minWidth: 86, textAlign: "right" }}>
            {e.type === "in" ? "+" : "−"}{fmt2(valOf(e))}
          </span>
          <div style={{ display: "flex", gap: 5 }}>
            {pago ? (
              <button onClick={() => estornar(e)} style={{ background: "none", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 7, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Estornar</button>
            ) : (
              <button onClick={() => abrirBaixa(e)} style={{ background: cor, border: "none", color: "#0E1420", borderRadius: 7, padding: "4px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                {e.type === "in" ? "Receber" : "Pagar"}
              </button>
            )}
            <button onClick={() => { setEditOpen(editOpen === e.id ? null : e.id); setEditForm({ name: e.name, amount: String(e.amount.toFixed(2)), date: iso(e.date), cat: catOf(e) }); }}
              title="Editar" style={{ background: "none", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 7, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✎</button>
            <button onClick={() => { if (confirm(`Excluir "${e.name}" de ${dKey(e.date)}?`)) { const o = { ...ovr }; o[e.id] = { ...(o[e.id] || {}), deleted: true }; setOvr(o); const s = { ...settle }; delete s[e.id]; setSettle(s); } }}
              title="Excluir" style={{ background: "none", border: `1px solid ${C.border}`, color: C.expense, borderRadius: 7, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>🗑</button>
          </div>
        </div>
        {editOpen === e.id && (
          <div style={{ marginTop: 8, background: C.cardSoft, borderRadius: 10, padding: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input value={editForm.name} onChange={(ev) => setEditForm({ ...editForm, name: ev.target.value })} placeholder="Descrição" style={{ ...inputSt, flex: 1, minWidth: 140 }} />
            <input type="number" step="0.01" value={editForm.amount} onChange={(ev) => setEditForm({ ...editForm, amount: ev.target.value })} style={{ ...inputSt, width: 110 }} />
            <input type="date" value={editForm.date} onChange={(ev) => setEditForm({ ...editForm, date: ev.target.value })} style={inputSt} />
            <select value={editForm.cat} onChange={(ev) => setEditForm({ ...editForm, cat: ev.target.value })} style={inputSt}>
              {(cats[e.type] || []).map((c) => <option key={c} value={c}>{c}</option>)}
              {!(cats[e.type] || []).includes(editForm.cat) && <option value={editForm.cat}>{editForm.cat}</option>}
            </select>
            <button onClick={() => { setOvr({ ...ovr, [e.id]: { ...(ovr[e.id] || {}), name: editForm.name, amount: Number(editForm.amount), date: editForm.date, cat: editForm.cat } }); setEditOpen(null); }}
              style={{ background: C.accent, border: "none", color: "#1A1205", borderRadius: 8, padding: "8px 16px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Salvar</button>
            {ovr[e.id] && (
              <button onClick={() => { const o = { ...ovr }; delete o[e.id]; setOvr(o); setEditOpen(null); }}
                style={{ background: "none", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>Restaurar original</button>
            )}
            <button onClick={() => setEditOpen(null)} style={{ background: "none", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
          </div>
        )}
        {baixaOpen === e.id && (
          <div style={{ marginTop: 8, background: C.cardSoft, borderRadius: 10, padding: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={baixaForm.bankId} onChange={(ev) => setBaixaForm({ ...baixaForm, bankId: ev.target.value })} style={inputSt}>
              {banks.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
            <input type="number" step="0.01" value={baixaForm.valor} onChange={(ev) => setBaixaForm({ ...baixaForm, valor: ev.target.value })} style={{ ...inputSt, width: 110 }} />
            <input type="date" value={baixaForm.data} onChange={(ev) => setBaixaForm({ ...baixaForm, data: ev.target.value })} style={inputSt} />
            <button onClick={() => confirmarBaixa(e)} style={{ background: C.income, border: "none", color: "#08201A", borderRadius: 8, padding: "8px 16px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Confirmar baixa</button>
            <button onClick={() => setBaixaOpen(null)} style={{ background: "none", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
          </div>
        )}
      </div>
    );
  };

  const NAV = [["saude", "Saúde", "💚"], ["mov", "Movim.", "🔁"], ["receitas", "Receitas", "📈"], ["despesas", "Despesas", "📉"], ["mensal", "Mensal", "📊"]];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "ui-sans-serif, system-ui, sans-serif", padding: isMobile ? 10 : 16, paddingBottom: isMobile ? 78 : 16 }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, margin: 0 }}>
              Cockpit <span style={{ color: C.accent }}>DR</span>
            </h1>
            <div style={{ color: C.dim, fontSize: 11 }}>DR Marketing · {mLabel(MLIST[0])} → {mLabel(MLIST[11])}</div>
          </div>
          <button onClick={onLogout} style={{ background: "none", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>Sair</button>
        </div>

        {isMobile ? (
          <select value={tab} onChange={(e) => setTab(e.target.value)}
            style={{ ...inputSt, width: "100%", marginBottom: 12, padding: "11px 10px", fontSize: 14, fontWeight: 700, borderColor: C.border, color: C.dim }}>
            {tabs.map(([k, l]) => <option key={k} value={k} style={{ color: C.text }}>{l}</option>)}
          </select>
        ) : (
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {tabs.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={chip(tab === k, C.accent)}>{l}</button>
            ))}
          </div>
        )}

        {/* ===== SAÚDE ===== */}
        {tab === "saude" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Card style={{ padding: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.dim }}>📅 Período</span>
              <label style={{ color: C.dim, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>De
                <input type="date" value={saudeDe} min={ISO_START} max={ISO_END} onChange={(e) => setSaudeDe(e.target.value)} style={inputSt} /></label>
              <label style={{ color: C.dim, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>Até
                <input type="date" value={saudeAte} min={ISO_START} max={ISO_END} onChange={(e) => setSaudeAte(e.target.value)} style={inputSt} /></label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => { setSaudeDe(ISO_START); setSaudeAte(ISO_END); }}
                  style={chip(saudeDe === ISO_START && saudeAte === ISO_END, C.dim)}>Tudo</button>
                {MLIST.map((m) => {
                  const d1 = iso(mDate(m, 1)), d2 = iso(mDate(m, mLast(m)));
                  return <button key={m} onClick={() => { setSaudeDe(d1); setSaudeAte(d2); }} style={chip(saudeDe === d1 && saudeAte === d2, C.blue)}>{mLabel(m)}</button>;
                })}
              </div>
            </Card>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <KpiBox label="Saldo realizado" value={fmt(realizado)} sub="bancos + baixas (total)" color={realizado >= 0 ? C.text : C.expense} />
              <KpiBox label="Saldo inicial do período" value={fmt(kpiPer.ini)} />
              <KpiBox label="A receber no período" value={fmt(kpiPer.aReceber)} color={C.income} />
              <KpiBox label="A pagar no período" value={fmt(kpiPer.aPagar)} color={C.expense} />
              <KpiBox label="Resultado do período" value={fmt(kpiPer.rec - kpiPer.desp)} sub={`${fmt(kpiPer.rec)} − ${fmt(kpiPer.desp)}`} color={kpiPer.rec - kpiPer.desp >= 0 ? C.income : C.expense} />
              <KpiBox label="Saldo ao fim do período" value={fmt(kpiPer.fim)} color={kpiPer.fim >= 0 ? C.accent : C.expense} />
              <KpiBox label="Menor saldo no período" value={fmt(kpiPer.min.saldo)} sub={`em ${kpiPer.min.key}`} color={kpiPer.min.saldo < 5000 ? C.expense : C.accent} />
              <KpiBox label="Resultado médio/mês" value={fmt(kpi.mediaRes)} sub="horizonte completo" color={kpi.mediaRes >= 0 ? C.income : C.expense} />
            </div>

            {(kpiPer.min.saldo < 0 || kpiPer.fim < 0) && (
              <Card style={{ borderColor: C.expense, background: "rgba(240,97,109,0.08)" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.expense, marginBottom: 6 }}>⚠ Déficit no período</div>
                <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>
                  O saldo fica negativo no período. Para não faltar caixa em nenhum dia, é preciso um reforço de{" "}
                  <b style={{ color: C.expense, fontSize: 16 }}>{fmt2(Math.max(0, -kpiPer.min.saldo))}</b>
                  {kpiPer.min.key !== "—" && <> até <b style={{ color: C.text }}>{kpiPer.min.key}</b></>}.
                  {kpiPer.fim < 0 && <> Para fechar o período no zero, o reforço precisa ser de <b style={{ color: C.expense }}>{fmt2(-kpiPer.fim)}</b>.</>}
                </div>
              </Card>
            )}

            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Saldo por banco</div>
              {banks.map((b) => (
                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", borderTop: `1px solid ${C.border}` }}>
                  <span style={{ color: C.dim }}>{b.nome}</span>
                  <b style={{ color: (saldoPorBanco[b.id] || 0) < 0 ? C.expense : C.text }}>{fmt2(saldoPorBanco[b.id] || 0)}</b>
                </div>
              ))}
            </Card>

            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Pulso do caixa — saldo dia a dia</div>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <AreaChart data={chartSaldo}>
                    <defs>
                      <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.accent} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                    <XAxis dataKey="d" tick={{ fill: FAINT, fontSize: 10 }} interval={14} />
                    <YAxis tick={{ fill: FAINT, fontSize: 10 }} width={52} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                    <ReferenceLine y={0} stroke={C.expense} strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="saldo" stroke={C.accent} strokeWidth={2} fill="url(#gS)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Diagnóstico gerencial</div>
              {(() => {
                const porCat = {};
                events.filter((e) => e.type === "out" && counts(e) && e.date >= pdate(saudeDe) && e.date <= pdate(saudeAte))
                  .forEach((e) => { const c = catOf(e); porCat[c] = (porCat[c] || 0) + valOf(e); });
                const top = Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
                const neg = monthly.filter((m) => m.inSum - m.outSum < 0);
                const res = kpiPer.rec - kpiPer.desp;
                const margem = kpiPer.rec ? (res / kpiPer.rec) * 100 : 0;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: C.dim, lineHeight: 1.5 }}>
                    {events.length === 0 && (
                      <div><span style={{ color: C.accent, fontWeight: 700 }}>▸ Comece por aqui.</span> Cadastre os bancos em <b style={{ color: C.text }}>Bancos</b> e lance receitas e despesas em <b style={{ color: C.text }}>Config</b> — ou peça ao Claude no chat.</div>
                    )}
                    {events.length > 0 && (
                      <div><span style={{ color: res >= 0 ? C.income : C.expense, fontWeight: 700 }}>{res >= 0 ? "✓" : "✕"} Margem do período: {margem.toFixed(0)}%.</span> Resultado de {fmt(res)} sobre {fmt(kpiPer.rec)} de receita.</div>
                    )}
                    {top.length > 0 && (
                      <div><span style={{ color: C.blue, fontWeight: 700 }}>◎ Maiores despesas:</span> {top.map(([c, v]) => `${c} (${fmt(v)})`).join(" · ")}.</div>
                    )}
                    {neg.length > 0 && (
                      <div><span style={{ color: C.expense, fontWeight: 700 }}>⚠ {neg.length} mês(es) com resultado negativo:</span> {neg.map((m) => m.nome).join(", ")}.</div>
                    )}
                    {kpi.negDays > 0 && <div style={{ color: C.expense, fontWeight: 700 }}>✕ {kpi.negDays} dia(s) com saldo projetado negativo — veja a aba Diário.</div>}
                  </div>
                );
              })()}
            </Card>
          </div>
        )}

        {/* ===== MOVIMENTAÇÕES ===== */}
        {tab === "mov" && (() => {
          const pd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
          const lista = events.filter((e) => {
            if (movModo === "mes") { if (MIDX(e.date) !== movMes) return false; }
            else { if (e.date < pd(movDe) || e.date > pd(movAte)) return false; }
            if (movTipo !== "todos" && e.type !== movTipo) return false;
            if (movStatus === "pend" && isPaid(e)) return false;
            if (movStatus === "pago" && !isPaid(e)) return false;
            if (!isPaid(e) && !movSt[stOf(e)]) return false;
            if (movCat !== "todas" && catOf(e) !== movCat) return false;
            if (movBusca.trim()) {
              const q = movBusca.trim().toLowerCase();
              if (!(e.name.toLowerCase().includes(q) || catOf(e).toLowerCase().includes(q))) return false;
            }
            return true;
          });
          const tIn = lista.filter((e) => e.type === "in").reduce((s, e) => s + valOf(e), 0);
          const tOut = lista.filter((e) => e.type === "out").reduce((s, e) => s + valOf(e), 0);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Card style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.dim }}>🔎 Filtros</div>
                <input placeholder="Buscar por descrição ou categoria…" value={movBusca} onChange={(e) => setMovBusca(e.target.value)} style={{ ...inputSt, width: "100%", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {[["mes", "Por mês"], ["periodo", "Por período"]].map(([k, l]) => <button key={k} onClick={() => setMovModo(k)} style={chip(movModo === k, C.accent)}>{l}</button>)}
                </div>
                {movModo === "mes" ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {MLIST.map((m) => <button key={m} onClick={() => setMovMes(m)} style={chip(movMes === m, C.blue)}>{mLabel(m)}</button>)}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ color: C.dim, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>De
                      <input type="date" value={movDe} min={ISO_START} max={ISO_END} onChange={(e) => setMovDe(e.target.value)} style={inputSt} /></label>
                    <label style={{ color: C.dim, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>Até
                      <input type="date" value={movAte} min={ISO_START} max={ISO_END} onChange={(e) => setMovAte(e.target.value)} style={inputSt} /></label>
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {[["todos", "Tudo"], ["in", "Receitas"], ["out", "Despesas"]].map(([k, l]) => <button key={k} onClick={() => setMovTipo(k)} style={chip(movTipo === k, C.accent)}>{l}</button>)}
                  <div style={{ width: 1, height: 20, background: C.border, margin: "0 2px" }} />
                  {[["pend", "Em aberto"], ["pago", "Baixados"], ["todos", "Todos"]].map(([k, l]) => <button key={k} onClick={() => setMovStatus(k)} style={chip(movStatus === k, C.income)}>{l}</button>)}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={movCat} onChange={(e) => setMovCat(e.target.value)} style={inputSt}>
                    <option value="todas">Todas as categorias</option>
                    {[...new Set([...cats.out, ...cats.in])].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span style={{ color: FAINT, fontSize: 11 }}>Status:</span>
                  {Object.entries(STATUS).map(([k, v]) => (
                    <button key={k} onClick={() => setMovSt({ ...movSt, [k]: !movSt[k] })} style={chip(movSt[k], v.color)}>{movSt[k] ? "✓ " : ""}{v.label}</button>
                  ))}
                  <button onClick={() => { setMovBusca(""); setMovTipo("todos"); setMovStatus("pend"); setMovSt({ conf: true, aconf: true, prov: true }); setMovModo("mes"); setMovCat("todas"); }}
                    style={{ ...chip(false, C.dim), marginLeft: "auto" }}>↺ Limpar</button>
                </div>
              </Card>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <KpiBox label="Entradas listadas" value={fmt(tIn)} color={C.income} />
                <KpiBox label="Saídas listadas" value={fmt(tOut)} color={C.expense} />
                <KpiBox label="Resultado" value={fmt(tIn - tOut)} color={tIn - tOut >= 0 ? C.income : C.expense} />
              </div>
              <Card>
                <div style={{ fontSize: 12, color: FAINT, marginBottom: 4 }}>
                  <b style={{ color: C.text }}>Status</b> na caixa de seleção recalcula a projeção · <b style={{ color: C.text }}>Receber/Pagar</b> dá baixa no banco · <b style={{ color: C.text }}>✎</b> edita · <b style={{ color: C.text }}>🗑</b> exclui.
                  {nExcluidos > 0 && <span style={{ color: C.expense }}> · {nExcluidos} excluído(s) — restaure em Config.</span>}
                </div>
                {lista.length === 0 && <div style={{ color: FAINT, fontSize: 12, padding: "10px 0" }}>Nenhum lançamento com esses filtros.</div>}
                {lista.map((e) => movRow(e))}
              </Card>
            </div>
          );
        })()}

        {/* ===== CATEGORIAS ===== */}
        {tab === "cat" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Cadastrar categoria</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select value={novaCat.tipo} onChange={(e) => setNovaCat({ ...novaCat, tipo: e.target.value })} style={inputSt}>
                  <option value="out">Despesa</option>
                  <option value="in">Receita</option>
                </select>
                <input placeholder="Nome da categoria" value={novaCat.nome} onChange={(e) => setNovaCat({ ...novaCat, nome: e.target.value })} style={{ ...inputSt, flex: 1, minWidth: 150 }} />
                <button onClick={() => {
                  const n = novaCat.nome.trim();
                  if (!n || cats[novaCat.tipo].includes(n)) return;
                  setCats({ ...cats, [novaCat.tipo]: [...cats[novaCat.tipo], n] });
                  setNovaCat({ nome: "", tipo: novaCat.tipo });
                }} style={{ background: C.accent, color: "#1A1205", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Adicionar</button>
              </div>
            </Card>
            {[["out", "Categorias de despesa", C.expense], ["in", "Categorias de receita", C.income]].map(([tp, titulo, cor]) => {
              const uso = {};
              events.filter((e) => e.type === tp).forEach((e) => { const c = catOf(e); uso[c] = (uso[c] || 0) + valOf(e); });
              return (
                <Card key={tp}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: cor }}>{titulo}</div>
                  {cats[tp].map((c) => (
                    <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${C.border}`, padding: "8px 0" }}>
                      <span style={{ flex: 1, fontSize: 13 }}>{c}</span>
                      <span style={{ color: FAINT, fontSize: 11 }}>{uso[c] ? fmt(uso[c]) : "—"}</span>
                      <button onClick={() => setCats({ ...cats, [tp]: cats[tp].filter((x) => x !== c) })}
                        style={{ background: "none", border: "none", color: FAINT, cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>
                  ))}
                  {Object.keys(uso).filter((c) => !cats[tp].includes(c)).map((c) => (
                    <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${C.border}`, padding: "8px 0", opacity: 0.6 }}>
                      <span style={{ flex: 1, fontSize: 13 }}>{c} <span style={{ color: C.accent, fontSize: 10 }}>(fora da lista)</span></span>
                      <span style={{ color: FAINT, fontSize: 11 }}>{fmt(uso[c])}</span>
                      <button onClick={() => setCats({ ...cats, [tp]: [...cats[tp], c] })} style={{ ...chip(false, C.income), padding: "2px 8px", fontSize: 10 }}>+ incluir</button>
                    </div>
                  ))}
                </Card>
              );
            })}
            <div style={{ color: FAINT, fontSize: 11 }}>
              Para trocar a categoria de um lançamento, use o ✎ em <b style={{ color: C.dim }}>Movimentações</b>.
            </div>
          </div>
        )}

        {/* ===== BANCOS ===== */}
        {tab === "bancos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <KpiBox label="Saldo total realizado" value={fmt2(realizado)} color={realizado >= 0 ? C.income : C.expense} sub={`${banks.length} conta(s)`} />
            </div>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Contas cadastradas</div>
              {banks.map((b) => (
                <div key={b.id} style={{ borderTop: `1px solid ${C.border}`, padding: "10px 0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input value={b.nome} onChange={(ev) => setBanks(banks.map((x) => (x.id === b.id ? { ...x, nome: ev.target.value } : x)))} style={{ ...inputSt, flex: 1, minWidth: 130 }} />
                  <label style={{ color: FAINT, fontSize: 10 }}>saldo inicial</label>
                  <input type="number" step="0.01" value={b.saldo} onChange={(ev) => setBanks(banks.map((x) => (x.id === b.id ? { ...x, saldo: ev.target.value } : x)))} style={{ ...inputSt, width: 120 }} />
                  <div style={{ minWidth: 110, textAlign: "right" }}>
                    <div style={{ color: FAINT, fontSize: 10 }}>saldo atual</div>
                    <b style={{ color: (saldoPorBanco[b.id] || 0) < 0 ? C.expense : C.income, fontSize: 14 }}>{fmt2(saldoPorBanco[b.id] || 0)}</b>
                  </div>
                  {banks.length > 1 && (
                    <button onClick={() => setBanks(banks.filter((x) => x.id !== b.id))} style={{ background: "none", border: "none", color: FAINT, cursor: "pointer", fontSize: 15 }}>✕</button>
                  )}
                </div>
              ))}
            </Card>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Cadastrar banco / conta</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input placeholder="Nome do banco / conta" value={novoBanco.nome} onChange={(e) => setNovoBanco({ ...novoBanco, nome: e.target.value })} style={{ ...inputSt, flex: 1, minWidth: 160 }} />
                <input type="number" step="0.01" placeholder="Saldo inicial" value={novoBanco.saldo} onChange={(e) => setNovoBanco({ ...novoBanco, saldo: e.target.value })} style={{ ...inputSt, width: 140 }} />
                <button onClick={addBanco} style={{ background: C.accent, color: "#1A1205", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Adicionar</button>
              </div>
              <div style={{ color: FAINT, fontSize: 11, marginTop: 10 }}>
                O saldo atual de cada conta = saldo inicial + baixas lançadas nela. Toda baixa em Movimentações abate direto no banco escolhido.
              </div>
            </Card>
          </div>
        )}

        {/* ===== CONTROLE DE FLUXO (diário/semanal/mensal) ===== */}
        {["diario", "semanal", "mensal"].includes(tab) && (
          <Card style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {[["mes", "Por mês"], ["periodo", "Por período"]].map(([k, l]) => (
                <button key={k} onClick={() => setFluxoModo(k)} style={chip(fluxoModo === k, C.accent)}>{l}</button>
              ))}
            </div>
            {fluxoModo === "mes" ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {MLIST.map((m) => <button key={m} onClick={() => setMesFiltro(m)} style={chip(mesFiltro === m, C.blue)}>{mLabel(m)}</button>)}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ color: C.dim, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>De
                  <input type="date" value={fluxoDe} min={ISO_START} max={ISO_END} onChange={(e) => setFluxoDe(e.target.value)} style={inputSt} /></label>
                <label style={{ color: C.dim, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>Até
                  <input type="date" value={fluxoAte} min={ISO_START} max={ISO_END} onChange={(e) => setFluxoAte(e.target.value)} style={inputSt} /></label>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ color: FAINT, fontSize: 11 }}>Considerar:</span>
              {Object.entries(STATUS).map(([k, v]) => (
                <button key={k} onClick={() => setScenClasses({ ...scenClasses, [k]: !scenClasses[k] })} style={chip(scenClasses[k], v.color)}>
                  {scenClasses[k] ? "✓ " : ""}{v.label}
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* ===== DIÁRIO (progressivo, sem agrupar) ===== */}
        {tab === "diario" && (() => {
          const de = fIni(), ate = fFim();
          const rows = flat.filter((r) => r.e.date >= de && r.e.date <= ate);
          const saldoIni = rows.length ? rows[0].saldo - (rows[0].rec - rows[0].desp) : (flat.filter((r) => r.e.date < de).slice(-1)[0]?.saldo ?? saldoBase);
          const rec = rows.reduce((t, r) => t + r.rec, 0), desp = rows.reduce((t, r) => t + r.desp, 0);
          const fim = rows.length ? rows[rows.length - 1].saldo : saldoIni;
          const fs = isMobile ? 10.5 : 12;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <KpiBox label="Saldo inicial" value={fmt(saldoIni)} />
                <KpiBox label="Receitas" value={fmt(rec)} color={C.income} />
                <KpiBox label="Despesas" value={fmt(desp)} color={C.expense} />
                <KpiBox label="Resultado" value={fmt(rec - desp)} color={rec - desp >= 0 ? C.income : C.expense} />
                <KpiBox label="Saldo final" value={fmt(fim)} color={fim < 0 ? C.expense : C.accent} />
              </div>
              <Card style={{ padding: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: isMobile ? 4 : 8, fontSize: fs, alignItems: "center" }}>
                  <div style={{ color: FAINT, fontWeight: 700 }}>Data</div>
                  <div style={{ color: FAINT, fontWeight: 700 }}>Descrição</div>
                  <div style={{ color: FAINT, fontWeight: 700, textAlign: "right" }}>Receita</div>
                  <div style={{ color: FAINT, fontWeight: 700, textAlign: "right" }}>Despesa</div>
                  <div style={{ color: FAINT, fontWeight: 700, textAlign: "right" }}>Resultado</div>
                  {rows.map((r) => [
                    <div key={r.e.id + "a"} style={{ color: C.text, fontWeight: 700, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>{dKey(r.e.date)}</div>,
                    <div key={r.e.id + "b"} style={{ color: C.dim, borderTop: `1px solid ${C.border}`, paddingTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.e.name}
                      {isPaid(r.e) ? <span style={{ color: C.income, fontSize: 9, marginLeft: 4 }}>✓</span>
                        : <span style={{ color: STATUS[stOf(r.e)].color, fontSize: 9, fontWeight: 800, marginLeft: 4 }}>{STATUS[stOf(r.e)].short}</span>}
                      {!isMobile && <span style={{ color: FAINT, fontSize: 9.5, marginLeft: 6 }}>{catOf(r.e)}</span>}
                    </div>,
                    <div key={r.e.id + "c"} style={{ textAlign: "right", color: C.income, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>{r.rec ? fmt2(r.rec) : "—"}</div>,
                    <div key={r.e.id + "d"} style={{ textAlign: "right", color: C.expense, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>{r.desp ? fmt2(r.desp) : "—"}</div>,
                    <div key={r.e.id + "e"} style={{ textAlign: "right", fontWeight: 800, color: r.saldo < 0 ? C.expense : C.accent, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>{fmt2(r.saldo)}</div>,
                  ])}
                </div>
                {rows.length === 0 && <div style={{ color: FAINT, fontSize: 12, paddingTop: 8 }}>Nenhum lançamento no período.</div>}
              </Card>
            </div>
          );
        })()}

        {/* ===== SEMANAL ===== */}
        {tab === "semanal" && (() => {
          const de = fIni(), ate = fFim();
          const rows = weekly.filter((w) => w.dt >= de && w.dt <= ate);
          const rec = rows.reduce((t, r) => t + r.inSum, 0), desp = rows.reduce((t, r) => t + r.outSum, 0);
          const ini = rows.length ? rows[0].saldo - (rows[0].inSum - rows[0].outSum) : saldoBase;
          const fim = rows.length ? rows[rows.length - 1].saldo : ini;
          const fs = isMobile ? 10.5 : 12;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <KpiBox label="Saldo inicial" value={fmt(ini)} />
                <KpiBox label="Resultado do período" value={fmt(rec - desp)} sub={`${fmt(rec)} − ${fmt(desp)}`} color={rec - desp >= 0 ? C.income : C.expense} />
                <KpiBox label="Saldo final" value={fmt(fim)} color={fim < 0 ? C.expense : C.accent} />
              </div>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Semanas (início segunda-feira)</div>
                <div style={{ display: "grid", gridTemplateColumns: "auto auto auto auto auto", gap: isMobile ? 4 : 6, fontSize: fs }}>
                  <div style={{ color: FAINT }}>Semana</div>
                  <div style={{ color: FAINT, textAlign: "right" }}>Saldo ini.</div>
                  <div style={{ color: FAINT, textAlign: "right" }}>Receitas</div>
                  <div style={{ color: FAINT, textAlign: "right" }}>Despesas</div>
                  <div style={{ color: FAINT, textAlign: "right" }}>Saldo fim</div>
                  {rows.map((w) => {
                    const res = w.inSum - w.outSum, si = w.saldo - res;
                    return [
                      <div key={w.key + "a"} style={{ fontWeight: 700, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>{w.key}</div>,
                      <div key={w.key + "b"} style={{ textAlign: "right", color: C.dim, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>{fmt(si)}</div>,
                      <div key={w.key + "c"} style={{ textAlign: "right", color: C.income, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>{fmt(w.inSum)}</div>,
                      <div key={w.key + "d"} style={{ textAlign: "right", color: C.expense, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>{fmt(w.outSum)}</div>,
                      <div key={w.key + "e"} style={{ textAlign: "right", color: w.saldo < 0 ? C.expense : C.accent, fontWeight: 700, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>{fmt(w.saldo)}</div>,
                    ];
                  })}
                </div>
              </Card>
            </div>
          );
        })()}

        {/* ===== MENSAL ===== */}
        {tab === "mensal" && (() => {
          const de = fIni(), ate = fFim();
          const rows = monthly.filter((m) => m.m >= MIDX(de) && m.m <= MIDX(ate));
          const rec = rows.reduce((t, r) => t + r.inSum, 0), desp = rows.reduce((t, r) => t + r.outSum, 0);
          const ini = rows.length ? rows[0].saldo - (rows[0].inSum - rows[0].outSum) : saldoBase;
          const fim = rows.length ? rows[rows.length - 1].saldo : ini;
          const fs = isMobile ? 10.5 : 12;
          const cm = rows.map((m) => ({ nome: m.nome, Receitas: Math.round(m.inSum), Despesas: Math.round(m.outSum) }));
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <KpiBox label="Saldo inicial" value={fmt(ini)} />
                <KpiBox label="Resultado do período" value={fmt(rec - desp)} sub={`${fmt(rec)} − ${fmt(desp)}`} color={rec - desp >= 0 ? C.income : C.expense} />
                <KpiBox label="Saldo final" value={fmt(fim)} color={fim < 0 ? C.expense : C.accent} />
              </div>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Receitas × Despesas por mês</div>
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <BarChart data={cm}>
                      <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                      <XAxis dataKey="nome" tick={{ fill: FAINT, fontSize: 11 }} />
                      <YAxis tick={{ fill: FAINT, fontSize: 10 }} width={52} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Receitas" fill={C.income} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Despesas" fill={C.expense} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card>
                <div style={{ display: "grid", gridTemplateColumns: "auto auto auto auto auto", gap: isMobile ? 4 : 6, fontSize: fs }}>
                  <div style={{ color: FAINT }}>Mês</div>
                  <div style={{ color: FAINT, textAlign: "right" }}>Saldo ini.</div>
                  <div style={{ color: FAINT, textAlign: "right" }}>Receitas</div>
                  <div style={{ color: FAINT, textAlign: "right" }}>Despesas</div>
                  <div style={{ color: FAINT, textAlign: "right" }}>Saldo fim</div>
                  {rows.map((m) => {
                    const res = m.inSum - m.outSum, si = m.saldo - res;
                    return [
                      <div key={m.m + "a"} style={{ fontWeight: 700, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>{m.nome}</div>,
                      <div key={m.m + "b"} style={{ textAlign: "right", color: C.dim, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>{fmt(si)}</div>,
                      <div key={m.m + "c"} style={{ textAlign: "right", color: C.income, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>{fmt(m.inSum)}</div>,
                      <div key={m.m + "d"} style={{ textAlign: "right", color: C.expense, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>{fmt(m.outSum)}</div>,
                      <div key={m.m + "e"} style={{ textAlign: "right", color: m.saldo < 0 ? C.expense : C.accent, fontWeight: 700, borderTop: `1px solid ${C.border}`, paddingTop: 4 }}>{fmt(m.saldo)}</div>,
                    ];
                  })}
                </div>
              </Card>
            </div>
          );
        })()}

        {/* ===== RECEITAS / DESPESAS ===== */}
        {(tab === "receitas" || tab === "despesas") && (() => {
          const tipo = tab === "receitas" ? "in" : "out";
          const cor = tipo === "in" ? C.income : C.expense;
          const evs = events.filter((e) => e.type === tipo && counts(e) && (mesFiltro2 === -1 || MIDX(e.date) === mesFiltro2));
          const total = evs.reduce((s, e) => s + valOf(e), 0);
          const pago = evs.filter(isPaid).reduce((s, e) => s + valOf(e), 0);
          const map = new Map();
          evs.forEach((e) => {
            let k, ord;
            if (gran === "dia") { k = dKey(e.date); ord = e.date.getTime(); }
            else if (gran === "semana") { const mo = mondayOf(e.date); k = "Sem. de " + dKey(mo); ord = mo.getTime(); }
            else { k = mLabel(MIDX(e.date)); ord = MIDX(e.date); }
            if (!map.has(k)) map.set(k, { k, ord, total: 0, items: [], cats: new Map() });
            const g = map.get(k);
            g.total += valOf(e); g.items.push(e);
            g.cats.set(catOf(e), (g.cats.get(catOf(e)) || 0) + valOf(e));
          });
          const groups = [...map.values()].sort((a, b) => a.ord - b.ord);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]].map(([g, l]) => <button key={g} onClick={() => setGran(g)} style={chip(gran === g, cor)}>{l}</button>)}
                <div style={{ width: 1, height: 22, background: C.border, margin: "0 4px" }} />
                <button onClick={() => setMesFiltro2(-1)} style={chip(mesFiltro2 === -1, C.blue)}>Todos</button>
                {MLIST.map((m) => <button key={m} onClick={() => setMesFiltro2(m)} style={chip(mesFiltro2 === m, C.blue)}>{mLabel(m)}</button>)}
              </div>
              <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
                    Total de {tab} · {mesFiltro2 === -1 ? "21/07 → 31/12" : mLabel(mesFiltro2)}
                  </div>
                  <div style={{ color: cor, fontSize: 26, fontWeight: 800, marginTop: 2 }}>{fmt2(total)}</div>
                </div>
                <div style={{ color: FAINT, fontSize: 12, textAlign: "right" }}>
                  {evs.length} lançamento(s)<br />
                  <span style={{ color: C.income }}>{fmt(pago)} baixado</span> · <span style={{ color: C.accent }}>{fmt(total - pago)} em aberto</span>
                </div>
              </Card>
              {groups.map((g) => {
                const ek = tab + gran + g.k;
                const isOpen = gran === "dia" ? true : !!expanded[ek];
                return (
                  <Card key={g.k} style={{ padding: 12 }}>
                    <div onClick={() => gran !== "dia" && setExpanded({ ...expanded, [ek]: !isOpen })}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, cursor: gran !== "dia" ? "pointer" : "default", userSelect: "none" }}>
                      <div style={{ fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                        {gran !== "dia" && <span style={{ color: cor, fontSize: 11, display: "inline-block", transform: isOpen ? "rotate(90deg)" : "none" }}>▶</span>}
                        {g.k}
                        {gran !== "dia" && <span style={{ color: FAINT, fontSize: 10, fontWeight: 400 }}>{isOpen ? "recolher" : `${g.items.length} itens`}</span>}
                      </div>
                      <div style={{ color: cor, fontWeight: 800, fontSize: 14 }}>{fmt2(g.total)}</div>
                    </div>
                    {gran !== "dia" && !isOpen && [...g.cats.entries()].sort((a, b) => b[1] - a[1]).map(([cat, v], i) => (
                      <div key={cat} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderTop: i ? `1px solid ${C.border}` : "none" }}>
                        <span style={{ color: C.dim }}>{cat}</span>
                        <span style={{ color: cor, fontWeight: 600 }}>{fmt2(v)}</span>
                      </div>
                    ))}
                    {isOpen && g.items.slice().sort((a, b) => a.date - b.date).map((e, i) => (
                      <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 0", borderTop: i ? `1px solid ${C.border}` : "none" }}>
                        <span style={{ color: C.dim, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span style={{ color: C.text, background: C.cardSoft, border: `1px solid ${C.border}`, borderRadius: 6, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{dKey(e.date)}</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span style={{ color: FAINT, fontSize: 10, marginRight: 6 }}>{catOf(e)}</span>{e.name}
                          </span>
                          {isPaid(e) ? <span style={{ color: C.income, fontSize: 10 }}>✓</span>
                            : <span style={{ color: STATUS[stOf(e)].color, fontSize: 9, fontWeight: 800 }}>{STATUS[stOf(e)].short}</span>}
                        </span>
                        <span style={{ color: cor, fontWeight: 600, marginLeft: 8 }}>{fmt2(valOf(e))}</span>
                      </div>
                    ))}
                  </Card>
                );
              })}
            </div>
          );
        })()}

        {/* ===== CENÁRIOS ===== */}
        {tab === "cenarios" && (() => {
          let sb = saldoBase, sc = saldoBase;
          const combo = []; let curK = null, curMi = null, cb = sb, cs = sc;
          events.forEach((e) => {
            const k = dKey(e.date);
            if (curK && k !== curK) combo.push({ d: curK, mi: curMi, base: Math.round(cb), cenario: Math.round(cs) });
            curK = k; curMi = MIDX(e.date);
            const v = e.type === "in" ? e.amount : -e.amount;
            cb += v;
            if (counts(e)) cs += e.type === "in" ? valOf(e) : -valOf(e);
          });
          if (curK) combo.push({ d: curK, mi: curMi, base: Math.round(cb), cenario: Math.round(cs) });
          const comboView = mesFiltro3 === -1 ? combo : combo.filter((x) => x.mi === mesFiltro3);

          const inPeriod = (e) => mesFiltro3 === -1 || MIDX(e.date) === mesFiltro3;
          const evPer = events.filter(inPeriod);
          const inclPer = evPer.filter(counts);
          const recIncl = inclPer.filter((e) => e.type === "in").reduce((s, e) => s + valOf(e), 0);
          const despIncl = inclPer.filter((e) => e.type === "out").reduce((s, e) => s + valOf(e), 0);
          const recBase = evPer.filter((e) => e.type === "in").reduce((s, e) => s + e.amount, 0);
          const despBase = evPer.filter((e) => e.type === "out").reduce((s, e) => s + e.amount, 0);
          const endM = mesFiltro3 === -1 ? MLIST[MLIST.length - 1] : mesFiltro3;
          let endBase = saldoBase, endScen = saldoBase;
          events.forEach((e) => {
            if (MIDX(e.date) > endM) return;
            endBase += e.type === "in" ? e.amount : -e.amount;
            if (counts(e)) endScen += e.type === "in" ? valOf(e) : -valOf(e);
          });
          const delta = endScen - endBase;

          const parseD = (s) => { const [y, mo, d] = s.split("-").map(Number); return new Date(y, mo - 1, d); };
          const de = parseD(scenDe), ate = parseD(scenAte);
          let barData, resumo = null;
          if (scenChartMode === "mes") {
            const mm = new Map();
            events.filter(counts).filter(inPeriod).forEach((e) => {
              const k = MIDX(e.date);
              if (!mm.has(k)) mm.set(k, { ord: k, nome: mLabel(k), Receitas: 0, Despesas: 0 });
              const g = mm.get(k);
              if (e.type === "in") g.Receitas += valOf(e); else g.Despesas += valOf(e);
            });
            barData = [...mm.values()].sort((a, b) => a.ord - b.ord).map((v) => ({ nome: v.nome, Receitas: Math.round(v.Receitas), Despesas: Math.round(v.Despesas) }));
          } else {
            let rC = 0, dC = 0, rB = 0, dB = 0;
            events.forEach((e) => {
              if (e.date < de || e.date > ate) return;
              if (e.type === "in") { rB += e.amount; if (counts(e)) rC += valOf(e); }
              else { dB += e.amount; if (counts(e)) dC += valOf(e); }
            });
            barData = [{ nome: "Receitas", Cenário: Math.round(rC), Base: Math.round(rB) }, { nome: "Despesas", Cenário: Math.round(dC), Base: Math.round(dB) }];
            resumo = { res: rC - dC, resBase: rB - dB };
          }

          const series = (tipo) => {
            const map = new Map();
            evPer.filter((e) => e.type === tipo).forEach((e) => {
              if (!map.has(e.serie)) map.set(e.serie, { name: e.serie, cat: catOf(e), grp: e.grp, total: 0, items: [] });
              const s = map.get(e.serie); s.total += e.amount; s.items.push(e);
            });
            return [...map.values()].sort((a, b) => b.total - a.total);
          };

          const SeriesBlock = ({ tipo, titulo, cor }) => (
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{titulo}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: cor }}>
                  {fmt(tipo === "in" ? recIncl : despIncl)}
                  <span style={{ color: FAINT, fontWeight: 400, fontSize: 11 }}> / {fmt(tipo === "in" ? recBase : despBase)}</span>
                </div>
              </div>
              {series(tipo).map((s) => {
                const stSer = stSerie[s.name] || DEF_ST[s.grp] || "conf";
                const ek = "sc" + tipo + s.name;
                const isOpen = !!expanded[ek];
                const inclTotal = s.items.filter(counts).reduce((t, e) => t + valOf(e), 0);
                const off = !scenClasses[stSer] && !s.items.some(isPaid);
                return (
                  <div key={s.name} style={{ borderTop: `1px solid ${C.border}`, padding: "8px 0", opacity: off ? 0.45 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div onClick={() => setExpanded({ ...expanded, [ek]: !isOpen })} style={{ flex: 1, minWidth: 0, cursor: "pointer", userSelect: "none" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ color: cor, fontSize: 9, marginRight: 5, display: "inline-block", transform: isOpen ? "rotate(90deg)" : "none" }}>▶</span>
                          {s.name}
                        </div>
                        <div style={{ fontSize: 10, color: FAINT }}>{s.items.length}x</div>
                      </div>
                      <select value={stSer} onChange={(ev) => setSerieStatus(s.name, ev.target.value)} title="Status da série inteira"
                        style={{ ...inputSt, padding: "4px 6px", fontSize: 11, fontWeight: 700, borderColor: STATUS[stSer].color, color: STATUS[stSer].color }}>
                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k} style={{ color: C.text }}>{v.label}</option>)}
                      </select>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: cor, minWidth: 74, textAlign: "right" }}>
                        {off ? <s style={{ color: FAINT }}>{fmt(s.total)}</s> : fmt(inclTotal)}
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ marginTop: 6, marginLeft: 14 }}>
                        {s.items.map((e) => (
                          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, padding: "3px 0" }}>
                            <span style={{ color: C.text, background: C.cardSoft, border: `1px solid ${C.border}`, borderRadius: 5, padding: "0 5px", fontSize: 9.5, fontWeight: 700 }}>{dKey(e.date)}</span>
                            {isPaid(e) ? <span style={{ color: C.income, fontSize: 9, fontWeight: 800 }}>✓ BAIXADO</span>
                              : <select value={stOf(e)} onChange={(ev) => setStItem({ ...stItem, [e.id]: ev.target.value })}
                                  style={{ ...inputSt, padding: "1px 3px", fontSize: 10, fontWeight: 800, borderColor: STATUS[stOf(e)].color, color: STATUS[stOf(e)].color }}>
                                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k} style={{ color: C.text }}>{v.short}</option>)}
                                </select>}
                            <span style={{ flex: 1, color: C.dim }}>{e.name}</span>
                            <span style={{ color: cor, fontWeight: 600 }}>{counts(e) ? fmt2(valOf(e)) : <s style={{ color: FAINT }}>{fmt2(e.amount)}</s>}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          );

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => setMesFiltro3(-1)} style={chip(mesFiltro3 === -1, C.blue)}>Todos</button>
                {MLIST.map((m) => <button key={m} onClick={() => setMesFiltro3(m)} style={chip(mesFiltro3 === m, C.blue)}>{mLabel(m)}</button>)}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ color: FAINT, fontSize: 11 }}>Incluir no cenário:</span>
                {Object.entries(STATUS).map(([k, v]) => (
                  <button key={k} onClick={() => setScenClasses({ ...scenClasses, [k]: !scenClasses[k] })} style={chip(scenClasses[k], v.color)}>
                    {scenClasses[k] ? "✓ " : ""}{v.label}
                  </button>
                ))}
                <button onClick={() => { setStItem({}); setStSerie({}); setScenClasses({ conf: true, aconf: true, prov: true }); }} style={{ ...chip(false, C.dim), marginLeft: "auto" }}>↺ Resetar status</button>
              </div>
              <div style={{ color: FAINT, fontSize: 11 }}>Itens já baixados entram sempre no cálculo, independente do filtro.</div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <KpiBox label="Receitas no período" value={fmt(recIncl)} sub={recIncl !== recBase ? `base: ${fmt(recBase)}` : "tudo incluído"} color={C.income} />
                <KpiBox label="Despesas no período" value={fmt(despIncl)} sub={despIncl !== despBase ? `base: ${fmt(despBase)}` : "tudo incluído"} color={C.expense} />
                <KpiBox label="Resultado do cenário" value={fmt(recIncl - despIncl)} color={recIncl - despIncl >= 0 ? C.income : C.expense} sub={mesFiltro3 === -1 ? "período total" : mLabel(mesFiltro3)} />
                <KpiBox label={`Saldo em ${mesFiltro3 === -1 ? "31/12" : "fim de " + mLabel(endM)}`} value={fmt(endScen)}
                  sub={delta !== 0 ? `${delta > 0 ? "+" : ""}${fmt(delta)} vs base` : "igual à base"} color={endScen < 0 ? C.expense : delta === 0 ? C.text : C.blue} />
              </div>

              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  Saldo projetado — <span style={{ color: C.accent }}>base</span> × <span style={{ color: C.blue }}>cenário</span>{mesFiltro3 !== -1 ? ` · ${MESES[mesFiltro3]}` : ""}
                </div>
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer>
                    <AreaChart data={comboView}>
                      <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                      <XAxis dataKey="d" tick={{ fill: FAINT, fontSize: 10 }} interval={mesFiltro3 === -1 ? 14 : "preserveStartEnd"} />
                      <YAxis tick={{ fill: FAINT, fontSize: 10 }} width={52} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmt(v), n === "base" ? "Base" : "Cenário"]} />
                      <ReferenceLine y={0} stroke={C.expense} strokeDasharray="4 4" />
                      <Area type="monotone" dataKey="base" stroke={C.accent} strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
                      <Area type="monotone" dataKey="cenario" stroke={C.blue} strokeWidth={2.5} fill="rgba(91,156,245,0.12)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Receitas × Despesas do cenário{mesFiltro3 !== -1 && scenChartMode === "mes" ? ` · ${MESES[mesFiltro3]}` : ""}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[["mes", "Mês a mês"], ["periodo", "Período"]].map(([k, l]) => <button key={k} onClick={() => setScenChartMode(k)} style={chip(scenChartMode === k, C.accent)}>{l}</button>)}
                  </div>
                </div>
                {scenChartMode === "periodo" && (
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                    <label style={{ color: C.dim, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>De
                      <input type="date" value={scenDe} min={ISO_START} max={ISO_END} onChange={(e) => setScenDe(e.target.value)} style={inputSt} />
                    </label>
                    <label style={{ color: C.dim, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>Até
                      <input type="date" value={scenAte} min={ISO_START} max={ISO_END} onChange={(e) => setScenAte(e.target.value)} style={inputSt} />
                    </label>
                    {resumo && (
                      <div style={{ marginLeft: "auto", fontSize: 12, color: C.dim }}>
                        Resultado: <b style={{ color: resumo.res >= 0 ? C.income : C.expense }}>{resumo.res >= 0 ? "+" : ""}{fmt(resumo.res)}</b>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ width: "100%", height: 230 }}>
                  <ResponsiveContainer>
                    <BarChart data={barData}>
                      <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                      <XAxis dataKey="nome" tick={{ fill: FAINT, fontSize: 11 }} />
                      <YAxis tick={{ fill: FAINT, fontSize: 10 }} width={52} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {scenChartMode === "mes" && <Bar dataKey="Receitas" fill={C.income} radius={[4, 4, 0, 0]} />}
                      {scenChartMode === "mes" && <Bar dataKey="Despesas" fill={C.expense} radius={[4, 4, 0, 0]} />}
                      {scenChartMode === "periodo" && <Bar dataKey="Cenário" fill={C.blue} radius={[4, 4, 0, 0]} />}
                      {scenChartMode === "periodo" && <Bar dataKey="Base" fill="#3A4A63" radius={[4, 4, 0, 0]} />}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <SeriesBlock tipo="in" titulo="💰 Receitas — incluídas / total" cor={C.income} />
              <SeriesBlock tipo="out" titulo="💸 Despesas — incluídas / total" cor={C.expense} />
            </div>
          );
        })()}

        {/* ===== CONFIG ===== */}
        {tab === "lanc" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Parâmetros</div>
              <div style={{ color: C.dim, fontSize: 12 }}>Defina os saldos de abertura em <b style={{ color: C.text }}>Bancos</b> e cadastre receitas e despesas em <b style={{ color: C.text }}>Config → Adicionar lançamento</b>.</div>
              <div style={{ color: FAINT, fontSize: 11, marginTop: 8 }}>O saldo de abertura é definido por banco na aba <b style={{ color: C.dim }}>Bancos</b>.</div>
              {(nExcluidos > 0 || Object.keys(ovr).length > 0) && (
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ color: C.dim, fontSize: 12 }}>
                    {nExcluidos} lançamento(s) excluído(s) · {Object.values(ovr).filter((o) => !o.deleted).length} editado(s)
                  </span>
                  {nExcluidos > 0 && (
                    <button onClick={() => { const o = {}; Object.entries(ovr).forEach(([k, v]) => { if (!v.deleted) o[k] = v; }); setOvr(o); }}
                      style={{ ...chip(false, C.income), color: C.income, borderColor: C.income }}>↺ Restaurar excluídos</button>
                  )}
                  <button onClick={() => { if (confirm("Desfazer todas as edições e exclusões?")) setOvr({}); }}
                    style={{ ...chip(false, C.dim) }}>↺ Restaurar tudo</button>
                </div>
              )}
            </Card>

            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Adicionar lançamento manual</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input placeholder="Descrição" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ ...inputSt, flex: 2, minWidth: 140 }} />
                <input type="number" placeholder="Valor" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={{ ...inputSt, width: 110 }} />
                <input type="date" value={form.date} min={ISO_START} max={ISO_END} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputSt} />
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, cat: e.target.value === "in" ? (cats.in[0] || "Outros") : (cats.out[0] || "Diversos") })} style={inputSt}>
                  <option value="in">Receita</option>
                  <option value="out">Despesa</option>
                </select>
                <select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} style={inputSt}>
                  {(cats[form.type] || []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={form.freq} onChange={(e) => setForm({ ...form, freq: e.target.value })}
                  style={{ ...inputSt, borderColor: form.freq !== "once" ? C.accent : C.border, color: form.freq !== "once" ? C.accent : C.text }}>
                  <option value="once">Única</option>
                  <option value="mensal">🔁 Mensal</option>
                  <option value="semanal">🔁 Semanal</option>
                </select>
                {form.freq !== "once" && (
                  <input type="number" min={1} max={30} placeholder="x vezes" value={form.vezes} onChange={(e) => setForm({ ...form, vezes: e.target.value })} style={{ ...inputSt, width: 84 }} />
                )}
                <button onClick={addExtra} style={{ background: C.accent, color: "#1A1205", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Adicionar</button>
              </div>
              {extras.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  {extras.map((x) => (
                    <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, background: C.cardSoft, borderRadius: 8, padding: "6px 10px" }}>
                      <span style={{ color: C.dim }}>
                        {x.date.split("-").reverse().slice(0, 2).join("/")} · {x.name}
                        {(x.freq === "mensal" || x.freq === "semanal") && (
                          <span style={{ color: C.accent, fontSize: 10, fontWeight: 700, marginLeft: 6, border: `1px solid ${C.accent}`, borderRadius: 5, padding: "0 5px" }}>
                            🔁 {x.freq}{Number(x.vezes) ? ` ×${x.vezes}` : " até dez"}
                          </span>
                        )}
                      </span>
                      <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <b style={{ color: x.type === "in" ? C.income : C.expense }}>{x.type === "in" ? "+" : "−"}{fmt2(Number(x.amount))}</b>
                        <button onClick={() => setExtras(extras.filter((e) => e.id !== x.id))} style={{ background: "none", border: "none", color: FAINT, cursor: "pointer", fontSize: 14 }}>✕</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>💬 Falar com o Claude</div>
              <div style={{ color: FAINT, fontSize: 11, marginBottom: 10 }}>
                Dúvidas sobre os números ou alterações — ex: <i>"qual meu pior mês?"</i>, <i>"cadastra o banco Inter com saldo 3000"</i>, <i>"muda o cenário EuPet pra 70%"</i>.
              </div>
              {chat.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto", marginBottom: 10, paddingRight: 4 }}>
                  {chat.map((m, i) => (
                    <div key={i} style={{
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%",
                      background: m.role === "user" ? "rgba(245,165,36,0.14)" : C.cardSoft,
                      border: `1px solid ${m.role === "user" ? "rgba(245,165,36,0.4)" : C.border}`,
                      borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                      padding: "8px 12px", fontSize: 12.5, lineHeight: 1.5, whiteSpace: "pre-wrap",
                    }}>
                      {m.role === "assistant" && <span style={{ color: C.accent, fontWeight: 800, fontSize: 10, display: "block", marginBottom: 2 }}>CLAUDE</span>}
                      {m.content}
                    </div>
                  ))}
                  {chatBusy && <div style={{ color: FAINT, fontSize: 12, padding: "4px 8px" }}>Claude está analisando…</div>}
                </div>
              )}
              <textarea value={chatInput}
                onChange={(e) => { setChatInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 220) + "px"; }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="Escreva sua pergunta ou comando… (Shift+Enter pula linha)"
                disabled={chatBusy} rows={3}
                style={{ width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: 76, maxHeight: 220, background: C.cardSoft, border: `1px solid ${C.border}`, color: C.text, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, lineHeight: 1.5, outline: "none", fontFamily: "inherit" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={sendChat} disabled={chatBusy || !chatInput.trim()}
                  style={{ background: chatBusy || !chatInput.trim() ? C.cardSoft : C.accent, color: chatBusy || !chatInput.trim() ? FAINT : "#1A1205", border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 800, fontSize: 13, cursor: chatBusy ? "wait" : "pointer" }}>
                  {chatBusy ? "Analisando…" : "Enviar ➤"}
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {isMobile && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 60, boxShadow: "0 -6px 18px rgba(0,0,0,0.45)" }}>
          {NAV.map(([k, l, ic]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ flex: 1, background: "none", border: "none", padding: "9px 2px 11px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === k ? C.accent : C.dim, borderTop: `2px solid ${tab === k ? C.accent : "transparent"}` }}>
              <span style={{ fontSize: 17, lineHeight: 1 }}>{ic}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700 }}>{l}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
