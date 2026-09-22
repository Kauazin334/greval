import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Edit3,
  FileText,
  Filter,
  Footprints,
  HeartPulse,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer } from "@/lib/recharts";
import { apiDelete, apiGet, apiPost, apiPut, apiUpload, friendlyApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface Player {
  id: string;
  full_name: string;
  nickname: string;
  birth_date: string;
  cpf: string;
  photo_url: string;
  city: string;
  club_name: string;
  club_state: string;
  address: string;
  father_name: string;
  father_cpf: string;
  father_phone: string;
  mother_name: string;
  school: string;
  school_grade: string;
  foot: string;
  position: string;
  secondary_position: string;
  category: string;
  jersey_number: number | null;
  status: string;
  height_cm: number | null;
  weight_kg: number | null;
  body_fat: number | null;
  wingspan_cm: number | null;
  shoe_size: string;
  blood_type: string;
  allergies: string;
  medical_notes: string;
  has_medical_restriction: boolean;
  contract_number: string;
  cbf_number: string;
  bid_number: string;
  publication_date: string;
  contract_start: string;
  contract_end: string;
  contract_status: string;
  termination_date: string;
  termination_reason: string;
  market_value: string;
  release_clause: string;
  bid_registered: boolean;
  guardian_name: string;
  guardian_phone: string;
  guardian_cpf: string;
  guardian_email: string;
  relationship: string;
  mother_cpf: string;
  mother_phone: string;
  speed: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defense: number;
  physical: number;
  notes: string;
  history: string;
  documents: PlayerDocument[];
  created_at: string;
  updated_at: string;
}

interface PlayerPage {
  items: Player[];
  total: number;
  limit: number;
  offset: number;
}

interface PlayerDocument {
  document_type: string;
  label: string;
  filename: string;
  size_bytes: number;
  uploaded_at: string;
}

interface PhotoUploadResponse {
  photo_url: string;
  filename: string;
  size_bytes: number;
}

type PlayerInput = Omit<Player, "id" | "created_at" | "updated_at" | "documents">;
type DocumentKind = "rg" | "cpf" | "birth_certificate";
type DocumentFiles = Record<DocumentKind, File | null>;
type ViewMode = "cards" | "table";

const CREST_URL = "https://customer-assets-jt897jd0.emergentagent.net/job_7ae507fb-4325-4851-9878-ee133b6e7293/artifacts/v4q6p5uv_greval.jpg";
const blankPlayer: PlayerInput = {
  full_name: "",
  nickname: "",
  birth_date: "",
  cpf: "",
  photo_url: "",
  city: "Valparaíso",
  club_name: "",
  club_state: "",
  address: "",
  father_name: "",
  father_cpf: "",
  father_phone: "",
  mother_name: "",
  school: "",
  school_grade: "",
  foot: "Direito",
  position: "",
  secondary_position: "",
  category: "17",
  jersey_number: null,
  status: "Ativo",
  height_cm: null,
  weight_kg: null,
  body_fat: null,
  wingspan_cm: null,
  shoe_size: "",
  blood_type: "",
  allergies: "",
  medical_notes: "",
  has_medical_restriction: false,
  contract_number: "",
  cbf_number: "",
  bid_number: "",
  publication_date: "",
  contract_start: "",
  contract_end: "",
  contract_status: "Vigente",
  termination_date: "",
  termination_reason: "",
  market_value: "",
  release_clause: "",
  bid_registered: false,
  guardian_name: "",
  guardian_phone: "",
  guardian_cpf: "",
  guardian_email: "",
  relationship: "",
  mother_cpf: "",
  mother_phone: "",
  speed: 70,
  shooting: 70,
  passing: 70,
  dribbling: 70,
  defense: 70,
  physical: 70,
  notes: "",
  history: "",
};

const categories = ["09", "10", "11", "13", "14", "15", "17", "18", "20", "Profissional"];
const positions = ["Goleiro", "Zagueiro", "Lateral", "Volante", "Meia", "Atacante"];
const statuses = ["Ativo", "DM", "Emprestado", "Inativo"];
const contractStatuses = ["Vigente", "Pendente", "Rescisão"];
const documentKinds: { key: DocumentKind; label: string; helper: string }[] = [
  { key: "rg", label: "RG", helper: "Documento de identidade" },
  { key: "cpf", label: "CPF", helper: "Comprovante do CPF" },
  { key: "birth_certificate", label: "Certidão de nascimento", helper: "Certidão do atleta" },
];

function displayDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const areaCode = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length <= 4) return `(${areaCode}) ${number}`;
  const prefixLength = number.length > 8 ? 5 : 4;
  return `(${areaCode}) ${number.slice(0, prefixLength)}-${number.slice(prefixLength)}`;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function statusClass(status: string) {
  if (status === "Ativo") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  if (status === "DM") return "border-red-400/20 bg-red-400/10 text-red-300";
  if (status === "Emprestado") return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  return "border-slate-500/20 bg-slate-500/10 text-slate-400";
}

function Field({ label, testId, children, className = "" }: { label: string; testId: string; children: ReactNode; className?: string }) {
  return (
    <label data-testid={`field-${testId}`} className={`space-y-2 ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function SelectField({ label, testId, value, onChange, options, placeholder }: { label: string; testId: string; value: string; onChange: (value: string) => void; options: string[]; placeholder?: string }) {
  return (
    <Field label={label} testId={testId}>
      <select data-testid={testId} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 text-sm text-slate-100 outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </Field>
  );
}

function PlayerFormDialog({ open, player, existingDocuments, onOpenChange, onSubmit, saving }: { open: boolean; player: PlayerInput; existingDocuments: PlayerDocument[]; onOpenChange: (open: boolean) => void; onSubmit: (player: PlayerInput, documents: DocumentFiles, photo: File | null) => void; saving: boolean }) {
  const [form, setForm] = useState<PlayerInput>(player);
  const [documentFiles, setDocumentFiles] = useState<DocumentFiles>({ rg: null, cpf: null, birth_certificate: null });
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  if (open && form.full_name !== player.full_name && !form.position && player.position) setForm(player);

  const set = <K extends keyof PlayerInput>(key: K, value: PlayerInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const numberValue = (value: string) => value === "" ? null : Number(value);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.full_name.trim() || !form.position) {
      toast.error("Preencha nome e posição para salvar o atleta.");
      return;
    }
    onSubmit({ ...form, full_name: form.full_name.trim() }, documentFiles, photoFile);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="modal-player-form" className="w-[min(96vw,64rem)] !max-w-none max-h-[92vh] overflow-y-auto border-slate-700 bg-[#0d1526] p-0 text-slate-100 shadow-2xl shadow-black/40">
        <DialogHeader className="border-b border-slate-800 bg-[#111c31] px-6 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-400/10 p-2 text-amber-300"><ClipboardList size={20} /></div>
            <div><DialogTitle className="font-heading text-2xl">{player.full_name ? "Editar atleta" : "Novo jogador"}</DialogTitle><DialogDescription className="mt-1 text-slate-400">Ficha completa do cadastro esportivo e administrativo.</DialogDescription></div>
          </div>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-7 p-6">
          <section data-testid="form-section-personal" className="space-y-4">
            <SectionTitle icon={<UserRound size={16} />} title="Dados pessoais" detail="Identificação e origem do atleta" />
            <div data-testid="player-photo-upload" className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:flex-row sm:items-center">
              {player.photo_url ? <img data-testid="player-photo-preview" src={player.photo_url} alt="Foto atual do atleta" className="h-20 w-20 rounded-2xl object-cover ring-1 ring-white/10" /> : <div data-testid="player-photo-placeholder" className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300 ring-1 ring-blue-400/20"><UserRound size={30} /></div>}
              <div className="flex-1"><p className="text-sm font-semibold text-slate-200">Foto do atleta</p><p className="mt-1 text-xs text-slate-500">Use uma foto de rosto em JPG, PNG ou WEBP, com até 5 MB.</p><label className="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-amber-400/60 hover:text-amber-200"><span>{photoFile ? photoFile.name : player.photo_url ? "Trocar foto" : "Adicionar foto"}</span><input data-testid="input-player-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} /></label></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <Field label="Nome completo *" testId="player-name" className="lg:col-span-2"><Input data-testid="input-player-name" value={form.full_name} onChange={(event) => set("full_name", event.target.value)} placeholder="Ex.: João Pedro Martins" /></Field>
              <Field label="Apelido" testId="player-nickname"><Input data-testid="input-player-nickname" value={form.nickname} onChange={(event) => set("nickname", event.target.value)} placeholder="Como é chamado" /></Field>
              <Field label="Nascimento" testId="player-birth-date"><Input data-testid="input-player-birth-date" type="date" value={form.birth_date} onChange={(event) => set("birth_date", event.target.value)} /></Field>
              <Field label="CPF" testId="player-cpf"><Input data-testid="input-player-cpf" inputMode="numeric" maxLength={14} value={form.cpf} onChange={(event) => set("cpf", formatCpf(event.target.value))} placeholder="000.000.000-00" /></Field>
              <Field label="Cidade" testId="player-city"><Input data-testid="input-player-city" value={form.city} onChange={(event) => set("city", event.target.value)} /></Field>
              <Field label="Clube atual" testId="player-club" className="lg:col-span-2"><Input data-testid="input-player-club" value={form.club_name} onChange={(event) => set("club_name", event.target.value)} placeholder="Ex.: Greval" /></Field>
              <Field label="UF do clube" testId="player-club-state"><Input data-testid="input-player-club-state" value={form.club_state} onChange={(event) => set("club_state", event.target.value)} placeholder="DF" /></Field>
              <Field label="Escola" testId="player-school" className="lg:col-span-2"><Input data-testid="input-player-school" value={form.school} onChange={(event) => set("school", event.target.value)} placeholder="Instituição de ensino" /></Field>
            </div>
          </section>

          <section data-testid="form-section-field" className="space-y-4">
            <SectionTitle icon={<Footprints size={16} />} title="Campo e categoria" detail="Perfil de jogo dentro do elenco" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <SelectField label="Posição principal *" testId="input-player-position" value={form.position} onChange={(value) => set("position", value)} options={positions} placeholder="Escolha" />
              <SelectField label="Posição secundária" testId="input-player-secondary-position" value={form.secondary_position} onChange={(value) => set("secondary_position", value)} options={positions} placeholder="Nenhuma" />
              <SelectField label="Categoria" testId="input-player-category" value={form.category} onChange={(value) => set("category", value)} options={categories} />
              <Field label="Camisa" testId="player-number"><Input data-testid="input-player-number" type="number" min="0" max="99" value={form.jersey_number ?? ""} onChange={(event) => set("jersey_number", numberValue(event.target.value))} /></Field>
              <SelectField label="Status" testId="input-player-status" value={form.status} onChange={(value) => set("status", value)} options={statuses} />
            </div>
          </section>

          <section data-testid="form-section-physical" className="space-y-4">
            <SectionTitle icon={<Dumbbell size={16} />} title="Medidas físicas" detail="Informações para acompanhamento de performance" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <Field label="Altura (cm)" testId="player-height"><Input data-testid="input-player-height" type="number" value={form.height_cm ?? ""} onChange={(event) => set("height_cm", numberValue(event.target.value))} /></Field>
              <Field label="Peso (kg)" testId="player-weight"><Input data-testid="input-player-weight" type="number" value={form.weight_kg ?? ""} onChange={(event) => set("weight_kg", numberValue(event.target.value))} /></Field>
              <Field label="% gordura" testId="player-body-fat"><Input data-testid="input-player-body-fat" type="number" step="0.1" value={form.body_fat ?? ""} onChange={(event) => set("body_fat", numberValue(event.target.value))} /></Field>
              <Field label="Envergadura" testId="player-wingspan"><Input data-testid="input-player-wingspan" type="number" value={form.wingspan_cm ?? ""} onChange={(event) => set("wingspan_cm", numberValue(event.target.value))} /></Field>
              <Field label="Pé dominante" testId="player-foot"><select data-testid="input-player-foot" value={form.foot} onChange={(event) => set("foot", event.target.value)} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 text-sm"><option>Direito</option><option>Esquerdo</option><option>Ambos</option></select></Field>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-7 lg:grid-cols-2">
            <section data-testid="form-section-medical" className="space-y-4">
              <SectionTitle icon={<HeartPulse size={16} />} title="Saúde e fisiologia" detail="Cuidados importantes para a comissão" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tipo sanguíneo" testId="player-blood-type"><Input data-testid="input-player-blood-type" value={form.blood_type} onChange={(event) => set("blood_type", event.target.value)} placeholder="Ex.: O+" /></Field>
                <Field label="Alergias" testId="player-allergies"><Input data-testid="input-player-allergies" value={form.allergies} onChange={(event) => set("allergies", event.target.value)} placeholder="Nenhuma" /></Field>
                <Field label="Observação médica" testId="player-medical-notes" className="col-span-2"><Textarea data-testid="input-player-medical-notes" value={form.medical_notes} onChange={(event) => set("medical_notes", event.target.value)} placeholder="Restrições, acompanhamento ou histórico" /></Field>
              </div>
            </section>
            <section data-testid="form-section-contract" className="space-y-4">
              <SectionTitle icon={<FileText size={16} />} title="Contrato e vínculo" detail="Controle documental do atleta" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Contrato nº" testId="player-contract-number"><Input data-testid="input-player-contract-number" value={form.contract_number} onChange={(event) => set("contract_number", event.target.value)} placeholder="2668665DF" /></Field>
                <SelectField label="Status do contrato" testId="input-player-contract-status" value={form.contract_status} onChange={(value) => set("contract_status", value)} options={contractStatuses} />
                <Field label="Número CBF" testId="player-cbf-number"><Input data-testid="input-player-cbf-number" value={form.cbf_number} onChange={(event) => set("cbf_number", event.target.value)} placeholder="Número CBF" /></Field>
                <Field label="Inscrição BID" testId="player-bid-number"><Input data-testid="input-player-bid-number" value={form.bid_number} onChange={(event) => set("bid_number", event.target.value)} placeholder="Ex.: 401579" /></Field>
                <Field label="Registro BID" testId="player-bid"><select data-testid="input-player-bid" value={String(form.bid_registered)} onChange={(event) => set("bid_registered", event.target.value === "true")} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 text-sm"><option value="false">Pendente</option><option value="true">Regularizado</option></select></Field>
                <Field label="Publicação" testId="player-publication-date"><Input data-testid="input-player-publication-date" type="datetime-local" value={form.publication_date} onChange={(event) => set("publication_date", event.target.value)} /></Field>
                <Field label="Data início" testId="player-contract-start"><Input data-testid="input-player-contract-start" type="date" value={form.contract_start} onChange={(event) => set("contract_start", event.target.value)} /></Field>
                <Field label="Data término" testId="player-contract-end"><Input data-testid="input-player-contract-end" type="date" value={form.contract_end} onChange={(event) => set("contract_end", event.target.value)} /></Field>
                <Field label="Data da rescisão" testId="player-termination-date"><Input data-testid="input-player-termination-date" type="date" value={form.termination_date} onChange={(event) => set("termination_date", event.target.value)} /></Field>
                <Field label="Motivo da rescisão" testId="player-termination-reason" className="sm:col-span-2"><Input data-testid="input-player-termination-reason" value={form.termination_reason} onChange={(event) => set("termination_reason", event.target.value)} placeholder="Se houver" /></Field>
              </div>
            </section>
          </div>

          <section data-testid="form-section-parents" className="space-y-4">
            <SectionTitle icon={<Users size={16} />} title="Pai e mãe" detail="Um cadastro separado para cada responsável familiar" />
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-950/30 p-4 md:grid-cols-4">
              <div className="md:col-span-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">Dados do pai</p></div>
              <Field label="Nome do pai" testId="player-father" className="md:col-span-2"><Input data-testid="input-player-father" value={form.father_name} onChange={(event) => set("father_name", event.target.value)} /></Field>
              <Field label="CPF do pai" testId="player-father-cpf"><Input data-testid="input-player-father-cpf" inputMode="numeric" maxLength={14} value={form.father_cpf} onChange={(event) => set("father_cpf", formatCpf(event.target.value))} placeholder="000.000.000-00" /></Field>
              <Field label="Telefone do pai" testId="player-father-phone"><Input data-testid="input-player-father-phone" inputMode="tel" maxLength={15} value={form.father_phone} onChange={(event) => set("father_phone", formatPhone(event.target.value))} placeholder="(00) 00000-0000" /></Field>
              <div className="mt-2 border-t border-slate-800 pt-4 md:col-span-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">Dados da mãe</p></div>
              <Field label="Nome da mãe" testId="player-mother" className="md:col-span-2"><Input data-testid="input-player-mother" value={form.mother_name} onChange={(event) => set("mother_name", event.target.value)} /></Field>
              <Field label="CPF da mãe" testId="player-mother-cpf"><Input data-testid="input-player-mother-cpf" inputMode="numeric" maxLength={14} value={form.mother_cpf} onChange={(event) => set("mother_cpf", formatCpf(event.target.value))} placeholder="000.000.000-00" /></Field>
              <Field label="Telefone da mãe" testId="player-mother-phone"><Input data-testid="input-player-mother-phone" inputMode="tel" maxLength={15} value={form.mother_phone} onChange={(event) => set("mother_phone", formatPhone(event.target.value))} placeholder="(00) 00000-0000" /></Field>
              <Field label="Anotações gerais" testId="player-notes" className="md:col-span-4"><Textarea data-testid="input-player-notes" value={form.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Perfil, pontos fortes, pontos de desenvolvimento..." /></Field>
            </div>
          </section>

          <section data-testid="form-section-history" className="space-y-4">
            <SectionTitle icon={<ClipboardList size={16} />} title="Histórico completo" detail="Registre passagens, publicações, alterações e observações administrativas" />
            <Field label="Histórico do atleta" testId="player-history"><Textarea data-testid="input-player-history" value={form.history} onChange={(event) => set("history", event.target.value)} placeholder="Ex.: inscrição no BID, clubes anteriores, rescisão ou outras movimentações..." /></Field>
          </section>

          <section data-testid="form-section-documents" className="space-y-4">
            <SectionTitle icon={<FileText size={16} />} title="Documentação em PDF" detail="Anexe RG, CPF e certidão de nascimento do atleta" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {documentKinds.map((document) => {
                const existing = existingDocuments.find((item) => item.document_type === document.key);
                const selected = documentFiles[document.key];
                return <div data-testid={`document-upload-${document.key}`} key={document.key} className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-200">{document.label}</p><p className="mt-1 text-xs text-slate-500">{document.helper}</p></div><FileText size={17} className="text-amber-300" /></div>
                  <label className="mt-4 flex cursor-pointer items-center justify-center rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-amber-400/60 hover:text-amber-200"><span>{selected ? selected.name : "Escolher PDF"}</span><input data-testid={`input-document-${document.key}`} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => setDocumentFiles((current) => ({ ...current, [document.key]: event.target.files?.[0] ?? null }))} /></label>
                  <p className="mt-2 truncate text-[10px] text-slate-500">{existing ? `Atual: ${existing.filename}` : "Máximo de 10 MB"}</p>
                </div>;
              })}
            </div>
            <p data-testid="document-upload-help" className="text-xs text-slate-500">Os arquivos são aceitos somente em PDF. Ao editar, enviar um novo arquivo substitui o documento anterior.</p>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end">
            <Button data-testid="form-player-cancel" type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400">Cancelar</Button>
            <Button data-testid="form-player-submit" type="submit" disabled={saving} className="bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">{saving ? "Salvando..." : "Salvar jogador"}<ArrowUpRight size={16} /></Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="flex items-center gap-3 border-b border-slate-800 pb-3"><div className="rounded-lg bg-blue-500/10 p-2 text-blue-300">{icon}</div><div><h3 className="font-heading text-lg font-semibold text-slate-100">{title}</h3><p className="text-xs text-slate-500">{detail}</p></div></div>;
}

function PlayerAvatar({ player, size = "md" }: { player: Player; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-24 w-24 text-3xl" : size === "sm" ? "h-9 w-9 text-xs" : "h-14 w-14 text-lg";
  return player.photo_url ? <img data-testid={`player-photo-${player.id}`} src={player.photo_url} alt={`Foto de ${player.full_name}`} className={`${sizeClass} rounded-2xl object-cover ring-1 ring-white/10`} /> : <div data-testid={`player-photo-${player.id}`} className={`${sizeClass} flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-900 font-heading font-bold text-white ring-1 ring-white/10`}>{initials(player.full_name)}</div>;
}

function StatCard({ label, value, hint, icon, tone, testId }: { label: string; value: number; hint: string; icon: ReactNode; tone: "blue" | "green" | "red" | "gold"; testId: string }) {
  const toneClasses = { blue: "border-blue-400/20 bg-blue-500/10 text-blue-300", green: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300", red: "border-red-400/20 bg-red-500/10 text-red-300", gold: "border-amber-400/20 bg-amber-500/10 text-amber-300" };
  return <Card data-testid={testId} className="border-slate-800 bg-[#0f172a]/80 p-5 shadow-xl shadow-black/10 transition-transform duration-200 hover:-translate-y-1"><div className="flex items-start justify-between"><div><p data-testid={`${testId}-label`} className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p><p data-testid={`${testId}-value`} className="mt-3 font-heading text-4xl font-bold tracking-tight text-white">{value}</p></div><div className={`rounded-xl border p-2.5 ${toneClasses[tone]}`}>{icon}</div></div><p data-testid={`${testId}-hint`} className="mt-3 text-xs text-slate-500">{hint}</p></Card>;
}

function PlayerCard({ player, onView, onEdit, onDelete }: { player: Player; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  return <Card data-testid={`player-card-${player.id}`} className="group relative overflow-hidden border-slate-800 bg-[#0f172a] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-950/40">
    <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/10 blur-2xl transition-colors group-hover:bg-amber-400/10" />
    <div className="relative flex items-start justify-between"><div className="flex items-center gap-3"><PlayerAvatar player={player} /><div><h3 data-testid={`player-name-${player.id}`} className="max-w-[150px] truncate font-heading text-lg font-semibold text-white">{player.full_name}</h3><p data-testid={`player-nickname-${player.id}`} className="text-xs text-slate-400">{player.nickname ? `“${player.nickname}”` : "Sem apelido"}</p></div></div><div className="flex flex-col items-end gap-2"><span data-testid={`player-number-${player.id}`} className="font-heading text-2xl font-bold text-amber-300">{player.jersey_number ?? "—"}</span><Badge data-testid={`player-position-${player.id}`} className="border-blue-400/20 bg-blue-400/10 text-[10px] text-blue-200">{player.position || "Sem posição"}</Badge></div></div>
    <div className="relative mt-5 grid grid-cols-3 divide-x divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/40 py-3"><div className="text-center"><p className="text-[9px] uppercase tracking-widest text-slate-500">Altura</p><p data-testid={`player-height-${player.id}`} className="mt-1 text-sm font-semibold text-slate-200">{player.height_cm ? `${player.height_cm} cm` : "—"}</p></div><div className="text-center"><p className="text-[9px] uppercase tracking-widest text-slate-500">Peso</p><p data-testid={`player-weight-${player.id}`} className="mt-1 text-sm font-semibold text-slate-200">{player.weight_kg ? `${player.weight_kg} kg` : "—"}</p></div><div className="text-center"><p className="text-[9px] uppercase tracking-widest text-slate-500">Pé</p><p className="mt-1 text-sm font-semibold text-slate-200">{player.foot || "—"}</p></div></div>
    <div className="relative mt-4 flex items-center justify-between"><div><Badge data-testid={`player-status-${player.id}`} className={`border text-[10px] ${statusClass(player.status)}`}><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />{player.status}</Badge><p data-testid={`player-category-${player.id}`} className="mt-2 text-xs text-slate-500">{player.category}</p></div><div className="flex gap-1"><Button data-testid={`button-view-player-${player.id}`} size="icon-sm" variant="ghost" onClick={onView} className="text-slate-400 hover:bg-blue-500/10 hover:text-blue-300" title="Abrir ficha"><ChevronRight size={17} /></Button><Button data-testid={`button-edit-player-${player.id}`} size="icon-sm" variant="ghost" onClick={onEdit} className="text-slate-400 hover:bg-amber-500/10 hover:text-amber-300" title="Editar"><Edit3 size={15} /></Button><Button data-testid={`button-delete-player-${player.id}`} size="icon-sm" variant="ghost" onClick={onDelete} className="text-slate-400 hover:bg-red-500/10 hover:text-red-300" title="Excluir"><Trash2 size={15} /></Button></div></div>
  </Card>;
}

function ProfileDialog({ player, onClose, onEdit }: { player: Player | null; onClose: () => void; onEdit: () => void }) {
  if (!player) return null;
  const radarData = [{ subject: "Velocidade", value: player.speed }, { subject: "Chute", value: player.shooting }, { subject: "Passe", value: player.passing }, { subject: "Drible", value: player.dribbling }, { subject: "Defesa", value: player.defense }, { subject: "Físico", value: player.physical }];
  const rating = Math.round(radarData.reduce((total, item) => total + item.value, 0) / radarData.length);
  return <Dialog open={Boolean(player)} onOpenChange={(open) => !open && onClose()}>
    <DialogContent data-testid="modal-player-profile" className="max-h-[92vh] max-w-4xl overflow-y-auto border-slate-700 bg-[#0d1526] text-slate-100">
      <DialogHeader className="text-left"><DialogTitle className="font-heading text-2xl">Ficha técnica do atleta</DialogTitle><DialogDescription className="text-slate-400">Visão completa para comissão e departamento de futebol.</DialogDescription></DialogHeader>
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-[#152b60] via-[#0f172a] to-[#101827] p-5"><div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" /><div className="relative flex flex-col gap-5 sm:flex-row sm:items-center"><PlayerAvatar player={player} size="lg" /><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><Badge className="border-amber-400/30 bg-amber-400/10 text-amber-300">#{player.jersey_number ?? "—"}</Badge><Badge className={statusClass(player.status)}>{player.status}</Badge><Badge className="border-slate-600 bg-slate-900/50 text-slate-300">{player.contract_status}</Badge></div><h2 data-testid="profile-player-name" className="mt-2 font-heading text-3xl font-bold text-white">{player.full_name}</h2><p data-testid="profile-player-summary" className="mt-1 text-slate-300">{player.position} · {player.category}{player.nickname ? ` · “${player.nickname}”` : ""}</p><div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400"><span className="inline-flex items-center gap-1.5"><MapPin size={13} />{player.city || "Cidade não informada"}</span><span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />Nasc. {displayDate(player.birth_date)}</span><span className="inline-flex items-center gap-1.5"><Footprints size={13} />Pé {player.foot}</span><span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} />{player.club_name || "Clube não informado"}{player.club_state ? ` · ${player.club_state}` : ""}</span></div></div><div className="flex flex-col items-center rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-3"><span className="font-mono text-4xl font-bold text-amber-300">{rating}</span><span className="text-[9px] font-bold uppercase tracking-widest text-amber-200/70">rating</span></div></div></div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.25fr]"><Card data-testid="profile-physical-card" className="border-slate-800 bg-slate-900/60 p-5"><div className="mb-4 flex items-center gap-2"><Dumbbell size={16} className="text-emerald-300" /><h3 className="font-semibold text-white">Leitura física</h3></div><div className="grid grid-cols-2 gap-3">{[["Altura", player.height_cm ? `${player.height_cm} cm` : "—"], ["Peso", player.weight_kg ? `${player.weight_kg} kg` : "—"], ["% Gordura", player.body_fat ? `${player.body_fat}%` : "—"], ["Contrato", displayDate(player.contract_end)]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-200">{value}</p></div>)}</div><div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-widest text-slate-500">Saúde</p><p data-testid="profile-medical-notes" className="mt-1 text-sm text-slate-300">{player.medical_notes || "Sem observações médicas"}</p></div></Card><Card data-testid="profile-radar-card" className="border-slate-800 bg-slate-900/60 p-5"><div className="mb-1 flex items-center gap-2"><Activity size={16} className="text-blue-300" /><h3 className="font-semibold text-white">Radar de atributos</h3></div><div className="h-64"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData}><PolarGrid stroke="#334155" /><PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11 }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Radar dataKey="value" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.25} strokeWidth={2} /></RadarChart></ResponsiveContainer></div></Card></div>
        <Card data-testid="profile-registration-card" className="border-slate-800 bg-slate-900/60 p-5"><div className="mb-4 flex items-center gap-2"><BadgeCheck size={16} className="text-amber-300" /><h3 className="font-semibold text-white">Registro e contrato</h3></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{[["Contrato", player.contract_number || "—"], ["Nº CBF", player.cbf_number || "—"], ["Inscrição BID", player.bid_number || "—"], ["Publicação", displayDate(player.publication_date)], ["Data início", displayDate(player.contract_start)]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p><p data-testid={`profile-${label.toLowerCase().replaceAll(" ", "-")}`} className="mt-1 truncate text-sm font-semibold text-slate-200">{value}</p></div>)}</div></Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><InfoBlock icon={<FileText size={15} />} title="Vínculo" value={player.contract_number || "Não cadastrado"} detail={player.bid_registered ? "BID regularizado" : "BID pendente"} /><InfoBlock icon={<Users size={15} />} title="Pai" value={player.father_name || "Não cadastrado"} detail={player.father_phone || player.father_cpf || "Contato não informado"} /><InfoBlock icon={<UserRound size={15} />} title="Mãe" value={player.mother_name || "Não cadastrada"} detail={player.mother_phone || player.mother_cpf || "Contato não informado"} /></div>
        <Card data-testid="profile-history" className="border-slate-800 bg-slate-900/60 p-5"><div className="mb-3 flex items-center gap-2"><ClipboardList size={16} className="text-blue-300" /><h3 className="font-semibold text-white">Histórico completo</h3></div><p data-testid="profile-history-text" className="whitespace-pre-line text-sm leading-6 text-slate-300">{player.history || player.notes || "Nenhum histórico registrado."}</p></Card>
        <Card data-testid="profile-documents" className="border-slate-800 bg-slate-900/60 p-5"><div className="mb-3 flex items-center gap-2"><FileText size={16} className="text-amber-300" /><h3 className="font-semibold text-white">Documentos do atleta</h3></div>{player.documents.length === 0 ? <p data-testid="profile-documents-empty" className="text-sm text-slate-500">Nenhum documento PDF anexado.</p> : <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{player.documents.map((document) => <a data-testid={`profile-document-${document.document_type}`} key={document.document_type} href={`/api/players/${player.id}/documents/${document.document_type}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-300 hover:border-amber-400/40 hover:text-amber-200"><span className="truncate">{document.label}</span><ArrowUpRight size={14} /></a>)}</div>}</Card>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end"><Button data-testid="button-close-profile" variant="ghost" onClick={onClose} className="text-slate-400">Fechar</Button><Button data-testid="button-print-profile" variant="outline" onClick={() => window.print()} className="border-slate-700 text-slate-200"><Printer size={16} /> Imprimir / salvar PDF</Button><Button data-testid="button-profile-edit" onClick={onEdit} className="bg-amber-400 font-bold text-slate-950 hover:bg-amber-300"><Edit3 size={16} /> Editar atleta</Button></div>
      </div>
    </DialogContent>
  </Dialog>;
}

function InfoBlock({ icon, title, value, detail }: { icon: ReactNode; title: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><div className="flex items-center gap-2 text-blue-300">{icon}<span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</span></div><p className="mt-3 truncate text-sm font-semibold text-slate-200">{value}</p><p className="mt-1 truncate text-xs text-slate-500">{detail}</p></div>;
}

export default function Home() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [profilePlayer, setProfilePlayer] = useState<Player | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);

  const playersQuery = useQuery({ queryKey: ["players"], queryFn: () => apiGet<PlayerPage>("/players?limit=100"), retry: false });
  const players = playersQuery.data?.items ?? [];
  const saveMutation = useMutation({
    mutationFn: async ({ id, payload, documents, photo }: { id?: string; payload: PlayerInput; documents: DocumentFiles; photo: File | null }) => {
      const savedPlayer = id ? await apiPut<Player>(`/players/${id}`, payload) : await apiPost<Player>("/players", payload);
      const entries = (Object.entries(documents) as [DocumentKind, File | null][]).filter((entry): entry is [DocumentKind, File] => entry[1] !== null);
      const uploadRequests: Promise<unknown>[] = entries.map(([documentType, file]) => {
        const formData = new FormData();
        formData.append("document_type", documentType);
        formData.append("file", file);
        return apiUpload<PlayerDocument>(`/players/${savedPlayer.id}/documents`, formData);
      });
      if (photo) {
        const photoData = new FormData();
        photoData.append("file", photo);
        uploadRequests.push(apiUpload<PhotoUploadResponse>(`/players/${savedPlayer.id}/photo`, photoData));
      }
      const uploads = await Promise.allSettled(uploadRequests);
      return { player: savedPlayer, uploadFailed: uploads.some((result) => result.status === "rejected") };
    },
    onSuccess: ({ uploadFailed }, variables) => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      setFormOpen(false);
      setEditingPlayer(null);
      toast.success(variables.id ? "Jogador atualizado com sucesso." : "Jogador cadastrado no elenco.");
      if (uploadFailed) toast.error("Jogador salvo, mas algum arquivo não pôde ser enviado.");
    },
    onError: (error) => toast.error(friendlyApiError(error)),
  });
  const deleteMutation = useMutation({ mutationFn: (id: string) => apiDelete<void>(`/players/${id}`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["players"] }); setDeleteTarget(null); toast.success("Jogador removido do elenco."); }, onError: () => toast.error("Não foi possível excluir este jogador.") });

  const filteredPlayers = useMemo(() => players.filter((player) => {
    const normalizedSearch = search.toLowerCase();
    return (!normalizedSearch || player.full_name.toLowerCase().includes(normalizedSearch) || player.nickname.toLowerCase().includes(normalizedSearch)) && (!categoryFilter || player.category === categoryFilter) && (!positionFilter || player.position === positionFilter) && (!statusFilter || player.status === statusFilter);
  }), [players, search, categoryFilter, positionFilter, statusFilter]);

  const openNew = () => { setEditingPlayer(null); setFormOpen(true); };
  const openEdit = (player: Player) => { setProfilePlayer(null); setEditingPlayer(player); setFormOpen(true); };
  const formPlayer = editingPlayer ? { ...editingPlayer } : { ...blankPlayer };
  const clearFilters = () => { setSearch(""); setCategoryFilter(""); setPositionFilter(""); setStatusFilter(""); };
  const activeCount = players.filter((player) => player.status === "Ativo").length;
  const medicalCount = players.filter((player) => player.status === "DM").length;
  const contractCount = players.filter((player) => Boolean(player.contract_end)).length;

  return <div data-testid="app-shell" className="min-h-svh bg-[#070b14] text-slate-100">
    <header data-testid="app-header" className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070b14]/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><img data-testid="club-crest-img" src={CREST_URL} alt="Escudo do Greval" className="h-11 w-11 rounded-xl object-cover ring-1 ring-amber-400/40" /><div className="min-w-0"><p data-testid="club-name" className="truncate font-heading text-lg font-bold tracking-tight text-white">GREVAL</p><p data-testid="club-subtitle" className="hidden text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 sm:block">Cadastro de jogadores</p></div></div><div className="hidden items-center gap-6 md:flex"><div className="text-right"><p className="text-[9px] uppercase tracking-widest text-slate-500">Elenco</p><p data-testid="header-roster-count" className="font-mono text-sm text-slate-200">{players.length} atletas</p></div><div className="h-7 w-px bg-slate-800" /><div className="text-right"><p className="text-[9px] uppercase tracking-widest text-slate-500">Status</p><p data-testid="header-status" className="inline-flex items-center gap-1.5 text-sm text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Operacional</p></div><Button data-testid="button-new-player-header" onClick={openNew} className="bg-amber-400 font-bold text-slate-950 shadow-lg shadow-amber-500/10 hover:bg-amber-300"><Plus size={17} /> Novo jogador</Button></div><Button data-testid="button-new-player-mobile" size="icon" onClick={openNew} className="bg-amber-400 text-slate-950 hover:bg-amber-300 md:hidden"><Plus size={19} /></Button></div></header>
    <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
      <section data-testid="stats-section" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard testId="stat-total-players" label="Total de jogadores" value={players.length} hint="Atletas cadastrados na base" icon={<Users size={19} />} tone="blue" /><StatCard testId="stat-active-players" label="Ativos no elenco" value={activeCount} hint="Disponíveis para convocação" icon={<BadgeCheck size={19} />} tone="green" /><StatCard testId="stat-medical-players" label="Departamento médico" value={medicalCount} hint="Precisam de acompanhamento" icon={<ShieldAlert size={19} />} tone="red" /><StatCard testId="stat-contracts" label="Vínculos registrados" value={contractCount} hint="Contratos com data cadastrada" icon={<ClipboardList size={19} />} tone="gold" /></section>
      <section id="roster" data-testid="roster-section" className="mt-10"><div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><div className="flex items-center gap-2 text-amber-300"><span className="h-px w-8 bg-amber-400" /><span className="text-[10px] font-bold uppercase tracking-[0.2em]">Base de dados</span></div><h2 data-testid="roster-title" className="mt-2 font-heading text-3xl font-bold tracking-tight text-white">Elenco do Greval</h2><p data-testid="roster-count" className="mt-1 text-sm text-slate-500">{filteredPlayers.length} de {players.length} jogadores exibidos</p></div><div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-1"><Button data-testid="toggle-view-cards" size="sm" variant={viewMode === "cards" ? "secondary" : "ghost"} onClick={() => setViewMode("cards")} className={viewMode === "cards" ? "bg-blue-500/20 text-blue-200" : "text-slate-500"}><LayoutGrid size={15} /> Cards</Button><Button data-testid="toggle-view-table" size="sm" variant={viewMode === "table" ? "secondary" : "ghost"} onClick={() => setViewMode("table")} className={viewMode === "table" ? "bg-blue-500/20 text-blue-200" : "text-slate-500"}><List size={15} /> Tabela</Button></div></div>
        <div data-testid="roster-filters" className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-[#0f172a]/70 p-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto]"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><Input data-testid="input-search-player" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou apelido..." className="border-slate-700 bg-slate-950/50 pl-9" /></div><select data-testid="select-category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-950/50 px-3 text-sm text-slate-300"><option value="">Todas categorias</option>{categories.map((category) => <option key={category}>{category}</option>)}</select><select data-testid="select-position-filter" value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-950/50 px-3 text-sm text-slate-300"><option value="">Todas posições</option>{positions.map((position) => <option key={position}>{position}</option>)}</select><select data-testid="select-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-950/50 px-3 text-sm text-slate-300"><option value="">Todos status</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><Button data-testid="button-clear-filters" variant="ghost" onClick={clearFilters} className="text-slate-500 hover:text-slate-200"><Filter size={15} /> Limpar</Button></div>
        {playersQuery.isError && <div data-testid="api-fallback-notice" className="mb-5 flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200"><ShieldAlert size={17} /> Não foi possível carregar o banco agora. Atualize a página para tentar novamente.</div>}
        {filteredPlayers.length === 0 ? <div data-testid="empty-roster" className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 py-16 text-center"><Search className="mx-auto text-slate-600" size={28} /><p className="mt-3 font-semibold text-slate-300">Nenhum jogador encontrado</p><p className="mt-1 text-sm text-slate-500">Tente ajustar os filtros da busca.</p></div> : viewMode === "cards" ? <div data-testid="player-card-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filteredPlayers.map((player) => <PlayerCard key={player.id} player={player} onView={() => setProfilePlayer(player)} onEdit={() => openEdit(player)} onDelete={() => setDeleteTarget(player)} />)}</div> : <div data-testid="player-table" className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a]"><div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-slate-800 bg-slate-950/40 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 md:grid"><span>Atleta</span><span>Posição</span><span>Categoria</span><span>Status</span><span>Contrato</span><span /></div>{filteredPlayers.map((player) => <div data-testid={`player-row-${player.id}`} key={player.id} className="grid grid-cols-2 gap-4 border-b border-slate-800/80 px-5 py-4 last:border-0 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] md:items-center"><div className="flex items-center gap-3"><PlayerAvatar player={player} size="sm" /><div><p className="font-semibold text-slate-200">{player.full_name}</p><p className="text-xs text-slate-500">#{player.jersey_number ?? "—"} · {player.nickname || "Sem apelido"}</p></div></div><div className="text-sm text-slate-300">{player.position}</div><div className="text-sm text-slate-400">{player.category}</div><div><Badge className={`border text-[10px] ${statusClass(player.status)}`}>{player.status}</Badge></div><div className="text-sm text-slate-400">{displayDate(player.contract_end)}</div><div className="flex justify-end gap-1"><Button data-testid={`table-view-player-${player.id}`} size="icon-xs" variant="ghost" onClick={() => setProfilePlayer(player)}><ChevronRight size={15} /></Button><Button data-testid={`table-edit-player-${player.id}`} size="icon-xs" variant="ghost" onClick={() => openEdit(player)}><Edit3 size={14} /></Button></div></div>)}</div>}
      </section>
      <footer data-testid="app-footer" className="mt-14 flex flex-col justify-between gap-3 border-t border-slate-800 pt-5 text-xs text-slate-600 sm:flex-row"><p>Greval · Cadastro de jogadores</p><p className="font-mono">Dados protegidos no banco local</p></footer>
    </main>
    <PlayerFormDialog key={`${editingPlayer?.id ?? "new"}-${formOpen}`} open={formOpen} player={formPlayer} existingDocuments={editingPlayer?.documents ?? []} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingPlayer(null); }} onSubmit={(payload, documents, photo) => saveMutation.mutate({ id: editingPlayer?.id, payload, documents, photo })} saving={saveMutation.isPending} />
    <ProfileDialog player={profilePlayer} onClose={() => setProfilePlayer(null)} onEdit={() => profilePlayer && openEdit(profilePlayer)} />
    <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><DialogContent data-testid="dialog-confirm-delete" className="max-w-md border-slate-700 bg-[#0d1526] text-slate-100"><DialogHeader><div className="mx-auto rounded-full bg-red-400/10 p-3 text-red-300"><Trash2 size={22} /></div><DialogTitle className="text-center font-heading text-xl">Excluir jogador?</DialogTitle><DialogDescription className="text-center text-slate-400">Esta ação remove a ficha de <strong className="text-slate-200">{deleteTarget?.full_name}</strong> do banco de dados.</DialogDescription></DialogHeader><div className="flex justify-end gap-3 pt-2"><Button data-testid="button-cancel-delete" variant="ghost" onClick={() => setDeleteTarget(null)} className="text-slate-400">Cancelar</Button><Button data-testid="button-confirm-delete" variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>{deleteMutation.isPending ? "Excluindo..." : "Excluir ficha"}</Button></div></DialogContent></Dialog>
  </div>;
}
