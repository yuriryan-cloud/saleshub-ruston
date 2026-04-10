import React, { useState, useMemo } from "react";
import { useAppStore } from "../store";
import { Plus, Search, Phone, ChevronDown, ChevronRight, Edit2, Trash2, X, Check } from "lucide-react";
import { OPPORTUNITY_STATUS_LABELS, OPPORTUNITY_STATUS_COLORS, type CloserOpportunity, type OpportunityStatus } from "../types";
import toast from "react-hot-toast";

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const CloserOpportunitiesView: React.FC = () => {
  const { closerOpportunities, addOpportunity, updateOpportunity, deleteOpportunity } = useAppStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<OpportunityStatus | ''>('');
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<CloserOpportunity | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // Form state
  const [form, setForm] = useState({ empresa: '', nome_contato: '', telefone: '', email: '', status: 'negociacao' as OpportunityStatus, contexto: '', parent_id: '' });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  // Organizar: leads principais (sem parent_id) com indicações aninhadas
  const organized = useMemo(() => {
    const parents = closerOpportunities.filter(o => !o.parent_id);
    const childMap = new Map<string, CloserOpportunity[]>();
    closerOpportunities.filter(o => o.parent_id).forEach(o => {
      const arr = childMap.get(o.parent_id!) || [];
      arr.push(o);
      childMap.set(o.parent_id!, arr);
    });
    return { parents, childMap };
  }, [closerOpportunities]);

  // Filtros
  const filtered = useMemo(() => {
    let items = organized.parents;
    if (search) {
      const s = search.toLowerCase();
      // Incluir pais que matcham OU que tem filhos que matcham
      items = items.filter(p => {
        const parentMatch = p.empresa.toLowerCase().includes(s) || (p.nome_contato || '').toLowerCase().includes(s);
        const children = organized.childMap.get(p.id) || [];
        const childMatch = children.some(c => c.empresa.toLowerCase().includes(s) || (c.nome_contato || '').toLowerCase().includes(s));
        return parentMatch || childMatch;
      });
    }
    if (filterStatus) {
      items = items.filter(p => {
        if (p.status === filterStatus) return true;
        const children = organized.childMap.get(p.id) || [];
        return children.some(c => c.status === filterStatus);
      });
    }
    return items;
  }, [organized, search, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const all = closerOpportunities;
    return {
      total: all.length,
      ganho: all.filter(o => o.status === 'ganho').length,
      negociacao: all.filter(o => o.status === 'negociacao' && !o.parent_id).length,
      indicacoes: all.filter(o => o.parent_id).length,
      perdido: all.filter(o => o.status === 'perdido').length,
    };
  }, [closerOpportunities]);

  const toggleExpand = (id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.empresa.trim()) { toast.error('Nome da empresa obrigatório'); return; }
    if (editing) {
      await updateOpportunity(editing.id, form);
      setEditing(null);
    } else {
      await addOpportunity({ ...form, parent_id: form.parent_id || undefined });
    }
    setShowNew(false);
    setForm({ empresa: '', nome_contato: '', telefone: '', email: '', status: 'negociacao', contexto: '', parent_id: '' });
  };

  const handleEdit = (o: CloserOpportunity) => {
    setForm({ empresa: o.empresa, nome_contato: o.nome_contato || '', telefone: o.telefone || '', email: o.email || '', status: o.status, contexto: o.contexto || '', parent_id: o.parent_id || '' });
    setEditing(o);
    setShowNew(true);
  };

  const handleAddIndicacao = (parentId: string) => {
    setForm({ empresa: '', nome_contato: '', telefone: '', email: '', status: 'indicacao', contexto: '', parent_id: parentId });
    setEditing(null);
    setShowNew(true);
  };

  const OppRow: React.FC<{ o: CloserOpportunity; isChild?: boolean }> = ({ o, isChild }) => (
    <div className={`flex items-center gap-3 px-4 py-3 ${isChild ? 'pl-12 bg-[var(--color-v4-bg)]/50' : 'bg-[var(--color-v4-card)]'} border-b border-[var(--color-v4-border)] hover:bg-[var(--color-v4-card-hover)] transition-colors`}>
      {!isChild && (
        <button onClick={() => toggleExpand(o.id)} className="text-[var(--color-v4-text-muted)] hover:text-white w-5">
          {(organized.childMap.get(o.id) || []).length > 0 ? (
            expandedParents.has(o.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : <span className="w-[14px]" />}
        </button>
      )}
      {isChild && <span className="text-[var(--color-v4-text-muted)] text-xs">↳</span>}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-medium truncate">{o.empresa}</span>
          {o.nome_contato && <span className="text-xs text-[var(--color-v4-text-muted)]">({o.nome_contato})</span>}
        </div>
        {o.contexto && <p className="text-[10px] text-[var(--color-v4-text-muted)] truncate mt-0.5">{o.contexto}</p>}
      </div>

      <span className={`text-[10px] px-2 py-0.5 rounded ${OPPORTUNITY_STATUS_COLORS[o.status]}`}>
        {OPPORTUNITY_STATUS_LABELS[o.status]}
      </span>

      {o.telefone && (
        <a href={`https://wa.me/${o.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
          className="text-green-400 hover:text-green-300" title="WhatsApp">
          <Phone size={14} />
        </a>
      )}

      {!isChild && (
        <button onClick={() => handleAddIndicacao(o.id)} title="Adicionar indicação"
          className="text-purple-400 hover:text-purple-300 text-xs px-1.5 py-0.5 rounded bg-purple-500/10">
          +Ind
        </button>
      )}

      <button onClick={() => handleEdit(o)} className="text-[var(--color-v4-text-muted)] hover:text-white">
        <Edit2 size={12} />
      </button>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-display font-bold text-white">Minhas Oportunidades</h2>
        <button onClick={() => { setEditing(null); setForm({ empresa: '', nome_contato: '', telefone: '', email: '', status: 'negociacao', contexto: '', parent_id: '' }); setShowNew(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-v4-red)] hover:bg-[var(--color-v4-red-hover)] text-white font-medium text-sm">
          <Plus size={16} /> Nova Oportunidade
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Negociação', value: stats.negociacao, color: 'text-yellow-400' },
          { label: 'Ganhos', value: stats.ganho, color: 'text-green-400' },
          { label: 'Indicações', value: stats.indicacoes, color: 'text-purple-400' },
          { label: 'Perdidos', value: stats.perdido, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-[var(--color-v4-card)] border border-[var(--color-v4-border)] rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-[var(--color-v4-text-muted)] uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-v4-text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empresa ou contato..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--color-v4-surface)] border border-[var(--color-v4-border)] text-white text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="px-3 py-2 rounded-lg bg-[var(--color-v4-surface)] border border-[var(--color-v4-border)] text-white text-sm">
          <option value="">Todos</option>
          <option value="negociacao">Negociação</option>
          <option value="ganho">Ganho</option>
          <option value="indicacao">Indicação</option>
          <option value="perdido">Perdido</option>
        </select>
      </div>

      {/* List */}
      <div className="border border-[var(--color-v4-border)] rounded-xl overflow-hidden">
        {filtered.map(parent => (
          <React.Fragment key={parent.id}>
            <OppRow o={parent} />
            {expandedParents.has(parent.id) && (organized.childMap.get(parent.id) || []).map(child => (
              <OppRow key={child.id} o={child} isChild />
            ))}
          </React.Fragment>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-[var(--color-v4-text-muted)] text-center py-8">Nenhuma oportunidade encontrada</p>
        )}
      </div>

      {/* Modal Criar/Editar */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowNew(false)} />
          <div className="relative w-full max-w-md bg-[var(--color-v4-card)] border border-[var(--color-v4-border)] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">{editing ? 'Editar' : form.parent_id ? 'Nova Indicação' : 'Nova Oportunidade'}</h3>
              <button onClick={() => setShowNew(false)} className="text-[var(--color-v4-text-muted)] hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={form.empresa} onChange={e => set('empresa', e.target.value)} placeholder="Nome da empresa *"
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-v4-bg)] border border-[var(--color-v4-border)] text-white text-sm" autoFocus />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.nome_contato} onChange={e => set('nome_contato', e.target.value)} placeholder="Nome do contato"
                  className="px-3 py-2 rounded-lg bg-[var(--color-v4-bg)] border border-[var(--color-v4-border)] text-white text-sm" />
                <input value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="Telefone"
                  className="px-3 py-2 rounded-lg bg-[var(--color-v4-bg)] border border-[var(--color-v4-border)] text-white text-sm" />
              </div>
              <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="Email"
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-v4-bg)] border border-[var(--color-v4-border)] text-white text-sm" />
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-v4-bg)] border border-[var(--color-v4-border)] text-white text-sm">
                <option value="negociacao">Negociação</option>
                <option value="ganho">Ganho</option>
                <option value="perdido">Perdido</option>
                <option value="indicacao">Indicação</option>
              </select>
              <textarea value={form.contexto} onChange={e => set('contexto', e.target.value)} placeholder="Contexto / valor / observações"
                rows={2} className="w-full px-3 py-2 rounded-lg bg-[var(--color-v4-bg)] border border-[var(--color-v4-border)] text-white text-sm resize-none" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--color-v4-border)] text-[var(--color-v4-text-muted)] text-sm">Cancelar</button>
              <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--color-v4-red)] hover:bg-[var(--color-v4-red-hover)] text-white font-bold text-sm">
                <Check size={14} /> {editing ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
