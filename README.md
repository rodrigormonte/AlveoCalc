# AlveoCalc

PWA de apoio à decisão para fisioterapeutas intensivistas e cardiorrespiratórios. Reúne calculadoras de ventilação mecânica, oxigenação e mecânica respiratória, além de fichas ilustradas de curvas e assincronias ventilatórias.

**Versão atual: 0.2.0.**

## Recursos

- **20 calculadoras e consultas**, organizadas em Adulto, Pediatria e Geral: HACOR, ROX, interpretação integrada da gasometria, cálculo unificado de iNO, volume corrente adulto e pediátrico, CNAF adulto e pediátrico, além de fórmulas de ventilação e mecânica respiratória.
- **11 fichas de curvas:** VCV, PCV e PSV de referência, mais as oito assincronias do Tema 6 da AMIB. Os diagramas são esquemáticos e originais; sugestões de ajuste ficam atrás do botão “Ver sugestão”.
- **Fontes acessíveis nos resultados:** cada cálculo apresenta sua fórmula e um link para a fonte correspondente.
- **Privacidade:** sem backend, login, analytics ou dados de pacientes. Favoritos e tema são armazenados localmente no navegador.
- **Uso offline:** após a primeira visita, o service worker mantém o aplicativo em cache no aparelho.

## Rodar localmente

Requisitos: Bun ou Node.js 20+ com npm.

```bash
bun install
bun run dev
```

Ou, usando npm:

```bash
npm install
npm run dev
```

O Vite informa o endereço local, normalmente `http://localhost:5173`.

## Build de produção

```bash
bun run build
bun run preview
```

Com npm:

```bash
npm run build
npm run preview
```

O build gera a pasta `dist/`, um site estático que pode ser publicado em hospedagem como GitHub Pages, Netlify ou Cloudflare Pages. A configuração `base: './'` permite servir o aplicativo em uma subpasta.

### GitHub Pages

O workflow em [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publica o aplicativo a cada push na branch `main`. Na primeira publicação, selecione **GitHub Actions** em **Settings → Pages**. O endereço segue o formato `https://<usuario>.github.io/<repositorio>/`.

## Segurança

O AlveoCalc é um aplicativo estático, sem backend, login, API ou dados de pacientes. Consulte a [documentação de segurança](docs/seguranca.md).

- Campos numéricos passam por validação estrita em `src/lib/validacao.ts`: não aceitam hexadecimal, notação científica, `Infinity`, `NaN` ou expressões; há limite de 12 caracteres e faixas mínimas e máximas por campo.
- Tema e favoritos são validados ao serem lidos do `localStorage`; conteúdo inválido retorna ao padrão.
- Um `ErrorBoundary` evita tela em branco e mostra uma mensagem genérica, sem expor stack trace.
- O build de produção injeta uma política restritiva de segurança de conteúdo (CSP).
- O código não usa `eval`, `Function`, `innerHTML` ou `dangerouslySetInnerHTML`.

Para conferir localmente:

```bash
bun run build
grep -rnE 'eval\(|new Function|dangerouslySetInnerHTML|innerHTML' src
bun run preview
```

## Estrutura do projeto

```text
public/              ícone e imagens do PWA
src/
  components/        diagramas SVG e ícones
  data/              calculadoras e fichas clínicas
  lib/                roteamento, validação e armazenamento local
  pages/              telas do aplicativo
  App.tsx             navegação, tema e aviso inicial
  styles.css          estilos claro e escuro
docs/
  revisao-fichas.md   folha de revisão clínica das fichas
  seguranca.md        matriz de segurança e decisões de arquitetura
  icon-preview.png    prévia do ícone
.github/workflows/
  deploy.yml          publicação automática no GitHub Pages
```

## Conteúdo clínico

As fórmulas e orientações são apresentadas com suas fontes junto aos resultados. Parte do conteúdo de ventilação mecânica e das fichas de assincronia é baseada em **AMIB. Orientações Práticas de Ventilação Mecânica, 2024** ([PDF da AMIB](https://d1xe7tfg0uwul9.cloudfront.net/amib-portal/wp-content/uploads/2024/09/12100249/Orientacoes-Praticas-de-Ventilacao-Mecanica-Interativo-SET-11-1.pdf)). A classificação de Berlim é referenciada separadamente (ARDS Definition Task Force, JAMA, 2012).

Os diagramas são desenhos esquemáticos originais inspirados na descrição das curvas pela AMIB. Não são reproduções das figuras da diretriz nem capturas de telas de ventiladores.

O conteúdo está pendente de assinatura de revisão clínica. Para registrar a revisão, preencha `REVISAO_NOME` e `REVISAO_DATA` em `src/config.ts`.

## Aviso

Ferramenta de apoio à decisão. Não substitui avaliação clínica nem julgamento profissional. Confira os valores no ventilador e consulte as diretrizes e os protocolos institucionais vigentes.
