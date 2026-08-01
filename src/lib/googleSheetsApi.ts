export interface GoogleSpreadsheetItem {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetTabInfo {
  title: string;
  sheetId: number;
}

// Search user's Google Drive for Google Sheets files
export async function fetchUserSpreadsheets(accessToken: string): Promise<GoogleSpreadsheetItem[]> {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,webViewLink)&pageSize=20&orderBy=modifiedTime desc`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Falha ao buscar planilhas do Google Drive');
  }

  const data = await response.json();
  return data.files || [];
}

// Fetch Spreadsheet metadata (Sheet tab names, title)
export async function getSpreadsheetDetails(accessToken: string, spreadsheetId: string): Promise<{
  title: string;
  sheets: SheetTabInfo[];
}> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Erro ao obter dados da planilha');
  }

  const data = await response.json();
  const title = data.properties?.title || 'Planilha sem título';
  const sheets: SheetTabInfo[] = (data.sheets || []).map((s: any) => ({
    title: s.properties?.title || 'Sheet1',
    sheetId: s.properties?.sheetId || 0,
  }));

  return { title, sheets };
}

// Fetch values from a specific range or sheet tab
export async function getSpreadsheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string = 'A1:Z100'
): Promise<string[][]> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Erro ao ler dados da planilha');
  }

  const data = await response.json();
  return data.values || [];
}

// Create a new Wanfinance Google Spreadsheet with formatted header & rows
export async function createWanfinanceSpreadsheet(
  accessToken: string,
  title: string,
  boletos: any[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // 1. Create empty spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: title || `Wanfinance - Boletos a Pagar (${new Date().toLocaleDateString('pt-BR')})`,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Falha ao criar nova planilha no Google Sheets');
  }

  const spreadsheetData = await createRes.json();
  const spreadsheetId = spreadsheetData.spreadsheetId;
  const spreadsheetUrl = spreadsheetData.spreadsheetUrl;

  // 2. Prepare headers and rows
  const headers = [
    'Linha Digitável / Barras',
    'Favorecido / Beneficiário',
    'CNPJ / CPF',
    'Valor (R$)',
    'Data Vencimento',
    'Data Pagamento',
    'Seu Número (NF/Ref)',
    'Banco Código',
    'Banco Nome',
    'Validação',
    'Observações',
  ];

  const rows = boletos.map((b) => [
    b.linhaDigitavel || b.codigoBarras || '',
    b.favorecidoNome || '',
    b.favorecidoCnpjCpf || '',
    Number(b.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    b.dataVencimento || '',
    b.dataPagamento || '',
    b.seuNumero || '',
    b.bancoCodigo || '',
    b.bancoNome || '',
    b.isValid ? 'VÁLIDO' : `INVÁLIDO: ${b.validationError || ''}`,
    b.observacoes || '',
  ]);

  const bodyValues = [headers, ...rows];

  // 3. Write data to sheet
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:K${bodyValues.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `A1:K${bodyValues.length}`,
        majorDimension: 'ROWS',
        values: bodyValues,
      }),
    }
  );

  return { spreadsheetId, spreadsheetUrl };
}

// Append boletos to an existing spreadsheet
export async function appendBoletosToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string = 'Sheet1',
  boletos: any[]
) {
  const rows = boletos.map((b) => [
    b.linhaDigitavel || b.codigoBarras || '',
    b.favorecidoNome || '',
    b.favorecidoCnpjCpf || '',
    Number(b.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    b.dataVencimento || '',
    b.dataPagamento || '',
    b.seuNumero || '',
    b.bancoCodigo || '',
    b.bancoNome || '',
    b.isValid ? 'VÁLIDO' : `INVÁLIDO: ${b.validationError || ''}`,
    b.observacoes || '',
  ]);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Erro ao adicionar boletos na planilha');
  }

  return await response.json();
}
