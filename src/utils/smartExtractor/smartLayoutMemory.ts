import { SmartDocCategory, SmartLearnedLayoutItem, SmartExtractedDocument } from './smartDocTypes';

const STORAGE_KEY = 'wanfinance_smart_learned_layouts_v1';

export function loadSmartLearnedLayouts(): SmartLearnedLayoutItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSmartLearnedLayouts(items: SmartLearnedLayoutItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('[SmartLayoutMemory] Erro ao salvar layouts:', err);
  }
}

export function matchSmartLayout(text: string, category: SmartDocCategory): SmartLearnedLayoutItem | null {
  const layouts = loadSmartLearnedLayouts();
  const normalized = text.toLowerCase();

  for (const layout of layouts) {
    if (category !== 'auto_detect' && layout.category !== category) continue;
    
    // Check if sample keywords all match
    if (layout.sampleKeywords && layout.sampleKeywords.length > 0) {
      const matchCount = layout.sampleKeywords.filter(kw => normalized.includes(kw.toLowerCase())).length;
      if (matchCount >= Math.min(3, layout.sampleKeywords.length)) {
        return layout;
      }
    }
  }
  return null;
}

export function learnSmartDocLayout(doc: SmartExtractedDocument, sampleText: string): SmartLearnedLayoutItem {
  const layouts = loadSmartLearnedLayouts();
  const keywords: string[] = [];

  if (doc.favorecidoNome) keywords.push(doc.favorecidoNome.toLowerCase());
  if (doc.favorecidoCnpjCpf) keywords.push(doc.favorecidoCnpjCpf);
  if (doc.bancoCodigo) keywords.push(doc.bancoCodigo);
  if (doc.montadoraMarca) keywords.push(doc.montadoraMarca.toLowerCase());

  const signature = `SMART_${doc.docCategory.toUpperCase()}_${(doc.favorecidoNome || 'LAYOUT').replace(/\W/g, '_').substring(0, 20)}`;
  
  const existingIndex = layouts.findIndex(l => l.signature === signature);
  const now = new Date().toISOString();

  let newItem: SmartLearnedLayoutItem;

  if (existingIndex >= 0) {
    layouts[existingIndex].timesUsed += 1;
    layouts[existingIndex].lastUsedAt = now;
    layouts[existingIndex].successRate = Math.min(100, layouts[existingIndex].successRate + 1);
    newItem = layouts[existingIndex];
  } else {
    newItem = {
      id: `smart-layout-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      category: doc.docCategory,
      signature,
      layoutName: `${doc.favorecidoNome || 'Layout Personalizado'} (${doc.docCategory})`,
      issuerName: doc.favorecidoNome || 'Emissor Não Identificado',
      issuerCnpj: doc.favorecidoCnpjCpf,
      bankCode: doc.bancoCodigo,
      timesUsed: 1,
      successRate: 98,
      createdAt: now,
      lastUsedAt: now,
      sampleKeywords: keywords,
    };
    layouts.push(newItem);
  }

  saveSmartLearnedLayouts(layouts);
  return newItem;
}
