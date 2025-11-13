/**
 * Utilitário para extrair dados de produtos/serviços de PDFs
 */

export interface Product {
  descricao: string;
  unidade: string;
  valorUnitario: string;
  valorTotal: string;
}

/**
 * Extrai dados de produtos do texto extraído do PDF
 */
export function extractProductsFromText(text: string): Product[] {
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
    } else if (lines.length > 0 && !/^(N[º°]|Descri|Unidade|Quantidade|Valor|CÓDIGO|NCM|CSOSN|CFOP|DADOS)/i.test(line)) {
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
    if (/^(N[º°]|Descri|Unidade|Quantidade|Valor|CÓDIGO|NCM|CSOSN|CFOP|DADOS)/i.test(line)) {
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
    
    // Padrão 2: CFOP e UNIDADE separados (5102 UND)
    const nfPatternSeparados = /^(\d{8})\s+(\d{4})\s+(\d{4})\s+([A-Z]{2,})[\s\t]+(\d+(?:[.,]\d+)?)[\s\t]+([\d.,]+)[\s\t]+([\d.,]+)[\s\t]+(?:[\d.,]+[\s\t]+){4,}(\d{3})[\s\t]+(.+)$/;
    const nfMatchSeparados = line.match(nfPatternSeparados);
    
    if (nfMatchSeparados) {
      const descricao = nfMatchSeparados[9].trim();
      const unidade = nfMatchSeparados[4].trim();
      const valorUnitario = nfMatchSeparados[6];
      const valorTotal = nfMatchSeparados[7];
      
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
}

