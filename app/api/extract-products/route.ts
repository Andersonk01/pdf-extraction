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

    // Usar pdf-parse diretamente (funciona localmente e deve funcionar na Vercel com configurações corretas)
    // Importar dinamicamente para evitar problemas de bundling
    let extractedText: string;
    
    try {
      console.log('Importando pdf-parse...');
      const pdfParseModule = await import('pdf-parse');
      
      if (!pdfParseModule) {
        throw new Error('Módulo pdf-parse não foi carregado');
      }
      
      // Verificar se PDFParse está disponível
      if (!pdfParseModule.PDFParse) {
        throw new Error('PDFParse não está disponível no módulo pdf-parse');
      }
      
      const { PDFParse } = pdfParseModule;
      console.log('PDFParse carregado com sucesso');
      
      // Configurar variáveis de ambiente para desabilitar worker (necessário em serverless)
      const originalWorkerEnv = process.env.PDFJS_DISABLE_WORKER;
      const originalNodeEnv = process.env.NODE_ENV;
      
      // Forçar desabilitar worker para ambiente serverless
      process.env.PDFJS_DISABLE_WORKER = 'true';
      
      try {
        console.log('Criando parser PDF...');
        const parser = new PDFParse({ data: pdfBuffer });
        
        console.log('Extraindo texto do PDF...');
        const result = await parser.getText();
        
        console.log('Texto extraído, tamanho:', result.text?.length || 0);
        
        await parser.destroy();
        extractedText = result.text || '';
        
        console.log('PDF processado com sucesso');
      } finally {
        // Restaurar variáveis de ambiente
        if (originalWorkerEnv !== undefined) {
          process.env.PDFJS_DISABLE_WORKER = originalWorkerEnv;
        } else {
          delete process.env.PDFJS_DISABLE_WORKER;
        }
      }
    } catch (error: any) {
      console.error('Erro detalhado ao processar PDF:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        code: error?.code,
      });
      throw new Error(`Erro ao processar PDF: ${error?.message || 'Erro desconhecido'}`);
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

