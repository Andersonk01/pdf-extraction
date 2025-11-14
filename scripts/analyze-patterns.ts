/**
 * Script para analisar padrões nos PDFs e identificar variações de cabeçalhos
 * 
 * Uso: pnpm tsx scripts/analyze-patterns.ts
 */

import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';

interface PatternAnalysis {
  fileName: string;
  headers: string[];
  productLines: string[];
  sampleLines: string[];
  totalLines: number;
}

async function analyzePDF(filePath: string): Promise<PatternAnalysis | null> {
  try {
    console.log(`Analisando: ${path.basename(filePath)}`);
    
    const pdfBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    await parser.destroy();
    
    const lines = result.text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Procurar por cabeçalhos relacionados a quantidade, valor unitário e valor total
    const headerKeywords = [
      'QUANT', 'QTD', 'Quantidade',
      'VLR', 'VALOR', 'Valor',
      'UNIT', 'Unitário',
      'TOTAL', 'Total'
    ];
    
    const headers: string[] = [];
    const productLines: string[] = [];
    const sampleLines: string[] = [];
    
    let foundProductSection = false;
    let productSectionStart = -1;
    
    // Procurar pela seção de produtos
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toUpperCase();
      
      // Verificar se é um cabeçalho
      const isHeader = headerKeywords.some(keyword => 
        line.includes(keyword) && (
          line.includes('UNIT') || 
          line.includes('TOTAL') || 
          line.includes('QUANT') ||
          line.includes('QTD')
        )
      );
      
      if (isHeader && !foundProductSection) {
        headers.push(lines[i]);
        productSectionStart = i;
        foundProductSection = true;
      }
      
      // Coletar linhas que parecem ser produtos (contêm números e valores)
      if (foundProductSection && i > productSectionStart && i < productSectionStart + 50) {
        // Linha que parece produto: contém números, pode ter valores monetários
        if (
          /\d/.test(lines[i]) && 
          (/\d+[.,]\d{2}/.test(lines[i]) || /\d{8}/.test(lines[i])) &&
          lines[i].length > 10
        ) {
          productLines.push(lines[i]);
        }
      }
      
      // Coletar algumas linhas de amostra
      if (i < 20) {
        sampleLines.push(lines[i]);
      }
    }
    
    return {
      fileName: path.basename(filePath),
      headers: [...new Set(headers)], // Remover duplicatas
      productLines: productLines.slice(0, 5), // Primeiras 5 linhas de produtos
      sampleLines: sampleLines.slice(0, 10),
      totalLines: lines.length,
    };
  } catch (error: any) {
    console.error(`Erro ao analisar ${filePath}:`, error.message);
    return null;
  }
}

async function main() {
  const pdfsDir = path.join(process.cwd(), 'pdfs');
  const files = fs.readdirSync(pdfsDir)
    .filter(file => file.endsWith('.pdf'))
    .map(file => path.join(pdfsDir, file));
  
  console.log(`Encontrados ${files.length} arquivos PDF para analisar\n`);
  
  const analyses: PatternAnalysis[] = [];
  
  for (const file of files) {
    const analysis = await analyzePDF(file);
    if (analysis) {
      analyses.push(analysis);
    }
  }
  
  // Agrupar cabeçalhos por padrão
  const headerPatterns = new Map<string, number>();
  
  analyses.forEach(analysis => {
    analysis.headers.forEach(header => {
      const normalized = header
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
      
      headerPatterns.set(normalized, (headerPatterns.get(normalized) || 0) + 1);
    });
  });
  
  // Ordenar por frequência
  const sortedHeaders = Array.from(headerPatterns.entries())
    .sort((a, b) => b[1] - a[1]);
  
  console.log('\n=== PADRÕES DE CABEÇALHOS ENCONTRADOS ===\n');
  sortedHeaders.forEach(([header, count]) => {
    console.log(`[${count}x] ${header}`);
  });
  
  console.log('\n=== ANÁLISE DETALHADA ===\n');
  analyses.forEach(analysis => {
    if (analysis.headers.length > 0) {
      console.log(`\n📄 ${analysis.fileName}`);
      console.log(`   Cabeçalhos: ${analysis.headers.join(' | ')}`);
      if (analysis.productLines.length > 0) {
        console.log(`   Exemplo de linha de produto:`);
        console.log(`   ${analysis.productLines[0].substring(0, 100)}...`);
      }
    }
  });
  
  // Salvar análise completa
  const outputPath = path.join(pdfsDir, 'pattern-analysis-detailed.json');
  fs.writeFileSync(outputPath, JSON.stringify(analyses, null, 2));
  console.log(`\n✅ Análise detalhada salva em: ${outputPath}`);
  
  // Salvar apenas os padrões de cabeçalhos
  const headersOutputPath = path.join(pdfsDir, 'header-patterns.json');
  fs.writeFileSync(headersOutputPath, JSON.stringify({
    totalFiles: files.length,
    analyzedFiles: analyses.length,
    headerPatterns: sortedHeaders.map(([header, count]) => ({ header, count })),
  }, null, 2));
  console.log(`✅ Padrões de cabeçalhos salvos em: ${headersOutputPath}`);
}

main().catch(console.error);
