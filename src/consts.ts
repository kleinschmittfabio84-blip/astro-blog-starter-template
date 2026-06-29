export const SITE_TITLE = "FabioAI - Assistente Pessoal";
export const SITE_DESCRIPTION = "Seu assistente de IA personalizado: monitora editais de concursos, organiza tarefas, envia notificações e fornece insights de negócios.";
export const OWNER_NAME = "Fabio";
export const OWNER_EMAIL = "kleinschmittfabio84@gmail.com";

export const MONITORED_SOURCES = [
  {
    id: "detran-sp",
    name: "Detran SP - Habilitação",
    url: "https://www.detran.sp.gov.br",
    state: "SP",
    category: "habilitacao",
    active: true,
  },
  {
    id: "detran-rj",
    name: "Detran RJ - Concursos",
    url: "https://www.detran.rj.gov.br",
    state: "RJ",
    category: "habilitacao",
    active: true,
  },
  {
    id: "detran-mg",
    name: "Detran MG - Editais",
    url: "https://www.detran.mg.gov.br",
    state: "MG",
    category: "habilitacao",
    active: false,
  },
  {
    id: "concursos-brasil",
    name: "Concursos no Brasil",
    url: "https://www.concursosnobrasil.com.br",
    state: "Nacional",
    category: "concursos",
    active: true,
  },
];

export const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/monitoramento", label: "Monitoramento", icon: "🔍" },
  { href: "/tarefas", label: "Tarefas", icon: "✅" },
  { href: "/insights", label: "Insights", icon: "📊" },
  { href: "/notificacoes", label: "Notificações", icon: "🔔" },
];
