import React, { useState, useMemo } from "react";
import { useAppStore } from "../store";
import { Plus, ChevronLeft, ChevronRight, X, Check, DollarSign, TrendingUp, Wallet } from "lucide-react";
import type { CloserPayment, PaymentOrigem } from "../types";
import toast from "react-hot-toast";

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Tabela IR 2026 (faixas mensais)
const IR_TABLE = [
  { max: 2259.20, rate: 0, deduction: 0 },
  { max: 2826.65, rate: 0.075, deduction: 169.44 },
  { max: 3751.05, rate: 0.15, deduction: 381.44 },
  { max: 4664.68, rate: 0.225, deduction: 662.77 },
  { max: Infinity, rate: 0.275, deduction: 896.0 },
];

// INSS 2026
const INSS_TABLE = [
  { max: 1518.00, rate: 0.075 },
  { max: 2793.88, rate: 0.09 },
  { max: 4190.83, rate: 0.12 },
  { max: 8157.41, rate: 0.14 },
];

function calcINSS(salarioBruto: number): number {
  let total = 0;
  let prev = 0;
  for (const faixa of INSS_TABLE) {
    const base = Math.min(salarioBruto, faixa.max) - prev;
    if (base <= 0) break;
    total += base * faixa.rate;
    prev = faixa.max;
  }
  return total;
}

function calcIR(baseCalculo: number): number {
  for (const faixa of IR_TABLE) {
    if (baseCalculo <= faixa.max) {
      return Math.max(0, baseCalculo * faixa.rate - faixa.deduction);
    }
  }
  return 0;
}

export const CloserPaymentsView: React.FC = () => {
  const { closerPayments, closerConfig, addPayment, updatePayment, deletePayment, fetchCloserPayments } = useAppStore();
  const [showNew, setShowNew] = useState(false);

  // Mês atual
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const selectedMes = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  // Pagamentos do mês
  const monthPayments = useMemo(() =>
    closerPayments.filter(p => p.mes === selectedMes),
  [closerPayments, selectedMes]);

  // Totais
  const totals = useMemo(() => {
    const totalMrr = monthPayments.reduce((s, p) => s + (p.mrr || 0), 0);
    const totalOt = monthPayments.reduce((s, p) => s + (p.ot || 0), 0);
    const totalComMrr = monthPayments.reduce((s, p) => s + (p.comissao_mrr || 0), 0);
    const totalComOt = monthPayments.reduce((s, p) => s + (p.comissao_ot || 0), 0);
    const totalComissao = totalComMrr + totalComOt;

    const config = closerConfig || { salario_base: 2800, vale_alimentacao: 600 };
    const salarioBruto = config.salario_base + totalComissao;
    const inss = calcINSS(salarioBruto);
    const baseIR = salarioBruto - inss;
    const ir = calcIR(baseIR);
    const salarioLiquido = salarioBruto + (config.vale_alimentacao || 0) - inss - ir;

    return { totalMrr, totalOt, totalComMrr, totalComOt, totalComissao, salarioBruto, inss, ir, salarioLiquido, va: config.vale_alimentacao || 0, base: config.salario_base };
  }, [monthPayments, closerConfig]);

  // Form
  const [form, setForm] = useState<Partial<CloserPayment>>({ mes: selectedMes, lead_name: '', origem: 'inbound', contrato_assinado: true, etapa: '', mrr: 0, ot: 0 });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.lead_name?.trim()) { toast.error('Nome do lead obrigatório'); return; }
    const config = closerConfig || { comissao_mrr_inbound: 0.10, comissao_mrr_outbound: 0.30, comissao_ot_inbound: 0.05, comissao_ot_outbound: 0.15 };
    const mrr = form.mrr || 0;
    const ot = form.ot || 0;
    const isInbound = form.origem === 'inbound';
    const comMrr = mrr * (isInbound ? config.comissao_mrr_inbound : config.comissao_mrr_outbound);
    const comOt = ot * (isInbound ? config.comissao_ot_inbound : config.comissao_ot_outbound);

    await addPayment({
      ...form,
      mes: selectedMes,
      comissao_mrr: Math.round(comMrr * 100) / 100,
      comissao_ot: Math.round(comOt * 100) / 100,
      comissao_total: Math.round((comMrr + comOt) * 100) / 100,
    });
    setShowNew(false);
    setForm({ mes: selectedMes, lead_name: '', origem: 'inbound', contrato_assinado: true, etapa: '', mrr: 0, ot: 0 });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-display font-bold text-white">Meus Pagamentos</h2>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-v4-red)] hover:bg-[var(--color-v4-red-hover)] text-white font-medium text-sm">
          <Plus size={16} /> Registrar Venda
        </button>
      </div>

      {/* Navegação por mês */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-[var(--color-v4-surface)] text-[var(--color-v4-text-muted)] hover:text-white">
          <ChevronLeft size={20} />
        </button>
        <span className="text-lg font-display font-bold text-white capitalize min-w-[200px] text-center">{monthLabel}</span>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-[var(--color-v4-surface)] text-[var(--color-v4-text-muted)] hover:text-white">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-[var(--color-v4-card)] border border-[var(--color-v4-border)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-blue-400" /><span className="text-[10px] text-[var(--color-v4-text-muted)] uppercase">MRR Total</span></div>
          <p className="text-lg font-bold text-blue-400">{fmt.format(totals.totalMrr)}</p>
        </div>
        <div className="bg-[var(--color-v4-card)] border border-[var(--color-v4-border)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-emerald-400" /><span className="text-[10px] text-[var(--color-v4-text-muted)] uppercase">OT Total</span></div>
          <p className="text-lg font-bold text-emerald-400">{fmt.format(totals.totalOt)}</p>
        </div>
        <div className="bg-[var(--color-v4-card)] border border-[var(--color-v4-border)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-amber-400" /><span className="text-[10px] text-[var(--color-v4-text-muted)] uppercase">Comissão</span></div>
          <p className="text-lg font-bold text-amber-400">{fmt.format(totals.totalComissao)}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Wallet size={14} className="text-green-400" /><span className="text-[10px] text-green-400/70 uppercase">Salário Líquido</span></div>
          <p className="text-lg font-bold text-green-400">{fmt.format(totals.salarioLiquido)}</p>
        </div>
      </div>

      {/* Detalhamento salário */}
      <div className="bg-[var(--color-v4-card)] border border-[var(--color-v4-border)] rounded-xl p-4 mb-6">
        <p className="text-xs font-bold text-[var(--color-v4-text-muted)] uppercase mb-2">Composição Salarial</p>
        <div className="grid grid-cols-6 gap-2 text-center">
          {[
            { label: 'Base', value: totals.base, color: 'text-white' },
            { label: 'Comissão', value: totals.totalComissao, color: 'text-amber-400' },
            { label: 'VA', value: totals.va, color: 'text-cyan-400' },
            { label: 'INSS', value: -totals.inss, color: 'text-red-400' },
            { label: 'IR', value: -totals.ir, color: 'text-red-400' },
            { label: 'Líquido', value: totals.salarioLiquido, color: 'text-green-400 font-bold' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-[10px] text-[var(--color-v4-text-muted)]">{s.label}</p>
              <p className={`text-sm ${s.color}`}>{fmt.format(Math.abs(s.value))}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela de vendas do mês */}
      <div className="border border-[var(--color-v4-border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-v4-surface)]">
              <th className="text-left px-4 py-2 text-[10px] text-[var(--color-v4-text-muted)] uppercase">Lead</th>
              <th className="text-left px-2 py-2 text-[10px] text-[var(--color-v4-text-muted)] uppercase">Origem</th>
              <th className="text-left px-2 py-2 text-[10px] text-[var(--color-v4-text-muted)] uppercase">Etapa</th>
              <th className="text-right px-2 py-2 text-[10px] text-[var(--color-v4-text-muted)] uppercase">MRR</th>
              <th className="text-right px-2 py-2 text-[10px] text-[var(--color-v4-text-muted)] uppercase">OT</th>
              <th className="text-right px-2 py-2 text-[10px] text-[var(--color-v4-text-muted)] uppercase">Comissão</th>
              <th className="text-center px-2 py-2 text-[10px] text-[var(--color-v4-text-muted)] uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {monthPayments.map(p => (
              <tr key={p.id} className="border-t border-[var(--color-v4-border)] hover:bg-[var(--color-v4-card-hover)]">
                <td className="px-4 py-2 text-white font-medium">{p.lead_name}</td>
                <td className="px-2 py-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded ${p.origem === 'inbound' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                    {p.origem?.toUpperCase()}
                  </span>
                </td>
                <td className="px-2 py-2 text-xs text-[var(--color-v4-text-muted)]">{p.etapa || '-'}</td>
                <td className="px-2 py-2 text-right text-xs text-blue-400">{p.mrr > 0 ? fmt.format(p.mrr) : '-'}</td>
                <td className="px-2 py-2 text-right text-xs text-emerald-400">{p.ot > 0 ? fmt.format(p.ot) : '-'}</td>
                <td className="px-2 py-2 text-right text-xs text-amber-400 font-medium">{fmt.format(p.comissao_total)}</td>
                <td className="px-2 py-2 text-center">
                  <button onClick={() => deletePayment(p.id)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                </td>
              </tr>
            ))}
            {monthPayments.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--color-v4-text-muted)] text-sm">Nenhuma venda neste mês</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar Venda */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowNew(false)} />
          <div className="relative w-full max-w-md bg-[var(--color-v4-card)] border border-[var(--color-v4-border)] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Registrar Venda — {monthLabel}</h3>
              <button onClick={() => setShowNew(false)} className="text-[var(--color-v4-text-muted)] hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={form.lead_name || ''} onChange={e => set('lead_name', e.target.value)} placeholder="Nome do lead *"
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-v4-bg)] border border-[var(--color-v4-border)] text-white text-sm" autoFocus />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.origem || 'inbound'} onChange={e => set('origem', e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[var(--color-v4-bg)] border border-[var(--color-v4-border)] text-white text-sm">
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                </select>
                <input value={form.etapa || ''} onChange={e => set('etapa', e.target.value)} placeholder="Etapa"
                  className="px-3 py-2 rounded-lg bg-[var(--color-v4-bg)] border border-[var(--color-v4-border)] text-white text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[var(--color-v4-text-muted)] block mb-1">Valor MRR</label>
                  <input type="number" value={form.mrr || ''} onChange={e => set('mrr', Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-v4-bg)] border border-[var(--color-v4-border)] text-white text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--color-v4-text-muted)] block mb-1">Valor OT</label>
                  <input type="number" value={form.ot || ''} onChange={e => set('ot', Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-v4-bg)] border border-[var(--color-v4-border)] text-white text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[var(--color-v4-text-muted)] block mb-1">Data Assinatura</label>
                  <input type="date" value={form.data_assinatura || ''} onChange={e => set('data_assinatura', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-v4-bg)] border border-[var(--color-v4-border)] text-white text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--color-v4-text-muted)] block mb-1">Data Pagamento</label>
                  <input type="date" value={form.data_pagamento || ''} onChange={e => set('data_pagamento', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-v4-bg)] border border-[var(--color-v4-border)] text-white text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--color-v4-border)] text-[var(--color-v4-text-muted)] text-sm">Cancelar</button>
              <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm">
                <Check size={14} /> Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
