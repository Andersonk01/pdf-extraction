'use client';

import { useState } from 'react';
import { Product } from '@/lib/pdf-extractor';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setFileName(e.target.files[0].name);
      setProducts([]);
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

      if (data.products && data.products.length > 0) {
        setProducts(data.products);
      } else {
        setError('Nenhum produto encontrado no PDF. Verifique se o formato está correto.');
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
