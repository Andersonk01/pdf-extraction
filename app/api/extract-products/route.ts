import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { extractProductsFromText } from '@/lib/pdf-extractor';

// Configurar runtime para Vercel
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const filePath = formData.get('filePath') as string;

    console.log('formData request:', formData);

    if (!file && !filePath) {
      return NextResponse.json(
        { error: 'Nenhum arquivo fornecido' },
        { status: 400 }
      );
    }

    let pdfBuffer: Buffer;
    
    if (file) {
      // arquivo enviado via upload
      const arrayBuffer = await file.arrayBuffer();
      console.log('arrayBuffer:', arrayBuffer);
      pdfBuffer = Buffer.from(arrayBuffer);
      console.log('pdfBuffer: ------------------------', pdfBuffer);
    } else if (filePath) {
      // caminho do arquivo no servidor
      const fullPath = path.join(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) {
        return NextResponse.json(
          { error: 'Arquivo não encontrado' },
          { status: 404 }
        );
      }
      pdfBuffer = fs.readFileSync(fullPath);
    } else {
      return NextResponse.json(
        { error: 'Nenhum arquivo fornecido' },
        { status: 400 }
      );
    }

    // Usar pdfjs-dist que funciona melhor em ambientes serverless
    // Importar dinamicamente para evitar problemas de bundling
    let extractedText: string;
    
    try {
      // Importar pdfjs-dist - usar build legacy que funciona melhor em Node.js
      // @ts-ignore - pdfjs-dist pode não ter tipos completos
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs' as any);
      
      // Configurar para não usar worker (necessário em serverless)
      if (pdfjs.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = '';
      }
      
      // Converter Buffer para Uint8Array (pdfjs-dist requer Uint8Array, não Buffer)
      const uint8Array = new Uint8Array(pdfBuffer);
      
      // Carregar o documento PDF
      const loadingTask = pdfjs.getDocument({
        data: uint8Array,
        useSystemFonts: true,
        verbosity: 0, // Reduzir logs
      });
      
      const pdfDocument = await loadingTask.promise;
      const numPages = pdfDocument.numPages;
      
      // Extrair texto de todas as páginas
      let fullText = '';
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Concatenar texto de todas as páginas
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        fullText += pageText + '\n';
      }
      
      extractedText = fullText;
      console.log('Texto extraído com sucesso, tamanho:', extractedText.length);
      
    } catch (pdfError: any) {
      console.error('Erro ao processar PDF com pdfjs-dist:', pdfError);
      
      // Fallback: tentar usar pdf-parse se pdfjs-dist falhar
      try {
        console.log('Tentando fallback com pdf-parse...');
        const pdfParseModule = await import('pdf-parse');
        
        if (!pdfParseModule || !pdfParseModule.PDFParse) {
          throw new Error('PDFParse não disponível no módulo');
        }
        
        const { PDFParse } = pdfParseModule;
        const originalEnv = process.env.PDFJS_DISABLE_WORKER;
        process.env.PDFJS_DISABLE_WORKER = 'true';
        
        try {
          const parser = new PDFParse({ data: pdfBuffer });
          const result = await parser.getText();
          await parser.destroy();
          extractedText = result.text;
          
          if (originalEnv !== undefined) {
            process.env.PDFJS_DISABLE_WORKER = originalEnv;
          } else {
            delete process.env.PDFJS_DISABLE_WORKER;
          }
        } catch (parseError: any) {
          if (originalEnv !== undefined) {
            process.env.PDFJS_DISABLE_WORKER = originalEnv;
          } else {
            delete process.env.PDFJS_DISABLE_WORKER;
          }
          throw parseError;
        }
      } catch (fallbackError: any) {
        throw new Error(`Erro ao processar PDF: ${pdfError.message}. Fallback também falhou: ${fallbackError.message}`);
      }
    }
    
    const products = extractProductsFromText(extractedText);

      return NextResponse.json({
        success: true,
        products,
        text: extractedText,
      });
  } catch (error: any) {
    console.error('Erro ao processar PDF:', error);
    console.error('Stack:', error.stack);
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    
    // Retornar mais informações sobre o erro para debug
    return NextResponse.json(
      { 
        error: 'Erro ao processar PDF',
        message: error?.message || 'Erro desconhecido',
        name: error?.name,
        // Sempre retornar stack em produção para debug inicial
        stack: error?.stack,
        details: process.env.NODE_ENV === 'development' ? {
          type: typeof error,
          keys: Object.keys(error || {}),
        } : undefined
      },
      { status: 500 }
    );
  }
}

