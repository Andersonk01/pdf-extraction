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
      pdfBuffer = Buffer.from(arrayBuffer);
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

    // Usar pdf-parse com configurações específicas para Vercel serverless
    // O pdf-parse v2 pode ter problemas com workers em ambientes serverless
    let extractedText: string;
    
    try {
      // Configurar variáveis de ambiente ANTES de importar o módulo
      // Isso é crítico para o pdf-parse funcionar em serverless
      const originalWorkerEnv = process.env.PDFJS_DISABLE_WORKER;
      process.env.PDFJS_DISABLE_WORKER = 'true';
      
      // Também desabilitar outras opções que podem causar problemas
      process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '';
      
      try {
        console.log('[1/5] Importando pdf-parse...');
        const pdfParseModule = await import('pdf-parse');
        
        if (!pdfParseModule) {
          throw new Error('Módulo pdf-parse não foi carregado');
        }
        
        console.log('[2/5] Módulo carregado, verificando PDFParse...');
        console.log('Chaves do módulo:', Object.keys(pdfParseModule));
        
        // Tentar diferentes formas de acessar PDFParse
        let PDFParse: any;
        
        if (pdfParseModule.PDFParse) {
          PDFParse = pdfParseModule.PDFParse;
          console.log('[3/5] PDFParse encontrado via .PDFParse');
        } else if ((pdfParseModule as any).default?.PDFParse) {
          PDFParse = (pdfParseModule as any).default.PDFParse;
          console.log('[3/5] PDFParse encontrado via .default.PDFParse');
        } else if ((pdfParseModule as any).default && typeof (pdfParseModule as any).default === 'function') {
          PDFParse = (pdfParseModule as any).default;
          console.log('[3/5] PDFParse encontrado via .default (função)');
        } else {
          throw new Error(`PDFParse não encontrado. Chaves disponíveis: ${Object.keys(pdfParseModule).join(', ')}`);
        }
        
        if (!PDFParse) {
          throw new Error('PDFParse é undefined após tentativas de importação');
        }
        
        console.log('[4/5] Criando parser com buffer de tamanho:', pdfBuffer.length);
        const parser = new PDFParse({ data: pdfBuffer });
        
        console.log('[5/5] Extraindo texto...');
        const result = await parser.getText();
        
        console.log('Texto extraído com sucesso! Tamanho:', result?.text?.length || 0);
        
        await parser.destroy();
        extractedText = result?.text || '';
        
        if (!extractedText || extractedText.length === 0) {
          throw new Error('Nenhum texto foi extraído do PDF');
        }
        
      } finally {
        // Restaurar variáveis de ambiente
        if (originalWorkerEnv !== undefined) {
          process.env.PDFJS_DISABLE_WORKER = originalWorkerEnv;
        } else {
          delete process.env.PDFJS_DISABLE_WORKER;
        }
      }
    } catch (error: any) {
      console.error('❌ Erro detalhado ao processar PDF:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack?.substring(0, 500), // Limitar stack para não exceder limites
        code: error?.code,
        errno: error?.errno,
        syscall: error?.syscall,
      });
      
      // Re-throw com mensagem mais clara
      const errorMessage = error?.message || 'Erro desconhecido ao processar PDF';
      throw new Error(`Erro ao processar PDF: ${errorMessage}`);
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

