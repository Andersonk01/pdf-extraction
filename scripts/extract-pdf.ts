/**
 * Script para extrair dados de produtos de PDFs no diretório pdfs/
 * 
 * Uso: pnpm tsx scripts/extract-pdf.ts <nome-do-arquivo.pdf>
 */

import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { extractProductsFromText } from '../lib/pdf-extractor';

async function extractFromPDF(filePath: string) {
  try {
    console.log(`Processando: ${filePath}`);
    
    const pdfBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    await parser.destroy();
    
    console.log(`\nTexto extraído (primeiros 500 caracteres):`);
    console.log(result.text.substring(0, 500));
    console.log('\n' + '='.repeat(80) + '\n');
    
    const products = extractProductsFromText(result.text);
    
    if (products.length === 0) {
      console.log('⚠️  Nenhum produto encontrado no PDF.');
      console.log('\nTentando encontrar padrões no texto...');
      
      // Mostrar linhas que podem conter produtos
      const lines = result.text.split('\n');
      const potentialLines = lines.filter((line: string) => {
        const trimmed = line.trim();
        return /^\d{3,}/.test(trimmed) && trimmed.length > 20;
      });
      
      if (potentialLines.length > 0) {
        console.log('\nLinhas potenciais encontradas:');
        potentialLines.slice(0, 5).forEach((line: string, i: number) => {
          console.log(`${i + 1}. ${line.substring(0, 100)}...`);
        });
      }
    } else {
      console.log(`✅ ${products.length} produto(s) encontrado(s):\n`);
      
      products.forEach((product, index) => {
        console.log(`${index + 1}. ${product.descricao}`);
        console.log(`   UN: ${product.unidade} | V.UNIT.: ${product.valorUnitario} | V.TOTAL: ${product.valorTotal}\n`);
      });
      
      // Exportar para JSON
      const outputPath = filePath.replace('.pdf', '_produtos.json');
      fs.writeFileSync(outputPath, JSON.stringify(products, null, 2));
      console.log(`\n💾 Dados exportados para: ${outputPath}`);
      
      // Exportar para CSV
      const csvPath = filePath.replace('.pdf', '_produtos.csv');
      const headers = ['DESCRIÇÃO', 'UN', 'V.UNIT.', 'V.TOTAL'];
      const rows = products.map(p => [
        p.descricao,
        p.unidade,
        p.valorUnitario,
        p.valorTotal,
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      fs.writeFileSync(csvPath, csvContent, 'utf-8');
      console.log(`💾 CSV exportado para: ${csvPath}`);
    }
  } catch (error: any) {
    console.error('❌ Erro ao processar PDF:', error.message);
    process.exit(1);
  }
}

// Executar script
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Uso: pnpm tsx scripts/extract-pdf.ts <nome-do-arquivo.pdf>');
  process.exit(1);
}

const fileName = args[0];
const filePath = path.join(process.cwd(), 'pdfs', fileName);

if (!fs.existsSync(filePath)) {
  console.error(`❌ Arquivo não encontrado: ${filePath}`);
  process.exit(1);
}

extractFromPDF(filePath);

