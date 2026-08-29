import React from 'react';
import { 
  Sparkles, 
  Car, 
  Building2, 
  FileText, 
  Landmark, 
  MapPin, 
  Zap, 
  Check, 
  ChevronRight,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { SmartDocCategory, SmartDocTypeOption } from '../../utils/smartExtractor/smartDocTypes';

interface SmartDocTypeSelectorProps {
  selectedCategory: SmartDocCategory;
  onSelectCategory: (cat: SmartDocCategory) => void;
  disabled?: boolean;
}

export const SMART_DOC_OPTIONS: SmartDocTypeOption[] = [
  {
    id: 'auto_detect',
    name: 'Detectar Automaticamente',
    badge: 'Recomendado (IA Triagem)',
    badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    iconName: 'Sparkles',
    description: 'A IA faz a varredura prévia de âncoras e direciona ao extrator ideal automaticamente.',
    examples: ['Todos os tipos de PDFs', 'Triagem sem intervenção prévia'],
  },
  {
    id: 'montadora_fidc',
    name: 'Boletos de Montadoras & FIDC',
    badge: 'Alta Precisão',
    badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
    iconName: 'Car',
    description: 'Compromissos, Chassis, Relação ao Caixa e FIDCs automotivos de todas as montadoras.',
    examples: ['LEAPMOTOR', 'GEELY', 'OMODA/JAECOO', 'FIAT (Vita Auto)', 'JEEP (Fidis)', 'RENAULT', 'FORD', 'BYD', 'BAJAJ'],
  },
  {
    id: 'boleto_bancario',
    name: 'Boleto Bancário Tradicional',
    badge: 'FEBRABAN',
    badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    iconName: 'Building2',
    description: 'Títulos de cobrança padrão emitidos por bancos comerciais públicos e privados.',
    examples: ['Bradesco', 'Itaú', 'Santander', 'Banco do Brasil', 'Caixa', 'Safra', 'BTG', 'Sicoob', 'Sicredi', 'Inter'],
  },
  {
    id: 'detran_ipva',
    name: 'DETRAN, IPVA & Licenciamento',
    badge: 'Trânsito Estadual',
    badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
    iconName: 'FileText',
    description: 'Guias de recolhimento de IPVA, Licenciamento Anual, DPVAT e Multas de Trânsito.',
    examples: ['DETRAN-SP', 'DETRAN-MG', 'DETRAN-RJ', 'DETRAN-PR', 'DETRAN-CE', 'SEFAZ IPVA'],
  },
  {
    id: 'darf_das_tributos',
    name: 'Tributos Federais (DARF / DAS)',
    badge: 'Receita Federal',
    badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20',
    iconName: 'Landmark',
    description: 'Documentos de Arrecadação de Receitas Federais, Simples Nacional (DAS) e GPS.',
    examples: ['DARF Numerado', 'DARF Ordinário', 'DAS Simples Nacional', 'PGFN'],
  },
  {
    id: 'gru_uniao',
    name: 'GRU (Guia de Recolhimento da União)',
    badge: 'STN / Federal',
    badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20',
    iconName: 'Landmark',
    description: 'Guias de recolhimento a favor de órgãos federais com Unidade Gestora e Gestão.',
    examples: ['GRU Simples', 'GRU Cobrança', 'Ministérios', 'Autarquias Federais'],
  },
  {
    id: 'gnre_icms',
    name: 'GNRE (Tributos Estaduais)',
    badge: 'ICMS ST / DIFAL',
    badgeColor: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    iconName: 'MapPin',
    description: 'Guia Nacional de Recolhimento de Tributos Estaduais para fretes e operações interestaduais.',
    examples: ['ICMS ST', 'DIFAL', 'Taxas Estaduais', 'SEFAZ'],
  },
  {
    id: 'concessionarias',
    name: 'Concessionárias & Consumo',
    badge: 'Utilidades',
    badgeColor: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/20',
    iconName: 'Zap',
    description: 'Contas e faturas de serviços públicos com código de barras de 48 dígitos.',
    examples: ['Enel', 'CPFL', 'Cemig', 'Sabesp', 'Copasa', 'Vivo', 'Claro', 'Tim', 'Comgás'],
  },
];

export const SmartDocTypeSelector: React.FC<SmartDocTypeSelectorProps> = ({
  selectedCategory,
  onSelectCategory,
  disabled = false,
}) => {
  const getIcon = (name: string) => {
    switch (name) {
      case 'Sparkles': return <Sparkles className="w-5 h-5" />;
      case 'Car': return <Car className="w-5 h-5" />;
      case 'Building2': return <Building2 className="w-5 h-5" />;
      case 'FileText': return <FileText className="w-5 h-5" />;
      case 'Landmark': return <Landmark className="w-5 h-5" />;
      case 'MapPin': return <MapPin className="w-5 h-5" />;
      case 'Zap': return <Zap className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-500" />
            <span>Selecione o Tipo de Documento antes da Extração</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Escolher a categoria ativa os parsers e dicionários específicos para acelerar e maximizar a assertividade.
          </p>
        </div>

        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.06]">
          {SMART_DOC_OPTIONS.length} categorias disponíveis
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {SMART_DOC_OPTIONS.map((opt) => {
          const isSelected = selectedCategory === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectCategory(opt.id)}
              className={`text-left p-3 rounded-2xl border transition-all relative flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/40 ring-2 ring-blue-500/30 shadow-sm'
                  : 'bg-white/80 dark:bg-[#242426]/80 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.08]'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99]'}`}
            >
              <div>
                <div className="flex items-start justify-between gap-1.5 mb-2">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-blue-500 text-white shadow-xs shadow-blue-500/30'
                        : 'bg-black/[0.05] dark:bg-white/[0.08] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {getIcon(opt.iconName)}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${opt.badgeColor}`}>
                    {opt.badge}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                  {opt.name}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {opt.description}
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-[10px] text-slate-400">
                <span className="truncate max-w-[150px] font-mono">
                  {opt.examples.slice(0, 3).join(', ')}
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0 ml-1" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
