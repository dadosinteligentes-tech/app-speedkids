import type { BlogPostView, BlogSection } from "../../db/queries/blog";

/**
 * Seed articles used for initial migration and as fallback
 * when the blog_posts table doesn't exist yet.
 */
export const seedArticles: BlogPostView[] = [
	{
		id: 0,
		slug: "como-montar-parque-carrinhos-eletricos",
		title: "Como montar um parque de carrinhos elétricos lucrativo",
		description:
			"Guia completo para montar e operar um parque de carrinhos elétricos infantis: investimento, equipamentos, localização, gestão e dicas para maximizar o faturamento.",
		icon: "🏎️",
		cover_image_url: null,
		reading_time: "8 min de leitura",
		cta_text: "Teste grátis por 30 dias",
		cta_href: "/landing/#cadastro",
		published: 1,
		published_at: "2026-03-29",
		created_at: "2026-03-29",
		updated_at: "2026-03-29",
		sections: [
			{
				heading: "Por que investir em carrinhos elétricos infantis?",
				content: `<p>O mercado de entretenimento infantil no Brasil está em expansão acelerada. O setor de brinquedos cresceu 36% nos últimos 4 anos, atingindo R&nbsp;10,2 bilhões em 2024 (Abrinq). Com milhares de nascimentos por dia no país, o público consumidor se renova constantemente.</p>
<p>Parques de carrinhos elétricos são uma das formas mais acessíveis de entrar neste mercado. Com um investimento inicial relativamente baixo e margens saudáveis, é possível obter retorno em poucos meses — especialmente quando a operação é bem gerenciada.</p>`,
			},
			{
				heading: "Quanto custa montar um parque de carrinhos elétricos?",
				content: `<p>O investimento inicial varia conforme o tamanho da operação. Aqui está uma estimativa realista:</p>
<ul class="list-disc pl-6 space-y-2">
<li><strong>5 a 10 carrinhos elétricos:</strong> R$&nbsp;15.000 a R$&nbsp;50.000 (dependendo do modelo e fabricante)</li>
<li><strong>Baterias extras:</strong> R$&nbsp;500 a R$&nbsp;1.500 por bateria (recomenda-se 1 extra por carrinho)</li>
<li><strong>Piso e delimitação da pista:</strong> R$&nbsp;2.000 a R$&nbsp;10.000</li>
<li><strong>Caixa e equipamentos básicos:</strong> R$&nbsp;1.000 a R$&nbsp;3.000</li>
<li><strong>Capital de giro inicial:</strong> R$&nbsp;3.000 a R$&nbsp;5.000</li>
</ul>
<p class="mt-3"><strong>Total estimado:</strong> R$&nbsp;21.000 a R$&nbsp;69.000 para começar com 5 a 10 carrinhos.</p>
<p>Parques em shoppings ou espaços comerciais precisam considerar também o custo do aluguel e taxas de condomínio, que variam de R$&nbsp;3.000 a R$&nbsp;15.000/mês dependendo da localização.</p>`,
			},
			{
				heading: "Escolhendo a localização ideal",
				content: `<p>A localização é um dos fatores mais importantes para o sucesso do seu parque. Priorize:</p>
<ul class="list-disc pl-6 space-y-2">
<li><strong>Shoppings e centros comerciais:</strong> alto fluxo de famílias, especialmente aos finais de semana</li>
<li><strong>Praças e áreas de lazer:</strong> baixo custo, mas dependente do clima</li>
<li><strong>Restaurantes e buffets infantis:</strong> público cativo e alta recorrência</li>
<li><strong>Eventos e feiras:</strong> operação temporária com alto faturamento concentrado</li>
</ul>
<p class="mt-3">O ideal é que o local tenha alto tráfego de famílias com crianças de 2 a 10 anos. Observe o movimento em diferentes dias e horários antes de fechar contrato.</p>`,
			},
			{
				heading: "Equipamentos essenciais",
				content: `<p>Além dos carrinhos, você precisará de:</p>
<ul class="list-disc pl-6 space-y-2">
<li><strong>Carregadores de bateria:</strong> pelo menos 2 para cada 5 carrinhos</li>
<li><strong>Baterias sobressalentes:</strong> para não parar a operação durante a recarga (45 min a 2h)</li>
<li><strong>Cones e delimitadores:</strong> para criar a pista e garantir segurança</li>
<li><strong>Cronômetro ou sistema de controle:</strong> para gerenciar o tempo de cada locação</li>
<li><strong>Capacetes infantis:</strong> obrigatórios em muitos municípios</li>
</ul>
<p class="mt-3"><strong>Dica importante:</strong> o controle manual de tempo (cronômetro no celular) é a principal fonte de perda de receita. Cada criança fica em média 3 minutos além do tempo pago, e sem um sistema automatizado, esse tempo extra não é cobrado. Com 30 locações por dia a R$&nbsp;20 cada, isso representa mais de R$&nbsp;5.000/mês em receita perdida.</p>`,
			},
			{
				heading: "Quanto fatura um parque de carrinhos elétricos?",
				content: `<p>O faturamento depende do número de carrinhos, localização e preço praticado. Veja uma projeção conservadora:</p>
<ul class="list-disc pl-6 space-y-2">
<li><strong>Preço médio por giro:</strong> R$&nbsp;15 a R$&nbsp;30 (5 a 10 minutos)</li>
<li><strong>Locações por carrinho/dia:</strong> 8 a 15 em dias úteis, 15 a 30 nos finais de semana</li>
<li><strong>Faturamento mensal com 10 carrinhos:</strong> R$&nbsp;20.000 a R$&nbsp;60.000</li>
</ul>
<p class="mt-3">Considerando custos operacionais (aluguel, energia, funcionários, manutenção), a margem líquida costuma ficar entre 30% e 50%. O ponto de equilíbrio é geralmente alcançado entre o 2º e o 4º mês de operação.</p>`,
			},
			{
				heading: "Gestão profissional: o diferencial entre lucrar e sobreviver",
				content: `<p>A maioria dos parques que fecham no primeiro ano não falham por falta de clientes, mas por falta de gestão. Os erros mais comuns são:</p>
<ul class="list-disc pl-6 space-y-2">
<li>Não cobrar tempo extra (perda de 15-20% da receita)</li>
<li>Não controlar o nível das baterias (crianças paradas = pais insatisfeitos)</li>
<li>Não saber quais horários e brinquedos são mais rentáveis</li>
<li>Não ter controle de caixa por operador/turno</li>
</ul>
<p class="mt-3">Um sistema de gestão especializado resolve todos esses problemas. Com timer automático, cobrança de tempo extra, monitoramento de baterias e relatórios detalhados, você recupera receita perdida e toma decisões baseadas em dados reais — não em achismo.</p>`,
			},
			{
				heading: "Passo a passo para começar",
				content: `<ol class="list-decimal pl-6 space-y-2">
<li>Pesquise a demanda na sua região (observe parques existentes e o fluxo de famílias)</li>
<li>Defina o local e negocie o contrato (dê preferência a shoppings com cláusulas flexíveis)</li>
<li>Compre os carrinhos e equipamentos (comece com 5-8 e cresça conforme a demanda)</li>
<li>Contrate e treine 2-3 operadores (eles são a cara do seu negócio)</li>
<li>Configure um sistema de gestão para controlar tempo, caixa e baterias</li>
<li>Divulgue nas redes sociais e no próprio ponto de venda</li>
<li>Acompanhe os números e otimize a operação semanalmente</li>
</ol>`,
			},
		],
	},
	{
		id: 0,
		slug: "quanto-fatura-parque-infantil",
		title: "Quanto fatura um parque infantil? Números reais e como aumentar sua receita",
		description:
			"Descubra quanto fatura um parque infantil por mês, quais fatores influenciam o faturamento e estratégias comprovadas para aumentar a receita do seu negócio.",
		icon: "💰",
		cover_image_url: null,
		reading_time: "7 min de leitura",
		cta_text: "Teste grátis por 30 dias",
		cta_href: "/landing/#cadastro",
		published: 1,
		published_at: "2026-03-29",
		created_at: "2026-03-29",
		updated_at: "2026-03-29",
		sections: [
			{
				heading: "Faturamento médio de um parque infantil no Brasil",
				content: `<p>O faturamento de um parque infantil varia bastante conforme o tamanho da operação, localização e tipo de brinquedos. Aqui estão faixas realistas baseadas no mercado brasileiro:</p>
<ul class="list-disc pl-6 space-y-2">
<li><strong>Parque pequeno (5-10 brinquedos):</strong> R$&nbsp;10.000 a R$&nbsp;30.000/mês</li>
<li><strong>Parque médio (10-25 brinquedos):</strong> R$&nbsp;30.000 a R$&nbsp;80.000/mês</li>
<li><strong>Parque grande (25-50+ brinquedos):</strong> R$&nbsp;80.000 a R$&nbsp;200.000+/mês</li>
</ul>
<p class="mt-3">Esses valores consideram operação em shopping ou espaço comercial com bom fluxo. Parques em praças ou eventos sazonais podem ter variações significativas.</p>`,
			},
			{
				heading: "Fatores que influenciam o faturamento",
				content: `<p>Entender o que impacta diretamente a sua receita é fundamental para otimizá-la:</p>
<ul class="list-disc pl-6 space-y-2">
<li><strong>Localização:</strong> shoppings e centros comerciais com alto fluxo de famílias geram 2-3x mais que parques em praças</li>
<li><strong>Mix de brinquedos:</strong> carrinhos elétricos, infláveis, trampolins e jogos interativos atraem faixas etárias diferentes</li>
<li><strong>Preço por tempo:</strong> a precificação por minuto é mais rentável que preço fixo por giro</li>
<li><strong>Horário de funcionamento:</strong> parques que operam de 10h às 22h faturam até 40% mais que os que fecham às 18h</li>
<li><strong>Sazonalidade:</strong> férias escolares e datas comemorativas podem triplicar o faturamento mensal</li>
<li><strong>Programa de fidelidade:</strong> clientes recorrentes gastam em média 60% mais por visita</li>
</ul>`,
			},
			{
				heading: "A receita invisível: tempo extra não cobrado",
				content: `<p>O maior vilão do faturamento de parques infantis é o tempo extra não cobrado. Quando uma criança paga por 10 minutos de carrinho elétrico, ela fica em média 13 minutos — e esses 3 minutos extras raramente são cobrados em operações manuais.</p>
<p>Faça a conta:</p>
<ul class="list-disc pl-6 space-y-2">
<li>Preço: R$&nbsp;20 por 10 minutos</li>
<li>Tempo extra médio: 3 minutos (30% do tempo pago)</li>
<li>Perda por locação: R$&nbsp;6,00</li>
<li>30 locações/dia × R$&nbsp;6,00 = <strong>R$&nbsp;180/dia perdidos</strong></li>
<li>Em um mês: <strong>R$&nbsp;5.400 de receita não cobrada</strong></li>
</ul>
<p class="mt-3">Em um ano, isso representa mais de <strong>R$&nbsp;64.000</strong> em receita perdida — dinheiro que já foi "vendido" mas nunca entrou no caixa. Sistemas com timer automático e cobrança proporcional de tempo extra eliminam esse problema desde o primeiro dia.</p>`,
			},
			{
				heading: "Como aumentar o faturamento do seu parque",
				content: `<p>Estratégias comprovadas para aumentar a receita sem necessariamente aumentar custos:</p>
<ol class="list-decimal pl-6 space-y-2">
<li><strong>Cobre tempo extra automaticamente:</strong> um sistema com timer elimina a perda de 15-20% da receita</li>
<li><strong>Implemente um programa de fidelidade:</strong> pontos que acumulam automaticamente aumentam a frequência de visitas em até 40%</li>
<li><strong>Crie pacotes familiares:</strong> "2 crianças com 15% de desconto" incentiva grupos e aumenta o ticket médio</li>
<li><strong>Use dados para otimizar preços:</strong> horários de pico justificam preços diferenciados</li>
<li><strong>Defina metas para operadores:</strong> gamificação e comissão por vendas acima da meta aumentam a produtividade</li>
<li><strong>Monitore baterias em tempo real:</strong> brinquedo parado por bateria fraca é dinheiro perdido</li>
<li><strong>Analise relatórios semanalmente:</strong> entenda quais brinquedos dão mais lucro e quais só dão manutenção</li>
</ol>`,
			},
			{
				heading: "Custos operacionais típicos",
				content: `<p>Para calcular o lucro real, considere os custos operacionais mensais:</p>
<ul class="list-disc pl-6 space-y-2">
<li><strong>Aluguel:</strong> R$&nbsp;3.000 a R$&nbsp;15.000 (maior custo na maioria dos casos)</li>
<li><strong>Funcionários (2-5 operadores):</strong> R$&nbsp;4.000 a R$&nbsp;12.000</li>
<li><strong>Energia elétrica:</strong> R$&nbsp;500 a R$&nbsp;1.500</li>
<li><strong>Manutenção de brinquedos:</strong> R$&nbsp;500 a R$&nbsp;2.000</li>
<li><strong>Sistema de gestão:</strong> R$&nbsp;97 a R$&nbsp;297/mês</li>
<li><strong>Marketing local:</strong> R$&nbsp;500 a R$&nbsp;2.000</li>
</ul>
<p class="mt-3">A margem líquida de parques bem gerenciados fica entre <strong>30% e 50%</strong>. Um parque médio que fatura R$&nbsp;50.000/mês pode ter lucro líquido de R$&nbsp;15.000 a R$&nbsp;25.000.</p>`,
			},
			{
				heading: "Erros que reduzem o faturamento",
				content: `<p>Evite os erros mais comuns que drenam a receita de parques infantis:</p>
<ul class="list-disc pl-6 space-y-2">
<li><strong>Controle manual de tempo:</strong> cronômetro no celular gera perdas de milhares de reais por mês</li>
<li><strong>Não conhecer seus números:</strong> sem relatórios, você não sabe onde está perdendo dinheiro</li>
<li><strong>Ignorar horários de pico:</strong> não ter brinquedos suficientes (ou pessoal) nos momentos de maior demanda</li>
<li><strong>Baterias que acabam no meio do giro:</strong> crianças chorando = pais insatisfeitos = menos retorno</li>
<li><strong>Não investir em fidelização:</strong> captar um cliente novo custa 5x mais que manter um existente</li>
</ul>`,
			},
		],
	},
];
