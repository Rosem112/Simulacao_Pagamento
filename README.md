# Simulação de Pagamento — RCONT-SCT

PWA de **simulação** de pagamento para dois turnos de trabalho, com cálculo de INSS, IRPF,
redutor salarial, hora refeição e exportação para **PDF** e **Excel**.

- **Turno Diurno** — sem horas noturnas, com hora refeição por dia útil.
- **Turno Folguista (misto)** — diurno + cobertura noturna das folgas.

> ⚠️ **Isto é um demonstrativo para simples conferência.**
> Não substitui a folha de pagamento oficial. Os valores devem ser conferidos
> pelo contador responsável antes de qualquer uso.

---

## Índice

- [O que o app faz](#o-que-o-app-faz)
- [Como usar](#como-usar)
- [Exportação](#exportação)
- [Cálculos implementados](#cálculos-implementados)
- [Tecnologias](#tecnologias)
- [Estrutura do projeto](#estrutura-do-projeto)
- [PWA e offline](#pwa-e-offline)
- [GitHub Pages](#github-pages)
- [Desenvolvimento](#desenvolvimento)
- [Licença e contato](#licença-e-contato)

---

## O que o app faz

- **Duas simulações independentes** — diurno e folguista, em páginas separadas.
- **Cálculo de proventos** — salário base, adicional de tempo de serviço, DSR, hora
  refeição, feriados, folgas trabalhadas e hora adicional.
- **Cálculo de descontos** — adiantamento salarial, vale transporte, INSS, IRPF e
  contribuição assistencial.
- **Redutor salarial (Lei 2026)** — aplicado sobre a renda bruta, com a regressiva
  para a faixa intermediária.
- **Gráfico** de proporção proventos × descontos (Chart.js).
- **Exportação** para PDF, Excel e mensagem de WhatsApp pronta para o cliente.
- **Botão LIMPAR** — zera os campos, o resultado e o gráfico para uma nova simulação.
- **Offline** — funciona sem internet depois da primeira visita.

---

## Como usar

1. Abra a landing page e escolha o turno (**Simulação Diurna** ou **Simulação Folguista**).
2. Preencha os campos:

   | Campo | Diurno | Folguista |
   | --- | --- | --- |
   | Salário Base (R$) | ✅ | ✅ |
   | Adicional Tempo Serviço (0-3) | ✅ | ✅ |
   | Dias Úteis (mês) | ✅ | ✅ |
   | Dias Noturnos (Folgas Cobertas) | — | ✅ |
   | Domingos | ✅ | ✅ |
   | Feriados no Mês | ✅ | ✅ |
   | Feriados Trabalhados | ✅ | ✅ (com seletor de turno) |
   | Folgas Trabalhadas | ✅ | ✅ (com seletor de turno) |
   | Dependentes | ✅ | ✅ |

3. Clique em **CALCULAR SIMULAÇÃO**.
4. Exporte o resultado em **PDF**, **Excel** ou envie pelo **WhatsApp**.

> Os valores aceitam formato brasileiro (`3.500,00`) ou numérico (`3500`).
> Campos vazios são tratados como `0`.

---

## Exportação

| Formato | Nome do arquivo | Observações |
| --- | --- | --- |
| PDF | `simulacao_pagamento_<turno>_<AAAA-MM-DD>.pdf` | A4, com rodapé do contador |
| Excel | `simulacao_pagamento_<turno>_<AAAA-MM-DD>.xlsx` | Aba `Simulação Diurna` / `Simulação Folguista` |
| WhatsApp | — | Texto formatado, enviado ao número informado com DDI |

Exemplo: `simulacao_pagamento_diurno_2026-09-27.pdf`

As exportações exigem um cálculo prévio — sem ele, o app avisa e não gera o arquivo.
Todos os formatos incluem o aviso de que o resultado **não substitui a folha oficial**.

---

## Cálculos implementados

Os valores ficam em `CONFIG` no topo do `<script>` de cada página, para facilitar
o ajuste em anos futuros.

### INSS progressivo (2026)

| Faixa | Limite | Alíquota |
| --- | --- | --- |
| 1 | até R$ 1.621,00 | 7,5% |
| 2 | até R$ 2.902,84 | 9% |
| 3 | até R$ 4.354,27 | 12% |
| 4 | até R$ 8.475,55 | 14% |

### IRPF progressivo

| Base de cálculo | Alíquota | Dedução |
| --- | --- | --- |
| até R$ 2.428,80 | isento | — |
| até R$ 2.826,65 | 7,5% | R$ 182,16 |
| até R$ 3.751,05 | 15% | R$ 394,16 |
| até R$ 4.664,68 | 22,5% | R$ 675,49 |
| acima | 27,5% | R$ 908,73 |

### Redutor salarial (Lei 2026)

| Renda bruta mensal | Redutor |
| --- | --- |
| até R$ 5.000,00 | R$ 312,89 (fixo) |
| R$ 5.000,01 a R$ 7.350,00 | R$ 978,62 − (0,133145 × renda bruta) |
| acima de R$ 7.350,00 | R$ 0,00 |

O redutor é **subtraído do IRRF** calculado, nunca ficando negativo.

### Dois regimes de IRRF — o app calcula os dois e aplica o menor

| Regime | Base de cálculo |
| --- | --- |
| **Completo** | `proventos − INSS − (dependentes × R$ 189,59)` |
| **Simplificado** | `proventos − R$ 607,00` |

O app calcula o IRPF nos dois regimes, desconta o redutor em ambos e **fica com o
menor valor** (`Math.min`), informando no resultado qual regime foi escolhido.
Isso evita descontar mais IR do que o devido.

### Horas e adicionais (folguista)

| Cálculo | Fórmula |
| --- | --- |
| Hora normal | `salário / 220` |
| Hora noturna (base) | `hora normal × 1,2` |
| Hora 50% noturna | `hora noturna × 1,5` |
| Hora 100% noturna | `hora noturna × 2` |
| Hora 100% diurna | `hora normal × 2` |
| Adicional noturno | `20% do salário`, proporcional aos dias noturnos |
| Horário noturno reduzido | `9,6 h × dias noturnos × 1,1429` |
| Refeição | `hora normal × dias diurnos` |

---

## Tecnologias

Sem build, sem framework, sem servidor de aplicação — apenas arquivos estáticos.

| Recurso | Uso |
| --- | --- |
| HTML5 + CSS3 | Interface, responsiva e mobile-first |
| JavaScript (vanilla ES6+) | Cálculos, estado e exportações |
| [Chart.js](https://www.chartjs.org/) | Gráfico de proporção (CDN) |
| [jsPDF 2.5.1](https://github.com/parallax/jsPDF) | Geração do PDF (CDN) |
| [SheetJS 0.18.5](https://sheetjs.com/) | Geração do Excel (CDN) |
| Inter (Google Fonts) | Tipografia (CDN) |
| Service Worker API | Cache e funcionamento offline |
| Web App Manifest | Instalação como aplicativo |

As bibliotecas são carregadas por CDN com `defer` e pré-cacheadas pelo service worker
para que o app também funcione offline.

---

## Estrutura do projeto

```text
.
├── index.html              Landing page — escolha do turno
├── index_diurno.html       Simulação do turno diurno
├── index_folguista.html    Simulação do turno folguista (misto)
├── manifest.json           Manifesto do PWA (nome, ícones, atalhos)
├── sw.js                   Service worker (cache offline)
├── .hintrc                 Configuração do webhint
└── img/
    ├── logo.png            Logo RCONT-SCT
    ├── FP-3d-icon_1_192.png
    ├── Contador-icon_512.png
    ├── exportexcel.ico
    └── exportpdf.ico
```

As duas páginas de cálculo são **autocontidas** (HTML + CSS + JS no mesmo arquivo),
o que mantém a implantação simples em qualquer hospedagem estática.

---

## PWA e offline

O app é instalável: no celular ou no desktop aparece a opção de instalar e ele roda
em janela própria, sem barra de navegador.

**Ciclo do service worker** (`sw.js`):

1. **install** — pré-cacheia o shell local (páginas, manifesto, ícones) e as
   bibliotecas de CDN.
2. **activate** — remove caches de versões anteriores.
3. **fetch** — aplica estratégias por tipo de recurso:
   - navegações: *network-first* (com fallback para a página em cache);
   - recursos de CDN: *stale-while-revalidate*;
   - demais recursos locais: *cache-first*.
4. **Fallback offline** — sem conexão e sem cache, abre a simulação diurna.

### Atualizar o cache após mudanças

Ao alterar qualquer arquivo local, **suba a `VERSION`** em `sw.js`:

```js
const VERSION = 'v1.1.1';   // → 'v1.1.2'
```

Sem isso, os clientes podem continuar servindo a versão antiga do HTML do cache.

---

## GitHub Pages

1. Envie o projeto para um repositório no GitHub.
2. Em **Settings → Pages**, aponte aBranch e a pasta (`/root`).
3. Acesse `https://<usuario>.github.io/<repositorio>/`.

O app já está preparado para subpasta: o service worker é registrado com caminho
relativo (`./sw.js`) e o manifesto usa `start_url: "./index.html"`.

> ⚠️ O `sw.js` só funciona em `https://` ou em `localhost`. Sirva o projeto por HTTP
> simples apenas para desenvolvimento.

---

## Desenvolvimento

Servir localmente (recomendado, habilita o service worker):

```bash
python -m http.server 8000
```

Depois abra `http://localhost:8000`.

Abrir `index.html` direto pelo `file://` **não funciona** para o PWA, porque o service
worker e o manifesto exigem um contexto HTTP.

**Ao alterar o código**, confira:

- `node --check sw.js` — sintaxe do service worker;
- `Get-Content manifest.json | ConvertFrom-Json` — JSON do manifesto válido;
- o cálculo e as exportações de **ambos** os turnos;
- o comportamento offline (DevTools → Application → Service Workers → *Offline*).

---

## Licença e contato

Projeto interno da **RCONT-SCT — Soluções Contábeis e Tributárias**.

- Contador responsável: **Rosemberg Oliveira**
- WhatsApp: [(11) 95893-0291](https://wa.me/5511958930291)
- E-mail: [contato@rcont-sct.com.br](mailto:contato@rcont-sct.com.br)

> Esta ferramenta é um **demonstrativo de conferência**. Os cálculos refletem a
> legislação de 2026 e devem ser validados pelo contador antes do uso prático.
