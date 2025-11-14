'use client';

import { useState } from 'react';
import { Product, PDFSection } from '@/lib/pdf-extractor';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [sections, setSections] = useState<PDFSection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setFileName(e.target.files[0].name);
      setProducts([]);
      setSections([]);
      setError(null);
    }
  };

  const handleExtract = async () => {
    if (!file) {
      setError('Por favor, selecione um arquivo PDF');
      return;
    }

    setLoading(true);
    setError(null);
    setProducts([]);
    setSections([]);

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

      // Atualizar produtos e seções
      if (data.products) {
        setProducts(data.products);
      }
      if (data.sections) {
        setSections(data.sections);
      }
      
      // Se não há seções, mostrar aviso
      if (!data.sections || data.sections.length === 0) {
        setError('Nenhuma seção foi identificada no PDF. O arquivo pode estar em um formato não suportado.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar o arquivo');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (products.length === 0) return;

    const headers = ['Descrição', 'UN', 'V.UNIT.', 'V.TOTAL'];
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

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName.replace('.pdf', '')}_produtos.csv`);
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
            Faça upload de um PDF de nota fiscal para extrair os dados dos produtos/serviços
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <label className="flex-1 cursor-pointer">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 text-center hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
                {fileName ? (
                  <div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Arquivo selecionado:</p>
                    <p className="font-medium text-black dark:text-zinc-50 mt-1">{fileName}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Clique para selecionar um arquivo PDF
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
                      ou arraste o arquivo aqui
                    </p>
                  </div>
                )}
              </div>
            </label>
          </div>

          <button
            onClick={handleExtract}
            disabled={!file || loading}
            className="w-full sm:w-auto px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Processando...' : 'Extrair Produtos'}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
        </div>

        {/* Seção de Produtos/Serviços - Destacada */}
        {sections.find(s => s.name === 'Dados dos Produtos/Serviços') && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 mb-6 border-2 border-green-500">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">
                📋 Dados dos Produtos/Serviços
              </h2>
              <button
                onClick={() => {
                  const produtosSection = sections.find(s => s.name === 'Dados dos Produtos/Serviços');
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
              const produtosSection = sections.find(s => s.name === 'Dados dos Produtos/Serviços');
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
                            link.setAttribute('download', `${fileName.replace('.pdf', '')}_produtos_servicos.txt`);
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
        {sections.filter(s => s.name !== 'Dados dos Produtos/Serviços').length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-4">
              Outras Seções ({sections.filter(s => s.name !== 'Dados dos Produtos/Serviços').length})
            </h2>
            
            <div className="space-y-4">
              {sections
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
        {products.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-black dark:text-zinc-50">
                Produtos Extraídos ({products.length})
              </h2>
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Exportar CSV
              </button>
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
                  {products.map((product, index) => (
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
    </div>
  );
}
