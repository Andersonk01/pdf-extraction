# Extrator de Produtos/Serviços de PDF

Sistema para extrair dados de produtos/serviços de PDFs de notas fiscais.

## Funcionalidades

- ✅ Upload de PDFs via interface web
- ✅ Extração automática de dados de produtos/serviços
- ✅ Visualização dos dados extraídos em tabela
- ✅ Exportação para CSV
- ✅ Processamento de PDFs do diretório `pdfs/`

## Instalação

```bash
pnpm install
```

## Uso

### Interface Web

1. Inicie o servidor de desenvolvimento:
```bash
pnpm dev
```

2. Acesse `http://localhost:3000`

3. Faça upload de um PDF de nota fiscal

4. Clique em "Extrair Produtos"

5. Visualize os dados extraídos e exporte para CSV se necessário

### Script de Linha de Comando

Para processar PDFs diretamente do diretório `pdfs/`:

```bash
pnpm tsx scripts/extract-pdf.ts "A BENEDITO  A DOS SANTOS NF 001   08 05 2025.pdf"
```

O script irá:
- Extrair os dados de produtos
- Exibir os resultados no console
- Gerar arquivos JSON e CSV com os dados extraídos

## Estrutura do Projeto

```
├── app/
│   ├── api/
│   │   └── extract-products/
│   │       └── route.ts          # API route para processar PDFs
│   └── page.tsx                   # Interface principal
├── lib/
│   └── pdf-extractor.ts          # Utilitário de extração
├── scripts/
│   └── extract-pdf.ts             # Script CLI
└── pdfs/                          # Diretório com PDFs
```

## Formato de Dados Extraídos

Os dados são extraídos no seguinte formato:

| Campo | Descrição |
|-------|-----------|
| Nº | Número/código do produto |
| Descrição do Produto | Descrição completa do produto |
| Unidade | Unidade de medida (Metro, Und, Caixa, etc.) |
| Quantidade | Quantidade do produto |
| Valor Unitário | Preço unitário (R$ X,XX) |
| Valor Total | Valor total do item (R$ X,XX) |

## Dependências

- `next` - Framework React
- `pdf-parse` - Biblioteca para extrair texto de PDFs
- `tsx` - Executor TypeScript para scripts

## Notas

- O sistema procura por seções como "DADOS DOS PRODUTOS/SERVIÇOS" ou "PRODUTOS/SERVIÇOS"
- Funciona melhor com PDFs que têm tabelas bem formatadas
- Se a extração não funcionar, verifique o formato do PDF
