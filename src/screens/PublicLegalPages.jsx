import React from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import './public-legal.css';

const privacySections = [
  ['Quem opera o Nexo', 'O Nexo Workspace é operado pela Focuss Dev para organizar clientes, projetos e a rotina da empresa. Para falar sobre privacidade ou solicitar acesso, correção ou exclusão de dados, escreva para contato@focussdev.art.'],
  ['Dados tratados', 'O workspace pode armazenar dados de conta, contatos de clientes, propostas, contratos, projetos, tarefas, cobranças, arquivos e conversas que o operador registrar. Ao conectar o Google, o Nexo solicita identidade básica e permissões para criar e manter eventos do Calendar, criar arquivos autorizados no Drive e enviar e-mails pelo Gmail. Recursos de Drive e Gmail podem ainda não estar habilitados no produto.'],
  ['Como usamos os dados', 'Usamos os dados para fornecer as funções do workspace e executar ações que o operador inicia. O Nexo não vende dados pessoais nem usa o conteúdo do Google para publicidade. O acesso a integrações externas depende de autorização explícita do operador.'],
  ['Serviços conectados', 'Quando habilitados, provedores como Google, Mercado Pago, WAHA, Resend e n8n recebem apenas os dados necessários para a ação solicitada. Cada provedor também trata dados segundo seus próprios termos e políticas. O Nexo não armazena números completos de cartão: pagamentos são processados pelo Mercado Pago.'],
  ['Armazenamento, segurança e retenção', 'Os registros do workspace ficam em banco de dados hospedado para a Focuss Dev. Tokens OAuth do Google são armazenados protegidos e podem ser revogados ao desconectar a conta. Mantemos dados enquanto forem necessários para a operação; o operador pode solicitar a exclusão pelo contato acima.'],
  ['Seus direitos e dados de terceiros', 'O operador é responsável por inserir dados de clientes com base legal adequada e por atender solicitações dos titulares. A Focuss Dev atende pedidos relativos aos dados do workspace pelo e-mail de contato. Transferências realizadas por provedores conectados seguem as configurações e políticas desses provedores.'],
];

const termsSections = [
  ['Uso autorizado', 'O Nexo Workspace é destinado à equipe autorizada da Focuss Dev. Mantenha as credenciais de acesso privadas, use dados de clientes de forma lícita e revise cada ação antes de enviar comunicações, publicar documentos ou emitir cobranças.'],
  ['Integrações e autorizações', 'Serviços como Google, Mercado Pago, WAHA, Resend e n8n dependem das contas, permissões, limites e disponibilidade de cada provedor. O operador autoriza cada conexão e deve desconectá-la quando não for mais necessária. A conexão de um provedor, por si só, não significa que todos os recursos relacionados estejam implementados ou ativos.'],
  ['Dados e conteúdo', 'A Focuss Dev mantém os direitos sobre o software Nexo. O operador mantém responsabilidade e os direitos sobre os dados e materiais que inserir. O operador deve possuir permissão para armazenar e compartilhar esses materiais e é responsável por conferir propostas, contratos, mensagens e valores antes de usá-los com clientes.'],
  ['Disponibilidade e suporte', 'O serviço depende da VPS e de fornecedores externos. Podem ocorrer interrupções para manutenção ou por falhas de terceiros. Para suporte, dúvidas ou encerramento de acesso, escreva para contato@focussdev.art.'],
  ['Alterações e encerramento', 'Estes termos podem ser atualizados conforme o produto evoluir. Alterações materiais serão indicadas nesta página. O acesso pode ser encerrado quando solicitado pelo operador ou quando necessário para proteger o workspace e seus usuários.'],
];

export default function PublicLegalPage({ type }) {
  const privacy = type === 'privacy';
  const title = privacy ? 'Política de Privacidade' : 'Termos de Uso';
  const sections = privacy ? privacySections : termsSections;
  return <main className="legal-page">
    <header className="legal-header"><a className="legal-brand" href="/"><span><ShieldCheck size={19} /></span><b>Nexo</b><small>WORKSPACE</small></a><a className="legal-back" href="/app/integracoes"><ArrowLeft size={15} />Voltar ao workspace</a></header>
    <article className="legal-document"><span className="legal-kicker">FOCUSS DEV · NEXO WORKSPACE</span><h1>{title}</h1><p className="legal-updated">Atualizado em 24 de setembro de 2026</p><p className="legal-intro">Esta página explica as condições aplicáveis ao Nexo Workspace e, na Política de Privacidade, como os dados são tratados quando o serviço é utilizado.</p>{sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}<footer>Contato: <a href="mailto:contato@focussdev.art">contato@focussdev.art</a></footer><nav className="legal-links"><a href="/privacy">Política de Privacidade</a><a href="/terms">Termos de Uso</a></nav></article>
  </main>;
}
