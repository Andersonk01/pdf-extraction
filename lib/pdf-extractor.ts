/**
 * Utilitário para extrair dados de produtos/serviços de PDFs
 */

export interface Product {
  descricao: string;
  unidade: string;
  valorUnitario: string;
  valorTotal: string;
}

export interface PDFSection {
  name: string;
  content: string;
  lines: string[];
}

export interface ExtractedPDFData {
  sections: PDFSection[];
  rawText: string;
  products: Product[];
}

/**
 * Verifica se uma linha é um cabeçalho da tabela
 */
function isHeaderLine(line: string): boolean {
  const headerPatterns = [
    // Padrões básicos (mais comuns primeiro para melhor performance)
    /^(N[º°]|Descri|Unidade|CÓDIGO|NCM|CSOSN|CFOP|DADOS)/i,
    // Padrões específicos para "DESCRIÇÃO" sozinho
    /^DESCRI[ÇC][ÃA]O\s*$/i,
    /^DESCRI[ÇC][ÃA]O$/i,
    
    // Padrões mais frequentes encontrados na análise (51x)
    /ITEM\s+QUANTIDAD\s+VALOR\s+UNIT[ÁRIO]?\s+VALOR\s+TOTAL/i,
    /ITEM\s+QUANTIDADE\s+VALOR\s+UNIT[ÁRIO]?\s*\(R\$\)\s+VALOR\s+TOTAL\s*\(R\$\)/i,
    /ITEM\s+QUANTIDADE\s+VALOR\s+UNIT[ÁRIO]?\s+VALOR\s+TOTAL/i,
    
    // Padrões com "Item Quantidad" (encontrado várias vezes)
    /ITEM\s+QUANTIDAD\s+VALOR\s+UNIT[ÁRIO]?\s+VALOR\s+TOTAL\s*\(R\$\)/i,
    
    // Padrões com ICMS (40x)
    /BASE\s+DE\s+C[ÁA]LCULO\s+DO\s+ICMS/i,
    /VALOR\s+DO\s+ICMS/i,
    /BASE\s+DE\s+C[ÁA]LCULO\s+DO\s+ICMS\s+ST/i,
    /VALOR\s+DO\s+ICMS\s+ST/i,
    /VALOR\s+TOTAL\s+DOS\s+PRODUTOS/i,
    
    // Padrões com "V. TOTAL DE" (22x)
    /V\.\s*TOTAL\s+DE/i,
    
    // Padrões com serviços (6x)
    /DESCRI[ÇC][ÃA]O\s+DOS\s+SERVI[ÇC]OS\s+QTDE\.\s*V\.\s*UNIT\.\s*TOTAL/i,
    /DESCRI[ÇC][ÃA]O\s+DOS\s+SERVI[ÇC]OS\s+QTDE\.\s*V\.UNIT\.\s*TOTAL/i,
    
    // Padrões com ISS
    /ISS\s+A\s+RECOLHER/i,
    /ISS\s+RETIDO/i,
    /VALOR\s+L[ÍI]QUIDO/i,
    /VALOR\s+TOTAL\s+DA\s+NOTA/i,
    
    // Padrões com IPI, ICMS, etc (4x)
    /IPI\s+V\.\s*IPI\s+V\.\s*ICMS\s+BC\s+ICMS\s+V\.\s*TOTAL/i,
    
    // Padrões específicos mencionados pelo usuário
    /QUANT\.?\s*[\/\s]\s*VLR\.?\s*UNIT\.?\s*[\/\s]\s*VLR\.?\s*TOTAL/i,
    /QUANTIDADE\s*[\/\s]\s*VLR\.?\s*UNIT\.?\s*[\/\s]\s*VLR\.?\s*TOTAL/i,
    /QUANTIDADE\s+VLR\.?\s*UNIT\.?\s*VLR\.?\s*TOTAL/i,
    /QTD\.?\s*[\/\s]\s*VLR\.?\s*UNIT\.?\s*[\/\s]\s*VLR\.?\s*TOTAL/i,
    /QUANT\s*[\/\s]\s*VALOR\s+UNIT[ÁRIO]?\s*[\/\s]\s*VALOR\s+TOTAL/i,
    /QUANT\s*[\/\s]\s*VALOR\s+UNIT\s*[\/\s]\s*VALOR\s+TOTAL/i,
    /QUANT\.?\s+V\.?\s*UNIT\.?\s*V\.?\s*[\/\s]\s*V\.?\s*TOTAL/i,
    /QUANT\.?\s*[\/\s]\s*VLR\.?\s*UNIT\.?\s*[\/\s]\s*VLR\.?\s*TOTAL/i,
    /QUANT\s*[\/\s]\s*VALOR\s+UNIT\s*[\/\s]\s*VALOR\s+TOT\.?/i,
    
    // Padrões com "Quantidade / Valor"
    /Quantidade\s*[\/\s]\s*Valor\s+Unit[ÁRIO]?/i,
    /Quantidade\s*[\/\s]\s*Valor\s+Unit[ÁRIO]?\.?\s*\(R\$\)\s*[\/\s]\s*Valor\s+Total\s*\(R\$\)/i,
    /Quantidade\s*[\/\s]\s*Valor\s+Unit[ÁRIO]?\.?\s*[\/\s]\s*Valor\s+Total\s*\(R\$\)/i,
    
    // Padrões com "DESCRIÇÃO QUANT."
    /DESCRI[ÇC][ÃA]O\s+QUANT\.\s+UNIT[ÁRIO]?\s+VALOR\s+TOTAL/i,
    
    // Padrões com "TOTAL QTDE."
    /TOTAL\s+QTDE\.\s+VLR\.\s+UNIT[ÁRIO]?\s+UN\.\s+MEDIDA/i,
    
    // Padrões com "TRIBUTÁVEL ITEM QTDE"
    /TRIBUT[ÁA]VEL\s+ITEM\s+QTDE\s+UNIT[ÁRIO]?\s+R\$\s+TOTAL\s+R\$/i,
    
    // Variações de Quantidade (início de linha)
    /^QUANT[IDADE]?\.?\s*[\/\s]/i,
    /^QTD\.?\s*[\/\s]/i,
    /^Quantidade\s*[\/\s]/i,
    /^QUANTIDADE$/i,
    // Padrões específicos para "QUANT." sozinho
    /^QUANT\.\s*$/i,
    /^QUANT\.$/i,
    
    // Variações de Valor Unitário (genéricas)
    /V\.?\s*UNIT[ÁRIO]?\.?/i,
    /VLR\.?\s*UNIT[ÁRIO]?\.?/i,
    /VALOR\s+UNIT[ÁRIO]?/i,
    /Valor\s+Unit[ÁRIO]?/i,
    // Padrões específicos para "VALOR UNITÁRIO" (sozinho ou como cabeçalho)
    /^VALOR\s+UNIT[ÁRIO]?\.?$/i,
    /VALOR\s+UNIT[ÁRIO]?\.?\s*$/i,
    // Padrões específicos para "V.UNIT." sozinho
    /^V\.\s*UNIT\.\s*$/i,
    /^V\.\s*UNIT\.$/i,
    /^V\.UNIT\.\s*$/i,
    
    // Variações de Valor Total (genéricas)
    /V\.?\s*TOTAL\.?/i,
    /VLR\.?\s*TOTAL\.?/i,
    /VALOR\s+TOTAL/i,
    /Valor\s+Total/i,
    /VALOR\s+TOT\.?/i,
    // Padrões específicos para "VALOR  TOTAL" (com espaço duplo ou múltiplo)
    /^VALOR\s{2,}TOTAL\.?$/i,
    /VALOR\s{2,}TOTAL\.?\s*$/i,
    // Padrão para "VALOR TOTAL" sozinho como cabeçalho
    /^VALOR\s+TOTAL\.?$/i,
    /VALOR\s+TOTAL\.?\s*$/i,
    // Padrões específicos para "V.TOTAL" sozinho
    /^V\.\s*TOTAL\.\s*$/i,
    /^V\.\s*TOTAL\.$/i,
    /^V\.TOTAL\.\s*$/i,
    
    // Padrões com ICMS genéricos
    /ICMS\s+ICMS\s+ISENTO/i,
    /ICMS\s+ISENTO\s+E\s+N[ÃA]O\s+TRIBUTADO/i,
    
    // Padrões com deduções
    /TOTAL\s+DEDU[ÇC][ÕO]ES/i,
    /DEDU[ÇC][ÕO]ES\(R\$\)/i,
    
    // Padrões com histórico
    /HIST[ÓO]RICO\s+TOTAL/i,
  ];
  
  return headerPatterns.some(pattern => pattern.test(line));
}

/**
 * Extrai e organiza todas as informações do PDF em seções
 */
export function extractPDFSections(text: string): PDFSection[] {
  const sections: PDFSection[] = [];
  
  // Normalizar texto
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  
  const lines = normalizedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Padrões de seções comuns em notas fiscais
  const sectionPatterns = [
    { name: 'Cabeçalho', pattern: /^(NF-e|NOTA FISCAL|DANFE)/i },
    { name: 'Dados do Emitente', pattern: /^(EMITENTE|DADOS DO EMITENTE|RAZÃO SOCIAL)/i },
    { name: 'Dados do Destinatário', pattern: /^(DESTINATÁRIO|DADOS DO DESTINATÁRIO|CLIENTE)/i },
    { name: 'Dados dos Produtos/Serviços', pattern: /^(DADOS DOS PRODUTOS|PRODUTOS|DADOS DOS PRODUTOS\/SERVIÇOS|PRODUTOS\/SERVIÇOS)/i },
    { name: 'Totais', pattern: /^(TOTAL|VALOR TOTAL|TOTAIS|VALORES TOTAIS)/i },
    { name: 'Impostos', pattern: /^(IMPOSTOS|TRIBUTOS|ICMS|IPI|ISS)/i },
    { name: 'Informações Complementares', pattern: /^(INFORMAÇÕES|OBSERVAÇÕES|DADOS ADICIONAIS|INFORMAÇÕES COMPLEMENTARES)/i },
    { name: 'Transporte', pattern: /^(TRANSPORTE|DADOS DO TRANSPORTE|TRANSPORTADOR)/i },
    { name: 'Pagamento', pattern: /^(PAGAMENTO|FORMA DE PAGAMENTO|DADOS DE PAGAMENTO)/i },
  ];
  
  let currentSection: PDFSection | null = null;
  let currentSectionLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let sectionFound = false;
    
    // Verificar se a linha corresponde a um padrão de seção
    for (const sectionPattern of sectionPatterns) {
      if (sectionPattern.pattern.test(line)) {
        // Salvar seção anterior se existir
        if (currentSection) {
          // Processar seção de produtos para juntar linhas quebradas
          if (currentSection.name === 'Dados dos Produtos/Serviços') {
            currentSectionLines = mergeProductLines(currentSectionLines);
          }
          currentSection.lines = currentSectionLines;
          currentSection.content = currentSectionLines.join('\n');
          sections.push(currentSection);
        }
        
        // Criar nova seção
        currentSection = {
          name: sectionPattern.name,
          content: line,
          lines: [],
        };
        currentSectionLines = [line];
        sectionFound = true;
        break;
      }
    }
    
    if (!sectionFound) {
      // Se não encontrou nova seção, adicionar à seção atual ou criar seção "Geral"
      if (currentSection) {
        currentSectionLines.push(line);
      } else {
        // Se não há seção atual, criar uma seção "Geral" para o início do documento
        if (sections.length === 0 || sections[sections.length - 1].name !== 'Geral') {
          currentSection = {
            name: 'Geral',
            content: '',
            lines: [],
          };
          currentSectionLines = [line];
        } else {
          sections[sections.length - 1].lines.push(line);
          sections[sections.length - 1].content += '\n' + line;
        }
      }
    }
  }
  
  // Adicionar última seção
  if (currentSection) {
    // Processar seção de produtos para juntar linhas quebradas
    if (currentSection.name === 'Dados dos Produtos/Serviços') {
      currentSectionLines = mergeProductLines(currentSectionLines);
    }
    currentSection.lines = currentSectionLines;
    currentSection.content = currentSectionLines.join('\n');
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * Reorganiza uma linha de produto para corresponder à ordem do cabeçalho
 * Formato original: NCM CSOSN CFOP UNIDADE QUANT V.UNIT V.TOTAL zeros CÓDIGO DESCRIÇÃO
 * Formato desejado: CÓDIGO DESCRIÇÃO NCM CSOSN CFOP UN. QUANT. V.UNIT. V.TOTAL BC.ICMS V.ICMS V.IPI %ICMS %IPI
 */
function reorganizeProductLine(line: string): string {
  const trimmed = line.trim();
  
  // Verificar se é uma linha de produto (começa com NCM de 8 dígitos)
  if (!/^\d{8}\s+\d{4}\s+\d{4}/.test(trimmed)) {
    return line; // Não é linha de produto, retornar original
  }
  
  // Usar uma abordagem mais flexível: dividir por espaços e identificar campos
  const parts = trimmed.split(/\s+/);
  
  if (parts.length < 10) {
    return line; // Não tem campos suficientes
  }
  
  // Identificar campos pela posição e padrão
  let idx = 0;
  const ncm = parts[idx++]; // Primeiro campo: NCM (8 dígitos)
  const csosn = parts[idx++]; // Segundo campo: CSOSN (4 dígitos)
  
  // CFOP pode estar separado ou junto com UNIDADE
  let cfop: string;
  let unidade: string;
  
  if (/^\d{4}$/.test(parts[idx])) {
    // CFOP está separado
    cfop = parts[idx++];
    unidade = parts[idx++];
  } else {
    // CFOP e UNIDADE estão juntos (ex: "5102METRO")
    const cfopUnidade = parts[idx++];
    const match = cfopUnidade.match(/^(\d{4})([A-Z]{2,})$/);
    if (match) {
      cfop = match[1];
      unidade = match[2];
    } else {
      // Fallback: assumir que os primeiros 4 caracteres são CFOP
      cfop = cfopUnidade.substring(0, 4);
      unidade = cfopUnidade.substring(4);
    }
  }
  
  // Quantidade (número inteiro ou decimal)
  const quant = parts[idx++];
  
  // Valores monetários
  const vUnit = parts[idx++];
  const vTotal = parts[idx++];
  
  // Zeros (BC.ICMS, V.ICMS, V.IPI, %ICMS, %IPI)
  const zeros: string[] = [];
  while (idx < parts.length && /^0[,.]00$/.test(parts[idx])) {
    zeros.push(parts[idx++]);
  }
  
  // Garantir que temos pelo menos 5 zeros
  while (zeros.length < 5) {
    zeros.push('0,00');
  }
  
  const bcIcms = zeros[0] || '0,00';
  const vIcms = zeros[1] || '0,00';
  const vIpi = zeros[2] || '0,00';
  const pctIcms = zeros[3] || '0,00';
  const pctIpi = zeros[4] || '0,00';
  
  // Código (2-3 dígitos)
  const codigo = parts[idx++] || '';
  
  // Descrição (tudo que sobrar)
  const descricao = parts.slice(idx).join(' ').trim();
  
  // Reorganizar na ordem do cabeçalho: CÓDIGO DESCRIÇÃO NCM CSOSN CFOP UN. QUANT. V.UNIT. V.TOTAL BC.ICMS V.ICMS V.IPI %ICMS %IPI
  return `${codigo}\t${descricao}\t${ncm}\t${csosn}\t${cfop}\t${unidade}\t${quant}\t${vUnit}\t${vTotal}\t${bcIcms}\t${vIcms}\t${vIpi}\t${pctIcms}\t${pctIpi}`;
}

/**
 * Normaliza separadores em uma linha, garantindo que campos importantes sejam separados por tabs
 * Isso ajuda a manter as colunas alinhadas para facilitar cópia para Excel
 */
function normalizeSeparators(line: string): string {
  let normalized = line;
  
  // Para linhas de produto (começam com NCM de 8 dígitos)
  if (/^\d{8}\s+\d{4}\s+\d{4}/.test(line.trim())) {
    // Reorganizar a linha para corresponder à ordem do cabeçalho
    return reorganizeProductLine(line);
  }
  
  // Para cabeçalhos, normalizar espaços múltiplos
  if (/^(CÓDIGO|DESCRIÇÃO|NCM|CSOSN|CFOP|UN\.|QUANT\.|V\.UNIT\.|V\.TOTAL|BC\.ICMS|V\.ICMS|V\.IPI|%ICMS|%IPI|DADOS)/i.test(line.trim())) {
    // Separar campos do cabeçalho que podem estar juntos - ordem específica
    normalized = normalized.replace(/(CSOSN)\s+(CFOP)/gi, '$1\t$2');
    normalized = normalized.replace(/(CFOP)\s+(UN\.)/gi, '$1\t$2');
    normalized = normalized.replace(/(V\.IPI)\s+(%ICMS)/gi, '$1\t$2');
    normalized = normalized.replace(/(%ICMS)\s+(%IPI)/gi, '$1\t$2');
    normalized = normalized.replace(/(UN\.)\s+(QUANT\.)/gi, '$1\t$2');
    
    // Converter espaços múltiplos em tabs (fazer por último)
    normalized = normalized.replace(/\s{2,}/g, '\t');
  }
  
  return normalized;
}

/**
 * Junta linhas quebradas de produtos na seção de produtos/serviços
 * Primeiro junta as linhas, depois reorganiza para corresponder ao cabeçalho
 */
function mergeProductLines(lines: string[]): string[] {
  const merged: string[] = [];
  
  // Primeiro passo: juntar linhas quebradas
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Não remover espaços/tabs no início - preservar estrutura original
    if (line.trim().length === 0) continue;
    
    const trimmedLine = line.trim();
    
    // Verificar se é uma linha de cabeçalho (contém palavras-chave de colunas)
    const isHeader = /^(CÓDIGO|DESCRIÇÃO|NCM|CSOSN|CFOP|UN\.|QUANT\.|V\.UNIT\.|V\.TOTAL|BC\.ICMS|V\.ICMS|V\.IPI|%ICMS|%IPI|DADOS)/i.test(trimmedLine);
    
    // Verificar se é uma linha de produto (começa com NCM de 8 dígitos)
    const isProductLine = /^\d{8}\s+\d{4}\s+\d{4}/.test(trimmedLine);
    
    // Verificar se é uma linha que parece ser continuação
    // Continuação: não começa com NCM, não é cabeçalho, e tem texto
    // Mas não começa com números que possam ser um novo produto
    const startsWithNumber = /^\d{2,}/.test(trimmedLine);
    const isContinuation = !isHeader && !isProductLine && !startsWithNumber && /[A-Za-z]/.test(trimmedLine);
    
    if (isHeader) {
      // É cabeçalho - adicionar sem normalizar ainda
      merged.push(line);
    } else if (isProductLine) {
      // É uma nova linha de produto - adicionar sem normalizar ainda
      merged.push(line);
    } else if (isContinuation && merged.length > 0) {
      // É continuação da linha anterior (descrição quebrada)
      // Juntar com a última linha
      const lastLine = merged[merged.length - 1];
      merged[merged.length - 1] = lastLine.trim() + ' ' + trimmedLine;
    } else {
      // Linha solta ou não identificada
      merged.push(line);
    }
  }
  
  // Segundo passo: normalizar e reorganizar cada linha
  return merged.map(line => normalizeSeparators(line));
}

/**
 * Extrai dados de produtos do texto extraído do PDF usando abordagem simples
 * Procura por cabeçalho e extrai produtos linha por linha
 */
export function extractSimpleTable(text: string): Product[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);

  let headerIndex = -1;

  // Detecta cabeçalho simples como o da imagem
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toUpperCase();
    if (
      l.includes("DESCRI") &&
      (l.includes("UN") || l.includes("UN.") || l.includes("UNIDADE")) &&
      (l.includes("V.UN") || l.includes("UNIT") || l.includes("VALOR"))
    ) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const products: Product[] = [];

  // Processar linhas após o cabeçalho
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const desc = lines[i];
    
    // Se for título ou próxima seção, interrompe
    if (/^(TOTAL|OBS|INFORMA|PAGAMENTO|VALOR)/i.test(desc)) break;
    
    // Próximas duas linhas devem ser UN e valor, como no PDF real
    const unidade = lines[i + 1] || "";
    const valor = lines[i + 2] || "";
    
    // Valida padrão esperado
    const isUn = /^[A-Z]{1,4}$/.test(unidade);
    const isValor = /^[0-9.]+,[0-9]{2}$/.test(valor);
    
    if (isUn && isValor) {
      products.push({
        descricao: desc,
        unidade: unidade,
        valorUnitario: valor,
        valorTotal: valor // em PDFs simples normalmente não existe total
      });
      i += 2; // pula as duas linhas que já foram consumidas
    }
  }

  return products;
}

/**
 * Extrai dados de produtos do texto extraído do PDF
 * Usa a função extractSimpleTable para extração simples
 */
export function extractProductsFromText(text: string): Product[] {
  // Usar a nova função de extração simples
  return extractSimpleTable(text);
  
  /* COMENTADO: Padrões de extração específicos
  const products: Product[] = [];

  // Preservar a estrutura original, mas normalizar quebras de linha múltiplas
  // Não remover todos os espaços múltiplos pois podem ser separadores de colunas
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/R\$\s+/g, 'R$ ');

  // Procurar pela seção de produtos/serviços
  const sectionPatterns = [
    /DADOS\s+DOS\s+PRODUTOS[\/\s]SERVIÇOS?/i,
    /PRODUTOS[\/\s]SERVIÇOS?/i,
    /DADOS\s+PRODUTOS/i,
  ];

  let startIndex = -1;
  for (const pattern of sectionPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      startIndex = match.index! + match[0].length;
      break;
    }
  }

  // Se não encontrou seção específica, procurar pelo cabeçalho da tabela
  if (startIndex === -1) {
    const headerPatterns = [
      /N[º°]\s+Descri[çc][ãa]o\s+do\s+Produto/i,
      /N[º°]\s+Descri[çc][ãa]o/i,
      /C[óo]digo\s+Descri[çc][ãa]o/i,
    ];

    for (const pattern of headerPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        startIndex = match.index! + match[0].length;
        break;
      }
    }
  }

  if (startIndex === -1) {
    return products;
  }

  // Extrair o texto relevante
  const relevantText = normalizedText.substring(startIndex);
  
  // Limitar a busca até encontrar uma seção diferente ou fim do documento
  const endPatterns = [
    /DADOS\s+ADICIONAIS/i,
    /INFORMA[ÇC][ÕO]ES\s+COMPLEMENTARES/i,
    /TOTAL\s+Geral/i,
    /VALOR\s+TOTAL/i,
  ];

  let endIndex = relevantText.length;
  for (const pattern of endPatterns) {
    const match = relevantText.match(pattern);
    if (match && match.index! < endIndex) {
      endIndex = match.index!;
    }
  }

  const tableText = relevantText.substring(0, endIndex);

  // Dividir em linhas e processar
  // Juntar linhas que podem ter sido quebradas (descrição na linha seguinte)
  const rawLines = tableText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const lines: string[] = [];
  
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    // Se a linha começa com NCM (8 dígitos), é uma nova linha de produto
    if (/^\d{8}\s+\d{4}\s+\d{4}/.test(line)) {
      lines.push(line);
    } else if (lines.length > 0 && !isHeaderLine(line)) {
      // Se não começa com padrão de cabeçalho, pode ser continuação da descrição
      lines[lines.length - 1] += ' ' + line;
    } else {
      lines.push(line);
    }
  }

  // Padrões para identificar linhas de produtos
  // Formato real: NCM(8) CSOSN(4) CFOP(4) UNIDADE QUANT V.UNIT V.TOTAL zeros CÓDIGO(3) DESCRIÇÃO
  // Exemplo: 84283300 0400 5102METRO 6 250,00 1.500,00 0,00 0,00 0,00 0,00 0,00001 CORREAS PARA EQUIPAMENTO JAR TEST N° 16
  
  for (const line of lines) {
    // Ignorar linhas que são claramente cabeçalhos
    if (isHeaderLine(line)) {
      continue;
    }
    
    // Padrão específico para o formato da nota fiscal
    // NCM (8 dígitos) + CSOSN (4 dígitos) + CFOP (4 dígitos) + UNIDADE + QUANT + V.UNIT + V.TOTAL + zeros + CÓDIGO + DESCRIÇÃO
    // Exemplo: 84283300 0400 5102METRO 	6 	250,00 1.500,00 	0,00 	0,00 	0,00 0,00 0,00	001 	CORREAS...
    // CFOP e UNIDADE podem estar juntos (5102METRO) ou separados (5102 UND)
    
    // Padrão 1: CFOP e UNIDADE juntos (5102METRO)
    const nfPatternJuntos = /^(\d{8})\s+(\d{4})\s+(\d{4})([A-Z]{2,})[\s\t]+(\d+(?:[.,]\d+)?)[\s\t]+([\d.,]+)[\s\t]+([\d.,]+)[\s\t]+(?:[\d.,]+[\s\t]+){4,}(\d{3})[\s\t]+(.+)$/;
    const nfMatchJuntos = line.match(nfPatternJuntos);
    
    if (nfMatchJuntos) {
      const descricao = nfMatchJuntos[9].trim();
      const unidade = nfMatchJuntos[4].trim(); // UNIDADE já separada
      const valorUnitario = nfMatchJuntos[6];
      const valorTotal = nfMatchJuntos[7];
      
      // Validar que unidade é texto (não números)
      if (/^[A-Za-z]{2,}$/.test(unidade) && descricao.length > 3) {
        products.push({
          descricao: descricao,
          unidade: unidade,
          valorUnitario: valorUnitario.includes(',') ? `R$ ${valorUnitario}` : `R$ ${valorUnitario.replace('.', ',')}`,
          valorTotal: valorTotal.includes(',') ? `R$ ${valorTotal}` : `R$ ${valorTotal.replace('.', ',')}`,
        });
        continue;
      }
    }
    
    // Padrão 2: CFOP e UNIDADE separados (5102 PÇ) - formato mais comum
    // Formato: NCM(8) CSOSN(4) CFOP(4) UNIDADE QUANT V.UNIT V.TOTAL zeros(3-5) CÓDIGO(2-3) DESCRIÇÃO
    // Exemplo: 40169300 0400 5102 PÇ 325 6,39 2.076,75 0,00 0,00 0,00 0,00 0,00 020 ANEL DE BORRACHA PBA 110MM
    // Usar abordagem híbrida: regex para validar estrutura, split para extrair dados
    
    // Primeiro, validar que a linha começa com o padrão esperado
    if (/^\d{8}\s+\d{4}\s+\d{4}\s+[A-Z]{2,}\s+\d+/.test(line)) {
      const parts = line.split(/\s+/);
      
      // Verificar se temos pelo menos 13 partes (NCM + CSOSN + CFOP + UNIDADE + QUANT + V.UNIT + V.TOTAL + zeros + CÓDIGO + DESCRIÇÃO)
      if (parts.length >= 13) {
        // Tentar identificar os índices
        // [0] = NCM, [1] = CSOSN, [2] = CFOP, [3] = UNIDADE, [4] = QUANTIDADE
        // Procurar V.UNIT e V.TOTAL (valores com vírgula)
        // Procurar CÓDIGO (2-3 dígitos após os zeros)
        // Resto é DESCRIÇÃO
        
        const ncm = parts[0];
        const csosn = parts[1];
        const cfop = parts[2];
        const unidade = parts[3];
        
        // Validar que unidade é texto
        if (/^[A-Za-z]{2,}$/.test(unidade) && /^\d{8}$/.test(ncm) && /^\d{4}$/.test(csosn) && /^\d{4}$/.test(cfop)) {
          // Procurar quantidade (número inteiro após unidade)
          let quantIndex = 4;
          if (!/^\d+$/.test(parts[quantIndex])) {
            continue; // Não é um produto válido
          }
          
          // Procurar V.UNIT (valor com vírgula após quantidade)
          let vUnitIndex = quantIndex + 1;
          if (vUnitIndex >= parts.length || !/[\d.,]+/.test(parts[vUnitIndex])) {
            continue;
          }
          
          // Procurar V.TOTAL (valor com vírgula após V.UNIT)
          let vTotalIndex = vUnitIndex + 1;
          if (vTotalIndex >= parts.length || !/[\d.,]+/.test(parts[vTotalIndex])) {
            continue;
          }
          
          const valorUnitario = parts[vUnitIndex];
          const valorTotal = parts[vTotalIndex];
          
          // Procurar CÓDIGO (2-3 dígitos após os zeros)
          // Os zeros são valores como "0,00"
          let codigoIndex = vTotalIndex + 1;
          while (codigoIndex < parts.length && /^0[,.]00$/.test(parts[codigoIndex])) {
            codigoIndex++;
          }
          
          // Se encontrou código (2-3 dígitos)
          if (codigoIndex < parts.length && /^\d{2,3}$/.test(parts[codigoIndex])) {
            // Tudo após o código é a descrição
            const descricao = parts.slice(codigoIndex + 1).join(' ').trim();
            
            if (descricao.length > 3 && !/^\d+$/.test(descricao)) {
              products.push({
                descricao: descricao,
                unidade: unidade,
                valorUnitario: valorUnitario.includes(',') ? `R$ ${valorUnitario}` : `R$ ${valorUnitario.replace('.', ',')}`,
                valorTotal: valorTotal.includes(',') ? `R$ ${valorTotal}` : `R$ ${valorTotal.replace('.', ',')}`,
              });
              continue;
            }
          }
        }
      }
    }
    
    // Padrão 2b: Versão com regex mais flexível (fallback)
    const nfPatternFlexivel = /^(\d{8})\s+(\d{4})\s+(\d{4})\s+([A-Z]{2,})[\s\t]+(\d+(?:[.,]\d+)?)[\s\t]+([\d.,]+)[\s\t]+([\d.,]+)(?:[\s\t]+0[,.]00){3,5}[\s\t]+(\d{2,3})[\s\t]+(.+)$/;
    const nfMatchFlexivel = line.match(nfPatternFlexivel);
    
    if (nfMatchFlexivel) {
      const descricao = nfMatchFlexivel[9].trim();
      const unidade = nfMatchFlexivel[4].trim();
      const valorUnitario = nfMatchFlexivel[6].trim();
      const valorTotal = nfMatchFlexivel[7].trim();
      
      // Validar que temos valores monetários válidos e descrição
      if (/^[A-Za-z]{2,}$/.test(unidade) && 
          /[\d.,]+/.test(valorUnitario) && 
          /[\d.,]+/.test(valorTotal) && 
          descricao.length > 3 &&
          !/^\d+$/.test(descricao)) {
        products.push({
          descricao: descricao,
          unidade: unidade,
          valorUnitario: valorUnitario.includes(',') ? `R$ ${valorUnitario}` : `R$ ${valorUnitario.replace('.', ',')}`,
          valorTotal: valorTotal.includes(',') ? `R$ ${valorTotal}` : `R$ ${valorTotal.replace('.', ',')}`,
        });
        continue;
      }
    }
    

    // Padrão 1: Separado por tabs (mais comum em PDFs)
    const tabParts = line.split('\t').filter(p => p.trim().length > 0);
    if (tabParts.length >= 4) {
      // Procurar por unidade e valores monetários
      const descricao = tabParts.slice(0, -3).join(' ').trim();
      const unidade = tabParts[tabParts.length - 3]?.trim();
      const valorUnitario = tabParts[tabParts.length - 2]?.trim();
      const valorTotal = tabParts[tabParts.length - 1]?.trim();

      if (unidade && (/R\$\s*[\d.,]+/.test(valorUnitario) || /[\d.,]+/.test(valorUnitario)) && (/R\$\s*[\d.,]+/.test(valorTotal) || /[\d.,]+/.test(valorTotal))) {
        products.push({
          descricao,
          unidade,
          valorUnitario: valorUnitario.includes('R$') ? valorUnitario : `R$ ${valorUnitario}`,
          valorTotal: valorTotal.includes('R$') ? valorTotal : `R$ ${valorTotal}`,
        });
        continue;
      }
    }

    // Padrão 2: Separado por múltiplos espaços (2 ou mais)
    const spaceParts = line.split(/\s{2,}/).filter(p => p.trim().length > 0);
    if (spaceParts.length >= 4) {
      const descricao = spaceParts.slice(0, -3).join(' ').trim();
      const unidade = spaceParts[spaceParts.length - 3]?.trim();
      const valorUnitario = spaceParts[spaceParts.length - 2]?.trim();
      const valorTotal = spaceParts[spaceParts.length - 1]?.trim();

      if (unidade && (/R\$\s*[\d.,]+/.test(valorUnitario) || /[\d.,]+/.test(valorUnitario)) && (/R\$\s*[\d.,]+/.test(valorTotal) || /[\d.,]+/.test(valorTotal))) {
        products.push({
          descricao,
          unidade,
          valorUnitario: valorUnitario.includes('R$') ? valorUnitario : `R$ ${valorUnitario}`,
          valorTotal: valorTotal.includes('R$') ? valorTotal : `R$ ${valorTotal}`,
        });
        continue;
      }
    }

    // Padrão 3: Regex para linha com descrição, unidade e valores
    const fullPattern = /^(.+?)\s+([A-Za-z]{2,})\s+R\$\s*([\d.,]+)\s+R\$\s*([\d.,]+)$/;
    const fullMatch = line.match(fullPattern);
    
    if (fullMatch) {
      products.push({
        descricao: fullMatch[1].trim(),
        unidade: fullMatch[2].trim(),
        valorUnitario: `R$ ${fullMatch[3]}`,
        valorTotal: `R$ ${fullMatch[4]}`,
      });
      continue;
    }
  }

  // Remover duplicatas baseado na descrição e valor total
  const uniqueProducts = products.filter((product, index, self) =>
    index === self.findIndex((p) => 
      p.descricao === product.descricao && 
      p.valorTotal === product.valorTotal
    )
  );

  return uniqueProducts;
  */
}

