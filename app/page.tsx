'use client';

import { useState } from 'react';
import { Product, PDFSection } from '@/lib/pdf-extractor';

interface PDFResult {
  fileName: string;
  products: Product[];
  sections: PDFSection[];
  error?: string;
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PDFResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedPdfs, setExpandedPdfs] = useState<Set<number>>(new Set());

  const togglePdf = (index: number) => {
    setExpandedPdfs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedPdfs(new Set(results.map((_, idx) => idx)));
  };

  const collapseAll = () => {
    setExpandedPdfs(new Set());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      // Adicionar novos arquivos aos existentes (evitar duplicatas)
      setFiles(prevFiles => {
        const existingNames = new Set(prevFiles.map(f => f.name));
        const uniqueNewFiles = newFiles.filter(f => !existingNames.has(f.name));
        return [...prevFiles, ...uniqueNewFiles];
      });
      setResults([]);
      setError(null);
      // Limpar o input para permitir selecionar o mesmo arquivo novamente se necessário
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      );
      if (droppedFiles.length > 0) {
        // Adicionar arquivos arrastados aos existentes (evitar duplicatas)
        setFiles(prevFiles => {
          const existingNames = new Set(prevFiles.map(f => f.name));
          const uniqueNewFiles = droppedFiles.filter(f => !existingNames.has(f.name));
          return [...prevFiles, ...uniqueNewFiles];
        });
        setResults([]);
        setError(null);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleExtract = async () => {
    if (files.length === 0) {
      setError('Por favor, selecione pelo menos um arquivo PDF');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    const newResults: PDFResult[] = [];

    try {
      // Processar cada arquivo
      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch('/api/extract-products', {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Erro ao processar PDF');
          }

          newResults.push({
            fileName: file.name,
            products: data.products || [],
            sections: data.sections || [],
            error: data.sections && data.sections.length === 0 
              ? 'Nenhuma seção foi identificada no PDF' 
              : undefined
          });
        } catch (err: any) {
          newResults.push({
            fileName: file.name,
            products: [],
            sections: [],
            error: err.message || 'Erro ao processar o arquivo'
          });
        }
      }

      setResults(newResults);
      // Expandir automaticamente o primeiro PDF
      if (newResults.length > 0) {
        setExpandedPdfs(new Set([0]));
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar os arquivos');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = (result?: PDFResult) => {
    const productsToExport = result 
      ? result.products 
      : results.flatMap(r => r.products);
    
    if (productsToExport.length === 0) return;

    const headers = ['Arquivo', 'Descrição', 'UN', 'V.UNIT.', 'V.TOTAL'];
    const rows = productsToExport.map(p => {
      const fileName = result 
        ? result.fileName 
        : results.find(r => r.products.includes(p))?.fileName || '';
      return [
        fileName,
        p.descricao,
        p.unidade,
        p.valorUnitario,
        p.valorTotal,
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileName = result 
      ? result.fileName.replace('.pdf', '') 
      : 'todos_produtos';
    link.setAttribute('download', `${fileName}_produtos.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2 text-black dark:text-zinc-50">
            Extrator de Produtos/Serviços de PDF
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Faça upload de um ou mais PDFs de nota fiscal para extrair os dados dos produtos/serviços
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <label className="flex-1 cursor-pointer">
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="pdf-file-input"
              />
              <div 
                className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 text-center hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById('pdf-file-input')?.click()}
              >
                {files.length > 0 ? (
                  <div>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">
                      ✓ {files.length} arquivo(s) selecionado(s)
                    </p>
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {files.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 rounded p-2 mb-1">
                          <p className="font-medium text-black dark:text-zinc-50 text-sm flex-1 text-left">
                            {file.name}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newFiles = files.filter((_, i) => i !== idx);
                              setFiles(newFiles);
                            }}
                            className="ml-2 text-red-500 hover:text-red-700 text-xs"
                            title="Remover arquivo"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">
                        Clique para adicionar mais arquivos ou arraste novos PDFs aqui
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFiles([]);
                          setResults([]);
                        }}
                        className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                        title="Limpar todos os arquivos"
                      >
                        Limpar Todos
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-zinc-600 dark:text-zinc-400 text-lg mb-2">
                      📄 Selecione múltiplos PDFs
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-500">
                      Clique aqui ou arraste os arquivos PDF para esta área
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-400 mt-2">
                      Você pode selecionar vários arquivos de uma vez (Ctrl+Click ou Cmd+Click)
                    </p>
                  </div>
                )}
              </div>
            </label>
          </div>

          <button
            onClick={handleExtract}
            disabled={files.length === 0 || loading}
            className="w-full sm:w-auto px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? `Processando ${files.length} arquivo(s)...` : `Extrair Produtos (${files.length})`}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
        </div>

        {/* Resultados por arquivo */}
        {results.length > 0 && (
          <div className="space-y-4 mb-6">
            {/* Controles do accordion */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-black dark:text-zinc-50">
                Resultados ({results.length} arquivo(s))
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={expandAll}
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                >
                  Expandir Todos
                </button>
                <button
                  onClick={collapseAll}
                  className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                >
                  Colapsar Todos
                </button>
              </div>
            </div>

            {results.map((result, resultIdx) => {
              const isExpanded = expandedPdfs.has(resultIdx);
              const hasProducts = result.products.length > 0;
              const hasSections = result.sections.length > 0;
              
              return (
                <div key={resultIdx} className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700">
                  {/* Cabeçalho do accordion */}
                  <div 
                    className="flex justify-between items-center p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    onClick={() => togglePdf(resultIdx)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-lg">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-black dark:text-zinc-50">
                          📄 {result.fileName}
                        </h3>
                        <div className="flex gap-4 mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                          {hasProducts && (
                            <span>{result.products.length} produto(s)</span>
                          )}
                          {hasSections && (
                            <span>{result.sections.length} seção(ões)</span>
                          )}
                          {result.error && (
                            <span className="text-red-500">⚠ Erro</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {hasProducts && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportCSV(result);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        Exportar CSV
                      </button>
                    )}
                  </div>

                  {/* Conteúdo do accordion */}
                  {isExpanded && (
                    <div className="border-t border-zinc-200 dark:border-zinc-700 p-6">

                      {result.error && (
                        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <p className="text-yellow-800 dark:text-yellow-200 text-sm">{result.error}</p>
                        </div>
                      )}

                      {/* Seção de Produtos/Serviços - Destacada */}
                      {result.sections.find(s => s.name === 'Dados dos Produtos/Serviços') && (
                        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 mb-6 border-2 border-green-500">
                          <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">
                              📋 Dados dos Produtos/Serviços
                            </h2>
                            <button
                              onClick={() => {
                                const produtosSection = result.sections.find(s => s.name === 'Dados dos Produtos/Serviços');
                                if (produtosSection) {
                                  const content = produtosSection.lines.join('\n');
                                  navigator.clipboard.writeText(content);
                                  alert('Conteúdo copiado para a área de transferência! Cole no Excel.');
                                }
                              }}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              📋 Copiar para Excel
                            </button>
                          </div>
                          
                          {(() => {
                            const produtosSection = result.sections.find(s => s.name === 'Dados dos Produtos/Serviços');
                            if (!produtosSection) return null;
                            
                            return (
                              <div className="space-y-3">
                                {/* Conteúdo completo formatado */}
                                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                                  <div className="flex justify-between items-center mb-3">
                                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                      Conteúdo completo ({produtosSection.lines.length} linhas)
                                    </p>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          const content = produtosSection.lines.join('\n');
                                          navigator.clipboard.writeText(content);
                                          alert('✅ Todo o conteúdo copiado! Cole no Excel.');
                                        }}
                                        className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                      >
                                        📋 Copiar Tudo
                                      </button>
                                      <button
                                        onClick={() => {
                                          const content = produtosSection.lines.join('\n');
                                          const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
                                          const link = document.createElement('a');
                                          const url = URL.createObjectURL(blob);
                                          link.setAttribute('href', url);
                                          link.setAttribute('download', `${result.fileName.replace('.pdf', '')}_produtos_servicos.txt`);
                                          link.style.visibility = 'hidden';
                                          document.body.appendChild(link);
                                          link.click();
                                          document.body.removeChild(link);
                                        }}
                                        className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                      >
                                        💾 Baixar TXT
                                      </button>
                                    </div>
                                  </div>
                                  <div className="bg-white dark:bg-zinc-800 rounded p-4 max-h-96 overflow-y-auto border border-green-200 dark:border-green-700">
                                    <pre className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre font-mono leading-relaxed">
                                      {produtosSection.lines.join('\n')}
                                    </pre>
                                  </div>
                                </div>
                                
                                {/* Visualização em linhas separadas - formatada para Excel */}
                                <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                                  <div className="flex justify-between items-center mb-3">
                                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                      Linhas formatadas para Excel (clique para copiar):
                                    </p>
                                    <button
                                      onClick={() => {
                                        // Converter tabs para vírgulas para Excel
                                        const excelContent = produtosSection.lines
                                          .map(line => line.replace(/\t/g, ',').replace(/\s{2,}/g, ','))
                                          .join('\n');
                                        navigator.clipboard.writeText(excelContent);
                                        alert('✅ Conteúdo formatado para Excel copiado! Cole diretamente no Excel.');
                                      }}
                                      className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                    >
                                      📊 Copiar como CSV
                                    </button>
                                  </div>
                                  <div className="space-y-1 max-h-96 overflow-y-auto">
                                    {produtosSection.lines.map((line, idx) => {
                                      // Detectar se é cabeçalho
                                      const isHeader = /^(CÓDIGO|DESCRIÇÃO|NCM|DADOS)/i.test(line);
                                      // Detectar se é linha de produto (começa com números)
                                      const isProduct = /^(\d{8}|\d{2,3})\s+/.test(line);
                                      
                                      return (
                                        <div
                                          key={idx}
                                          onClick={() => {
                                            // Converter tabs para vírgulas se necessário
                                            const excelLine = line.replace(/\t/g, ',').replace(/\s{2,}/g, ',');
                                            navigator.clipboard.writeText(excelLine);
                                            alert('✅ Linha copiada!');
                                          }}
                                          className={`p-2 rounded border cursor-pointer transition-colors text-xs font-mono ${
                                            isHeader 
                                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 font-bold text-blue-800 dark:text-blue-200' 
                                              : isProduct
                                              ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700 text-zinc-700 dark:text-zinc-300'
                                              : 'bg-zinc-100 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                          }`}
                                          title="Clique para copiar esta linha (formatada para Excel)"
                                        >
                                          {line}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Outras Seções */}
                      {result.sections.filter(s => s.name !== 'Dados dos Produtos/Serviços').length > 0 && (
                        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 mb-6">
                          <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-4">
                            Outras Seções ({result.sections.filter(s => s.name !== 'Dados dos Produtos/Serviços').length})
                          </h2>
                          
                          <div className="space-y-4">
                            {result.sections
                              .filter(s => s.name !== 'Dados dos Produtos/Serviços')
                              .map((section, index) => (
                                <div
                                  key={index}
                                  className="border border-zinc-300 dark:border-zinc-700 rounded-lg p-4"
                                >
                                  <h3 className="font-semibold text-lg text-black dark:text-zinc-50 mb-2">
                                    {section.name}
                                  </h3>
                                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded p-3 max-h-60 overflow-y-auto">
                                    <pre className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-mono">
                                      {section.content || section.lines.join('\n')}
                                    </pre>
                                  </div>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
                                    {section.lines.length} linha(s)
                                  </p>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Produtos Extraídos */}
                      {result.products.length > 0 && (
                        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
                          <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-black dark:text-zinc-50">
                              Produtos Extraídos ({result.products.length})
                            </h2>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-zinc-100 dark:bg-zinc-800">
                                  <th className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-left text-sm font-semibold text-black dark:text-zinc-50">
                                    DESCRIÇÃO
                                  </th>
                                  <th className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-left text-sm font-semibold text-black dark:text-zinc-50">
                                    UN
                                  </th>
                                  <th className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-left text-sm font-semibold text-black dark:text-zinc-50">
                                    V.UNIT.
                                  </th>
                                  <th className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-left text-sm font-semibold text-black dark:text-zinc-50">
                                    V.TOTAL
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {result.products.map((product, index) => (
                                  <tr
                                    key={index}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                  >
                                    <td className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-black dark:text-zinc-50">
                                      {product.descricao}
                                    </td>
                                    <td className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-black dark:text-zinc-50">
                                      {product.unidade}
                                    </td>
                                    <td className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-black dark:text-zinc-50">
                                      {product.valorUnitario}
                                    </td>
                                    <td className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-black dark:text-zinc-50">
                                      {product.valorTotal}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Botão para exportar todos os produtos juntos */}
        {results.length > 0 && results.some(r => r.products.length > 0) && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-black dark:text-zinc-50">
                Exportar Todos os Produtos
              </h2>
              <button
                onClick={() => handleExportCSV()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                📊 Exportar Todos os Produtos (CSV)
              </button>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
              Total: {results.reduce((sum, r) => sum + r.products.length, 0)} produtos de {results.length} arquivo(s)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
