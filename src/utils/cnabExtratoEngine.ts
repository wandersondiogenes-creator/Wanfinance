import {
  ExtratoTransaction,
  LearnedCNABExtratoLayout,
  CNABExtratoFieldSpec,
  MovementCodeDefinition,
  ExtratoConversionRecord,
  CompanySettings,
} from '../types';
import { getBankInfo } from './banks';

const STORAGE_KEY_EXTRATO_LAYOUTS = 'cnab_learned_extrato_layouts_v1';
const STORAGE_KEY_EXTRATO_HISTORY = 'cnab_extrato_conversion_history_v1';

/**
 * Tabela Padrão Febraban de Códigos e Categorias de Movimentação de Extrato
 */
export class MOVEMENT_CODES_DATABASE {
  static DEFAULT_CODES: MovementCodeDefinition[] = [
    { codigo: '101', descricao: 'PIX Recebido (Crédito)', grupo: 'CREDITO', padraoBanco: 'TODOS' },
    { codigo: '102', descricao: 'PIX Enviado (Débito)', grupo: 'DEBITO', padraoBanco: 'TODOS' },
    { codigo: '103', descricao: 'TED Recebida', grupo: 'CREDITO', padraoBanco: 'TODOS' },
    { codigo: '104', descricao: 'TED Enviada', grupo: 'DEBITO', padraoBanco: 'TODOS' },
    { codigo: '105', descricao: 'DOC Recebido', grupo: 'CREDITO', padraoBanco: 'TODOS' },
    { codigo: '106', descricao: 'DOC Enviado', grupo: 'DEBITO', padraoBanco: 'TODOS' },
    { codigo: '201', descricao: 'Tarifa de Manutenção de Conta', grupo: 'TARIFA', padraoBanco: 'TODOS' },
    { codigo: '202', descricao: 'Tarifa de Pacote de Serviços', grupo: 'TARIFA', padraoBanco: 'TODOS' },
    { codigo: '203', descricao: 'Tarifa de Processamento de Boleto', grupo: 'TARIFA', padraoBanco: 'TODOS' },
    { codigo: '204', descricao: 'Tarifa de Transferência/PIX', grupo: 'TARIFA', padraoBanco: 'TODOS' },
    { codigo: '301', descricao: 'Juros Sobre Saldo Devedor / Cheque Especial', grupo: 'IMPOSTO', padraoBanco: 'TODOS' },
    { codigo: '302', descricao: 'IOF - Imposto Sobre Operações Financeiras', grupo: 'IMPOSTO', padraoBanco: 'TODOS' },
    { codigo: '303', descricao: 'Imposto do Pagamento (IRRF/CSLL/PIS/COFINS)', grupo: 'IMPOSTO', padraoBanco: 'TODOS' },
    { codigo: '401', descricao: 'Aplicação Financeira (Débito p/ Investimento)', grupo: 'INVESTIMENTO', padraoBanco: 'TODOS' },
    { codigo: '402', descricao: 'Resgate de Aplicação (Crédito do Investimento)', grupo: 'INVESTIMENTO', padraoBanco: 'TODOS' },
    { codigo: '403', descricao: 'Rendimento de Aplicação Automática', grupo: 'CREDITO', padraoBanco: 'TODOS' },
    { codigo: '501', descricao: 'Estorno de Lançamento em Duplicidade', grupo: 'CREDITO', padraoBanco: 'TODOS' },
    { codigo: '502', descricao: 'Devolução de Pagamento / Tarifas', grupo: 'CREDITO', padraoBanco: 'TODOS' },
    { codigo: '601', descricao: 'Pagamento de Salários / Folha', grupo: 'DEBITO', padraoBanco: 'TODOS' },
    { codigo: '602', descricao: 'Pagamento de Fornecedores / Boletos', grupo: 'DEBITO', padraoBanco: 'TODOS' },
    { codigo: '603', descricao: 'Pagamento de Guias de Impostos (DARF/GPS/DAS)', grupo: 'DEBITO', padraoBanco: 'TODOS' },
  ];

  static identifyCodeFromHistory(historico: string, tipo: 'C' | 'D'): { codigo: string; categoria: string } {
    const text = historico.toUpperCase();

    if (text.includes('PIX')) {
      return tipo === 'C'
        ? { codigo: '101', categoria: 'PIX Recebido' }
        : { codigo: '102', categoria: 'PIX Enviado' };
    }
    if (text.includes('TED')) {
      return tipo === 'C'
        ? { codigo: '103', categoria: 'TED Recebida' }
        : { codigo: '104', categoria: 'TED Enviada' };
    }
    if (text.includes('DOC')) {
      return tipo === 'C'
        ? { codigo: '105', categoria: 'DOC Recebido' }
        : { codigo: '106', categoria: 'DOC Enviado' };
    }
    if (text.includes('TARIFA') || text.includes('TAR ') || text.includes('PAC ') || text.includes('TAXA')) {
      return { codigo: '201', categoria: 'Tarifas Bancárias' };
    }
    if (text.includes('IOF')) {
      return { codigo: '302', categoria: 'IOF' };
    }
    if (text.includes('JUROS') || text.includes('MORA')) {
      return { codigo: '301', categoria: 'Juros e Encargos' };
    }
    if (text.includes('RESGATE') || text.includes('RESG ')) {
      return { codigo: '402', categoria: 'Resgate de Aplicação' };
    }
    if (text.includes('APLICACAO') || text.includes('APLIC ')) {
      return { codigo: '401', categoria: 'Aplicação Financeira' };
    }
    if (text.includes('ESTORNO') || text.includes('DEVOL')) {
      return { codigo: '501', categoria: 'Estorno/Devolução' };
    }
    if (text.includes('FOLHA') || text.includes('SALARIO')) {
      return { codigo: '601', categoria: 'Folha de Pagamento' };
    }
    if (text.includes('BOLETO') || text.includes('TITULO') || text.includes('PAGTO')) {
      return { codigo: '602', categoria: 'Pagamento Boletos' };
    }
    if (text.includes('DARF') || text.includes('GPS') || text.includes('DAS') || text.includes('IMPOSTO')) {
      return { codigo: '603', categoria: 'Pagamento de Tributos' };
    }

    return tipo === 'C'
      ? { codigo: '100', categoria: 'Outros Créditos' }
      : { codigo: '200', categoria: 'Outros Débitos' };
  }
}

/**
 * Padrão de Especificação do Segmento E (Extrato CNAB 240 FEBRABAN)
 */
export const FEBRABAN_SEGMENTO_E_FIELDS: CNABExtratoFieldSpec[] = [
  { posInicio: 1, posFim: 3, tamanho: 3, tipo: 'N', nomeCampo: 'Código do Banco', descricao: 'Código Numérico do Banco (ex: 341, 237, 001)' },
  { posInicio: 4, posFim: 7, tamanho: 4, tipo: 'N', nomeCampo: 'Lote de Serviço', descricao: 'Número do Lote (Padrão 0001)' },
  { posInicio: 8, posFim: 8, tamanho: 1, tipo: 'N', nomeCampo: 'Tipo de Registro', descricao: '3 = Registro Detalhe' },
  { posInicio: 9, posFim: 13, tamanho: 5, tipo: 'N', nomeCampo: 'Nº Sequencial no Lote', descricao: 'Contador de lançamentos (1, 2, 3...)' },
  { posInicio: 14, posFim: 14, tamanho: 1, tipo: 'A', nomeCampo: 'Código de Segmento', descricao: "'E' = Extrato de Conta Corrente" },
  { posInicio: 15, posFim: 17, tamanho: 3, tipo: 'A', nomeCampo: 'Uso Exclusivo FEBRABAN', descricao: 'Espaços em branco' },
  { posInicio: 18, posFim: 18, tamanho: 1, tipo: 'N', nomeCampo: 'Tipo de Inscrição Empresa', descricao: '1 = CPF, 2 = CNPJ' },
  { posInicio: 19, posFim: 32, tamanho: 14, tipo: 'N', nomeCampo: 'Número de Inscrição Empresa', descricao: 'CNPJ ou CPF da Empresa Titular' },
  { posInicio: 33, posFim: 47, tamanho: 15, tipo: 'A', nomeCampo: 'Código do Convênio no Banco', descricao: 'Código de Identificação da Conta / Convênio' },
  { posInicio: 48, posFim: 52, tamanho: 5, tipo: 'N', nomeCampo: 'Agência Mantenedora', descricao: 'Número da Agência Bancária' },
  { posInicio: 53, posFim: 53, tamanho: 1, tipo: 'A', nomeCampo: 'Dígito da Agência', descricao: 'Dígito Verificador da Agência' },
  { posInicio: 54, posFim: 65, tamanho: 12, tipo: 'N', nomeCampo: 'Número da Conta Corrente', descricao: 'Número da Conta' },
  { posInicio: 66, posFim: 66, tamanho: 1, tipo: 'A', nomeCampo: 'Dígito da Conta Corrente', descricao: 'Dígito Verificador da Conta' },
  { posInicio: 67, posFim: 67, tamanho: 1, tipo: 'A', nomeCampo: 'Dígito Agência / Conta', descricao: 'Dígito Verificador Conjunto' },
  { posInicio: 68, posFim: 97, tamanho: 30, tipo: 'A', nomeCampo: 'Nome da Empresa', descricao: 'Razão Social da Empresa' },
  { posInicio: 98, posFim: 103, tamanho: 6, tipo: 'A', nomeCampo: 'Reservado Banco', descricao: 'Uso do banco' },
  { posInicio: 104, posFim: 105, tamanho: 2, tipo: 'A', nomeCampo: 'Natureza do Lançamento', descricao: 'TR=Transferência, DP=Depósito, CX=Caixa, TB=Tarifa' },
  { posInicio: 106, posFim: 108, tamanho: 3, tipo: 'A', nomeCampo: 'Tipo de Complemento', descricao: 'Identificador adicional' },
  { posInicio: 109, posFim: 116, tamanho: 8, tipo: 'N', nomeCampo: 'Data do Lançamento', descricao: 'Data DDMMAAAA' },
  { posInicio: 117, posFim: 134, tamanho: 18, tipo: 'N', nomeCampo: 'Valor do Lançamento', descricao: 'Valor Numérico com 2 decimais sem pontuação' },
  { posInicio: 135, posFim: 135, tamanho: 1, tipo: 'A', nomeCampo: 'Tipo do Lançamento', descricao: "'C' = Crédito / Entrada, 'D' = Débito / Saída" },
  { posInicio: 136, posFim: 139, tamanho: 4, tipo: 'N', nomeCampo: 'Categoria do Lançamento', descricao: 'Código Numérico de Categoria do Extrato' },
  { posInicio: 140, posFim: 164, tamanho: 25, tipo: 'A', nomeCampo: 'Histórico do Lançamento', descricao: 'Descrição / Histórico impresso no extrato' },
  { posInicio: 165, posFim: 170, tamanho: 6, tipo: 'A', nomeCampo: 'Documento / NSU Ref', descricao: 'Número do documento ou NSU' },
  { posInicio: 171, posFim: 190, tamanho: 20, tipo: 'A', nomeCampo: 'Nº do Documento de Origem', descricao: 'Autenticação / Chave do Lançamento' },
  { posInicio: 191, posFim: 240, tamanho: 50, tipo: 'A', nomeCampo: 'Uso Exclusivo FEBRABAN', descricao: 'Espaços em branco para alinhamento 240' },
];

export const SANTANDER_MODEL_RAW = `03300000         2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARISANTANDER BANESPA                       20108202607281900363508201600                                                                     
03300011E0440033 2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI00000000000000000000000000000000        30072026000000000000000000CFBRL03636                                                              
0330001300001E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000002000000C2093989PIX RECEBIDO             00000008095553441                      
0330001300002E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000100000C2093989PIX RECEBIDO             00000063982196434                      
0330001300003E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001000000C2093989PIX RECEBIDO             00000049210173520                      
0330001300004E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000036940C2093989PIX RECEBIDO             00000096467045572                      
0330001300005E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000010000C2093989PIX RECEBIDO             00000004792592000182                   
0330001300006E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000003049000C2131070TRANSF CONTAS            312620RCI-LIB-15TB122026               
0330001300007E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000008511000C2131070TRANSF CONTAS            413963DE: 3747.01.000138-4             
0330001300008E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000003100000C2131070TRANSF CONTAS            521148RCI-LIB-CAHP740851               
0330001300009E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001999000C2131070TRANSF CONTAS            074454RCI-LIB-15TB122722               
0330001300010E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001000000C2093989PIX RECEBIDO             00000007291188512                      
0330001300011E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001000000C2093989PIX RECEBIDO             00000001368649530                      
0330001300012E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000027000000C2093988PIX RECEBIDO             00000004109834000190                   
0330001300013E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000002000000C2093989PIX RECEBIDO             00000003044369509                      
0330001300014E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000004951866C2093989PIX RECEBIDO             00000002265894559                      
0330001300015E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000058042794D1132036PGTO SALARIO             010731PAGSAL:        415 PAGTOS        
0330001300016E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000004799600C2131070TRANSF CONTAS            341714RCI-LIB-15TB122217               
0330001300017E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000006099000C2131070TRANSF CONTAS            375499RCI-LIB-15TB122856               
0330001300018E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000900000C2093989PIX RECEBIDO             00000038200597000190                   
0330001300019E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000003600000C2093989PIX RECEBIDO             00000038200597000190                   
0330001300020E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001000000C2093989PIX RECEBIDO             00000007336815570                      
0330001300021E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001000000C2093989PIX RECEBIDO             00000007336815570                      
0330001300022E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001000000C2093989PIX RECEBIDO             00000007336815570                      
0330001300023E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001000000C2093989PIX RECEBIDO             00000007336815570                      
0330001300024E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001000000C2093989PIX RECEBIDO             00000007336815570                      
0330001300025E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001000000C2093989PIX RECEBIDO             00000007336815570                      
0330001300026E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000430000C2093989PIX RECEBIDO             00000007336815570                      
0330001300027E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000140000C2093989PIX RECEBIDO             00000041114507504                      
0330001300028E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000800000C2093989PIX RECEBIDO             00000059890410559                      
0330001300029E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000003061800C2093989PIX RECEBIDO             00000078771439587                      
0330001300030E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000047332C2093989PIX RECEBIDO             00000006092257580                      
0330001300031E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001938200C2093989PIX RECEBIDO             00000080246737549                      
0330001300032E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000300000C2093989PIX RECEBIDO             00000003437377523                      
0330001300033E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000006700000C2200001DEP DIN CX AG            145354                                 
0330001300034E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000263289C2170183PGTO FORNEC              010731RES026060188001                  
0330001300035E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000031142C2170183PGTO FORNEC              010731RES026056809001                  
0330001300036E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001000000C2093989PIX RECEBIDO             00000006544442500                      
0330001300037E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000002000000C2093989PIX RECEBIDO             00000006544442500                      
0330001300038E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000116300000C2090477TED RECEBIDA             00000004104117000176                   
0330001300039E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000060000000C2093988PIX RECEBIDO             00000004109834000190                   
0330001300040E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001000000C2093989PIX RECEBIDO             00000039661197814                      
0330001300041E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001000000C2093989PIX RECEBIDO             00000039661197814                      
0330001300042E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000004799000C2131070TRANSF CONTAS            591337RCI-LIB-15TB122086               
0330001300043E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000011799000C2131070TRANSF CONTAS            004446RCI-LIB-15TB117850               
0330001300044E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000005599000C2131070TRANSF CONTAS            022550RCI-LIB-15TB120072               
0330001300045E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000002950000C2093989PIX RECEBIDO             00000047514167587                      
0330001300046E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000002912000C2131070TRANSF CONTAS            105051RCI-LIB-15RB112329               
0330001300047E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000300000C2133987PIX RECEBIDO             13260839661197814                      
0330001300048E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000002950000C2131070TRANSF CONTAS            164994RCI-LIB-15TB118417               
0330001300049E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000003488000C2131070TRANSF CONTAS            170083RCI-LIB-15TB111015               
0330001300050E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000100000C2093989PIX RECEBIDO             00000000769483402                      
0330001300051E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000100000C2093989PIX RECEBIDO             00000015969070530                      
0330001300052E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000008219000C2131070TRANSF CONTAS            564416RCI-LIB-15TB121004               
0330001300053E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000008399000C2131070TRANSF CONTAS            113228RCI-LIB-15TB122709               
0330001300054E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000390000C2093989PIX RECEBIDO             00000041448774500                      
0330001300055E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000000200000C2093989PIX RECEBIDO             00000044416938500                      
0330001300056E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000001500000C2133987PIX RECEBIDO             10101339661197814                      
0330001300057E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000100092691D1120572PG FORN TIT              300731B - 000007                       
0330001300058E   2041098340001900033466100870017477104661 0000130001028 EUROVIA AUTOMOVEIS E UTILITARI      CDS00                    N3107202631072026000000000167737684D1063625APL CONTAMAX             000000                                 
03300015         2041098340001900033466100870017477104661 0000130001028 000000000000000000000000000000000000000000000000000000000000000000000031072026000000000000000000CP0000600000000003258731690000000003258731690000000000000000            
03399999         000001000062000001`;

// Layout aprendido por engenharia reversa do modelo Santander Eurovia
export const SANTANDER_EUROVIA_LAYOUT: LearnedCNABExtratoLayout = reverseEngineCnabStructure(
  SANTANDER_MODEL_RAW,
  'Modelo_CNAB_Santander_Eurovia.ret'
);

/**
 * Layouts padrão para inicializar a base aprendida (Santander, Bradesco, Banco do Brasil, Itaú, Caixa)
 */
export const DEFAULT_EXTRATO_LAYOUTS: LearnedCNABExtratoLayout[] = [
  {
    ...SANTANDER_EUROVIA_LAYOUT,
    id: 'extrato-layout-santander-240-eurovia',
    nomeLayout: 'Extrato CNAB 240 Modelo Fiel - Banco Santander (033) [EUROVIA AUTOMOVEIS E UTILITARI]',
    bancoCodigo: '033',
    bancoNome: 'Banco Santander (Brasil) S.A.',
    empresaNome: 'EUROVIA AUTOMOVEIS E UTILITARI',
    cnpjEmpresa: '20.410.983/0001-90',
    agenciaPadrao: '3466',
    digitoAgencia: '1',
    contaPadrao: '008700174771',
    digitoConta: '0',
    convenioPadrao: '00033466100870017477',
    codigoEmpresaBanco: '00033466100870017477',
    seqArquivoModelo: '350820',
    versaoLayoutModelo: '160',
    isCustomLearned: false,
    timesUsed: 120,
  },
  {
    id: 'extrato-layout-santander-240',
    nomeLayout: 'Extrato Conta Corrente Banco Santander 240 FEBRABAN',
    bancoCodigo: '033',
    bancoNome: 'Banco Santander (Brasil) S.A.',
    padraoCNAB: '240',
    createdDate: new Date().toISOString(),
    lastUsedDate: new Date().toISOString(),
    timesUsed: 64,
    isCustomLearned: false,
    headerArquivoFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    headerLoteFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    segmentoEFields: FEBRABAN_SEGMENTO_E_FIELDS,
    trailerLoteFields: [],
    trailerArquivoFields: [],
    movementCodesMap: {
      '101': 'PIX Recebido (Santander)',
      '102': 'PIX Enviado (Santander)',
      '103': 'TED Crédito Web',
      '104': 'TED Débito Web',
      '201': 'Tarifa Pacote Conta Empresa',
      '203': 'Tarifa Liquidação Boleto',
      '301': 'Juros Cheque Empresa Santander',
      '601': 'Pagamento Fornecedores / Titulos',
      '602': 'Folha de Pagamento Santander',
    },
  },
  {
    id: 'extrato-layout-bradesco-240',
    nomeLayout: 'Extrato Empresarial Banco Bradesco 240',
    bancoCodigo: '237',
    bancoNome: 'Banco Bradesco S.A.',
    padraoCNAB: '240',
    createdDate: new Date().toISOString(),
    lastUsedDate: new Date().toISOString(),
    timesUsed: 48,
    isCustomLearned: false,
    headerArquivoFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    headerLoteFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    segmentoEFields: FEBRABAN_SEGMENTO_E_FIELDS,
    trailerLoteFields: [],
    trailerArquivoFields: [],
    movementCodesMap: {
      '101': 'PIX Recebido Bradesco',
      '102': 'PIX Enviado Bradesco',
      '103': 'TED Recebida STR',
      '104': 'TED Transf Net Bradesco',
      '201': 'Tarifa de Cesta de Serviços',
      '202': 'Tarifa Cobrança Bradesco',
      '302': 'IOF Operações Crédito',
      '601': 'Folha de Pagamento Bradesco',
    },
  },
  {
    id: 'extrato-layout-bb-240',
    nomeLayout: 'Extrato Conta Corrente Banco do Brasil 240',
    bancoCodigo: '001',
    bancoNome: 'Banco do Brasil S.A.',
    padraoCNAB: '240',
    createdDate: new Date().toISOString(),
    lastUsedDate: new Date().toISOString(),
    timesUsed: 59,
    isCustomLearned: false,
    headerArquivoFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    headerLoteFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    segmentoEFields: FEBRABAN_SEGMENTO_E_FIELDS,
    trailerLoteFields: [],
    trailerArquivoFields: [],
    movementCodesMap: {
      '101': 'PIX Recebido BB',
      '102': 'PIX Enviado BB',
      '103': 'TED Recebida BB',
      '104': 'TED Enviada BB',
      '201': 'Tarifa Manutenção Conta BB',
      '302': 'IOF Tributos Federais',
      '401': 'BB Rende Fácil Aplicação',
      '402': 'BB Rende Fácil Resgate',
      '603': 'Pagamento Guia DARF/GPS BB',
    },
  },
  {
    id: 'extrato-layout-itau-240',
    nomeLayout: 'Extrato Conta Corrente Itaú 240 FEBRABAN',
    bancoCodigo: '341',
    bancoNome: 'Banco Itaú Unibanco S.A.',
    padraoCNAB: '240',
    createdDate: new Date().toISOString(),
    lastUsedDate: new Date().toISOString(),
    timesUsed: 52,
    isCustomLearned: false,
    headerArquivoFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    headerLoteFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    segmentoEFields: FEBRABAN_SEGMENTO_E_FIELDS,
    trailerLoteFields: [],
    trailerArquivoFields: [],
    movementCodesMap: {
      '101': 'PIX Recebido Itaú',
      '102': 'PIX Enviado Itaú',
      '103': 'TED Recebida Itaú',
      '104': 'TED Enviada Itaú',
      '201': 'Tarifa de Pacote Itaú',
      '302': 'IOF',
      '401': 'Aplicação Itaú',
      '402': 'Resgate Itaú',
    },
  },
  {
    id: 'extrato-layout-caixa-240',
    nomeLayout: 'Extrato Conta Empresarial Caixa 240',
    bancoCodigo: '104',
    bancoNome: 'Caixa Econômica Federal',
    padraoCNAB: '240',
    createdDate: new Date().toISOString(),
    lastUsedDate: new Date().toISOString(),
    timesUsed: 22,
    isCustomLearned: false,
    headerArquivoFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    headerLoteFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    segmentoEFields: FEBRABAN_SEGMENTO_E_FIELDS,
    trailerLoteFields: [],
    trailerArquivoFields: [],
    movementCodesMap: {
      '101': 'PIX Recebido Caixa',
      '102': 'PIX Enviado Caixa',
      '103': 'TED Recebida CEF',
      '104': 'TED Enviada CEF',
      '201': 'Tarifa Manutenção CEF',
      '601': 'Pagamento Salários Caixa',
    },
  },
];

/**
 * Funções de Armazenamento Local / Cache de Layouts de Extrato
 */
export function loadLearnedExtratoLayouts(): LearnedCNABExtratoLayout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXTRATO_LAYOUTS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const merged = [...parsed];
        DEFAULT_EXTRATO_LAYOUTS.forEach((def) => {
          const idx = merged.findIndex((m) => m.id === def.id);
          if (idx === -1) {
            merged.unshift(def);
          } else {
            merged[idx] = {
              ...def,
              ...merged[idx],
              sampleHeaderArq: def.sampleHeaderArq || merged[idx].sampleHeaderArq,
              sampleHeaderLote: def.sampleHeaderLote || merged[idx].sampleHeaderLote,
              sampleSegmentE: def.sampleSegmentE || merged[idx].sampleSegmentE,
              sampleTrailerLote: def.sampleTrailerLote || merged[idx].sampleTrailerLote,
              sampleTrailerArq: def.sampleTrailerArq || merged[idx].sampleTrailerArq,
              rawModelContent: def.rawModelContent || merged[idx].rawModelContent,
            };
          }
        });
        return merged;
      }
    }
  } catch (e) {
    console.warn('[Extrato Engine] Erro ao carregar layouts aprendidos:', e);
  }
  saveLearnedExtratoLayouts(DEFAULT_EXTRATO_LAYOUTS);
  return DEFAULT_EXTRATO_LAYOUTS;
}

export function saveLearnedExtratoLayouts(layouts: LearnedCNABExtratoLayout[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_EXTRATO_LAYOUTS, JSON.stringify(layouts));
  } catch (e) {
    console.warn('[Extrato Engine] Erro ao salvar layouts:', e);
  }
}

export function loadExtratoConversionHistory(): ExtratoConversionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXTRATO_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('[Extrato Engine] Erro ao carregar histórico:', e);
  }
  return [];
}

export function saveExtratoConversionHistory(records: ExtratoConversionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_EXTRATO_HISTORY, JSON.stringify(records));
  } catch (e) {
    console.warn('[Extrato Engine] Erro ao salvar histórico:', e);
  }
}

/**
 * Formatadores Auxiliares para alinhamento estrito em CNAB 240
 */
function padText(text: string, length: number): string {
  const clean = (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s\.\/\-\,\_]/g, '');
  return clean.padEnd(length, ' ').slice(0, length);
}

function padZero(value: number | string, length: number): string {
  const digits = String(value || 0).replace(/\D/g, '');
  return digits.padStart(length, '0').slice(-length);
}

function formatValueInCents(value: number, length: number = 18): string {
  const cents = Math.round(Math.abs(value) * 100);
  return String(cents).padStart(length, '0').slice(-length);
}

function formatDateDDMMAAAA(dateStr: string): string {
  if (!dateStr) return '01012026';
  const clean = dateStr.replace(/\D/g, '');
  if (clean.length === 8 && !dateStr.includes('-')) {
    return clean; // já no formato DDMMAAAA ou AAAAMMDD
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '01012026';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}${month}${year}`;
}

/**
 * SOBREPOSIÇÃO DE CAMPOS (OVERLAY) MANTENDO 100% DAS INFORMAÇÕES DO MODELO CNAB
 * Preserva exatamente todos os caracteres do arquivo enviado, alterando apenas os campos dinâmicos do extrato
 */
export function overlayField(
  baseLine: string,
  posStart1Based: number,
  length: number,
  replacement: string
): string {
  if (!baseLine) return '';
  const targetLength = Math.max(baseLine.length, posStart1Based + length - 1, 240);
  const padded = baseLine.padEnd(targetLength, ' ');
  const chars = padded.split('');
  const startIdx = posStart1Based - 1;
  const repFormatted = replacement.slice(0, length);
  for (let i = 0; i < length; i++) {
    chars[startIdx + i] = repFormatted[i] ?? ' ';
  }
  return chars.join('');
}

/**
 * GERADOR DE ARQUIVO CNAB 240 DE EXTRATO BANCÁRIO
 * Converte lançamentos extraídos de planilha espelhando com precisão de 100% o modelo CNAB enviado,
 * alterando exclusivamente as movimentações do extrato (crédito e débito)
 */
export function generateCNABExtratoFile(
  transactions: ExtratoTransaction[],
  company: CompanySettings,
  layout: LearnedCNABExtratoLayout
): string {
  const lines: string[] = [];

  const bankCode = padZero(layout?.bancoCodigo || company.bancoCodigo || '341', 3);
  const rawCnpj = layout?.cnpjEmpresa || company.cnpjCpf || company.cnpj || '00000000000000';
  const cnpjDigits = padZero(rawCnpj.replace(/\D/g, ''), 14);
  const bankInfo = getBankInfo(bankCode);

  const agency = padZero(layout?.agenciaPadrao || company.agencia || '0001', 5);
  const agencyDV = padText(layout?.digitoAgencia || company.agenciaDV || '0', 1);
  const account = padZero(layout?.contaPadrao || company.conta || '000000', 12);
  const accountDV = padText(layout?.digitoConta || company.contaDV || '0', 1);
  const companyName = padText(layout?.empresaNome || company.razaoSocial || 'EMPRESA TITULAR DA CONTA', 30);
  const convenio = padText(layout?.codigoEmpresaBanco || layout?.convenioPadrao || company.convenio || '000000000000001', 20);
  const nsa = padZero(layout?.seqArquivoModelo || company.nsa || 1, 6);
  const versaoLayout = padZero(layout?.versaoLayoutModelo || '080', 3);

  const now = new Date();
  const dateDDMMAAAA = formatDateDDMMAAAA(now.toISOString().split('T')[0]);
  const timeHHMMSS = padZero(`${now.getHours()}${now.getMinutes()}${now.getSeconds()}`, 6);

  // 1. HEADER DE ARQUIVO (240 posições - Usa o modelo original como base)
  let headerArq = '';
  if (layout?.sampleHeaderArq && layout.sampleHeaderArq.length >= 240) {
    headerArq = layout.sampleHeaderArq.padEnd(240, ' ').slice(0, 240);
    headerArq = overlayField(headerArq, 1, 3, bankCode);
    headerArq = overlayField(headerArq, 18, 1, layout.tipoInscricaoEmpresa || '2');
    headerArq = overlayField(headerArq, 19, 14, cnpjDigits);
    headerArq = overlayField(headerArq, 33, 20, convenio);
    headerArq = overlayField(headerArq, 53, 5, agency);
    headerArq = overlayField(headerArq, 58, 1, agencyDV);
    headerArq = overlayField(headerArq, 59, 12, account);
    headerArq = overlayField(headerArq, 71, 1, accountDV);
    headerArq = overlayField(headerArq, 73, 30, companyName);
    headerArq = overlayField(headerArq, 103, 30, padText(layout?.nomeBancoModelo?.toUpperCase() || bankInfo.shortName.toUpperCase(), 30));
    headerArq = overlayField(headerArq, 144, 8, dateDDMMAAAA);
    headerArq = overlayField(headerArq, 152, 6, timeHHMMSS);
    headerArq = overlayField(headerArq, 158, 6, nsa);
    headerArq = overlayField(headerArq, 164, 3, versaoLayout);
  } else {
    headerArq += bankCode; // 001-003: Banco
    headerArq += '0000'; // 004-007: Lote 0000
    headerArq += '0'; // 008-008: Tipo Reg 0 (Header Arq)
    headerArq += padText('', 9); // 009-017: Uso FEBRABAN
    headerArq += '2'; // 018-018: Tipo Inscrição (2 = CNPJ)
    headerArq += cnpjDigits; // 019-032: CNPJ
    headerArq += convenio; // 033-052: Convênio / Código da Empresa no Banco
    headerArq += agency; // 053-057: Agência
    headerArq += agencyDV; // 058-058: DV Agência
    headerArq += account; // 059-070: Conta
    headerArq += accountDV; // 071-071: DV Conta
    headerArq += ' '; // 072-072: DV Ag/Conta
    headerArq += companyName; // 073-102: Nome Empresa
    headerArq += padText(layout?.nomeBancoModelo?.toUpperCase() || bankInfo.shortName.toUpperCase(), 30); // 103-132: Nome Banco
    headerArq += padText('', 10); // 133-142: Uso FEBRABAN
    headerArq += '1'; // 143-143: Código Remessa/Retorno (1=Remessa/Extrato)
    headerArq += dateDDMMAAAA; // 144-151: Data Geração
    headerArq += timeHHMMSS; // 152-157: Hora Geração
    headerArq += nsa; // 158-163: Sequencial NSA
    headerArq += versaoLayout; // 164-166: Versão Layout 080/087
    headerArq += '00000'; // 167-171: Densidade
    headerArq += padText('', 69); // 172-240: Reservado Banco/FEBRABAN
  }
  lines.push(headerArq);

  // 2. HEADER DE LOTE DE EXTRATO (240 posições - Usa o modelo original como base)
  let headerLote = '';
  if (layout?.sampleHeaderLote && layout.sampleHeaderLote.length >= 240) {
    headerLote = layout.sampleHeaderLote.padEnd(240, ' ').slice(0, 240);
    headerLote = overlayField(headerLote, 1, 3, bankCode);
    headerLote = overlayField(headerLote, 4, 4, '0001');
    headerLote = overlayField(headerLote, 8, 1, '1');
    headerLote = overlayField(headerLote, 19, 14, cnpjDigits);
    headerLote = overlayField(headerLote, 33, 20, convenio);
    headerLote = overlayField(headerLote, 53, 5, agency);
    headerLote = overlayField(headerLote, 58, 1, agencyDV);
    headerLote = overlayField(headerLote, 59, 12, account);
    headerLote = overlayField(headerLote, 71, 1, accountDV);
    headerLote = overlayField(headerLote, 73, 30, companyName);
    headerLote = overlayField(headerLote, 143, 8, dateDDMMAAAA);
  } else {
    headerLote += bankCode; // 001-003: Banco
    headerLote += '0001'; // 004-007: Lote 0001
    headerLote += '1'; // 008-008: Tipo Reg 1 (Header Lote)
    headerLote += 'E'; // 009-009: Operação 'E' (Extrato)
    headerLote += '04'; // 010-011: Serviço 04 (Extrato de CC)
    headerLote += '00'; // 012-013: Forma Lançamento
    headerLote += '030'; // 014-016: Versão Layout Lote
    headerLote += ' '; // 017-017: Uso FEBRABAN
    headerLote += '2'; // 018-018: CNPJ
    headerLote += cnpjDigits; // 019-032: CNPJ
    headerLote += convenio; // 033-052: Convênio
    headerLote += agency; // 053-057: Agência
    headerLote += agencyDV; // 058-058
    headerLote += account; // 059-070
    headerLote += accountDV; // 071-071
    headerLote += ' '; // 072-072
    headerLote += companyName; // 073-102
    headerLote += padText('', 40); // 103-142
    headerLote += dateDDMMAAAA; // 143-150: Data Inicial
    headerLote += formatValueInCents(0, 18); // 151-168: Saldo Inicial
    headerLote += 'C'; // 169-169: Situação Saldo Inicial
    headerLote += 'M'; // 170-170: Posição do Saldo (M = Matriz)
    headerLote += 'BRL'; // 171-173: Moeda
    headerLote += padZero(1, 6); // 174-179: Nº Sequencial Extrato
    headerLote += padText('', 61); // 180-240: Uso FEBRABAN
  }
  lines.push(headerLote);

  // 3. REGISTROS DETALHE - SEGMENTO E (240 posições para cada transação do extrato)
  let totalCreditos = 0;
  let totalDebitos = 0;
  let seqInLote = 0;

  transactions.forEach((tx) => {
    seqInLote += 1;

    if (tx.tipo === 'C') totalCreditos += Math.abs(tx.valor);
    else totalDebitos += Math.abs(tx.valor);

    const txDate = formatDateDDMMAAAA(tx.dataLancamento);
    const txValCents = formatValueInCents(tx.valor, 18);
    const txTipo = tx.tipo === 'C' ? 'C' : 'D';
    const codigoMov = padZero(tx.codigoMovimento || '100', 4);
    const historicoText = padText(tx.historico || 'LANCAMENTO DE EXTRATO', 25);
    const docRef = padText(tx.documentoRef || `${seqInLote}`, 6);
    const docOrigem = padText(tx.documentoRef || `NSU-${seqInLote}`, 20);

    let segE = '';
    if (layout?.sampleSegmentE && layout.sampleSegmentE.length >= 240) {
      // COPIA EXATAMENTE A LINHA DO MODELO ENVIADO! Alterando unicamente as informações do lançamento de extrato
      segE = layout.sampleSegmentE.padEnd(240, ' ').slice(0, 240);
      segE = overlayField(segE, 1, 3, bankCode);
      segE = overlayField(segE, 4, 4, '0001');
      segE = overlayField(segE, 8, 1, '3');
      segE = overlayField(segE, 9, 5, padZero(seqInLote, 5));
      segE = overlayField(segE, 14, 1, 'E');
      segE = overlayField(segE, 19, 14, cnpjDigits);
      segE = overlayField(segE, 33, 15, padText(convenio, 15));
      segE = overlayField(segE, 48, 5, agency);
      segE = overlayField(segE, 53, 1, agencyDV);
      segE = overlayField(segE, 54, 12, account);
      segE = overlayField(segE, 66, 1, accountDV);
      segE = overlayField(segE, 68, 30, companyName);
      segE = overlayField(segE, 109, 8, txDate);
      segE = overlayField(segE, 117, 18, txValCents);
      segE = overlayField(segE, 135, 1, txTipo);
      segE = overlayField(segE, 136, 4, codigoMov);
      segE = overlayField(segE, 140, 25, historicoText);
      segE = overlayField(segE, 165, 6, docRef);
      segE = overlayField(segE, 171, 20, docOrigem);
    } else {
      segE += bankCode; // 001-003
      segE += '0001'; // 004-007: Lote 0001
      segE += '3'; // 008-008: Detalhe
      segE += padZero(seqInLote, 5); // 009-013: Seq no Lote
      segE += 'E'; // 014-014: Segmento E
      segE += padText('', 3); // 015-017: Uso FEBRABAN
      segE += '2'; // 018-018: CNPJ
      segE += cnpjDigits; // 019-032: CNPJ
      segE += padText(convenio, 15); // 033-047
      segE += agency; // 048-052
      segE += agencyDV; // 053-053
      segE += account; // 054-065
      segE += accountDV; // 066-066
      segE += ' '; // 067-067
      segE += companyName; // 068-097
      segE += padText('', 6); // 098-103
      segE += 'TR'; // 104-105: Natureza Lançamento
      segE += '000'; // 106-108: Tipo Complemento
      segE += txDate; // 109-116: Data Lançamento
      segE += txValCents; // 117-134: Valor Lançamento
      segE += txTipo; // 135-135: 'C' ou 'D'
      segE += codigoMov; // 136-139: Categoria Lançamento
      segE += historicoText; // 140-164: Histórico
      segE += docRef; // 165-170: Documento/NSU
      segE += docOrigem; // 171-190: Nº Documento Origem
      segE += padText('', 50); // 191-240: Reservado
    }
    lines.push(segE);
  });

  // 4. TRAILER DE LOTE (240 posições - Usa o modelo original como base)
  const totalRegLote = seqInLote + 2; // + HeaderLote + TrailerLote
  let trailerLote = '';
  if (layout?.sampleTrailerLote && layout.sampleTrailerLote.length >= 240) {
    trailerLote = layout.sampleTrailerLote.padEnd(240, ' ').slice(0, 240);
    trailerLote = overlayField(trailerLote, 1, 3, bankCode);
    trailerLote = overlayField(trailerLote, 4, 4, '0001');
    trailerLote = overlayField(trailerLote, 8, 1, '5');
    trailerLote = overlayField(trailerLote, 19, 14, cnpjDigits);
    trailerLote = overlayField(trailerLote, 48, 5, agency);
    trailerLote = overlayField(trailerLote, 53, 1, agencyDV);
    trailerLote = overlayField(trailerLote, 54, 12, account);
    trailerLote = overlayField(trailerLote, 66, 1, accountDV);
    trailerLote = overlayField(trailerLote, 68, 18, formatValueInCents(totalDebitos, 18));
    trailerLote = overlayField(trailerLote, 86, 18, formatValueInCents(totalCreditos, 18));
    trailerLote = overlayField(trailerLote, 104, 18, formatValueInCents(totalCreditos - totalDebitos, 18));
    trailerLote = overlayField(trailerLote, 122, 1, totalCreditos >= totalDebitos ? 'C' : 'D');
    trailerLote = overlayField(trailerLote, 123, 6, padZero(totalRegLote, 6));
  } else {
    trailerLote += bankCode; // 001-003
    trailerLote += '0001'; // 004-007
    trailerLote += '5'; // 008-008: Tipo Reg 5 (Trailer Lote)
    trailerLote += padText('', 9); // 009-017
    trailerLote += '2'; // 018-018: CNPJ
    trailerLote += cnpjDigits; // 019-032
    trailerLote += padText('', 15); // 033-047
    trailerLote += agency; // 048-052
    trailerLote += agencyDV; // 053-053
    trailerLote += account; // 054-065
    trailerLote += accountDV; // 066-066
    trailerLote += ' '; // 067-067
    trailerLote += formatValueInCents(totalDebitos, 18); // 068-085: Total Débitos
    trailerLote += formatValueInCents(totalCreditos, 18); // 086-103: Total Créditos
    trailerLote += formatValueInCents(totalCreditos - totalDebitos, 18); // 104-121: Saldo Final
    trailerLote += totalCreditos >= totalDebitos ? 'C' : 'D'; // 122-122: Situação Saldo Final
    trailerLote += padZero(totalRegLote, 6); // 123-128: Qtd Registros no Lote
    trailerLote += padText('', 112); // 129-240: Uso FEBRABAN
  }
  lines.push(trailerLote);

  // 5. TRAILER DE ARQUIVO (240 posições - Usa o modelo original como base)
  const totalRegArquivo = lines.length + 1;
  let trailerArq = '';
  if (layout?.sampleTrailerArq && layout.sampleTrailerArq.length >= 240) {
    trailerArq = layout.sampleTrailerArq.padEnd(240, ' ').slice(0, 240);
    trailerArq = overlayField(trailerArq, 1, 3, bankCode);
    trailerArq = overlayField(trailerArq, 4, 4, '9999');
    trailerArq = overlayField(trailerArq, 8, 1, '9');
    trailerArq = overlayField(trailerArq, 18, 6, padZero(1, 6));
    trailerArq = overlayField(trailerArq, 24, 6, padZero(totalRegArquivo, 6));
  } else {
    trailerArq += bankCode; // 001-003
    trailerArq += '9999'; // 004-007
    trailerArq += '9'; // 008-008: Tipo Reg 9 (Trailer Arq)
    trailerArq += padText('', 9); // 009-017
    trailerArq += padZero(1, 6); // 018-023: Qtd Lotes
    trailerArq += padZero(totalRegArquivo, 6); // 024-029: Qtd Registros Arquivo
    trailerArq += padText('', 211); // 030-240: Uso FEBRABAN
  }
  lines.push(trailerArq);

  return lines.join('\r\n');
}

/**
 * ENGENHARIA REVERSA & APRENDIZADO DE LAYOUTS CNAB DE MODELOS RECEBIDOS
 * Analisa as linhas do arquivo CNAB modelo, identifica Header, Detalhes, Trailer e posições de campos
 */
export function reverseEngineCnabStructure(
  cnabRawContent: string,
  fileName: string = 'Modelo_CNAB.ret',
  company?: CompanySettings,
  autoSave: boolean = false
): LearnedCNABExtratoLayout {
  const lines = cnabRawContent
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  let detectedBankCode = '341';
  let detectedPadrao: '240' | '400' = '240';
  let detectedBankName = 'Banco Não Identificado';

  let sampleHeaderArq = '';
  let sampleHeaderLote = '';
  let sampleSegmentE = '';
  let sampleTrailerLote = '';
  let sampleTrailerArq = '';

  let detectedTipoInscricao = '2'; // 2 = CNPJ, 1 = CPF
  let detectedCnpj = company?.cnpj || '';
  let detectedCodigoEmpresaBanco = company?.convenio || '';
  let detectedAgencia = company?.agencia || '';
  let detectedDigitoAgencia = '';
  let detectedConta = company?.conta || '';
  let detectedDigitoConta = '';
  let detectedConvenio = company?.convenio || '';
  let detectedEmpresaNome = company?.razaoSocial || '';
  let detectedNomeBancoModelo = '';
  let detectedDataGeracao = '';
  let detectedHoraGeracao = '';
  let detectedSeqArquivo = '000001';
  let detectedVersaoLayout = '087';

  const movementCodesDetected: Record<string, string> = {};

  if (lines.length > 0) {
    const line1 = lines[0];
    if (line1.length >= 240) {
      detectedPadrao = '240';
      detectedBankCode = line1.substring(0, 3);
      sampleHeaderArq = line1.padEnd(240, ' ').slice(0, 240);

      // Tenta extrair dados cadastrais detalhados do Header de Arquivo 240
      detectedTipoInscricao = line1.substring(17, 18).trim() || '2';
      const rawCnpj = line1.substring(18, 32).trim();
      if (rawCnpj && rawCnpj !== '00000000000000') {
        detectedCnpj = rawCnpj;
      }
      detectedCodigoEmpresaBanco = line1.substring(32, 52).trim();
      detectedConvenio = detectedCodigoEmpresaBanco;

      const rawAg = line1.substring(52, 57).replace(/^0+/, '');
      if (rawAg) detectedAgencia = rawAg;
      detectedDigitoAgencia = line1.substring(57, 58).trim();

      const rawConta = line1.substring(58, 70).replace(/^0+/, '');
      if (rawConta) detectedConta = rawConta;
      detectedDigitoConta = line1.substring(70, 71).trim();

      const rawEmpresa = line1.substring(72, 102).trim();
      if (rawEmpresa) detectedEmpresaNome = rawEmpresa;

      const rawBanco = line1.substring(102, 132).trim();
      if (rawBanco) detectedNomeBancoModelo = rawBanco;

      detectedDataGeracao = line1.substring(143, 151).trim();
      detectedHoraGeracao = line1.substring(151, 157).trim();
      detectedSeqArquivo = line1.substring(157, 163).trim() || '000001';
      detectedVersaoLayout = line1.substring(163, 166).trim() || '087';
    } else if (line1.length === 400) {
      detectedPadrao = '400';
      detectedBankCode = line1.substring(76, 79) || line1.substring(0, 3);
      sampleHeaderArq = line1;
      const rawEmpresa400 = line1.substring(46, 76).trim();
      if (rawEmpresa400) detectedEmpresaNome = rawEmpresa400;
      detectedCodigoEmpresaBanco = line1.substring(26, 46).trim();
    }
    const bInfo = getBankInfo(detectedBankCode);
    detectedBankName = bInfo.shortName;
  }

  // Percorre as linhas do modelo para extrair amostras e códigos de movimentação do Segmento E / Detalhe
  lines.forEach((line) => {
    if (line.length >= 240) {
      const regType = line.charAt(7);
      const segCode = line.charAt(13);

      if (regType === '1' && !sampleHeaderLote) {
        sampleHeaderLote = line.padEnd(240, ' ').slice(0, 240);
        // Tenta reforçar os dados do Header do Lote
        const loteEmpresa = line.substring(72, 102).trim();
        if (loteEmpresa && !detectedEmpresaNome) detectedEmpresaNome = loteEmpresa;
      } else if (regType === '3' && segCode === 'E') {
        if (!sampleSegmentE) {
          sampleSegmentE = line.padEnd(240, ' ').slice(0, 240);
        }
        const code = line.substring(135, 139).trim();
        const hist = line.substring(139, 164).trim();
        if (code && hist) {
          movementCodesDetected[code] = hist;
        }
      } else if (regType === '5' && !sampleTrailerLote) {
        sampleTrailerLote = line.padEnd(240, ' ').slice(0, 240);
      } else if (regType === '9' && !sampleTrailerArq) {
        sampleTrailerArq = line.padEnd(240, ' ').slice(0, 240);
      }
    }
  });

  const layoutId = `layout-custom-${detectedBankCode}-${Date.now().toString(36)}`;
  const companyLabel = company?.razaoSocial || detectedEmpresaNome || 'Empresa Geral';
  const layoutName = `Modelo CNAB ${detectedPadrao} - ${detectedBankName} (${detectedBankCode}) [${companyLabel}]`;

  const headerArquivoFieldsExtracted: CNABExtratoFieldSpec[] = [
    { posInicio: 1, posFim: 3, tamanho: 3, tipo: 'N', nomeCampo: 'Código do Banco', descricao: `Banco Emissor (${detectedBankCode})` },
    { posInicio: 4, posFim: 7, tamanho: 4, tipo: 'N', nomeCampo: 'Lote de Serviço', descricao: '0000 (Header de Arquivo)' },
    { posInicio: 8, posFim: 8, tamanho: 1, tipo: 'N', nomeCampo: 'Tipo de Registro', descricao: '0 = Header de Arquivo' },
    { posInicio: 9, posFim: 17, tamanho: 9, tipo: 'A', nomeCampo: 'Uso Exclusivo FEBRABAN/Banco', descricao: 'Brancos' },
    { posInicio: 18, posFim: 18, tamanho: 1, tipo: 'N', nomeCampo: 'Tipo de Inscrição', descricao: `${detectedTipoInscricao === '1' ? '1 = CPF' : '2 = CNPJ'}` },
    { posInicio: 19, posFim: 32, tamanho: 14, tipo: 'N', nomeCampo: 'CNPJ/CPF da Empresa', descricao: `CNPJ Modelo: ${detectedCnpj || 'Não informado'}` },
    { posInicio: 33, posFim: 52, tamanho: 20, tipo: 'A', nomeCampo: 'Código do Convênio / Empresa no Banco', descricao: `Convênio Modelo: ${detectedCodigoEmpresaBanco || 'Não informado'}` },
    { posInicio: 53, posFim: 57, tamanho: 5, tipo: 'N', nomeCampo: 'Agência Mantenedora', descricao: `Agência: ${detectedAgencia || '00000'}` },
    { posInicio: 58, posFim: 58, tamanho: 1, tipo: 'A', nomeCampo: 'Dígito Verificador Agência', descricao: `DV Agência: ${detectedDigitoAgencia || '-'}` },
    { posInicio: 59, posFim: 70, tamanho: 12, tipo: 'N', nomeCampo: 'Número da Conta Corrente', descricao: `Conta: ${detectedConta || '000000000000'}` },
    { posInicio: 71, posFim: 71, tamanho: 1, tipo: 'A', nomeCampo: 'Dígito Verificador Conta', descricao: `DV Conta: ${detectedDigitoConta || '-'}` },
    { posInicio: 72, posFim: 72, tamanho: 1, tipo: 'A', nomeCampo: 'Dígito Verificador Ag/Conta', descricao: 'DV Ag/Conta' },
    { posInicio: 73, posFim: 102, tamanho: 30, tipo: 'A', nomeCampo: 'Nome da Empresa / Razão Social', descricao: `Razão Social: ${detectedEmpresaNome || 'Não informada'}` },
    { posInicio: 103, posFim: 132, tamanho: 30, tipo: 'A', nomeCampo: 'Nome do Banco Emissor', descricao: `Banco Modelo: ${detectedNomeBancoModelo || detectedBankName}` },
    { posInicio: 133, posFim: 142, tamanho: 10, tipo: 'A', nomeCampo: 'Uso Exclusivo FEBRABAN/Banco', descricao: 'Reservado' },
    { posInicio: 143, posFim: 143, tamanho: 1, tipo: 'N', nomeCampo: 'Código Remessa / Retorno', descricao: '2 = Retorno / Extrato' },
    { posInicio: 144, posFim: 151, tamanho: 8, tipo: 'N', nomeCampo: 'Data de Geração do Arquivo', descricao: `Data Modelo: ${detectedDataGeracao || 'DDMMAAAA'}` },
    { posInicio: 152, posFim: 157, tamanho: 6, tipo: 'N', nomeCampo: 'Hora de Geração do Arquivo', descricao: `Hora Modelo: ${detectedHoraGeracao || 'HHMMSS'}` },
    { posInicio: 158, posFim: 163, tamanho: 6, tipo: 'N', nomeCampo: 'Número Sequencial do Arquivo (NSA)', descricao: `NSA Modelo: ${detectedSeqArquivo || '000001'}` },
    { posInicio: 164, posFim: 166, tamanho: 3, tipo: 'N', nomeCampo: 'Nº da Versão do Layout do Arquivo', descricao: `Versão Modelo: ${detectedVersaoLayout || '087'}` },
  ];

  const newLearnedLayout: LearnedCNABExtratoLayout = {
    id: layoutId,
    nomeLayout: layoutName,
    bancoCodigo: detectedBankCode,
    bancoNome: detectedBankName,
    padraoCNAB: detectedPadrao,
    createdDate: new Date().toISOString(),
    lastUsedDate: new Date().toISOString(),
    timesUsed: 1,
    isCustomLearned: true,

    // Vínculo detalhado com Empresa, CNPJ e Dados da Conta extraídos do arquivo modelo
    empresaId: company?.id || '',
    empresaNome: companyLabel,
    cnpjEmpresa: detectedCnpj,
    tipoInscricaoEmpresa: detectedTipoInscricao,
    agenciaPadrao: detectedAgencia || company?.agencia || '0001',
    digitoAgencia: detectedDigitoAgencia,
    contaPadrao: detectedConta || company?.conta || '00000',
    digitoConta: detectedDigitoConta,
    convenioPadrao: detectedConvenio || company?.convenio || '000001',
    codigoEmpresaBanco: detectedCodigoEmpresaBanco,
    nomeBancoModelo: detectedNomeBancoModelo || detectedBankName,
    dataGeracaoModelo: detectedDataGeracao,
    horaGeracaoModelo: detectedHoraGeracao,
    seqArquivoModelo: detectedSeqArquivo,
    versaoLayoutModelo: detectedVersaoLayout,

    // Amostras das linhas originais modelo espelhadas
    sampleHeaderArq,
    sampleHeaderLote,
    sampleSegmentE,
    sampleTrailerLote,
    sampleTrailerArq,
    rawModelContent: cnabRawContent,

    headerArquivoFields: headerArquivoFieldsExtracted,
    headerLoteFields: [
      { posInicio: 1, posFim: 3, tamanho: 3, tipo: 'N', nomeCampo: 'Código do Banco', descricao: `Código do Banco (${detectedBankCode})` },
      { posInicio: 4, posFim: 7, tamanho: 4, tipo: 'N', nomeCampo: 'Lote de Serviço', descricao: '0001 (Primeiro Lote)' },
      { posInicio: 8, posFim: 8, tamanho: 1, tipo: 'N', nomeCampo: 'Tipo de Registro', descricao: '1 = Header de Lote' },
      { posInicio: 9, posFim: 9, tamanho: 1, tipo: 'A', nomeCampo: 'Tipo de Operação', descricao: 'E = Extrato de Conta' },
      { posInicio: 10, posFim: 11, tamanho: 2, tipo: 'N', nomeCampo: 'Tipo de Serviço', descricao: '04 = Extrato para Conciliação' },
      { posInicio: 18, posFim: 32, tamanho: 14, tipo: 'N', nomeCampo: 'CNPJ/CPF do Titular', descricao: `CNPJ: ${detectedCnpj}` },
      { posInicio: 33, posFim: 52, tamanho: 20, tipo: 'A', nomeCampo: 'Convênio / Código da Empresa', descricao: `Convênio: ${detectedConvenio}` },
      { posInicio: 53, posFim: 57, tamanho: 5, tipo: 'N', nomeCampo: 'Agência Mantenedora', descricao: `Agência: ${detectedAgencia}` },
      { posInicio: 59, posFim: 70, tamanho: 12, tipo: 'N', nomeCampo: 'Número da Conta Corrente', descricao: `Conta: ${detectedConta}` },
      { posInicio: 73, posFim: 102, tamanho: 30, tipo: 'A', nomeCampo: 'Nome da Empresa Titular', descricao: `Empresa: ${detectedEmpresaNome}` },
    ],
    segmentoEFields: FEBRABAN_SEGMENTO_E_FIELDS,
    trailerLoteFields: [],
    trailerArquivoFields: [],
    movementCodesMap: Object.keys(movementCodesDetected).length > 0 ? movementCodesDetected : {
      '101': 'PIX Recebido',
      '102': 'PIX Enviado',
      '103': 'TED Recebida',
      '104': 'TED Enviada',
      '201': 'Tarifa de Pacote de Serviços',
    },
  };

  // Salva o layout na base aprendida de extratos se autoSave for verdadeiro
  if (autoSave) {
    try {
      const currentLayouts = loadLearnedExtratoLayouts();
      currentLayouts.unshift(newLearnedLayout);
      saveLearnedExtratoLayouts(currentLayouts);
    } catch (e) {
      console.warn('[reverseEngineCnabStructure] Erro ao salvar layout:', e);
    }
  }

  return newLearnedLayout;
}
