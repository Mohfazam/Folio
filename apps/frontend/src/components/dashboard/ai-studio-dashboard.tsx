"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  createKnowledgeEntryAction,
  updateKnowledgeEntryAction,
  deleteKnowledgeEntryAction,
  saveAgentSettingsAction,
} from "@/app/(dashboard)/dashboard/actions";

type Entry = {
  id: string; type: string; title: string | null; category: string | null;
  question: string | null; content: string; tags: string[]; priority: number;
  targetPersonas: string[]; version: number; isActive: boolean; updatedAt: string;
};
type Voice = { id: string; label: string; language?: string };
type Language = { code: string; label: string };
type Props = { entries: Entry[]; agent: Record<string, unknown>; profile: Record<string, unknown>; voices: Voice[]; languages: Language[]; error: string | null };
type Tab = "knowledge" | "agent";
const input = "mt-1.5 h-10 w-full rounded-md border border-[#DCDDD6] bg-white px-3 text-[12px] text-[#252620] outline-none focus:border-[#7852D6]";
const label = "block text-[11px] font-semibold text-[#55574F]";
const area = "mt-1.5 w-full rounded-md border border-[#DCDDD6] bg-white px-3 py-2.5 text-[12px] leading-5 text-[#252620] outline-none focus:border-[#7852D6]";
const types = ["faq","course_info","fee","deadline","policy","product_feature","pricing_plan","technical_spec","troubleshooting","integration_guide","case_study","document"];
const typeLabels: Record<string,string> = { faq:"FAQ", course_info:"Course information", fee:"Fees", deadline:"Deadlines", policy:"Policies", product_feature:"Product / service", pricing_plan:"Pricing", technical_spec:"Technical details", troubleshooting:"Troubleshooting", integration_guide:"Integration guide", case_study:"Case study", document:"Document" };
function str(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function Field({ title, children }: { title: string; children: ReactNode }) { return <label className={label}>{title}{children}</label>; }

export function AiStudioDashboard({ entries: initialEntries, agent, profile, voices, languages, error: initialError }: Props) {
  const [tab,setTab] = useState<Tab>("knowledge");
  const [entries,setEntries] = useState(initialEntries);
  const [query,setQuery] = useState("");
  const [filter,setFilter] = useState("all");
  const [editing,setEditing] = useState<Entry | null>(null);
  const [creating,setCreating] = useState(false);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const [error,setError] = useState(initialError ?? "");
  const filtered = useMemo(() => entries.filter(e => (filter === "all" || e.type === filter) && `${e.title ?? ""} ${e.question ?? ""} ${e.content} ${e.category ?? ""}`.toLowerCase().includes(query.toLowerCase())),[entries,filter,query]);
  const activeCount = entries.filter(e=>e.isActive).length;

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    const payload = { type:String(form.get("type")), title:String(form.get("title")||"").trim(), category:String(form.get("category")||"").trim(), question:String(form.get("question")||"").trim(), content:String(form.get("content")||"").trim(), tags:String(form.get("tags")||"").split(",").map(x=>x.trim()).filter(Boolean), priority:Number(form.get("priority")||0), isActive:form.get("isActive")==="on" };
    const result = editing ? await updateKnowledgeEntryAction(editing.id,payload) : await createKnowledgeEntryAction(payload);
    if (!result.ok) { setError(result.error); setBusy(false); return; }
    const raw = result.data?.entry as Entry | undefined;
    if (raw) setEntries(current => editing ? current.map(e=>e.id===editing.id?raw:e) : [raw,...current]);
    else window.location.reload();
    setEditing(null); setCreating(false); setNotice(editing?"Knowledge entry updated.":"Knowledge entry added."); setBusy(false);
  }
  async function removeEntry(entry: Entry) {
    if (!window.confirm(`Delete “${entry.title || entry.question || "this entry"}”? This cannot be undone.`)) return;
    const result = await deleteKnowledgeEntryAction(entry.id);
    if (!result.ok) { setError(result.error); return; }
    setEntries(current=>current.filter(e=>e.id!==entry.id)); setNotice("Knowledge entry deleted.");
  }
  async function saveAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    const result = await saveAgentSettingsAction({
      industry: str(profile.industry,"education"), displayName: str(profile.displayName), description: str(profile.description),
      agentName:String(form.get("agentName")||"").trim(), tone:String(form.get("tone")||""), language:String(form.get("language")||"en-IN"),
      speechRate:Number(form.get("speechRate")||1), voiceId:String(form.get("voiceId")||"")||null,
      greeting:String(form.get("greeting")||"").trim(), primaryObjective:String(form.get("primaryObjective")||"").trim(),
      handoffInstructions:String(form.get("handoffInstructions")||"").trim(), pronunciationNotes:String(form.get("pronunciationNotes")||"").trim(),
      complianceNotes:String(form.get("complianceNotes")||"").trim(), guardrails:String(form.get("guardrails")||"").split("\n").map(x=>x.trim()).filter(Boolean),
    });
    if (!result.ok) setError(result.error); else { setNotice("AI agent settings saved."); }
    setBusy(false);
  }

  return <div className="mx-auto max-w-[1180px] space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[.12em] text-[#9A8ABF]">Workspace / Configuration</p><h1 className="mt-1 font-['Newsreader'] text-[38px] leading-tight text-[#1B1C18]">AI Studio</h1><p className="mt-2 max-w-[650px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">Manage what your AI knows and how it communicates with your customers.</p></div><div className="flex gap-2 rounded-lg border border-[#ECEBE5] bg-white p-1"><button onClick={()=>setTab("knowledge")} className={`rounded-md px-4 py-2 text-[11px] font-semibold ${tab==="knowledge"?"bg-[#EDE6FC] text-[#5737A6]":"text-[#777970]"}`}>Knowledge base</button><button onClick={()=>setTab("agent")} className={`rounded-md px-4 py-2 text-[11px] font-semibold ${tab==="agent"?"bg-[#EDE6FC] text-[#5737A6]":"text-[#777970]"}`}>Voice agent</button></div></header>
    {notice && <div role="status" className="rounded-md border border-[#D7E8DA] bg-[#F1F8F2] px-4 py-3 text-[12px] text-[#397A55]">{notice}</div>}
    {error && <div role="alert" className="rounded-md border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3 text-[12px] text-[#A33A32]">{error}</div>}
    {tab==="knowledge" ? <>
      <div className="grid gap-3 sm:grid-cols-3"><Metric title="Total entries" value={entries.length}/><Metric title="Active knowledge" value={activeCount}/><Metric title="Inactive entries" value={entries.length-activeCount}/></div>
      {(creating||editing) ? <section className="rounded-lg border border-[#ECEBE5] bg-white p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-['Newsreader'] text-[25px]">{editing?"Edit knowledge":"Add knowledge"}</h2><p className="mt-1 text-[11px] text-[#85877F]">Keep information accurate, specific and approved for customer conversations.</p></div><button onClick={()=>{setCreating(false);setEditing(null);}} className="text-[12px] font-semibold text-[#7852D6]">Close</button></div><form onSubmit={submitEntry} className="grid gap-4 md:grid-cols-2"><Field title="Content type"><select name="type" defaultValue={editing?.type??"faq"} className={input}>{types.map(t=><option key={t} value={t}>{typeLabels[t]??t}</option>)}</select></Field><Field title="Category"><input name="category" defaultValue={editing?.category??""} className={input} placeholder="Admissions, courses, billing..."/></Field><Field title="Title"><input name="title" defaultValue={editing?.title??""} className={input} placeholder="A short, searchable title"/></Field><Field title="Question (optional)"><input name="question" defaultValue={editing?.question??""} className={input} placeholder="What might a customer ask?"/></Field><div className="md:col-span-2"><Field title="Approved answer / content"><textarea name="content" required rows={7} defaultValue={editing?.content??""} className={area} placeholder="Enter the exact information the AI agent is allowed to use."/></Field></div><Field title="Tags (comma separated)"><input name="tags" defaultValue={editing?.tags?.join(", ")??""} className={input} placeholder="admissions, fees, 2027"/></Field><Field title="Priority"><select name="priority" defaultValue={String(editing?.priority??0)} className={input}><option value="0">Normal</option><option value="1">High</option><option value="2">Critical</option></select></Field><label className="flex items-center gap-2 text-[12px] text-[#55574F]"><input type="checkbox" name="isActive" defaultChecked={editing?.isActive??true}/> Available to the AI agent</label><div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={()=>{setCreating(false);setEditing(null);}} className="rounded-md border border-[#DCDDD6] px-4 py-2 text-[11px]">Cancel</button><button disabled={busy} className="rounded-md bg-[#1B1C18] px-5 py-2 text-[11px] font-semibold text-white">{busy?"Saving…":editing?"Save changes":"Add to knowledge base"}</button></div></form></section> : <>
        <section className="rounded-lg border border-[#ECEBE5] bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECEBE5] p-4"><div><h2 className="text-[14px] font-semibold text-[#1B1C18]">Knowledge library</h2><p className="mt-1 text-[11px] text-[#85877F]">Approved facts and answers your AI can use during calls.</p></div><button onClick={()=>{setEditing(null);setCreating(true);}} className="rounded-md bg-[#1B1C18] px-4 py-2.5 text-[11px] font-semibold text-white">+ Add knowledge</button></div><div className="grid gap-3 border-b border-[#ECEBE5] p-4 md:grid-cols-[1fr_220px]"><input value={query} onChange={e=>setQuery(e.target.value)} className={input+" mt-0"} placeholder="Search titles, questions and content"/><select value={filter} onChange={e=>setFilter(e.target.value)} className={input+" mt-0"}><option value="all">All content types</option>{types.map(t=><option key={t} value={t}>{typeLabels[t]??t}</option>)}</select></div>{filtered.length? <div className="divide-y divide-[#F0EFE9]">{filtered.map(entry=><article key={entry.id} className="flex flex-wrap items-start justify-between gap-4 p-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-semibold text-[#1B1C18]">{entry.title||entry.question||"Untitled entry"}</h3><span className="rounded-full bg-[#F1ECFA] px-2 py-1 text-[9px] text-[#684AAE]">{typeLabels[entry.type]??entry.type}</span><span className={`rounded-full px-2 py-1 text-[9px] ${entry.isActive?"bg-[#EFF8F1] text-[#34734B]":"bg-[#F4F3EF] text-[#777970]"}`}>{entry.isActive?"Active":"Inactive"}</span></div>{entry.question&&entry.title&&<p className="mt-1 text-[11px] text-[#6F716A]">{entry.question}</p>}<p className="mt-2 line-clamp-2 whitespace-pre-line text-[11px] leading-5 text-[#85877F]">{entry.content}</p><p className="mt-2 text-[9px] text-[#A0A19A]">Version {entry.version} · Updated {entry.updatedAt?new Date(entry.updatedAt).toLocaleDateString():"—"}{entry.tags?.length?` · ${entry.tags.join(", ")}`:""}</p></div><div className="flex shrink-0 gap-2"><button onClick={()=>{setEditing(entry);setCreating(false);}} className="rounded-md border border-[#DCDDD6] px-3 py-2 text-[10px] font-semibold">Edit</button><button onClick={()=>removeEntry(entry)} className="rounded-md border border-[#EAD6D3] px-3 py-2 text-[10px] font-semibold text-[#A33A32]">Delete</button></div></article>)}</div>:<div className="p-12 text-center"><h3 className="font-['Newsreader'] text-[24px]">No knowledge entries found</h3><p className="mt-2 text-[11px] text-[#85877F]">Add approved information so your agent can answer customer questions accurately.</p></div>}</section>
      </>}
    </> : <section className="rounded-lg border border-[#ECEBE5] bg-white p-5"><div className="mb-5 border-b border-[#ECEBE5] pb-4"><h2 className="font-['Newsreader'] text-[26px]">Voice agent settings</h2><p className="mt-1 text-[11px] text-[#85877F]">Define the agent's identity, speaking style, objectives and safety boundaries.</p></div><form onSubmit={saveAgent} className="grid gap-4 md:grid-cols-2"><Field title="Agent name"><input name="agentName" required defaultValue={str(agent.agentName,str(profile.aiPersonaName,"Foolioo Assistant"))} className={input}/></Field><Field title="Speaking style"><select name="tone" required defaultValue={str(agent.tone,str(profile.toneOfVoice,"Warm, professional, knowledgeable, and concise"))} className={input}>{["Warm, professional, knowledgeable, and concise","Friendly and conversational","Formal and professional","Confident and persuasive","Calm and reassuring"].map(x=><option key={x}>{x}</option>)}</select></Field><Field title="Language"><select name="language" defaultValue={str(agent.language,languages[0]?.code??"en-IN")} className={input}>{languages.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}</select></Field><Field title="Voice"><select name="voiceId" defaultValue={str(agent.voiceId)} className={input}><option value="">Provider default</option>{voices.map(v=><option key={v.id} value={v.id}>{v.label}{v.language?` · ${v.language}`:""}</option>)}</select></Field><Field title="Speaking speed"><div className="flex items-center gap-3"><input name="speechRate" type="range" min="0.8" max="1.2" step="0.05" defaultValue={String(agent.speechRate??1)} className="mt-3 flex-1"/><span className="text-[11px] text-[#747878]">0.8x–1.2x</span></div></Field><Field title="Primary objective"><input name="primaryObjective" required defaultValue={str(agent.primaryObjective)} className={input} placeholder="What should the agent accomplish?"/></Field><div className="md:col-span-2"><Field title="Opening greeting"><textarea name="greeting" required rows={3} defaultValue={str(agent.greeting)} className={area} placeholder="Write the first message the agent says when a call connects."/></Field></div><div className="md:col-span-2"><Field title="Handoff instructions"><textarea name="handoffInstructions" rows={3} defaultValue={str(agent.handoffInstructions)} className={area} placeholder="When and how should the agent transfer a conversation to a human?"/></Field></div><div className="md:col-span-2"><Field title="Pronunciation notes"><textarea name="pronunciationNotes" rows={2} defaultValue={str(agent.pronunciationNotes)} className={area} placeholder="Names, acronyms and terms the agent must pronounce correctly."/></Field></div><div className="md:col-span-2"><Field title="Compliance notes"><textarea name="complianceNotes" rows={3} defaultValue={str(agent.complianceNotes,str(profile.complianceNotes))} className={area} placeholder="Required disclosures and statements."/></Field></div><div className="md:col-span-2"><Field title="Safety rules (one per line)"><textarea name="guardrails" required rows={5} defaultValue={Array.isArray(profile.guardrails)?profile.guardrails.join("\n"):"Do not invent prices, policies, deadlines or availability.\nIf the approved knowledge base does not contain an answer, say so and offer human follow-up.\nDo not request sensitive personal or payment information."} className={area}/></Field></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECEBE5] pt-4 md:col-span-2"><p className="max-w-[560px] text-[10px] leading-4 text-[#85877F]">Changes apply to future calls after saving. Run a test call before launching a campaign.</p><button disabled={busy} className="rounded-md bg-[#1B1C18] px-5 py-2.5 text-[11px] font-semibold text-white">{busy?"Saving…":"Save agent settings"}</button></div></form></section>}
  </div>;
}
function Metric({title,value}:{title:string;value:number}) { return <div className="rounded-lg border border-[#ECEBE5] bg-[#FFFEFB] px-5 py-4"><p className="text-[11px] text-[#747878]">{title}</p><p className="mt-2 font-['Newsreader'] text-[30px] leading-none">{value}</p></div>; }
