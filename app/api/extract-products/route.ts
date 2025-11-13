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

    // Importar pdf-parse v2 - mesma abordagem do script CLI que funciona
    // Usar import dinâmico para evitar problemas de bundling no Next.js
    // No ambiente Node.js do Next.js, desabilitar worker para evitar erros
    let PDFParse: any;
    
    try {
      const pdfParseModule = await import('pdf-parse');
      console.log('pdf-parse module loaded:', {
        hasModule: !!pdfParseModule,
        keys: Object.keys(pdfParseModule || {}),
      });
      
      // Verificar se PDFParse está disponível
      if (!pdfParseModule) {
        throw new Error('Módulo pdf-parse não foi carregado');
      }
      
      // Tentar diferentes formas de importação
      if (pdfParseModule.PDFParse) {
        PDFParse = pdfParseModule.PDFParse;
      } else {
        // Tentar acessar default com type assertion
        const moduleWithDefault = pdfParseModule as any;
        if (moduleWithDefault.default?.PDFParse) {
          PDFParse = moduleWithDefault.default.PDFParse;
        } else if (moduleWithDefault.default && typeof moduleWithDefault.default === 'function') {
          PDFParse = moduleWithDefault.default;
        } else {
          throw new Error(`PDFParse não encontrado no módulo. Chaves disponíveis: ${Object.keys(pdfParseModule).join(', ')}`);
        }
      }
      
      console.log('PDFParse class loaded:', typeof PDFParse);
    } catch (importError: any) {
      console.error('Erro ao importar pdf-parse:', importError);
      throw new Error(`Erro ao importar pdf-parse: ${importError.message}`);
    }
    
    // Desabilitar worker no ambiente Node.js usando variável de ambiente
    // Isso força o pdf-parse a usar modo síncrono que não requer worker
    const originalEnv = process.env.PDFJS_DISABLE_WORKER;
    process.env.PDFJS_DISABLE_WORKER = 'true';
    
    try {
      const parser = new PDFParse({ data: pdfBuffer });
      const result = await parser.getText();
      await parser.destroy();
      
      // Restaurar variável de ambiente
      if (originalEnv !== undefined) {
        process.env.PDFJS_DISABLE_WORKER = originalEnv;
      } else {
        delete process.env.PDFJS_DISABLE_WORKER;
      }
      
      const products = extractProductsFromText(result.text);

      return NextResponse.json({
        success: true,
        products,
        text: result.text,
      });
    } catch (error: any) {
      // Restaurar variável de ambiente em caso de erro
      if (originalEnv !== undefined) {
        process.env.PDFJS_DISABLE_WORKER = originalEnv;
      } else {
        delete process.env.PDFJS_DISABLE_WORKER;
      }
      throw error;
    }
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

