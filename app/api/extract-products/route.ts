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
    const pdfParseModule = await import('pdf-parse');
    
    // Verificar se PDFParse está disponível
    if (!pdfParseModule || !pdfParseModule.PDFParse) {
      throw new Error('PDFParse não está disponível. Verifique a instalação do pdf-parse.');
    }
    
    const { PDFParse } = pdfParseModule;
    
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
    return NextResponse.json(
      { 
        error: 'Erro ao processar PDF',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

