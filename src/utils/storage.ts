import { BoletoItem, CompanySettings, CompanyProfile, BankAccountProfile, CNABBatchHistory, AuthUser } from '../types';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import {
  getSupabaseClient,
  syncCompanyProfilesToSupabase,
  syncBoletosToSupabase,
  syncHistoryToSupabase,
} from '../lib/supabase';

const STORAGE_KEYS = {
  COMPANIES_V4: 'gerador_cnab_companies_v4',
  ACTIVE_SELECTION_V4: 'gerador_cnab_active_selection_v4',
  COMPANIES_V3: 'gerador_cnab_companies_v3',
  ACTIVE_SELECTION_V3: 'gerador_cnab_active_selection_v3',
  COMPANIES_V2: 'gerador_cnab_companies_v2',
  COMPANY_LEGACY: 'gerador_cnab_company_v1',
  BOLETOS: 'gerador_cnab_boletos_v1',
  HISTORY: 'gerador_cnab_history_v1',
  USER_SESSION: 'wanfinance_user_session_v1',
};

export const DEFAULT_COMPANIES: CompanyProfile[] = [
  {
    id: 'comp-viasul-auto-byd',
    nomeFantasia: 'BYD - ARRUDA',
    razaoSocial: 'VIA SUL AUTO LTDA',
    cnpjCpf: '54122933000180',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA PROFESSOR ARRUDA CAMARA',
    numero: '100',
    complemento: '',
    cidade: 'RECIFE',
    uf: 'PE',
    cep: '52070000',
    bancos: [
      {
        id: 'bank-byd-bradesco',
        apelido: 'Bradesco - 30612',
        bancoCodigo: '237',
        bancoNome: 'Banco Bradesco S.A.',
        agencia: '2960',
        agenciaDV: '0',
        conta: '3171',
        contaDV: '2',
        convenio: '30612',
        codigoTransmissao: '30612',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-byd-bb',
        apelido: 'Banco do Brasil - 30300',
        bancoCodigo: '001',
        bancoNome: 'Banco do Brasil S.A.',
        agencia: '3434',
        agenciaDV: '0',
        conta: '6931',
        contaDV: '0',
        convenio: '30300',
        codigoTransmissao: '30300',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-byd-itau',
        apelido: 'Itaú - 30279',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '98958',
        contaDV: '2',
        convenio: '30279',
        codigoTransmissao: '30279',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-byd-santander',
        apelido: 'Santander - 30262',
        bancoCodigo: '033',
        bancoNome: 'Banco Santander Brasil S.A.',
        agencia: '4661',
        agenciaDV: '0',
        conta: '130068256',
        contaDV: '0',
        convenio: '30262',
        codigoTransmissao: '30262',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-byd-trianon',
        apelido: 'Banco Trianon - 30625',
        bancoCodigo: '318',
        bancoNome: 'Banco Trianon / BMG',
        agencia: '895',
        agenciaDV: '0',
        conta: '54726',
        contaDV: '8',
        convenio: '30625',
        codigoTransmissao: '30625',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-byd-itau',
  },
  {
    id: 'comp-invest1-parts',
    nomeFantasia: 'EMPRESA INVESTPARTS',
    razaoSocial: 'INVEST1 PARTICIPACOES LTDA',
    cnpjCpf: '58773491000193',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA PAULISTA',
    numero: '1500',
    complemento: '',
    cidade: 'SAO PAULO',
    uf: 'SP',
    cep: '01310200',
    bancos: [
      {
        id: 'bank-invest1-bradesco',
        apelido: 'Bradesco - 30218',
        bancoCodigo: '237',
        bancoNome: 'Banco Bradesco S.A.',
        agencia: '2960',
        agenciaDV: '0',
        conta: '85000',
        contaDV: '4',
        convenio: '30218',
        codigoTransmissao: '30218',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-invest1-itau',
        apelido: 'Itaú - 30216',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '1247',
        agenciaDV: '0',
        conta: '40738',
        contaDV: '8',
        convenio: '30216',
        codigoTransmissao: '30216',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-invest1-itau',
  },
  {
    id: 'comp-projeto-part',
    nomeFantasia: 'EMPRESA PROJETO',
    razaoSocial: 'PROJETO PART. E EMPREEND S/A.',
    cnpjCpf: '01800826000106',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA REBOUCAS',
    numero: '2500',
    complemento: '',
    cidade: 'SAO PAULO',
    uf: 'SP',
    cep: '05402000',
    bancos: [
      {
        id: 'bank-projeto-itau',
        apelido: 'Itaú - 30245',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '50846',
        contaDV: '5',
        convenio: '30245',
        codigoTransmissao: '30245',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-projeto-itau',
  },
  {
    id: 'comp-granvia-ford',
    nomeFantasia: 'FORD IMBIRIBEIRA',
    razaoSocial: 'GRANVIA VEICULOS',
    cnpjCpf: '12946886000140',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA MASCARENHAS DE MORAIS',
    numero: '2000',
    complemento: '',
    cidade: 'RECIFE',
    uf: 'PE',
    cep: '51170000',
    bancos: [
      {
        id: 'bank-granvia-bradesco',
        apelido: 'Bradesco - 30221',
        bancoCodigo: '237',
        bancoNome: 'Banco Bradesco S.A.',
        agencia: '2960',
        agenciaDV: '0',
        conta: '29004',
        contaDV: '1',
        convenio: '30221',
        codigoTransmissao: '30221',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-granvia-bb',
        apelido: 'Banco do Brasil - 30227',
        bancoCodigo: '001',
        bancoNome: 'Banco do Brasil S.A.',
        agencia: '3433',
        agenciaDV: '0',
        conta: '105905',
        contaDV: 'X',
        convenio: '30227',
        codigoTransmissao: '30227',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-granvia-itau',
        apelido: 'Itaú - 30224',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '5196',
        agenciaDV: '0',
        conta: '18209',
        contaDV: '0',
        convenio: '30224',
        codigoTransmissao: '30224',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-granvia-safra',
        apelido: 'Safra - 30226',
        bancoCodigo: '422',
        bancoNome: 'Banco Safra S.A.',
        agencia: '144',
        agenciaDV: '0',
        conta: '580201',
        contaDV: '2',
        convenio: '30226',
        codigoTransmissao: '30226',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-granvia-santander',
        apelido: 'Santander - 30220',
        bancoCodigo: '033',
        bancoNome: 'Banco Santander Brasil S.A.',
        agencia: '2147',
        agenciaDV: '0',
        conta: '13001229',
        contaDV: '6',
        convenio: '30220',
        codigoTransmissao: '30220',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-granvia-itau',
  },
  {
    id: 'comp-eurovia-geely',
    nomeFantasia: 'GEELY IMBIRIBEIRA',
    razaoSocial: 'EUROVIA AUTO LTDA - GEELY IMBIRIBEIRA',
    cnpjCpf: '60933323000160',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA MASCARENHAS DE MORAIS',
    numero: '2500',
    complemento: '',
    cidade: 'RECIFE',
    uf: 'PE',
    cep: '51170000',
    bancos: [
      {
        id: 'bank-geely-bradesco',
        apelido: 'Bradesco - 30620',
        bancoCodigo: '237',
        bancoNome: 'Banco Bradesco S.A.',
        agencia: '2960',
        agenciaDV: '0',
        conta: '3353',
        contaDV: '7',
        convenio: '30620',
        codigoTransmissao: '30620',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-geely-bb',
        apelido: 'Banco do Brasil - 30623',
        bancoCodigo: '001',
        bancoNome: 'Banco do Brasil S.A.',
        agencia: '3434',
        agenciaDV: '7',
        conta: '7636',
        contaDV: '8',
        convenio: '30623',
        codigoTransmissao: '30623',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-geely-itau',
        apelido: 'Itaú - 30621',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '98184',
        contaDV: '5',
        convenio: '30621',
        codigoTransmissao: '30621',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-geely-santander',
        apelido: 'Santander - 30622',
        bancoCodigo: '033',
        bancoNome: 'Banco Santander Brasil S.A.',
        agencia: '3749',
        agenciaDV: '0',
        conta: '13005439',
        contaDV: '4',
        convenio: '30622',
        codigoTransmissao: '30622',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-geely-itau',
  },
  {
    id: 'comp-viasul-jeep',
    nomeFantasia: 'JEEP IMBIRIBEIRA',
    razaoSocial: 'VIA SUL VEICULOS S/A - JEEP IMBIRIBEIRA',
    cnpjCpf: '40841736001006',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA MASCARENHAS DE MORAIS',
    numero: '1800',
    complemento: '',
    cidade: 'RECIFE',
    uf: 'PE',
    cep: '51170000',
    bancos: [
      {
        id: 'bank-jeep-itau',
        apelido: 'Itaú - 30232',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '13314',
        contaDV: '0',
        convenio: '30232',
        codigoTransmissao: '30232',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-jeep-santander',
        apelido: 'Santander - 30229',
        bancoCodigo: '033',
        bancoNome: 'Banco Santander Brasil S.A.',
        agencia: '4661',
        agenciaDV: '0',
        conta: '13023301',
        contaDV: '4',
        convenio: '30229',
        codigoTransmissao: '30229',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-jeep-itau',
  },
  {
    id: 'comp-intervia-kia',
    nomeFantasia: 'KIA PIEDADE',
    razaoSocial: 'INTERVIA VEICULOS SA PIEDADE',
    cnpjCpf: '08315588000184',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA BERNARDO VIEIRA DE MELO',
    numero: '1200',
    complemento: '',
    cidade: 'JABOATAO DOS GUARARAPES',
    uf: 'PE',
    cep: '54410010',
    bancos: [
      {
        id: 'bank-kia-bradesco',
        apelido: 'Bradesco - 30204',
        bancoCodigo: '237',
        bancoNome: 'Banco Bradesco S.A.',
        agencia: '2960',
        agenciaDV: '0',
        conta: '29000',
        contaDV: '9',
        convenio: '30204',
        codigoTransmissao: '30204',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-kia-bb',
        apelido: 'Banco do Brasil - 30203',
        bancoCodigo: '001',
        bancoNome: 'Banco do Brasil S.A.',
        agencia: '3433',
        agenciaDV: '9',
        conta: '105530',
        contaDV: '5',
        convenio: '30203',
        codigoTransmissao: '30203',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-kia-itau',
        apelido: 'Itaú - 30201',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '50844',
        contaDV: '0',
        convenio: '30201',
        codigoTransmissao: '30201',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-kia-safra',
        apelido: 'Safra - 30205',
        bancoCodigo: '422',
        bancoNome: 'Banco Safra S.A.',
        agencia: '144',
        agenciaDV: '0',
        conta: '4195',
        contaDV: '1',
        convenio: '30205',
        codigoTransmissao: '30205',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-kia-santander',
        apelido: 'Santander - 30202',
        bancoCodigo: '033',
        bancoNome: 'Banco Santander Brasil S.A.',
        agencia: '4661',
        agenciaDV: '0',
        conta: '13003914',
        contaDV: '0',
        convenio: '30202',
        codigoTransmissao: '30202',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-kia-itau',
  },
  {
    id: 'comp-viasul-leap',
    nomeFantasia: 'LEAP IMBIRIBEIRA',
    razaoSocial: 'VIA SUL VEICULOS S/A - LEAP IMBIRIBEIRA',
    cnpjCpf: '40841736002312',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA MASCARENHAS DE MORAIS',
    numero: '2100',
    complemento: '',
    cidade: 'RECIFE',
    uf: 'PE',
    cep: '51170000',
    bancos: [
      {
        id: 'bank-leap-itau',
        apelido: 'Itaú - 30626',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '98171',
        contaDV: '2',
        convenio: '30626',
        codigoTransmissao: '30626',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-leap-santander',
        apelido: 'Santander - 30627',
        bancoCodigo: '033',
        bancoNome: 'Banco Santander Brasil S.A.',
        agencia: '3749',
        agenciaDV: '0',
        conta: '13005485',
        contaDV: '1',
        convenio: '30627',
        codigoTransmissao: '30627',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-leap-itau',
  },
  {
    id: 'comp-newvia-motos',
    nomeFantasia: 'NEWVIA IMBIRIBEIRA',
    razaoSocial: 'NEWVIA MOTOS LTDA',
    cnpjCpf: '51478180000152',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA MASCARENHAS DE MORAIS',
    numero: '1500',
    complemento: '',
    cidade: 'RECIFE',
    uf: 'PE',
    cep: '51170000',
    bancos: [
      {
        id: 'bank-newvia-bradesco',
        apelido: 'Bradesco - 30615',
        bancoCodigo: '237',
        bancoNome: 'Banco Bradesco S.A.',
        agencia: '2960',
        agenciaDV: '0',
        conta: '3255',
        contaDV: '7',
        convenio: '30615',
        codigoTransmissao: '30615',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-newvia-bb',
        apelido: 'Banco do Brasil - 30261',
        bancoCodigo: '001',
        bancoNome: 'Banco do Brasil S.A.',
        agencia: '3433',
        agenciaDV: '9',
        conta: '7304',
        contaDV: '0',
        convenio: '30261',
        codigoTransmissao: '30261',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-newvia-itau',
        apelido: 'Itaú - 30271',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '80413',
        contaDV: '8',
        convenio: '30271',
        codigoTransmissao: '30271',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-newvia-safra',
        apelido: 'Safra - 30624',
        bancoCodigo: '422',
        bancoNome: 'Banco Safra S.A.',
        agencia: '144',
        agenciaDV: '0',
        conta: '6954',
        contaDV: '6',
        convenio: '30624',
        codigoTransmissao: '30624',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-newvia-santander',
        apelido: 'Santander - 30292',
        bancoCodigo: '033',
        bancoNome: 'Banco Santander Brasil S.A.',
        agencia: '3886',
        agenciaDV: '0',
        conta: '13047880',
        contaDV: '0',
        convenio: '30292',
        codigoTransmissao: '30292',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-newvia-itau',
  },
  {
    id: 'comp-eurovia-nissan',
    nomeFantasia: 'NISSAN IMBIRIBEIRA',
    razaoSocial: 'EUROVIA AUT E UTILIT SA MATRIZ',
    cnpjCpf: '04109834000190',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA MASCARENHAS DE MORAIS',
    numero: '2700',
    complemento: '',
    cidade: 'RECIFE',
    uf: 'PE',
    cep: '51170000',
    bancos: [
      {
        id: 'bank-nissan-bradesco',
        apelido: 'Bradesco - 30270',
        bancoCodigo: '237',
        bancoNome: 'Banco Bradesco S.A.',
        agencia: '2960',
        agenciaDV: '0',
        conta: '55073',
        contaDV: '6',
        convenio: '30270',
        codigoTransmissao: '30270',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-nissan-bb',
        apelido: 'Banco do Brasil - 30286',
        bancoCodigo: '001',
        bancoNome: 'Banco do Brasil S.A.',
        agencia: '3433',
        agenciaDV: '0',
        conta: '8976',
        contaDV: '1',
        convenio: '30286',
        codigoTransmissao: '30286',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-nissan-itau',
        apelido: 'Itaú - 30285',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '50848',
        contaDV: '1',
        convenio: '30285',
        codigoTransmissao: '30285',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-nissan-safra',
        apelido: 'Safra - 30287',
        bancoCodigo: '422',
        bancoNome: 'Banco Safra S.A.',
        agencia: '144',
        agenciaDV: '0',
        conta: '580235',
        contaDV: '7',
        convenio: '30287',
        codigoTransmissao: '30287',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-nissan-santander',
        apelido: 'Santander - 30269',
        bancoCodigo: '033',
        bancoNome: 'Banco Santander Brasil S.A.',
        agencia: '4661',
        agenciaDV: '0',
        conta: '13000102',
        contaDV: '8',
        convenio: '30269',
        codigoTransmissao: '30269',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-nissan-itau',
  },
  {
    id: 'comp-eurovia-omoda',
    nomeFantasia: 'OMODA ABDIAS',
    razaoSocial: 'EUROVIA COMERCIO DE VEICULOS LTDA',
    cnpjCpf: '55479113000103',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA GENERAL SAN MARTIN',
    numero: '1000',
    complemento: '',
    cidade: 'RECIFE',
    uf: 'PE',
    cep: '50761000',
    bancos: [
      {
        id: 'bank-omoda-bradesco',
        apelido: 'Bradesco - 30616',
        bancoCodigo: '237',
        bancoNome: 'Banco Bradesco S.A.',
        agencia: '2960',
        agenciaDV: '0',
        conta: '3219',
        contaDV: '0',
        convenio: '30616',
        codigoTransmissao: '30616',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-omoda-bb',
        apelido: 'Banco do Brasil - 30618',
        bancoCodigo: '001',
        bancoNome: 'Banco do Brasil S.A.',
        agencia: '3434',
        agenciaDV: '0',
        conta: '6986',
        contaDV: '8',
        convenio: '30618',
        codigoTransmissao: '30618',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-omoda-itau',
        apelido: 'Itaú - 30613',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '98565',
        contaDV: '5',
        convenio: '30613',
        codigoTransmissao: '30613',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-omoda-santander',
        apelido: 'Santander - 30619',
        bancoCodigo: '033',
        bancoNome: 'Banco Santander Brasil S.A.',
        agencia: '4661',
        agenciaDV: '0',
        conta: '130069783',
        contaDV: '0',
        convenio: '30619',
        codigoTransmissao: '30619',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-omoda-trianon',
        apelido: 'Banco Trianon - 30655',
        bancoCodigo: '318',
        bancoNome: 'Banco Trianon / BMG',
        agencia: '0895',
        agenciaDV: '8',
        conta: '83346',
        contaDV: '0',
        convenio: '30655',
        codigoTransmissao: '30655',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-omoda-itau',
  },
  {
    id: 'comp-eurovia-renault',
    nomeFantasia: 'RENAULT PIEDADE',
    razaoSocial: 'EUROVIA VEICULOS AS',
    cnpjCpf: '02671595000132',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA BERNARDO VIEIRA DE MELO',
    numero: '1400',
    complemento: '',
    cidade: 'JABOATAO DOS GUARARAPES',
    uf: 'PE',
    cep: '54410010',
    bancos: [
      {
        id: 'bank-renault-bradesco-2960',
        apelido: 'Bradesco Ag 2960 - 30248',
        bancoCodigo: '237',
        bancoNome: 'Banco Bradesco S.A.',
        agencia: '2960',
        agenciaDV: '0',
        conta: '51574',
        contaDV: '4',
        convenio: '30248',
        codigoTransmissao: '30248',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-renault-bradesco-895',
        apelido: 'Bradesco Ag 895 - 30252',
        bancoCodigo: '237',
        bancoNome: 'Banco Bradesco S.A.',
        agencia: '895',
        agenciaDV: '0',
        conta: '0139514',
        contaDV: '9',
        convenio: '30252',
        codigoTransmissao: '30252',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-renault-bb',
        apelido: 'Banco do Brasil - 30263',
        bancoCodigo: '001',
        bancoNome: 'Banco do Brasil S.A.',
        agencia: '3433',
        agenciaDV: '0',
        conta: '105619',
        contaDV: '0',
        convenio: '30263',
        codigoTransmissao: '30263',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-renault-itau',
        apelido: 'Itaú - 30255',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '40092',
        contaDV: '9',
        convenio: '30255',
        codigoTransmissao: '30255',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-renault-safra',
        apelido: 'Safra - 30266',
        bancoCodigo: '422',
        bancoNome: 'Banco Safra S.A.',
        agencia: '144',
        agenciaDV: '0',
        conta: '4203',
        contaDV: '6',
        convenio: '30266',
        codigoTransmissao: '30266',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-renault-santander',
        apelido: 'Santander - 30247',
        bancoCodigo: '033',
        bancoNome: 'Banco Santander Brasil S.A.',
        agencia: '4661',
        agenciaDV: '0',
        conta: '13000563',
        contaDV: '7',
        convenio: '30247',
        codigoTransmissao: '30247',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-renault-itau',
  },
  {
    id: 'comp-via1-corretora',
    nomeFantasia: 'VIA 1 CORRETORA',
    razaoSocial: 'VIA 1 CORRETORA DE SEGUROS LTDA',
    cnpjCpf: '08617068000126',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA MASCARENHAS DE MORAIS',
    numero: '1900',
    complemento: '',
    cidade: 'RECIFE',
    uf: 'PE',
    cep: '51170000',
    bancos: [
      {
        id: 'bank-via1corretora-santander',
        apelido: 'Santander - 30230',
        bancoCodigo: '033',
        bancoNome: 'Banco Santander Brasil S.A.',
        agencia: '4661',
        agenciaDV: '0',
        conta: '13067288',
        contaDV: '0',
        convenio: '30230',
        codigoTransmissao: '30230',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-via1corretora-santander',
  },
  {
    id: 'comp-via1-locadora',
    nomeFantasia: 'VIA 1 LOCADORA',
    razaoSocial: 'VIA 1 LOCADORA DE VEICULOS LTDA',
    cnpjCpf: '40539927000119',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA MASCARENHAS DE MORAIS',
    numero: '1950',
    complemento: '',
    cidade: 'RECIFE',
    uf: 'PE',
    cep: '51170000',
    bancos: [
      {
        id: 'bank-via1locadora-santander',
        apelido: 'Santander - 30297',
        bancoCodigo: '033',
        bancoNome: 'Banco Santander Brasil S.A.',
        agencia: '4661',
        agenciaDV: '0',
        conta: '13036996',
        contaDV: '6',
        convenio: '30297',
        codigoTransmissao: '30297',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-via1locadora-santander',
  },
  {
    id: 'comp-via-holding',
    nomeFantasia: 'VIA HOLDING',
    razaoSocial: 'VIA HOLDING LTDA',
    cnpjCpf: '27537487000100',
    tipoInscricao: 'CNPJ',
    logradouro: 'RUA SAMUEL KLEIN',
    numero: '83',
    complemento: '',
    cidade: 'SAO CAETANO DO SUL',
    uf: 'SP',
    cep: '09510125',
    bancos: [
      {
        id: 'bank-viaholding-bradesco',
        apelido: 'Bradesco - 30296',
        bancoCodigo: '237',
        bancoNome: 'Banco Bradesco S.A.',
        agencia: '2960',
        agenciaDV: '0',
        conta: '02357',
        contaDV: '4',
        convenio: '30296',
        codigoTransmissao: '30296',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-viaholding-itau',
        apelido: 'Itaú - 30278',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '98722',
        contaDV: '2',
        convenio: '30278',
        codigoTransmissao: '30278',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-viaholding-itau',
  },
  {
    id: 'comp-viasul-matriz',
    nomeFantasia: 'VIA SUL MATRIZ',
    razaoSocial: 'VIA SUL VEICULOS LTDA',
    cnpjCpf: '40841736000107',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA MASCARENHAS DE MORAIS',
    numero: '1700',
    complemento: '',
    cidade: 'RECIFE',
    uf: 'PE',
    cep: '51170000',
    bancos: [
      {
        id: 'bank-viasulmatriz-bradesco-2960',
        apelido: 'Bradesco Ag 2960 - 30234',
        bancoCodigo: '237',
        bancoNome: 'Banco Bradesco S.A.',
        agencia: '2960',
        agenciaDV: '0',
        conta: '28755',
        contaDV: '5',
        convenio: '30234',
        codigoTransmissao: '30234',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-viasulmatriz-bradesco-895',
        apelido: 'Bradesco Ag 895 - 30246',
        bancoCodigo: '237',
        bancoNome: 'Banco Bradesco S.A.',
        agencia: '895',
        agenciaDV: '0',
        conta: '140107',
        contaDV: '6',
        convenio: '30246',
        codigoTransmissao: '30246',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-viasulmatriz-bb',
        apelido: 'Banco do Brasil - 30241',
        bancoCodigo: '001',
        bancoNome: 'Banco do Brasil S.A.',
        agencia: '3433',
        agenciaDV: '0',
        conta: '62283',
        contaDV: '4',
        convenio: '30241',
        codigoTransmissao: '30241',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-viasulmatriz-itau',
        apelido: 'Itaú - 30231',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '40091',
        contaDV: '1',
        convenio: '30231',
        codigoTransmissao: '30231',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
      {
        id: 'bank-viasulmatriz-santander',
        apelido: 'Santander - 30228',
        bancoCodigo: '033',
        bancoNome: 'Banco Santander Brasil S.A.',
        agencia: '3749',
        agenciaDV: '0',
        conta: '13000653',
        contaDV: '5',
        convenio: '30228',
        codigoTransmissao: '30228',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      },
    ],
    activeBankId: 'bank-viasulmatriz-itau',
  },
];

export function loadCompanyProfiles(): CompanyProfile[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.COMPANIES_V4);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load company profiles:', e);
  }

  saveCompanyProfiles(DEFAULT_COMPANIES);
  return DEFAULT_COMPANIES;
}

export function saveCompanyProfiles(companies: CompanyProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COMPANIES_V4, JSON.stringify(companies));
    companies.forEach((c) => {
      setDoc(doc(db, 'companies', c.id), c, { merge: true }).catch((err) =>
        console.warn('[Firestore] Sync company warning:', err)
      );
    });

    syncCompanyProfilesToSupabase(companies).catch((err) =>
      console.warn('[Supabase] Sync companies warning:', err)
    );
  } catch (e) {
    console.error('Failed to save company profiles:', e);
  }
}

export function resetToDefaultCompanies(): CompanyProfile[] {
  saveCompanyProfiles(DEFAULT_COMPANIES);
  saveActiveSelection(DEFAULT_COMPANIES[0].id, DEFAULT_COMPANIES[0].bancos[0].id);
  return DEFAULT_COMPANIES;
}

export function loadActiveSelection(): { companyId: string; bankId: string } {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SELECTION_V4);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.companyId && parsed.bankId) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load active selection:', e);
  }
  return {
    companyId: DEFAULT_COMPANIES[0].id,
    bankId: DEFAULT_COMPANIES[0].bancos[0].id,
  };
}

export function saveActiveSelection(companyId: string, bankId: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SELECTION_V4, JSON.stringify({ companyId, bankId }));
  } catch (e) {
    console.error('Failed to save active selection:', e);
  }
}

/**
 * Returns a merged CompanySettings object for the active company and bank account
 */
export function getActiveCompanySettings(
  companies: CompanyProfile[],
  activeCompanyId: string,
  activeBankId?: string
): CompanySettings {
  const company = companies.find((c) => c.id === activeCompanyId) || companies[0] || DEFAULT_COMPANIES[0];
  const targetBankId = activeBankId || company.activeBankId || (company.bancos[0] ? company.bancos[0].id : '');
  const bank = (company && company.bancos)
    ? (company.bancos.find((b) => b.id === targetBankId) || company.bancos[0])
    : DEFAULT_COMPANIES[0].bancos[0];

  return {
    razaoSocial: company.razaoSocial,
    cnpjCpf: company.cnpjCpf,
    tipoInscricao: company.tipoInscricao,
    logradouro: company.logradouro,
    numero: company.numero,
    complemento: company.complemento,
    cidade: company.cidade,
    uf: company.uf,
    cep: company.cep,

    bancoCodigo: bank.bancoCodigo,
    bancoNome: bank.bancoNome,
    agencia: bank.agencia,
    agenciaDV: bank.agenciaDV,
    conta: bank.conta,
    contaDV: bank.contaDV,
    convenio: bank.convenio,
    codigoTransmissao: bank.codigoTransmissao,
    nsa: bank.nsa,
    padraoCNAB: bank.padraoCNAB,
    layoutVersaoLote: bank.layoutVersaoLote,
  };
}

export const INITIAL_SAMPLE_BOLETOS: BoletoItem[] = [
  {
    id: 'bol-sample-1',
    linhaDigitavel: '00190000090123456700400001234567885000000012345',
    codigoBarras: '00198850000000123450000001234567004000012345',
    bancoCodigo: '001',
    bancoNome: 'Banco do Brasil',
    favorecidoNome: 'FORNECEDOR DE SOFTWARE S.A.',
    favorecidoCnpjCpf: '98765432000188',
    valor: 123.45,
    dataVencimento: '2026-08-15',
    dataPagamento: '2026-08-15',
    seuNumero: 'NF-8942',
    desconto: 0,
    jurosMulta: 0,
    categoria: 'Licença de Software',
    observacoes: 'Mensalidade do sistema ERP',
    isValid: true,
    selected: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'bol-sample-2',
    linhaDigitavel: '23790000020111122220300003333444585000000085000',
    codigoBarras: '23795850000000850000000001111222200003333444',
    bancoCodigo: '237',
    bancoNome: 'Bradesco',
    favorecidoNome: 'DISTRIBUIDORA ELETRICA LTDA',
    favorecidoCnpjCpf: '45678912000133',
    valor: 850.00,
    dataVencimento: '2026-08-10',
    dataPagamento: '2026-08-10',
    seuNumero: 'FAT-4012',
    desconto: 20.00,
    jurosMulta: 0,
    categoria: 'Energia / Insumos',
    observacoes: 'Conta de energia do galpão',
    isValid: true,
    selected: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'bol-sample-3',
    linhaDigitavel: '34191234560000012345612345678901285000000150000',
    codigoBarras: '34192850000001500001234500000123456123456789',
    bancoCodigo: '341',
    bancoNome: 'Itaú',
    favorecidoNome: 'CONSULTORIA CONTABIL SILVA',
    favorecidoCnpjCpf: '11223344000155',
    valor: 1500.00,
    dataVencimento: '2026-08-20',
    dataPagamento: '2026-08-20',
    seuNumero: 'HON-082026',
    desconto: 0,
    jurosMulta: 0,
    categoria: 'Serviços Profissionais',
    observacoes: 'Honorários contábeis do mês',
    isValid: true,
    selected: true,
    createdAt: new Date().toISOString(),
  }
];

export function loadCompanySettings(): CompanySettings {
  const profiles = loadCompanyProfiles();
  const activeSel = loadActiveSelection();
  return getActiveCompanySettings(profiles, activeSel.companyId, activeSel.bankId);
}

export function saveCompanySettings(company: CompanySettings): void {
  // Legacy save wrapper: updates active bank/company
  const profiles = loadCompanyProfiles();
  const activeSel = loadActiveSelection();
  const updatedProfiles = profiles.map((p) => {
    if (p.id === activeSel.companyId) {
      return {
        ...p,
        razaoSocial: company.razaoSocial,
        cnpjCpf: company.cnpjCpf,
        tipoInscricao: company.tipoInscricao,
        logradouro: company.logradouro,
        numero: company.numero,
        complemento: company.complemento,
        cidade: company.cidade,
        uf: company.uf,
        cep: company.cep,
        bancos: p.bancos.map((b) => {
          if (b.id === activeSel.bankId) {
            return {
              ...b,
              bancoCodigo: company.bancoCodigo,
              bancoNome: company.bancoNome,
              agencia: company.agencia,
              agenciaDV: company.agenciaDV,
              conta: company.conta,
              contaDV: company.contaDV,
              convenio: company.convenio,
              codigoTransmissao: company.codigoTransmissao,
              nsa: company.nsa,
              padraoCNAB: company.padraoCNAB,
              layoutVersaoLote: company.layoutVersaoLote,
            };
          }
          return b;
        }),
      };
    }
    return p;
  });
  saveCompanyProfiles(updatedProfiles);
}

export function loadBoletos(): BoletoItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BOLETOS);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load boletos:', e);
  }
  return INITIAL_SAMPLE_BOLETOS;
}

export function saveBoletos(boletos: BoletoItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BOLETOS, JSON.stringify(boletos));
    boletos.forEach((b) => {
      setDoc(doc(db, 'boletos', b.id), b, { merge: true }).catch((err) =>
        console.warn('[Firestore] Sync boleto warning:', err)
      );
    });

    syncBoletosToSupabase(boletos).catch((err) =>
      console.warn('[Supabase] Sync boletos warning:', err)
    );
  } catch (e) {
    console.error('Failed to save boletos:', e);
  }
}

export function loadHistory(): CNABBatchHistory[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load history:', e);
  }
  return [];
}

export function saveHistory(history: CNABBatchHistory[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    history.forEach((h) => {
      setDoc(doc(db, 'cnab_history', h.id), h, { merge: true }).catch((err) =>
        console.warn('[Firestore] Sync history warning:', err)
      );
    });

    syncHistoryToSupabase(history).catch((err) =>
      console.warn('[Supabase] Sync history warning:', err)
    );
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

export function loadUserSession(): AuthUser | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load user session:', e);
  }
  return null;
}

export function saveUserSession(user: AuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(user));
      setDoc(doc(db, 'users', user.id), user, { merge: true }).catch((err) =>
        console.warn('[Firestore] Sync user session warning:', err)
      );

      const supabase = getSupabaseClient();
      if (supabase) {
        supabase.from('user_sessions').upsert({
          id: user.id,
          user_id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          login_time: user.loginTime,
        }).then(({ error }) => {
          if (error) console.warn('[Supabase] Sync user session error:', error.message);
        });
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
    }
  } catch (e) {
    console.error('Failed to save user session:', e);
  }
}
