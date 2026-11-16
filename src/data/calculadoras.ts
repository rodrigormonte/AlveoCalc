import type { Calculadora } from '../types'
import { lerNumero } from '../lib/validacao'

/**
 * As calculadoras só são executadas depois da validação do formulário.
 * O fallback 0 evita que uma chamada inesperada produza NaN/Infinity na tela.
 */
const num = (valores: Record<string, string>, id: string) =>
  lerNumero(String(valores[id] ?? '')).valor ?? 0

const fmt = (valor: number, casas = 0) =>
  valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })

const calculadorasBase: Calculadora[] = [
  {
    id: 'pbw',
    nome: 'Peso predito (PBW)',
    descricao: 'Peso corporal predito a partir da altura, usado para calcular o volume corrente.',
    grupo: 'Ventilação',
    campos: [
      {
        tipo: 'opcao',
        id: 'sexo',
        rotulo: 'Sexo biológico',
        padrao: 'M',
        opcoes: [
          { valor: 'M', rotulo: 'Masculino' },
          { valor: 'F', rotulo: 'Feminino' },
        ],
        ajuda: 'A fórmula de ARDSNet usa o sexo biológico, não o gênero.',
      },
      {
        tipo: 'numero',
        id: 'altura',
        rotulo: 'Altura',
        unidade: 'cm',
        min: 120,
        max: 230,
        passo: 1,
        placeholder: 'Ex.: 170',
        ajuda: 'Altura medida ou estimada, em centímetros.',
      },
    ],
    calcular: (valores) => {
      const altura = num(valores, 'altura')
      const sexo = valores.sexo === 'F' ? 'F' : 'M'
      const base = sexo === 'M' ? 50 : 45.5
      const pbw = base + 0.91 * (altura - 152.4)
      return {
        valor: fmt(pbw, 1),
        unidade: 'kg',
        rotulo: 'Peso predito',
        linhas: [
          { rotulo: 'Altura informada', valor: `${fmt(altura, 0)} cm` },
          { rotulo: 'Fórmula aplicada', valor: sexo === 'M' ? 'Masculino' : 'Feminino' },
        ],
        interpretacao: {
          texto:
            'Use o peso predito — e não o peso real — para definir o volume corrente, principalmente em obesidade ou desnutrição.',
          nivel: 'info',
        },
        formula:
          'Homem: 50 + 0,91 × (altura − 152,4) · Mulher: 45,5 + 0,91 × (altura − 152,4)',
        referencia:
          'ARDSNet. Ventilation with lower tidal volumes as compared with traditional tidal volumes (NEJM, 2000); AMIB, Orientações Práticas de VM, 2024.',
      }
    },
  },
  {
    id: 'volume-corrente',
    nome: 'Volume corrente alvo',
    descricao: 'Volume corrente calculado pelo peso predito, com alvo ajustável de 4 a 10 mL/kg.',
    grupo: 'Ventilação',
    campos: [
      {
        tipo: 'numero',
        id: 'pbw',
        rotulo: 'Peso predito (PBW)',
        unidade: 'kg',
        min: 20,
        max: 200,
        passo: 0.1,
        placeholder: 'Ex.: 65',
        ajuda: 'Calcule na primeira calculadora se precisar.',
      },
      {
        tipo: 'numero',
        id: 'alvo',
        rotulo: 'Alvo de volume corrente',
        unidade: 'mL/kg',
        min: 4,
        max: 10,
        passo: 0.5,
        padrao: '6',
        ajuda: 'A faixa calculável é de 4 a 10 mL/kg. Na SARA, 6 mL/kg é um alvo inicial frequente; ajuste à mecânica e ao contexto clínico.',
      },
    ],
    calcular: (valores) => {
      const pbw = num(valores, 'pbw')
      const alvo = num(valores, 'alvo')
      const vt = pbw * alvo

      let interpretacao: { texto: string; nivel: 'ok' | 'info' | 'atencao' } = {
        texto: 'Dentro da faixa usual de ventilação protetora na SARA (6–8 mL/kg de peso predito).',
        nivel: 'ok',
      }
      if (alvo > 8) {
        interpretacao = {
          texto:
            'Acima da faixa usual na SARA (6–8 mL/kg). Confirme a indicação e acompanhe pressão de platô e driving pressure.',
          nivel: 'atencao',
        }
      }
      if (alvo < 6) {
        interpretacao = {
          texto:
            'Alvo abaixo de 6 mL/kg. Pode ser indicado conforme a estratégia ventilatória e a mecânica pulmonar; acompanhe pressões, volume efetivo e gasometria.',
          nivel: 'info',
        }
      }
      if (alvo === 6) {
        interpretacao = {
          texto:
            'Alvo inicial de 6 mL/kg de peso predito, dentro da faixa usual na SARA. Reduza até 4 mL/kg se a driving pressure ou o platô estiverem altos.',
          nivel: 'ok',
        }
      }

      return {
        valor: fmt(vt, 0),
        unidade: 'mL',
        rotulo: 'Volume corrente',
        linhas: [{ rotulo: 'Alvo selecionado', valor: `${fmt(alvo, 1)} mL/kg` }],
        interpretacao,
        formula: 'Volume corrente = PBW × alvo (mL/kg)',
        referencia:
          'AMIB, Orientações Práticas de Ventilação Mecânica, 2024; ARDSNet (2000) para a estratégia de 6 mL/kg.',
      }
    },
  },
  {
    id: 'volume-minuto',
    nome: 'Volume minuto',
    descricao: 'Volume de ar movimentado por minuto a partir do volume corrente e da frequência.',
    grupo: 'Ventilação',
    campos: [
      {
        tipo: 'numero',
        id: 'vt',
        rotulo: 'Volume corrente',
        unidade: 'mL',
        min: 100,
        max: 1200,
        passo: 10,
        placeholder: 'Ex.: 450',
        ajuda: 'Use o volume corrente efetivamente entregue no ventilador.',
      },
      {
        tipo: 'numero',
        id: 'fr',
        rotulo: 'Frequência respiratória',
        unidade: 'rpm',
        min: 5,
        max: 60,
        passo: 1,
        placeholder: 'Ex.: 14',
      },
    ],
    calcular: (valores) => {
      const vt = num(valores, 'vt')
      const fr = num(valores, 'fr')
      const vm = (vt * fr) / 1000
      let nivel: 'ok' | 'atencao' | 'info' = 'ok'
      let texto = 'Volume minuto dentro de uma faixa habitual em ventilação controlada (5–10 L/min).'
      if (vm > 10) {
        nivel = 'atencao'
        texto =
          'Volume minuto elevado. Avalie demanda metabólica, acidose e o custo em pressões; volume minuto alto está associado a pior desfecho em SARA.'
      } else if (vm < 5) {
        nivel = 'atencao'
        texto = 'Volume minuto baixo. Avalie hipoventilação, sedação excessiva e necessidade de suporte.'
      }
      return {
        valor: fmt(vm, 1),
        unidade: 'L/min',
        rotulo: 'Volume minuto',
        linhas: [
          { rotulo: 'Volume corrente', valor: `${fmt(vt, 0)} mL` },
          { rotulo: 'Frequência respiratória', valor: `${fmt(fr, 0)} rpm` },
        ],
        interpretacao: { texto, nivel },
        formula: 'Volume minuto = Vt × FR ÷ 1000',
        referencia:
          'AMIB, Orientações Práticas de Ventilação Mecânica, 2024. Faixa de referência aproximada; interpretar conforme demanda e PaCO₂.',
      }
    },
  },
  {
    id: 'pf',
    nome: 'Relação P/F',
    descricao: 'Relação PaO₂/FiO₂ com classificação de Berlim para a gravidade da SDRA.',
    grupo: 'Oxigenação',
    campos: [
      {
        tipo: 'numero',
        id: 'pao2',
        rotulo: 'PaO₂',
        unidade: 'mmHg',
        min: 20,
        max: 600,
        passo: 1,
        placeholder: 'Ex.: 90',
        ajuda: 'Valor da gasometria arterial.',
      },
      {
        tipo: 'numero',
        id: 'fio2',
        rotulo: 'FiO₂',
        unidade: '%',
        min: 21,
        max: 100,
        passo: 1,
        placeholder: 'Ex.: 40',
      },
    ],
    calcular: (valores) => {
      const pao2 = num(valores, 'pao2')
      const fio2 = num(valores, 'fio2')
      const razao = pao2 / (fio2 / 100)

      let nivel: 'ok' | 'info' | 'atencao' | 'alerta' = 'info'
      let classificacao = 'Sem critério de SDRA pela relação P/F'
      if (razao <= 300 && razao > 200) {
        classificacao = 'SDRA leve (201–300)'
        nivel = 'atencao'
      } else if (razao <= 200 && razao > 100) {
        classificacao = 'SDRA moderada (101–200)'
        nivel = 'atencao'
      } else if (razao <= 100) {
        classificacao = 'SDRA grave (≤100)'
        nivel = 'alerta'
      }

      return {
        valor: fmt(razao, 0),
        unidade: 'mmHg',
        rotulo: 'Relação PaO₂/FiO₂',
        linhas: [
          { rotulo: 'PaO₂', valor: `${fmt(pao2, 0)} mmHg` },
          { rotulo: 'FiO₂', valor: `${fmt(fio2, 0)}%` },
          { rotulo: 'Classificação de Berlim', valor: classificacao },
        ],
        interpretacao: {
          texto: `${classificacao}. A classificação de Berlim exige PEEP ≥ 5 cmH₂O, opacidades bilaterais e causa identificada, sem edema cardiogênico como causa principal. A relação isolada não define SDRA.`,
          nivel,
        },
        formula: 'Relação P/F = PaO₂ ÷ (FiO₂ ÷ 100)',
        referencia:
          'Definição de Berlim (ARDS Definition Task Force, JAMA, 2012). Citada separadamente da AMIB. AMIB, Orientações Práticas de VM, 2024.',
      }
    },
  },
  {
    id: 'driving-pressure',
    nome: 'Driving pressure',
    descricao: 'Pressão de distensão do sistema respiratório: platô menos PEEP total.',
    grupo: 'Mecânica',
    campos: [
      {
        tipo: 'numero',
        id: 'pplat',
        rotulo: 'Pressão de platô',
        unidade: 'cmH₂O',
        min: 5,
        max: 60,
        passo: 1,
        placeholder: 'Ex.: 24',
        ajuda: 'Medida em pausa inspiratória, sem esforço do paciente.',
      },
      {
        tipo: 'numero',
        id: 'peep',
        rotulo: 'PEEP total',
        unidade: 'cmH₂O',
        min: 0,
        max: 30,
        passo: 1,
        placeholder: 'Ex.: 8',
        ajuda: 'Inclua a autoPEEP se estiver medindo a PEEP total.',
      },
    ],
    calcular: (valores) => {
      const pplat = num(valores, 'pplat')
      const peep = num(valores, 'peep')
      const dp = pplat - peep
      return {
        valor: fmt(dp, 0),
        unidade: 'cmH₂O',
        rotulo: 'Driving pressure',
        linhas: [
          { rotulo: 'Pressão de platô', valor: `${fmt(pplat, 0)} cmH₂O` },
          { rotulo: 'PEEP total', valor: `${fmt(peep, 0)} cmH₂O` },
        ],
        interpretacao: {
          texto:
            dp > 15
              ? 'Driving pressure acima de 15 cmH₂O está associada a pior desfecho em SARA. Reveja volume corrente, PEEP e causa da redução de complacência.'
              : 'Driving pressure ≤ 15 cmH₂O está dentro do alvo habitualmente recomendado em ventilação protetora.',
          nivel: dp > 15 ? 'atencao' : 'ok',
        },
        formula: 'Driving pressure = Pplatô − PEEP',
        referencia:
          'AMIB, Orientações Práticas de Ventilação Mecânica, 2024; Amato et al., NEJM, 2015.',
      }
    },
  },
  {
    id: 'complacencia',
    nome: 'Complacência estática',
    descricao: 'Complacência do sistema respiratório a partir do volume corrente e da pressão de distensão.',
    grupo: 'Mecânica',
    campos: [
      {
        tipo: 'numero',
        id: 'vt',
        rotulo: 'Volume corrente',
        unidade: 'mL',
        min: 100,
        max: 1200,
        passo: 10,
        placeholder: 'Ex.: 450',
        ajuda: 'Use o volume corrente entregue, em pausa inspiratória.',
      },
      {
        tipo: 'numero',
        id: 'pplat',
        rotulo: 'Pressão de platô',
        unidade: 'cmH₂O',
        min: 5,
        max: 60,
        passo: 1,
        placeholder: 'Ex.: 24',
      },
      {
        tipo: 'numero',
        id: 'peep',
        rotulo: 'PEEP total',
        unidade: 'cmH₂O',
        min: 0,
        max: 30,
        passo: 1,
        placeholder: 'Ex.: 8',
      },
    ],
    calcular: (valores) => {
      const vt = num(valores, 'vt')
      const pplat = num(valores, 'pplat')
      const peep = num(valores, 'peep')
      const dp = pplat - peep
      const complacencia = dp > 0 ? vt / dp : 0
      return {
        valor: fmt(complacencia, 0),
        unidade: 'mL/cmH₂O',
        rotulo: 'Complacência estática',
        linhas: [
          { rotulo: 'Driving pressure', valor: `${fmt(dp, 0)} cmH₂O` },
          { rotulo: 'Volume corrente', valor: `${fmt(vt, 0)} mL` },
        ],
        interpretacao: {
          texto:
            'Quanto menor a complacência, maior a rigidez do sistema respiratório. Compare com a evolução do paciente e com a driving pressure; valores isolados não definem conduta.',
          nivel: complacencia < 30 ? 'atencao' : 'info',
        },
        formula: 'Complacência estática = Vt ÷ (Pplatô − PEEP)',
        referencia:
          'AMIB, Orientações Práticas de Ventilação Mecânica, 2024. Referência aproximada: 50–70 mL/cmH₂O em pulmões normais; valores abaixo de 40 sugerem complacência reduzida. Interpretar conforme a doença de base.',
      }
    },
  },
  {
    id: 'resistencia',
    nome: 'Resistência de vias aéreas',
    descricao: 'Resistência ao fluxo a partir da diferença entre pico e platô e do fluxo inspiratório.',
    grupo: 'Mecânica',
    campos: [
      {
        tipo: 'numero',
        id: 'pip',
        rotulo: 'Pressão de pico (PIP)',
        unidade: 'cmH₂O',
        min: 5,
        max: 70,
        passo: 1,
        placeholder: 'Ex.: 32',
        ajuda: 'Pico de pressão durante a inspiração.',
      },
      {
        tipo: 'numero',
        id: 'pplat',
        rotulo: 'Pressão de platô',
        unidade: 'cmH₂O',
        min: 5,
        max: 60,
        passo: 1,
        placeholder: 'Ex.: 24',
      },
      {
        tipo: 'numero',
        id: 'fluxo',
        rotulo: 'Fluxo inspiratório',
        unidade: 'L/min',
        min: 10,
        max: 120,
        passo: 1,
        placeholder: 'Ex.: 60',
        ajuda: 'Fluxo constante programado ou o fluxo médio entregue.',
      },
    ],
    calcular: (valores) => {
      const pip = num(valores, 'pip')
      const pplat = num(valores, 'pplat')
      const fluxo = num(valores, 'fluxo')
      const fluxoLs = fluxo / 60
      const resistencia = fluxoLs > 0 ? (pip - pplat) / fluxoLs : 0
      return {
        valor: fmt(resistencia, 1),
        unidade: 'cmH₂O/L/s',
        rotulo: 'Resistência de vias aéreas',
        linhas: [
          { rotulo: 'Gradiente pico − platô', valor: `${fmt(pip - pplat, 0)} cmH₂O` },
          { rotulo: 'Fluxo inspiratório', valor: `${fmt(fluxoLs, 2)} L/s` },
        ],
        interpretacao: {
          texto:
            resistencia > 15
              ? 'Resistência elevada. Considere broncoespasmo, secreção, tubo de pequeno calibre ou circuito; avalie aspiração, broncodilatador e ajuste de fluxo.'
              : 'Resistência dentro de faixa habitualmente aceitável. Valores muito baixos também merecem conferência da medida.',
          nivel: resistencia > 15 ? 'atencao' : 'ok',
        },
        formula: 'Resistência = (PIP − Pplatô) ÷ (fluxo ÷ 60)',
        referencia:
          'AMIB, Orientações Práticas de Ventilação Mecânica, 2024. Referência aproximada: até 10 cmH₂O/L/s; acima de 15 sugere aumento relevante. A resistência do tubo endotraqueal contribui para o valor medido.',
      }
    },
  },
  {
    id: 'ie',
    nome: 'Relação I:E e tempo inspiratório',
    descricao: 'Tempos inspiratório e expiratório a partir da frequência e da relação I:E ajustada.',
    grupo: 'Ventilação',
    campos: [
      {
        tipo: 'numero',
        id: 'fr',
        rotulo: 'Frequência respiratória',
        unidade: 'rpm',
        min: 5,
        max: 60,
        passo: 1,
        placeholder: 'Ex.: 14',
      },
      {
        tipo: 'opcao',
        id: 'ie',
        rotulo: 'Relação I:E',
        padrao: '1:2',
        opcoes: [
          { valor: '1:1', rotulo: '1:1' },
          { valor: '1:1.5', rotulo: '1:1,5' },
          { valor: '1:2', rotulo: '1:2' },
          { valor: '1:2.5', rotulo: '1:2,5' },
          { valor: '1:3', rotulo: '1:3' },
          { valor: '1:4', rotulo: '1:4' },
        ],
      },
    ],
    calcular: (valores) => {
      const fr = num(valores, 'fr')
      const rel = String(valores.ie ?? '1:2')
      const exp = Number(rel.split(':')[1] ?? '2')
      const ttot = 60 / fr
      const ti = ttot / (1 + exp)
      const te = ttot - ti
      const expiracaoCurta = exp <= 1.5
      return {
        valor: fmt(ti, 2),
        unidade: 's',
        rotulo: 'Tempo inspiratório',
        linhas: [
          { rotulo: 'Tempo expiratório', valor: `${fmt(te, 2)} s` },
          { rotulo: 'Tempo total do ciclo', valor: `${fmt(ttot, 2)} s` },
          { rotulo: 'Relação I:E', valor: rel.replace('.', ',') },
          { rotulo: 'Frequência', valor: `${fmt(fr, 0)} rpm` },
        ],
        interpretacao: {
          texto: expiracaoCurta
            ? 'Relação com expiração curta. Em pacientes com limitação ao fluxo, isso favorece autoPEEP e hiperinsuflação; monitore a PEEP total.'
            : 'Relação com expiração predominante, habitualmente usada para favorecer o esvaziamento pulmonar e reduzir autoPEEP.',
          nivel: expiracaoCurta ? 'atencao' : 'info',
        },
        formula: 'Ttot = 60 ÷ FR · Ti = Ttot × I ÷ (I + E) · Te = Ttot − Ti',
        referencia:
          'AMIB, Orientações Práticas de Ventilação Mecânica, 2024. Relações 1:1 a 1:2 são habituais; ajuste conforme mecânica e sincronia.',
      }
    },
  },
  {
    id: 'cnaf-pediatrico',
    nome: 'CNAF pediátrico',
    descricao: 'Estimativa do fluxo inicial por peso para cânula nasal de alto fluxo.',
    grupo: 'Ventilação',
    campos: [{ tipo: 'numero', id: 'peso', rotulo: 'Peso', unidade: 'kg', min: 0.5, max: 50, passo: 0.1, placeholder: 'Ex.: 16', ajuda: 'Acima de 10 kg, o cálculo usa 20 L/min nos primeiros 10 kg e soma 0,5 L/min por kg adicional.' }],
    calcular: (v) => {
      const peso = num(v, 'peso')
      const fluxo = peso <= 10 ? 2 * peso : 20 + 0.5 * (peso - 10)
      return { valor: fmt(fluxo, 1), unidade: 'L/min', rotulo: 'Fluxo inicial estimado', formula: peso <= 10 ? 'Fluxo = 2 × peso (kg)' : 'Fluxo = 20 + [0,5 × (peso − 10)]', referencia: 'Vapotherm Pediatric Pocket Guide', referenciaUrl: 'https://content.vapotherm.com/hubfs/PDFs/Pediatric/Vapotherm%20Pediatric%20Pocket%20Guide.pdf', interpretacao: { texto: 'Titule conforme esforço respiratório, SpO₂, conforto, tolerância e resposta clínica. Confirme os limites do dispositivo e o protocolo local.', nivel: 'info' } }
    },
  },
  {
    id: 'cnaf-faixa-etaria',
    nome: 'CNAF pediátrico por idade',
    descricao: 'Consulta das faixas de fluxo sugeridas por faixa etária e peso.',
    grupo: 'Ventilação',
    campos: [{ tipo: 'opcao', id: 'faixa', rotulo: 'Faixa etária e peso', padrao: '1', opcoes: [
      { valor: '0', rotulo: '≤ 1 mês, < 4 kg' }, { valor: '1', rotulo: '1–12 meses, 4–10 kg' }, { valor: '2', rotulo: '1–6 anos, 10–20 kg' }, { valor: '3', rotulo: '6–12 anos, 20–40 kg' }, { valor: '4', rotulo: '12–18 anos, > 40 kg' },
    ] }],
    calcular: (v) => {
      const faixas = [['5–8', '≤ 1 mês, < 4 kg'], ['8–20', '1–12 meses, 4–10 kg'], ['12–25', '1–6 anos, 10–20 kg'], ['20–30', '6–12 anos, 20–40 kg'], ['25–50', '12–18 anos, > 40 kg']]
      const [fluxo, idade] = faixas[Number(v.faixa ?? 1)] ?? faixas[1]
      return { valor: fluxo, unidade: 'L/min', rotulo: 'Faixa sugerida', linhas: [{ rotulo: 'Grupo selecionado', valor: idade }], formula: 'Faixa de referência por idade e peso (não é cálculo individual)', referencia: 'High-flow nasal cannula oxygen therapy in children: a clinical review', referenciaUrl: 'https://www.e-cep.org/journal/view.php?number=20125553606&viewtype=pubreader', interpretacao: { texto: 'Ajuste o fluxo à resposta, tolerância e especificações do equipamento; esta faixa não substitui avaliação clínica.', nivel: 'info' } }
    },
  },
  {
    id: 'cnaf-adulto',
    nome: 'CNAF adulto: faixas de fluxo',
    descricao: 'Consulta da faixa inicial, ajuste progressivo e faixa usual para adultos.',
    grupo: 'Ventilação',
    campos: [{ tipo: 'opcao', id: 'etapa', rotulo: 'Etapa de ajuste', padrao: 'inicial', opcoes: [{ valor: 'inicial', rotulo: 'Fluxo inicial' }, { valor: 'ajuste', rotulo: 'Ajuste progressivo' }, { valor: 'usual', rotulo: 'Faixa usual' }] }],
    calcular: (v) => {
      const dados: Record<string, [string, string, string]> = {
        inicial: ['20–35', 'Fluxo inicial sugerido', 'Iniciar entre 20 e 35 L/min.'],
        ajuste: ['+5 a 10', 'Incremento sugerido', 'Aumentar em incrementos de 5 a 10 L/min se não houver melhora da frequência respiratória ou do desconforto.'],
        usual: ['30–60', 'Faixa usual', 'Faixa usual de 30 a 60 L/min; usar o maior fluxo tolerado conforme resposta clínica.'],
      }
      const [faixa, rotulo, texto] = dados[v.etapa] ?? dados.inicial
      return { valor: faixa, unidade: 'L/min', rotulo, formula: 'Recomendação de fluxo para CNAF em adultos (não é cálculo individual)', referencia: 'Hamilton Medical — High-flow nasal cannula therapy', referenciaUrl: 'https://www.hamilton-medical.com/en_US/Resource-center/Article-page~knowledge-base~efb4fa6e-cb67-4e7c-ac50-28b9e3472a04~.html', interpretacao: { texto, nivel: 'info' } }
    },
  },
  {
    id: 'volume-corrente-pediatrico',
    nome: 'Volume corrente pediátrico',
    descricao: 'Escolha o alvo em mL/kg para calcular um único volume corrente pelo peso ideal.',
    grupo: 'Ventilação',
    campos: [
      { tipo: 'numero', id: 'peso', rotulo: 'Peso ideal', unidade: 'kg', min: 1, max: 200, passo: 0.1, placeholder: 'Ex.: 20' },
      { tipo: 'numero', id: 'alvo', rotulo: 'Alvo de volume corrente', unidade: 'mL/kg', min: 4, max: 8, passo: 0.1, padrao: '6', placeholder: 'Ex.: 6', ajuda: 'Escolha um valor específico entre 4 e 8 mL/kg, conforme doença, complacência e estratégia ventilatória.' },
    ],
    calcular: (v) => {
      const peso = num(v, 'peso')
      const alvo = num(v, 'alvo')
      return { valor: fmt(peso * alvo, 0), unidade: 'mL', rotulo: 'Volume corrente pediátrico', linhas: [{ rotulo: 'Alvo selecionado', valor: `${fmt(alvo, 1)} mL/kg` }, { rotulo: 'Peso ideal informado', valor: `${fmt(peso, 1)} kg` }], formula: 'VT (mL) = alvo escolhido (mL/kg) × peso ideal (kg)', referencia: 'SBP — Síndrome do desconforto respiratório agudo pediátrico; SBP — COVID-19 em UTI pediátrica', referenciaUrl: 'https://www.sbp.com.br/fileadmin/user_upload/23171b-DC_SindrDesconf_RegulatAgudo_Ped-SDRAP.pdf', interpretacao: { texto: 'O valor calculado usa exatamente o alvo selecionado. Ajuste conforme doença, complacência, pressões, volumes efetivos e gasometria.', nivel: 'info' } }
    },
  },
  {
    id: 'constante-tempo',
    nome: 'Constante de tempo respiratória',
    descricao: 'Calcula τ pela complacência e resistência do sistema respiratório.',
    grupo: 'Mecânica',
    campos: [{ tipo: 'numero', id: 'complacencia', rotulo: 'Complacência', unidade: 'L/cmH₂O', min: 0.001, max: 2, passo: 0.001, placeholder: 'Ex.: 0,02' }, { tipo: 'numero', id: 'resistencia', rotulo: 'Resistência', unidade: 'cmH₂O/L/s', min: 0.1, max: 200, passo: 0.1, placeholder: 'Ex.: 50' }],
    calcular: (v) => {
      const c = num(v, 'complacencia'); const r = num(v, 'resistencia'); const tau = c * r
      return { valor: fmt(tau, 2), unidade: 's', rotulo: 'Constante de tempo (τ)', formula: 'τ = C × R', linhas: [{ rotulo: '3 constantes de tempo', valor: `${fmt(tau * 3, 2)} s` }, { rotulo: '5 constantes de tempo', valor: `${fmt(tau * 5, 2)} s` }], referencia: 'SBP — Ventilação não invasiva com pressão positiva', referenciaUrl: 'https://www.sbp.com.br/fileadmin/user_upload/2015/02/CONSENSO-VENTILACAO-PULMONAR-MECANICA-EM-PEDIATRIA-VNIPP.pdf', interpretacao: { texto: 'Consideram-se 3 a 5 constantes de tempo para equilíbrio de pressões. Em obstrução, prolongue a expiração conforme avaliação clínica.', nivel: 'info' } }
    },
  },
  {
    id: 'formula-winter',
    nome: 'PaCO₂ esperada (Fórmula de Winter)',
    descricao: 'Faixa compensatória esperada na acidose metabólica.',
    grupo: 'Ventilação',
    campos: [{ tipo: 'numero', id: 'hco3', rotulo: 'HCO₃⁻', unidade: 'mEq/L', min: 1, max: 60, passo: 0.1, placeholder: 'Ex.: 14' }],
    calcular: (v) => {
      const hco3 = num(v, 'hco3'); const esperado = 1.5 * hco3 + 8
      return { valor: `${fmt(esperado - 2, 1)}–${fmt(esperado + 2, 1)}`, unidade: 'mmHg', rotulo: 'Faixa de PaCO₂ esperada', linhas: [{ rotulo: 'Valor central', valor: `${fmt(esperado, 1)} mmHg` }], formula: 'PaCO₂ esperada = (1,5 × HCO₃⁻) + 8 ± 2 mmHg', referencia: 'SBP — Distúrbios ácido-básicos', referenciaUrl: 'https://www.sbp.com.br/fileadmin/user_upload/2015/02/tep2011_comentado.pdf', interpretacao: { texto: 'Aplicável à compensação respiratória da acidose metabólica. Não use isoladamente para diagnóstico ou tratamento de distúrbios ácido-base.', nivel: 'atencao' } }
    },
  },
  {
    id: 'ino-concentracao',
    nome: 'iNO: concentração administrada',
    descricao: 'Estima a concentração de óxido nítrico entregue pela mistura de fluxos.',
    grupo: 'Oxigenação',
    campos: [{ tipo: 'numero', id: 'cilindro', rotulo: 'Concentração do cilindro', unidade: 'ppm', min: 1, max: 10000, passo: 1, placeholder: 'Ex.: 500' }, { tipo: 'numero', id: 'fluxo-cilindro', rotulo: 'Fluxo do cilindro', unidade: 'L/min', min: 0.01, max: 100, passo: 0.01, placeholder: 'Ex.: 0,28' }, { tipo: 'numero', id: 'fluxo-total', rotulo: 'Fluxo total do ventilador', unidade: 'L/min', min: 0.1, max: 200, passo: 0.1, placeholder: 'Ex.: 7' }],
    calcular: (v) => { const c = num(v, 'cilindro'); const fc = num(v, 'fluxo-cilindro'); const ft = num(v, 'fluxo-total'); const dose = c * fc / ft; return { valor: fmt(dose, 1), unidade: 'ppm', rotulo: 'NO administrado', formula: 'NO administrado (ppm) = NO do cilindro × (fluxo do cilindro ÷ fluxo total do ventilador)', referencia: 'Inhaled nitric oxide applications in paediatric practice', referenciaUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3232511/', interpretacao: { texto: 'O iNO exige protocolo institucional e monitorização de metahemoglobina, NO₂, toxicidade e resposta oxigenatória.', nivel: 'atencao' } } },
  },
  {
    id: 'ino-fluxo',
    nome: 'iNO: fluxo necessário do cilindro',
    descricao: 'Calcula a vazão de cilindro necessária para uma dose alvo.',
    grupo: 'Oxigenação',
    campos: [{ tipo: 'numero', id: 'dose', rotulo: 'Dose alvo', unidade: 'ppm', min: 0.1, max: 100, passo: 0.1, padrao: '20' }, { tipo: 'numero', id: 'cilindro', rotulo: 'Concentração do cilindro', unidade: 'ppm', min: 1, max: 10000, passo: 1, padrao: '500' }, { tipo: 'numero', id: 'fluxo-total', rotulo: 'Fluxo total do ventilador', unidade: 'L/min', min: 0.1, max: 200, passo: 0.1, placeholder: 'Ex.: 7' }],
    calcular: (v) => { const d = num(v, 'dose'); const c = num(v, 'cilindro'); const ft = num(v, 'fluxo-total'); return { valor: fmt(d / c * ft, 2), unidade: 'L/min', rotulo: 'Fluxo do cilindro', formula: 'Fluxo do cilindro = (dose alvo ÷ concentração do cilindro) × fluxo total do ventilador', referencia: 'POP.DT.024 — Utilização de Óxido Nítrico, Hospital Santa Helena', referenciaUrl: 'https://hmsantahelena.com.br/wp-content/uploads/2024/09/POP.DT_.024.01-UTILIZACAO-DE-OXIDO-NITRICO.pdf', interpretacao: { texto: 'Confira a concentração final administrada e siga o protocolo institucional de instalação e monitorização.', nivel: 'atencao' } } },
  },
  {
    id: 'indice-oxigenacao',
    nome: 'Índice de oxigenação (IO/OI)',
    descricao: 'Calcula o índice de oxigenação usado para acompanhar gravidade e resposta.',
    grupo: 'Oxigenação',
    campos: [{ tipo: 'numero', id: 'pam', rotulo: 'Pressão média de vias aéreas (PAM)', unidade: 'cmH₂O', min: 1, max: 60, passo: 0.1, placeholder: 'Ex.: 15' }, { tipo: 'numero', id: 'fio2', rotulo: 'FiO₂', unidade: 'fração decimal', min: 0.21, max: 1, passo: 0.01, placeholder: 'Ex.: 0,8', ajuda: 'Informe como decimal: 0,8 corresponde a 80%.' }, { tipo: 'numero', id: 'pao2', rotulo: 'PaO₂', unidade: 'mmHg', min: 1, max: 600, passo: 1, placeholder: 'Ex.: 60' }],
    calcular: (v) => { const pam = num(v, 'pam'); const fio2 = num(v, 'fio2'); const pao2 = num(v, 'pao2'); const io = pam * fio2 * 100 / pao2; return { valor: fmt(io, 1), rotulo: 'Índice de oxigenação', formula: 'IO = (PAM × FiO₂ × 100) ÷ PaO₂', referencia: 'Secretaria de Saúde do DF — Protocolo de HPPN', referenciaUrl: 'https://www.saude.df.gov.br/documents/37101/0/Hipertens%C3%A3o+Pulmonar+Persistente+Neonatal.pdf/3550beb8-fe9f-60a7-4aff-e3d50e6aff36', interpretacao: { texto: 'Na neonatologia, IO ≥ 25 pode ser usado como critério de gravidade e consideração de iNO conforme protocolo institucional.', nivel: io >= 25 ? 'atencao' : 'info' } } },
  },
  {
    id: 'fio2-cateter',
    nome: 'FiO₂ estimada no cateter nasal',
    descricao: 'Estimativa aproximada da FiO₂ com cateter nasal convencional.',
    grupo: 'Oxigenação',
    campos: [{ tipo: 'numero', id: 'fluxo', rotulo: 'Fluxo de oxigênio', unidade: 'L/min', min: 1, max: 6, passo: 1, placeholder: 'Ex.: 2' }],
    calcular: (v) => { const fluxo = num(v, 'fluxo'); const fio2 = 21 + 4 * fluxo; return { valor: fmt(fio2, 0), unidade: '%', rotulo: 'FiO₂ estimada', formula: 'FiO₂ estimada ≈ 21% + (4% × fluxo em L/min)', referencia: 'SBP — Oxigenoterapia com cânula nasal de alto fluxo', referenciaUrl: 'https://www.sbp.com.br/boletimabp-marco2023/ciencia-e-ensino/', interpretacao: { texto: 'Estimativa aproximada para cateter nasal convencional. Não substitui a FiO₂ real do dispositivo; no CNAF ajuste a FiO₂ diretamente conforme alvo de SpO₂.', nivel: 'atencao' } } },
  },
  {
    id: 'hacor',
    nome: 'Índice HACOR',
    descricao: 'Escore para estimar risco de falha da ventilação não invasiva em adultos com insuficiência respiratória hipoxêmica.',
    grupo: 'Oxigenação',
    campos: [
      { tipo: 'numero', id: 'fc', rotulo: 'Frequência cardíaca', unidade: 'bpm', min: 30, max: 250, passo: 1, placeholder: 'Ex.: 128' },
      { tipo: 'numero', id: 'ph', rotulo: 'pH arterial', unidade: '', min: 6.8, max: 7.8, passo: 0.01, placeholder: 'Ex.: 7,28' },
      { tipo: 'numero', id: 'glasgow', rotulo: 'Escala de Coma de Glasgow', unidade: 'pontos', min: 3, max: 15, passo: 1, placeholder: 'Ex.: 14' },
      { tipo: 'numero', id: 'pao2', rotulo: 'PaO₂ arterial', unidade: 'mmHg', min: 20, max: 600, passo: 1, placeholder: 'Ex.: 70' },
      { tipo: 'numero', id: 'fio2', rotulo: 'FiO₂', unidade: 'fração decimal', min: 0.21, max: 1, passo: 0.01, placeholder: 'Ex.: 0,5', ajuda: 'Informe em fração: 0,50 corresponde a 50%.' },
      { tipo: 'numero', id: 'fr', rotulo: 'Frequência respiratória', unidade: 'irpm', min: 1, max: 100, passo: 1, placeholder: 'Ex.: 34' },
    ],
    calcular: (v) => {
      const fc = num(v, 'fc'); const ph = num(v, 'ph'); const glasgow = num(v, 'glasgow'); const pf = num(v, 'pao2') / num(v, 'fio2'); const fr = num(v, 'fr')
      const pFc = fc <= 120 ? 0 : 1
      const pPh = ph >= 7.35 ? 0 : ph >= 7.30 ? 2 : ph >= 7.25 ? 3 : 4
      const pGcs = glasgow === 15 ? 0 : glasgow >= 13 ? 2 : glasgow >= 11 ? 5 : 10
      const pPf = pf >= 201 ? 0 : pf >= 176 ? 2 : pf >= 151 ? 3 : pf >= 126 ? 4 : pf >= 101 ? 5 : 6
      const pFr = fr <= 30 ? 0 : fr <= 35 ? 1 : fr <= 40 ? 2 : fr <= 45 ? 3 : 4
      const total = pFc + pPh + pGcs + pPf + pFr
      return { valor: String(total), unidade: 'pontos', rotulo: 'Escore HACOR', linhas: [{ rotulo: 'FC', valor: `${pFc} ponto(s)` }, { rotulo: 'pH', valor: `${pPh} ponto(s)` }, { rotulo: 'Glasgow', valor: `${pGcs} ponto(s)` }, { rotulo: `PaO₂/FiO₂ (${fmt(pf, 0)})`, valor: `${pPf} ponto(s)` }, { rotulo: 'FR', valor: `${pFr} ponto(s)` }], formula: 'HACOR = pontos de FC + pH + Glasgow + PaO₂/FiO₂ + FR (0–25)', referencia: 'Duan et al. Assessment of heart rate, acidosis, consciousness, oxygenation, and respiratory rate to predict noninvasive ventilation failure, 2017', referenciaUrl: 'https://pubmed.ncbi.nlm.nih.gov/27812731/', interpretacao: total > 5 ? { texto: 'Escore acima de 5 foi associado a maior risco de falha da VNI no estudo original. Não determina intubação isoladamente; integre evolução, avaliação clínica e protocolo local.', nivel: 'atencao' } : { texto: 'O escore isolado não exclui falha da VNI. Reavalie a resposta clínica e considere acompanhar o HACOR em série conforme protocolo.', nivel: 'info' } }
    },
  },
  {
    id: 'rox',
    nome: 'Índice ROX',
    descricao: 'Índice de oxigenação e frequência respiratória durante oxigenoterapia nasal de alto fluxo.',
    grupo: 'Oxigenação',
    campos: [{ tipo: 'numero', id: 'spo2', rotulo: 'SpO₂', unidade: '%', min: 50, max: 100, passo: 1, placeholder: 'Ex.: 95' }, { tipo: 'numero', id: 'fio2', rotulo: 'FiO₂', unidade: 'fração decimal', min: 0.21, max: 1, passo: 0.01, placeholder: 'Ex.: 0,5', ajuda: 'Informe como fração decimal; use SpO₂ em porcentagem.' }, { tipo: 'numero', id: 'fr', rotulo: 'Frequência respiratória', unidade: 'irpm', min: 1, max: 100, passo: 1, placeholder: 'Ex.: 25' }],
    calcular: (v) => { const spo2 = num(v, 'spo2'); const fio2 = num(v, 'fio2'); const fr = num(v, 'fr'); const rox = (spo2 / fio2) / fr; return { valor: fmt(rox, 2), rotulo: 'Índice ROX', linhas: [{ rotulo: 'SpO₂/FiO₂', valor: fmt(spo2 / fio2, 1) }], formula: 'ROX = (SpO₂ (%) ÷ FiO₂ [fração]) ÷ FR (irpm)', referencia: 'Roca et al. An Index Combining Respiratory Rate and Oxygenation to Predict Outcome of Nasal High-Flow Therapy, 2019', referenciaUrl: 'https://www.atsjournals.org/doi/10.1164/rccm.201803-0589OC', interpretacao: rox >= 4.88 ? { texto: 'ROX ≥ 4,88 após 2, 6 ou 12 horas associou-se a maior probabilidade de sucesso no estudo original. Acompanhe a tendência junto da avaliação clínica.', nivel: 'info' } : { texto: 'ROX abaixo de 4,88 foi associado a maior risco de falha no estudo original. Reavalie prontamente o quadro e a resposta ao CNAF; o índice não define conduta isoladamente.', nivel: 'atencao' } } },
  },
  {
    id: 'henderson-hasselbalch',
    nome: 'Validação pela equação de Henderson–Hasselbalch',
    descricao: 'Calcula o pH esperado a partir de PaCO₂ e bicarbonato para conferir consistência da gasometria.',
    grupo: 'Mecânica',
    campos: [{ tipo: 'numero', id: 'hco3', rotulo: 'HCO₃⁻', unidade: 'mEq/L', min: 1, max: 60, passo: 0.1, placeholder: 'Ex.: 24' }, { tipo: 'numero', id: 'paco2', rotulo: 'PaCO₂', unidade: 'mmHg', min: 5, max: 200, passo: 1, placeholder: 'Ex.: 40' }, { tipo: 'numero', id: 'ph-informado', rotulo: 'pH informado', unidade: '', min: 6.8, max: 7.8, passo: 0.01, placeholder: 'Ex.: 7,40' }],
    calcular: (v) => { const hco3 = num(v, 'hco3'); const paco2 = num(v, 'paco2'); const ph = 6.1 + Math.log10(hco3 / (0.03 * paco2)); const informado = num(v, 'ph-informado'); const diferenca = Math.abs(ph - informado); return { valor: fmt(ph, 2), rotulo: 'pH calculado', linhas: [{ rotulo: 'pH informado', valor: fmt(informado, 2) }, { rotulo: 'Diferença absoluta', valor: fmt(diferenca, 2) }], formula: 'pH = 6,1 + log₁₀[HCO₃⁻ ÷ (0,03 × PaCO₂)]', referencia: 'NCBI Bookshelf — Arterial Blood Gases (Clinical Methods)', referenciaUrl: 'https://www.ncbi.nlm.nih.gov/books/NBK371/', interpretacao: { texto: 'Compare o valor calculado ao informado. Diferenças devem ser interpretadas considerando método laboratorial, amostra e contexto; esta conferência não substitui validação pelo laboratório.', nivel: 'info' } } },
  },
  {
    id: 'compensacao-gasometria',
    nome: 'Compensação ácido-base esperada',
    descricao: 'Estima a compensação esperada nos distúrbios metabólicos e respiratórios descritos no documento.',
    grupo: 'Mecânica',
    campos: [{ tipo: 'opcao', id: 'disturbio', rotulo: 'Distúrbio primário', padrao: 'acidose-metabolica', opcoes: [{ valor: 'acidose-metabolica', rotulo: 'Acidose metabólica (Winter)' }, { valor: 'alcalose-metabolica', rotulo: 'Alcalose metabólica' }, { valor: 'acidose-respiratoria-aguda', rotulo: 'Acidose respiratória aguda' }, { valor: 'acidose-respiratoria-cronica', rotulo: 'Acidose respiratória crônica' }, { valor: 'alcalose-respiratoria-aguda', rotulo: 'Alcalose respiratória aguda' }, { valor: 'alcalose-respiratoria-cronica', rotulo: 'Alcalose respiratória crônica' }] }, { tipo: 'numero', id: 'hco3', rotulo: 'HCO₃⁻ medido', unidade: 'mEq/L', min: 1, max: 60, passo: 0.1, placeholder: 'Ex.: 14', ajuda: 'Usado nas compensações metabólicas e como valor observado nas respiratórias.' }, { tipo: 'numero', id: 'paco2', rotulo: 'PaCO₂ medida', unidade: 'mmHg', min: 5, max: 200, passo: 1, placeholder: 'Ex.: 60', ajuda: 'Usada nas compensações respiratórias e como valor observado nas metabólicas.' }],
    calcular: (v) => {
      const hco3 = num(v, 'hco3'); const paco2 = num(v, 'paco2'); const tipo = v.disturbio
      let esperado = ''; let comparacao = ''; let formula = ''; let fora = false; let respiratoria = false
      if (tipo === 'acidose-metabolica') { const alvo = 1.5 * hco3 + 8; esperado = `${fmt(alvo - 2, 1)}–${fmt(alvo + 2, 1)} mmHg`; comparacao = `PaCO₂ medida: ${fmt(paco2, 1)} mmHg`; formula = 'PaCO₂ = (1,5 × HCO₃⁻) + 8 ± 2'; fora = paco2 < alvo - 2 || paco2 > alvo + 2 }
      else if (tipo === 'alcalose-metabolica') { const alvo = 40 + 0.7 * (hco3 - 24); esperado = `${fmt(alvo - 5, 1)}–${fmt(alvo + 5, 1)} mmHg`; comparacao = `PaCO₂ medida: ${fmt(paco2, 1)} mmHg`; formula = 'PaCO₂ = 40 + [0,7 × (HCO₃⁻ − 24)] ± 5'; fora = paco2 < alvo - 5 || paco2 > alvo + 5 }
      else { respiratoria = true; const aguda = String(tipo).endsWith('aguda'); const acidose = String(tipo).startsWith('acidose'); const delta = acidose ? paco2 - 40 : 40 - paco2; const fator = acidose ? (aguda ? 1 : 3.5) : (aguda ? 2 : 5); const alvo = acidose ? 24 + fator * delta / 10 : 24 - fator * delta / 10; esperado = `${fmt(alvo, 1)} mEq/L`; comparacao = `HCO₃⁻ medido: ${fmt(hco3, 1)} mEq/L`; formula = `HCO₃⁻ esperado varia ${fator} mEq/L por 10 mmHg de ${acidose ? 'aumento' : 'queda'} da PaCO₂` }
      return { valor: esperado, rotulo: 'Compensação esperada', linhas: [{ rotulo: 'Comparação', valor: comparacao }], formula, referencia: 'American Thoracic Society — Interpretation of Arterial Blood Gases; fórmulas conforme documento enviado', referenciaUrl: 'https://site.thoracic.org/assemblies/cc/clinical-education/interpretation-of-abgs', interpretacao: { texto: respiratoria ? 'Estimativa da compensação esperada; o documento não define uma faixa de tolerância para esta fórmula. Compare ao valor medido com pH, contexto clínico e demais exames.' : fora ? 'Valor medido fora da estimativa calculada pode sugerir distúrbio associado. Avalie o contexto, a compensação esperada e os dados clínicos.' : 'Valor medido dentro da estimativa indicada. Interprete em conjunto com pH, contexto clínico e demais exames.', nivel: fora ? 'atencao' : 'info' } }
    },
  },
  {
    id: 'anion-gap',
    nome: 'Ânion gap',
    descricao: 'Calcula o ânion gap medido e sua correção pela albumina.',
    grupo: 'Mecânica',
    campos: [{ tipo: 'numero', id: 'sodio', rotulo: 'Sódio (Na⁺)', unidade: 'mEq/L', min: 80, max: 200, passo: 1, placeholder: 'Ex.: 140' }, { tipo: 'numero', id: 'cloro', rotulo: 'Cloro (Cl⁻)', unidade: 'mEq/L', min: 50, max: 160, passo: 1, placeholder: 'Ex.: 104' }, { tipo: 'numero', id: 'hco3', rotulo: 'HCO₃⁻', unidade: 'mEq/L', min: 1, max: 60, passo: 0.1, placeholder: 'Ex.: 24' }, { tipo: 'numero', id: 'albumina', rotulo: 'Albumina', unidade: 'g/dL', min: 0.1, max: 8, passo: 0.1, placeholder: 'Ex.: 4' }],
    calcular: (v) => { const na = num(v, 'sodio'); const cl = num(v, 'cloro'); const hco3 = num(v, 'hco3'); const albumina = num(v, 'albumina'); const ag = na - (cl + hco3); const corrigido = ag + 2.5 * (4 - albumina); return { valor: fmt(ag, 1), unidade: 'mEq/L', rotulo: 'Ânion gap medido', linhas: [{ rotulo: 'Ânion gap corrigido pela albumina', valor: `${fmt(corrigido, 1)} mEq/L` }, { rotulo: 'Albumina', valor: `${fmt(albumina, 1)} g/dL` }], formula: 'AG = Na⁺ − (Cl⁻ + HCO₃⁻) · AG corrigido = AG + 2,5 × (4,0 − albumina)', referencia: 'American Thoracic Society — Interpretation of Arterial Blood Gases', referenciaUrl: 'https://site.thoracic.org/assemblies/cc/clinical-education/interpretation-of-abgs', interpretacao: { texto: 'Referências usuais variam por laboratório. Use o intervalo local e interprete junto à albumina, lactato, função renal, cetonas e quadro clínico.', nivel: 'info' } } },
  },
  {
    id: 'gasometria-oxigenacao',
    nome: 'Equação alveolar e gradiente A–a',
    descricao: 'Estima PAO₂ e gradiente alvéolo-arterial a partir da FiO₂, PaCO₂ e PaO₂.',
    grupo: 'Oxigenação',
    campos: [{ tipo: 'numero', id: 'fio2', rotulo: 'FiO₂', unidade: 'fração decimal', min: 0.21, max: 1, passo: 0.01, placeholder: 'Ex.: 0,5', ajuda: 'Informe em fração decimal.' }, { tipo: 'numero', id: 'paco2', rotulo: 'PaCO₂', unidade: 'mmHg', min: 5, max: 200, passo: 1, placeholder: 'Ex.: 40' }, { tipo: 'numero', id: 'pao2', rotulo: 'PaO₂', unidade: 'mmHg', min: 1, max: 600, passo: 1, placeholder: 'Ex.: 80' }, { tipo: 'numero', id: 'idade', rotulo: 'Idade', unidade: 'anos', min: 1, max: 120, passo: 1, placeholder: 'Ex.: 40' }],
    calcular: (v) => { const fio2 = num(v, 'fio2'); const paco2 = num(v, 'paco2'); const pao2 = num(v, 'pao2'); const idade = num(v, 'idade'); const pao2Alveolar = fio2 * (760 - 47) - paco2 / 0.8; const gradiente = pao2Alveolar - pao2; const esperado = (idade + 10) / 4; return { valor: fmt(gradiente, 1), unidade: 'mmHg', rotulo: 'Gradiente alvéolo-arterial (A–a)', linhas: [{ rotulo: 'PAO₂ estimada', valor: `${fmt(pao2Alveolar, 1)} mmHg` }, { rotulo: 'A–a esperado aproximado', valor: `${fmt(esperado, 1)} mmHg` }, { rotulo: 'PaO₂ estimada (FiO₂ × 5; aproximação)', valor: `${fmt(fio2 * 100 * 5, 0)} mmHg` }], formula: 'PAO₂ = [FiO₂ × (760 − 47)] − (PaCO₂ ÷ 0,8) · A–a = PAO₂ − PaO₂', referencia: 'NCBI Bookshelf — Arterial Blood Gases; American Thoracic Society — Interpretation of ABGs', referenciaUrl: 'https://www.ncbi.nlm.nih.gov/books/NBK371/', interpretacao: { texto: 'A estimativa A–a por idade é aproximada e menos precisa com FiO₂ elevada. A equação alveolar usa pressão atmosférica ao nível do mar e quociente respiratório de 0,8; ajuste às condições locais.', nivel: 'info' } } },
  },
  {
    id: 'interpretacao-gasometria',
    nome: 'Interpretação da gasometria',
    descricao: 'Informe os seis valores da gasometria para identificar o distúrbio ácido-base e conferir os dados informados.',
    grupo: 'Mecânica',
    campos: [
      { tipo: 'numero', id: 'ph', rotulo: 'pH arterial', unidade: '', min: 6.8, max: 7.8, passo: 0.01, placeholder: 'Ex.: 7,28' },
      { tipo: 'numero', id: 'paco2', rotulo: 'PaCO₂', unidade: 'mmHg', min: 5, max: 200, passo: 1, placeholder: 'Ex.: 60' },
      { tipo: 'numero', id: 'hco3', rotulo: 'HCO₃⁻', unidade: 'mEq/L', min: 1, max: 60, passo: 0.1, placeholder: 'Ex.: 24' },
      { tipo: 'numero', id: 'be', rotulo: 'BE (excesso de base)', unidade: 'mEq/L', min: -40, max: 40, passo: 0.1, placeholder: 'Ex.: -4' },
      { tipo: 'numero', id: 'pao2', rotulo: 'PaO₂', unidade: 'mmHg', min: 1, max: 600, passo: 1, placeholder: 'Ex.: 80' },
      { tipo: 'numero', id: 'saturacao', rotulo: 'Saturação de O₂', unidade: '%', min: 1, max: 100, passo: 1, placeholder: 'Ex.: 95' },
    ],
    calcular: (v) => {
      const ph = num(v, 'ph')
      const paco2 = num(v, 'paco2')
      const hco3 = num(v, 'hco3')
      const be = num(v, 'be')
      const pao2 = num(v, 'pao2')
      const saturacao = num(v, 'saturacao')
      const statusPh = ph < 7.35 ? 'Acidemia' : ph > 7.45 ? 'Alcalemia' : 'pH na faixa usual (7,35–7,45)'
      const direcaoPh = ph < 7.35 || (ph >= 7.35 && ph < 7.40) ? 'acida' : ph > 7.45 || ph > 7.40 ? 'alcalina' : 'neutra'
      const acidoseMetabolica = hco3 < 22 || be < -2
      const alcaloseMetabolica = hco3 > 26 || be > 2
      let classificacao = ''
      let compensacao = 'Não estimada: pH/valores não indicam um distúrbio primário claro pelos limites de referência.'
      let detalhe = ''
      let possivelMisto = false

      if (direcaoPh === 'acida') {
        if (paco2 > 45 && acidoseMetabolica) {
          classificacao = 'Distúrbio misto: acidose respiratória e acidose metabólica'
          compensacao = 'PaCO₂ elevada e componente metabólico acidótico (HCO₃⁻ baixo e/ou BE < −2) contribuem ambos para acidemia.'
          possivelMisto = true
        } else if (paco2 > 45) {
          classificacao = 'Acidose respiratória primária'
          const delta = paco2 - 40
          const agudo = 24 + delta / 10
          const cronico = 24 + (delta / 10) * 3.5
          compensacao = `HCO₃⁻ esperado: cerca de ${fmt(agudo, 1)} mEq/L no padrão agudo ou ${fmt(cronico, 1)} mEq/L no crônico.`
          if (acidoseMetabolica) { classificacao = 'Acidose respiratória com possível componente metabólico associado'; detalhe = 'BE negativo e/ou HCO₃⁻ baixo reforçam componente metabólico acidótico.'; possivelMisto = true }
          else if (alcaloseMetabolica) detalhe = 'BE positivo e/ou HCO₃⁻ elevado podem refletir compensação crônica ou componente metabólico alcalótico; considere o tempo de evolução e a clínica.'
        } else if (acidoseMetabolica) {
          classificacao = 'Acidose metabólica primária'
          const esperado = 1.5 * hco3 + 8
          const inferior = esperado - 2
          const superior = esperado + 2
          compensacao = `PaCO₂ esperada pela fórmula de Winter: ${fmt(inferior, 1)}–${fmt(superior, 1)} mmHg.`
          if (paco2 > superior) { detalhe = 'PaCO₂ acima da faixa de compensação sugere acidose respiratória associada.'; possivelMisto = true }
          if (paco2 < inferior) { detalhe = 'PaCO₂ abaixo da faixa de compensação sugere alcalose respiratória associada.'; possivelMisto = true }
        } else {
          classificacao = 'Acidemia sem padrão primário definido por estes valores'
          detalhe = 'Confira a amostra, os intervalos de referência e a evolução clínica.'
        }
      } else if (direcaoPh === 'alcalina') {
        if (paco2 < 35 && alcaloseMetabolica) {
          classificacao = 'Distúrbio misto: alcalose respiratória e alcalose metabólica'
          compensacao = 'PaCO₂ reduzida e componente metabólico alcalótico (HCO₃⁻ elevado e/ou BE > +2) contribuem ambos para alcalemia.'
          possivelMisto = true
        } else if (paco2 < 35) {
          classificacao = 'Alcalose respiratória primária'
          const delta = 40 - paco2
          const agudo = 24 - (delta / 10) * 2
          const cronico = 24 - (delta / 10) * 5
          compensacao = `HCO₃⁻ esperado: cerca de ${fmt(agudo, 1)} mEq/L no padrão agudo ou ${fmt(cronico, 1)} mEq/L no crônico.`
          if (acidoseMetabolica) detalhe = 'BE negativo e/ou HCO₃⁻ baixo podem representar compensação metabólica da alcalose respiratória ou um distúrbio metabólico associado; considere o tempo de evolução e a clínica.'
          else if (alcaloseMetabolica) detalhe = 'BE positivo e/ou HCO₃⁻ elevado podem refletir compensação crônica ou componente metabólico alcalótico; considere o tempo de evolução e a clínica.'
        } else if (alcaloseMetabolica) {
          classificacao = 'Alcalose metabólica primária'
          const esperado = 40 + 0.7 * (hco3 - 24)
          const inferior = esperado - 5
          const superior = esperado + 5
          compensacao = `PaCO₂ esperada: ${fmt(inferior, 1)}–${fmt(superior, 1)} mmHg.`
          if (paco2 > superior) { detalhe = 'PaCO₂ acima da faixa de compensação sugere acidose respiratória associada.'; possivelMisto = true }
          if (paco2 < inferior) { detalhe = 'PaCO₂ abaixo da faixa de compensação sugere alcalose respiratória associada.'; possivelMisto = true }
        } else {
          classificacao = 'Alcalemia sem padrão primário definido por estes valores'
          detalhe = 'Confira a amostra, os intervalos de referência e a evolução clínica.'
        }
      } else {
        if (paco2 > 45 && be > 2 && hco3 > 26) {
          classificacao = 'Possível acidose respiratória compensada'
          compensacao = 'PaCO₂ elevada com BE positivo e HCO₃⁻ elevado; considere compensação metabólica, especialmente em quadro crônico.'
        } else if (paco2 < 35 && be < -2 && hco3 < 22) {
          classificacao = 'Possível alcalose respiratória compensada'
          compensacao = 'PaCO₂ reduzida com BE negativo e HCO₃⁻ baixo; considere compensação metabólica, especialmente em quadro crônico.'
        } else if (paco2 > 45 && be < -2) {
          classificacao = 'Possível distúrbio misto: acidose respiratória e metabólica'
          compensacao = 'PaCO₂ elevada e BE negativo apontam componentes acidóticos opostos que podem manter o pH na faixa usual.'
          possivelMisto = true
        } else if (paco2 < 35 && be > 2) {
          classificacao = 'Possível distúrbio misto: alcalose respiratória e metabólica'
          compensacao = 'PaCO₂ reduzida e BE positivo apontam componentes alcalóticos opostos que podem manter o pH na faixa usual.'
          possivelMisto = true
        } else if (be < -2) {
          classificacao = 'Possível acidose metabólica compensada'
          compensacao = 'BE negativo indica componente metabólico acidótico; confira se a PaCO₂ está na faixa compensatória esperada.'
        } else if (be > 2) {
          classificacao = 'Possível alcalose metabólica compensada'
          compensacao = 'BE positivo indica componente metabólico alcalótico; confira se a PaCO₂ está na faixa compensatória esperada.'
        } else {
          classificacao = 'Sem distúrbio ácido-base evidente pelos valores informados'
          compensacao = 'pH, PaCO₂ e BE estão sem alteração relevante pelos limites de referência aproximados.'
        }
        detalhe = 'O pH dentro da faixa usual não exclui distúrbio compensado ou misto; correlacione com evolução, clínica e valores de referência do laboratório.'
      }

      return {
        valor: classificacao,
        rotulo: 'Interpretação ácido-base',
        linhas: [
          { rotulo: 'pH', valor: `${fmt(ph, 2)} — ${statusPh}` },
          { rotulo: 'PaCO₂', valor: `${fmt(paco2, 1)} mmHg (${paco2 < 35 ? 'baixa' : paco2 > 45 ? 'elevada' : 'faixa usual'})` },
          { rotulo: 'HCO₃⁻', valor: `${fmt(hco3, 1)} mEq/L (${hco3 < 22 ? 'baixo' : hco3 > 26 ? 'elevado' : 'faixa usual'})` },
          { rotulo: 'BE', valor: `${fmt(be, 1)} mEq/L (${be < -2 ? 'componente metabólico acidótico' : be > 2 ? 'componente metabólico alcalótico' : 'faixa usual aproximada'})` },
          { rotulo: 'PaO₂', valor: `${fmt(pao2, 0)} mmHg` },
          { rotulo: 'Saturação', valor: `${fmt(saturacao, 0)}%` },
          { rotulo: 'Compensação estimada', valor: compensacao },
        ],
        formula: 'Interprete pH + PaCO₂ (componente respiratório) + HCO₃⁻/BE (componente metabólico)',
        referencia: 'Resuscitation Council UK — Arterial blood gas interpretation; American Thoracic Society — Interpretation of ABGs',
        referenciaUrl: 'https://lms.resus.org.uk/modules/m35-v2-blood-gasses/10346/m35/t05/content/m35_t05_005sr.htm',
        interpretacao: {
          texto: [detalhe, 'A interpretação da PaO₂ depende da FiO₂ e do contexto; estes valores são mostrados sem classificar a oxigenação. Integre a história, a amostra e os protocolos locais.'].filter(Boolean).join(' '),
          nivel: possivelMisto || ph < 7.35 || ph > 7.45 ? 'atencao' : 'info',
        },
      }
    },
  },
  {
    id: 'oxido-nitrico',
    nome: 'Óxido nítrico inalatório (iNO)',
    descricao: 'Calcule concentração administrada, fluxo do cilindro ou índice de oxigenação em uma única ferramenta.',
    grupo: 'Oxigenação',
    campos: [
      { tipo: 'opcao', id: 'operacao', rotulo: 'O que deseja calcular?', padrao: 'concentracao', opcoes: [{ valor: 'concentracao', rotulo: 'Concentração administrada' }, { valor: 'fluxo', rotulo: 'Fluxo necessário do cilindro' }, { valor: 'io', rotulo: 'Índice de oxigenação (IO/OI)' }] },
      { tipo: 'numero', id: 'cilindro', rotulo: 'Concentração de NO no cilindro', unidade: 'ppm', min: 1, max: 10000, passo: 1, placeholder: 'Ex.: 500', quando: { campoId: 'operacao', valores: ['concentracao', 'fluxo'] } },
      { tipo: 'numero', id: 'fluxo-cilindro', rotulo: 'Fluxo do cilindro', unidade: 'L/min', min: 0.01, max: 100, passo: 0.01, placeholder: 'Ex.: 0,28', quando: { campoId: 'operacao', valores: ['concentracao'] } },
      { tipo: 'numero', id: 'fluxo-total', rotulo: 'Fluxo total do ventilador', unidade: 'L/min', min: 0.1, max: 200, passo: 0.1, placeholder: 'Ex.: 7', quando: { campoId: 'operacao', valores: ['concentracao', 'fluxo'] } },
      { tipo: 'numero', id: 'dose', rotulo: 'Dose alvo', unidade: 'ppm', min: 0.1, max: 100, passo: 0.1, padrao: '20', quando: { campoId: 'operacao', valores: ['fluxo'] } },
      { tipo: 'numero', id: 'pam', rotulo: 'Pressão média de vias aéreas (PAM)', unidade: 'cmH₂O', min: 1, max: 60, passo: 0.1, placeholder: 'Ex.: 15', quando: { campoId: 'operacao', valores: ['io'] } },
      { tipo: 'numero', id: 'fio2', rotulo: 'FiO₂', unidade: 'fração decimal', min: 0.21, max: 1, passo: 0.01, placeholder: 'Ex.: 0,8', ajuda: 'Informe 0,8 para 80%.', quando: { campoId: 'operacao', valores: ['io'] } },
      { tipo: 'numero', id: 'pao2', rotulo: 'PaO₂ arterial', unidade: 'mmHg', min: 1, max: 600, passo: 1, placeholder: 'Ex.: 60', quando: { campoId: 'operacao', valores: ['io'] } },
    ],
    calcular: (v) => {
      if (v.operacao === 'fluxo') {
        const dose = num(v, 'dose'); const cilindro = num(v, 'cilindro'); const fluxoTotal = num(v, 'fluxo-total'); const fluxo = dose / cilindro * fluxoTotal
        return { valor: fmt(fluxo, 2), unidade: 'L/min', rotulo: 'Fluxo necessário do cilindro', formula: 'Fluxo do cilindro = (dose alvo ÷ concentração do cilindro) × fluxo total do ventilador', referencia: 'POP.DT.024 — Utilização de Óxido Nítrico, Hospital Santa Helena', referenciaUrl: 'https://hmsantahelena.com.br/wp-content/uploads/2024/09/POP.DT_.024.01-UTILIZACAO-DE-OXIDO-NITRICO.pdf', interpretacao: { texto: 'Confira a concentração final administrada e siga o protocolo institucional de instalação e monitorização do iNO.', nivel: 'atencao' } }
      }
      if (v.operacao === 'io') {
        const pam = num(v, 'pam'); const fio2 = num(v, 'fio2'); const pao2 = num(v, 'pao2'); const io = pam * fio2 * 100 / pao2
        return { valor: fmt(io, 1), rotulo: 'Índice de oxigenação (IO/OI)', formula: 'IO = (PAM × FiO₂ × 100) ÷ PaO₂', referencia: 'Secretaria de Saúde do DF — Protocolo de HPPN', referenciaUrl: 'https://www.saude.df.gov.br/documents/37101/0/Hipertens%C3%A3o+Pulmonar+Persistente+Neonatal.pdf/3550beb8-fe9f-60a7-4aff-e3d50e6aff36', interpretacao: { texto: 'Na neonatologia, IO ≥ 25 pode ser usado como critério de gravidade e consideração de iNO conforme protocolo institucional.', nivel: io >= 25 ? 'atencao' : 'info' } }
      }
      const cilindro = num(v, 'cilindro'); const fluxo = num(v, 'fluxo-cilindro'); const fluxoTotal = num(v, 'fluxo-total'); const dose = cilindro * fluxo / fluxoTotal
      return { valor: fmt(dose, 1), unidade: 'ppm', rotulo: 'Concentração administrada', linhas: [{ rotulo: 'Concentração no cilindro', valor: `${fmt(cilindro, 0)} ppm` }, { rotulo: 'Fluxo do cilindro', valor: `${fmt(fluxo, 2)} L/min` }, { rotulo: 'Fluxo total do ventilador', valor: `${fmt(fluxoTotal, 1)} L/min` }], formula: 'NO administrado (ppm) = NO do cilindro × (fluxo do cilindro ÷ fluxo total do ventilador)', referencia: 'Inhaled nitric oxide applications in paediatric practice', referenciaUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3232511/', interpretacao: { texto: 'O iNO exige protocolo institucional e monitorização de metahemoglobina, NO₂, toxicidade e resposta oxigenatória.', nivel: 'atencao' } }
    },
  },
]

const idsPediatricos = new Set(['cnaf-pediatrico', 'cnaf-faixa-etaria', 'volume-corrente-pediatrico', 'oxido-nitrico'])
const idsGerais = new Set(['constante-tempo', 'formula-winter', 'fio2-cateter'])

const idsRemovidos = new Set(['compensacao-gasometria', 'anion-gap', 'gasometria-oxigenacao', 'ino-concentracao', 'ino-fluxo', 'indice-oxigenacao'])

export const calculadoras: Calculadora[] = calculadorasBase.filter((calc) => !idsRemovidos.has(calc.id)).map((calc) => ({
  ...calc,
  populacao: idsPediatricos.has(calc.id) || calc.id === 'oxido-nitrico' ? 'Pediatria' : idsGerais.has(calc.id) ? 'Geral' : 'Adulto',
}))

export const grupos = ['Adulto', 'Pediatria', 'Geral'] as const

export const encontrarCalculadora = (id: string) => calculadoras.find((c) => c.id === id)
