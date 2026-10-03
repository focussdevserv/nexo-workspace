import React from "react";
import { Fragment } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, Clock3, Copy, Download, Ellipsis, FileCheck2, FileText, Filter, LifeBuoy, Mail, MessageCircle, MoreHorizontal, Phone, Plus, RefreshCw, Search, Send, ShieldCheck, SlidersHorizontal, Sparkles, Users, Wallet, X } from "lucide-react";
import "../screens/commercial.css";
import { apiRequest, fetchAllRecords, useWorkspaceRecords } from "../lib/workspace-api.js";
import { dateAfterDays } from "../lib/payment-due-date.js";
import { completeRequestedServiceCatalog, mergeRequestedServiceCatalog, requestedServiceCatalog } from "../data/service-catalog.js";
import { resolveProposalServices, summarizeProposalServices } from "../data/proposal-services.js";
import { buildServiceProject } from "../data/service-project-template.js";
import { belongsToClient, clientTicketPresentation } from "../data/client-link.js";
import { contractText, downloadContract, editableContractStatuses, isLockedContractStatus } from "../data/contract-document.js";
import { moveLeadById } from "../lib/pipeline-stage.js";
import { leadConversionPayload, leadFieldsBeforeConversion } from "../lib/lead-conversion-payload.js";
import { persistPipelineLeadDeal } from "../lib/pipeline-deal-save.js";
import { proposalDeletionBlockReason } from "../lib/proposal-deletion.js";
import { activeContractMonthlyRevenue } from "../lib/commercial-contract-revenue.js";
import { commercialStatusPatch } from "../lib/commercial-status-patch.js";
import { commercialServicePayload } from "../lib/commercial-service-payload.js";
import { commercialServicePricingInput, validateCommercialServicePricing } from "../lib/commercial-service-pricing.js";
import { parseCatalogPrice } from "../lib/catalog-price.js";
import { filterLeadsByPeriod } from "../lib/lead-period-filter.js";
import { summarizeClientServices } from "../lib/client-service-summary.js";
import { splitInstallmentAmounts } from "../lib/installment-plan.js";
import { clientMonthlyRevenue, clientMonthlyRevenueLabel, parseDisplayAmount, recurringMonthlyAmount } from "../lib/client-billing-summary.js";
import { downloadCsvFile, recordsToCsv } from "../lib/csv.js";
import { isLocalDemoActive } from "../lib/local-demo.js";
import { buildClientFinanceHistory, clientFinanceDateKey, clientFinanceDueDateLabel, clientFinanceEditPatch, clientFinanceFailedResources, clientFinanceFilterCounts, clientFinanceFilterForPage, clientFinanceLegacyClientValue, clientFinanceOpenBillingCount, isClientFinanceCancelled, isClientFinanceSettled, manualFinanceSettlementPatch, normalizeClientSubscriptionTerms, prepareClientContractTrackingPatch, prepareClientServiceChargeUpdate, safeClientFinanceExternalHref } from "../lib/client-finance.js";
import { clientContactActions } from "../lib/client-contact-actions.js";
import { removeClientContact } from "../lib/client-contact-records.js";
import { presentClientContact } from "../lib/client-contact-presentation.js";
import { archiveClientRecord, isArchivedClient, restoreClientRecord } from "../lib/client-archive.js";
import { clientFileRecordForUpload } from "../lib/client-file-link.js";
import { buildClientRelationshipHistory, clientRelationshipHistoryDateLabel } from "../lib/client-relationship-history.js";
import { buildCommercialRecordEditorPatch, companyContactCount, commercialRecordEditorDraft, commercialRecordEditorFields, commercialRecordEditorIsDirty } from "../lib/commercial-record-editor.js";
import { filterCommercialRecords } from "../lib/commercial-record-filter.js";
import { commercialStageTone } from "../lib/commercial-stage-tone.js";
import { averageProposalApprovalDays, countLeadsWithoutNextAction, formatElapsedDays } from "../lib/commercial-cycle-metrics.js";
import { buildLeadFollowUpTaskData, findOpenLeadFollowUpTask, isTerminalLeadStage } from "../lib/lead-follow-up-task.js";
import { isCommercialDateWithinNextDays } from "../lib/commercial-date.js";
import { confirmWorkspaceDelete, useWorkspacePreferences } from "../lib/workspace-preferences.js";
import { normalizeCommercialScreenRows } from "../lib/commercial-screen-data.js";
import { createCommercialSubmissionLock } from "../lib/commercial-submission-lock.js";
import { resolveLeadNavigation } from "../lib/lead-navigation-context.js";
import { resolveClientBillingCancellation } from "../lib/client-billing-cancellation.js";
import { clientProfileSelectionKey } from "../lib/client-profile-selection.js";
const datasets = {
  leads: [],
  clients: [],
  companies: [],
  contacts: [],
  proposals: [],
  services: [],
  contracts: [],
  projects: [],
  tasks: []
};
const config = {
  crm: {
    title: "CRM",
    eyebrow: "VISÃO COMERCIAL",
    description: "Acompanhe suas oportunidades e relacionamentos em um só lugar.",
    tab: "Visão geral",
    icon: Users
  },
  leads: {
    title: "Leads",
    eyebrow: "COMERCIAL / CRM",
    description: "Organize os novos contatos e acompanhe cada oportunidade.",
    tab: "Leads",
    icon: Users
  },
  clientes: {
    title: "Clientes",
    eyebrow: "COMERCIAL / RELACIONAMENTO",
    description: "Seus relacionamentos ativos e o valor que constroem juntos.",
    tab: "Clientes",
    icon: Building2
  },
  empresas: {
    title: "Empresas",
    eyebrow: "COMERCIAL / CADASTROS",
    description: "Empresas e organizações da sua carteira comercial.",
    tab: "Empresas",
    icon: Building2
  },
  contatos: {
    title: "Contatos",
    eyebrow: "COMERCIAL / CADASTROS",
    description: "Pessoas e decisores ligados às suas oportunidades e clientes.",
    tab: "Contatos",
    icon: Users
  },
  pipeline: {
    title: "Pipeline",
    eyebrow: "COMERCIAL / OPORTUNIDADES",
    description: "Veja o avanço das oportunidades em cada etapa comercial.",
    tab: "Pipeline",
    icon: ArrowUpRight
  },
  propostas: {
    title: "Propostas",
    eyebrow: "COMERCIAL / NEGOCIAÇÃO",
    description: "Acompanhe propostas enviadas, aprovações e próximos passos.",
    tab: "Propostas",
    icon: FileText
  },
  servicos: {
    title: "Serviços",
    eyebrow: "COMERCIAL / PORTFÓLIO",
    description: "Apresente seu catálogo de serviços e condições comerciais.",
    tab: "Serviços",
    icon: Sparkles
  },
  contratos: {
    title: "Contratos",
    eyebrow: "COMERCIAL / CLIENTES",
    description: "Acompanhe contratos ativos, entregas e datas de renovação.",
    tab: "Contratos",
    icon: FileCheck2
  }
};
const normalizePage = page => String(page || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const titleFor = page => config[normalizePage(page)] || config.crm;
const dataAliases = {
  clientes: "clients",
  empresas: "companies",
  contatos: "contacts",
  propostas: "proposals",
  servicos: "services",
  contratos: "contracts"
};
const dataFor = page => datasets[dataAliases[normalizePage(page)] || normalizePage(page)] || datasets.leads;
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});
const formatLeadAmount = value => {
  const raw = String(value ?? "").trim();
  return /\d/.test(raw) ? brl.format(parseDisplayAmount(value)) : raw || "A definir";
};
function serviceFrequencyLabel(value) {
  const [unit, rawInterval] = String(value || "").split(":");
  const interval = Number(rawInterval) || 1;
  if (unit === "days") return interval === 1 ? "diária" : interval === 7 ? "semanal" : `a cada ${interval} dias`;
  if (unit === "months") return {
    1: "mensal",
    3: "trimestral",
    6: "semestral",
    12: "anual"
  }[interval] || `a cada ${interval} meses`;
  return "a definir";
}
function useCommercialRecords() {
  const leads = useWorkspaceRecords("leads");
  const clients = useWorkspaceRecords("clients");
  const companies = useWorkspaceRecords("companies");
  const contacts = useWorkspaceRecords("contacts");
  const proposals = useWorkspaceRecords("proposals");
  const services = useWorkspaceRecords("services");
  const contracts = useWorkspaceRecords("contracts");
  const projects = useWorkspaceRecords("projects");
  const tasks = useWorkspaceRecords("tasks");
  const stores = {
    leads,
    clients,
    companies,
    contacts,
    services,
    contracts,
    projects,
    tasks,
    proposals
  };
  const records = Object.fromEntries(Object.entries(stores).map(([key, value]) => [key, value.records]));
  const persist = async next => {
    try {
      for (const [key, store] of Object.entries(stores)) {
        const oldRows = store.records;
        const newRows = next[key] || [];
        const oldIds = new Set(oldRows.map(row => String(row.id)));
        const nextIds = new Set(newRows.map(row => String(row.id)));
        for (const row of newRows) {
          const before = oldRows.find(item => String(item.id) === String(row.id));
          const payload = Object.fromEntries(Object.entries(row).filter(([field]) => !["id", "createdAt", "updatedAt"].includes(field)));
          if (!before) await store.create(payload);else if (JSON.stringify(payload) !== JSON.stringify(Object.fromEntries(Object.entries(before).filter(([field]) => !["id", "createdAt", "updatedAt"].includes(field))))) await store.update(row.id, payload);
        }
        for (const row of oldRows) if (!nextIds.has(String(row.id)) && oldIds.has(String(row.id))) await store.remove(row.id);
      }
    } catch (error) {
      window.dispatchEvent(new CustomEvent("nexo:workspace-error", {
        detail: error.message
      }));
      throw error;
    }
  };
  const persistServices = async nextServices => {
    const oldRows = services.records;
    const oldIds = new Set(oldRows.map(row => String(row.id)));
    const nextIds = new Set(nextServices.map(row => String(row.id)));
    for (const row of nextServices) {
      const before = oldRows.find(item => String(item.id) === String(row.id));
      const payload = Object.fromEntries(Object.entries(row).filter(([field]) => !["id", "createdAt", "updatedAt"].includes(field)));
      if (!before) await services.create(payload);else if (JSON.stringify(payload) !== JSON.stringify(Object.fromEntries(Object.entries(before).filter(([field]) => !["id", "createdAt", "updatedAt"].includes(field))))) await services.update(row.id, payload);
    }
    for (const row of oldRows) if (!nextIds.has(String(row.id)) && oldIds.has(String(row.id))) await services.remove(row.id);
  };
  const refresh = async () => {
    await Promise.all(Object.values(stores).map(store => store.refresh()));
  };
  const errors = Object.fromEntries(Object.entries(stores).map(([key, store]) => [key, store.error]));
  const loadings = Object.fromEntries(Object.entries(stores).map(([key, store]) => [key, store.loading]));
  const refreshOne = key => stores[key]?.refresh();
  return [records, persist, refresh, services.loading, services.error, persistServices, Object.values(stores).some(store => store.loading), errors, refreshOne, loadings];
}
function Avatar({
  initials,
  tone = "blue",
  small = false
}) {
  return <span className={`com-avatar com-avatar-${tone}${small ? " com-avatar-small" : ""}`} aria-hidden="true">{initials}</span>;
}
function Badge({
  children,
  tone = "gray"
}) {
  return <span className={`com-badge com-badge-${tone}`}><i />{children}</span>;
}
function Feedback({
  message,
  onClose
}) {
  if (!message) return null;
  return <div className="com-feedback" role="status"><CheckCircle2 size={17} />{message}<button onClick={onClose} aria-label="Fechar mensagem"><X size={14} /></button></div>;
}
function ClientServiceBilling({
  services,
  draft,
  setDraft
}) {
  const [serviceSearch, setServiceSearch] = useState("");
  const [showAllServices, setShowAllServices] = useState(false);
  const ids = (draft.serviceIds || []).map(String);
  const charges = draft.serviceCharges || {};
  const filteredServices = services.filter(service => `${service.name || ""} ${service.catalogGroup || ""}`.toLocaleLowerCase("pt-BR").includes(serviceSearch.trim().toLocaleLowerCase("pt-BR")));
  const initialServices = services.slice(0, 8);
  const visibleServices = serviceSearch.trim() || showAllServices ? filteredServices : [...new Map([...initialServices, ...services.filter(service => ids.includes(String(service.id)))].map(service => [String(service.id), service])).values()];
  const priceNumber = value => {
    const raw = String(value || "").replace(/[^0-9,.]/g, "");
    const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
    return Number(normalized) || "";
  };
  const cadenceDefaults = service => {
    if (/mensal/i.test(service.cadence || "")) return {
      billingMode: "recurring",
      frequency: "months:1"
    };
    if (/anual/i.test(service.cadence || "")) return {
      billingMode: "recurring",
      frequency: "months:12"
    };
    if (/etapas|parcel/i.test(service.cadence || "")) return {
      billingMode: "installments",
      frequency: "months:1"
    };
    if (/projeto fechado|pagamento unico/i.test(service.cadence || "")) return {
      billingMode: "single",
      frequency: "months:1"
    };
    return {
      billingMode: "none",
      frequency: "months:1"
    };
  };
  const toggle = (service, checked) => {
    const id = String(service.id);
    const nextIds = checked ? [...new Set([...ids, id])] : ids.filter(item => item !== id);
    const nextCharges = {
      ...charges
    };
    if (checked && !nextCharges[id]) nextCharges[id] = {
      serviceId: service.id,
      service: service.name,
      amount: priceNumber(service.price),
      installments: 2,
      ...cadenceDefaults(service)
    };
    if (!checked) delete nextCharges[id];
    setDraft({
      ...draft,
      serviceIds: nextIds,
      serviceCharges: nextCharges
    });
  };
  const update = (service, field, value) => {
    const id = String(service.id);
    const current = charges[id] || {
      serviceId: service.id,
      service: service.name,
      amount: "",
      installments: 2,
      ...cadenceDefaults(service)
    };
    setDraft({
      ...draft,
      serviceCharges: {
        ...charges,
        [id]: {
          ...current,
          [field]: value
        }
      }
    });
  };
  return <Fragment><fieldset className="com-client-service-billing"><legend>Serviços e cobranças planejadas</legend><p>Escolha a condição de cada serviço. Salvar o cliente não emite cobranças.</p><label className="com-client-service-search"><Search size={14} /><input type="search" aria-label="Buscar serviço no catálogo" value={serviceSearch} onChange={event => setServiceSearch(event.target.value)} placeholder="Buscar serviço no catálogo" /></label>{ids.length > 0 && <small className="com-client-service-count">{ids.length} serviço{ids.length === 1 ? "" : "s"} selecionado{ids.length === 1 ? "" : "s"}</small>}<div className="com-client-service-options">{visibleServices.map(service => <label><input type="checkbox" checked={ids.includes(String(service.id))} onChange={event => toggle(service, event.target.checked)} /><span><b>{service.name}</b><small>{service.price || "Preço a definir"} / {service.cadence || "condição a definir"}</small></span></label>)}{!services.length && <small>Cadastre serviços no catálogo ou informe um serviço manual abaixo.</small>}{services.length > 0 && serviceSearch.trim() && !filteredServices.length && <small>Nenhum serviço encontrado. Ajuste a busca.</small>}</div>{!serviceSearch.trim() && services.length > 8 && <button type="button" className="com-client-service-expand" onClick={() => setShowAllServices(value => !value)}>{showAllServices ? "Mostrar menos" : `Ver catálogo completo (${services.length})`}</button>}{services.filter(service => ids.includes(String(service.id))).map(service => {
        const charge = charges[String(service.id)] || {
          billingMode: "none",
          amount: "",
          installments: 2,
          frequency: "months:1"
        };
        return <div className="com-client-service-charge"><b>{service.name}</b><label>Tipo de cobrança<select value={charge.billingMode} onChange={event => update(service, "billingMode", event.target.value)}><option value="none">Definir depois</option><option value="single">Valor único</option><option value="installments">Parcelado</option><option value="recurring">Recorrente</option></select></label>{charge.billingMode !== "none" && <Fragment><label>Valor total (R$)<input type="number" min="0.01" step="0.01" required={true} value={charge.amount} onChange={event => update(service, "amount", event.target.value)} /></label>{charge.billingMode === "installments" && <label>Parcelas<input type="number" min="2" max="24" required={true} value={charge.installments} onChange={event => update(service, "installments", Number(event.target.value))} /></label>}{charge.billingMode === "recurring" && <label>Frequência<select value={charge.frequency} onChange={event => update(service, "frequency", event.target.value)}><option value="days:7">Semanal</option><option value="months:1">Mensal</option><option value="months:3">Trimestral</option><option value="months:6">Semestral</option><option value="months:12">Anual</option></select></label>}</Fragment>}</div>;
      })}<label>Outros serviços<input value={draft.servicesText} onChange={event => setDraft({
          ...draft,
          servicesText: event.target.value
        })} placeholder="Serviço fora do catálogo, separado por vírgulas" /></label></fieldset></Fragment>;
}
export default function CommercialScreen({
  page,
  navigationContext = null,
  onNavigationContextConsumed = () => {}
}) {
  const localDemo = isLocalDemoActive();
  const preferences = useWorkspacePreferences();
  const externalPage = normalizePage(page || "crm");
  const [localPage, setLocalPage] = useState(externalPage);
  useEffect(() => setLocalPage(externalPage), [externalPage]);
  const current = titleFor(localPage);
  const key = localPage;
  const recordType = dataAliases[key] || key;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [extraFilters, setExtraFilters] = useState({});
  const [toast, setToast] = useState("");
  const [period, setPeriod] = useState("all");
  const [records, persistRecords, refreshRecords, servicesLoading, servicesError, persistServices, recordsLoading, recordErrors, refreshOneRecord, recordLoadings] = useCommercialRecords();
  const [relatedSubscriptions, setRelatedSubscriptions] = useState([]);
  useEffect(() => {
    if (key !== "clientes") {
      setRelatedSubscriptions([]);
      return void 0;
    }
    let mounted = true;
    apiRequest("/api/billing/subscriptions?limit=200").then(result => {
      if (mounted) setRelatedSubscriptions(Array.isArray(result.data) ? result.data : []);
    }).catch(() => {
      if (mounted) setRelatedSubscriptions([]);
    });
    return () => {
      mounted = false;
    };
  }, [key]);
  const [catalogSeedState, setCatalogSeedState] = useState("idle");
  const catalogSeedStarted = useRef(false);
  const [composer, setComposer] = useState(false);
  const [composerSaving, setComposerSaving] = useState(false);
  const composerSubmitLock = useRef(null);
  if (!composerSubmitLock.current) composerSubmitLock.current = createCommercialSubmissionLock();
  const [proposalServiceSearch, setProposalServiceSearch] = useState("");
  const [showAllProposalServices, setShowAllProposalServices] = useState(false);
  const emptyDraft = {
    title: "",
    client: "",
    clientId: "",
    companyId: "",
    email: "",
    phone: "",
    value: "",
    detail: "",
    description: "",
    cadence: "Projeto fechado",
    owner: "",
    nextAction: "",
    closeDate: "",
    stage: "Novo lead",
    serviceId: "",
    serviceIds: [],
    scope: "",
    deadline: "",
    paymentTerms: "50% na aprovação e 50% na entrega",
    clientType: "pf",
    legalName: "",
    document: "",
    companyDocument: "",
    website: "",
    address: "",
    source: "",
    city: "",
    size: "",
    servicesText: "",
    billingMode: "none",
    billingFrequency: "months:1",
    installments: "2",
    notes: ""
  };
  const [draft, setDraft] = useState(emptyDraft);
  const sourceRows = records[recordType];
  const data = useMemo(() => Array.isArray(sourceRows) ? normalizeCommercialScreenRows(recordType, sourceRows) : normalizeCommercialScreenRows(recordType, dataFor(localPage)), [sourceRows, recordType, localPage]);
  const displayRows = useMemo(() => ({
    leads: normalizeCommercialScreenRows("leads", records.leads || datasets.leads),
    clients: normalizeCommercialScreenRows("clients", records.clients || []),
    companies: normalizeCommercialScreenRows("companies", records.companies || []),
    contacts: normalizeCommercialScreenRows("contacts", records.contacts || []),
    proposals: normalizeCommercialScreenRows("proposals", records.proposals || []),
    services: normalizeCommercialScreenRows("services", records.services || []),
    contracts: normalizeCommercialScreenRows("contracts", records.contracts || []),
  }), [records.leads, records.clients, records.companies, records.contacts, records.proposals, records.services, records.contracts]);
  const activeStoreKey = ["crm", "pipeline"].includes(key) ? "leads" : recordType;
  const activeLoadError = recordErrors[activeStoreKey];
  const activeStoreLoading = recordLoadings[activeStoreKey];
  const activeRecordCount = (records[activeStoreKey] || []).length;
  const extraFilterFields = useMemo(() => [{
    key: "source",
    label: "Origem"
  }, {
    key: "owner",
    label: "Responsável"
  }, {
    key: "service",
    label: "Serviço"
  }, {
    key: "segment",
    label: "Segmento"
  }, {
    key: "city",
    label: "Cidade"
  }, {
    key: "status",
    label: "Status",
    read: item => item.status || item.stage
  }].flatMap(field => {
    const values = [...new Set(data.map(item => String(field.read ? field.read(item) || "" : item[field.key] || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return values.length > 1 ? [{
      ...field,
      values
    }] : [];
  }), [data]);
  const visible = useMemo(() => filterCommercialRecords(data, {
    search,
    filter,
    extraFilters,
    extraFilterFields,
  }), [data, search, filter, extraFilters, extraFilterFields]);
  const proposalServices = useMemo(() => {
    const term = proposalServiceSearch.trim().toLocaleLowerCase("pt-BR");
    const filtered = (records.services || []).filter(service => `${service.name || ""} ${service.catalogGroup || ""} ${service.category || ""}`.toLocaleLowerCase("pt-BR").includes(term));
    return {
      filtered,
      visible: term || showAllProposalServices ? filtered : filtered.slice(0, 8)
    };
  }, [records.services, proposalServiceSearch, showAllProposalServices]);
  const notify = message => {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(""), 3e3);
  };
  useEffect(() => {
    if (key !== "clientes" || !navigationContext?.search || recordsLoading) return;
    setSearch(String(navigationContext.search));
    onNavigationContextConsumed();
  }, [key, navigationContext?.intentId, navigationContext?.search, recordsLoading, onNavigationContextConsumed]);
  useEffect(() => {
    if (key !== "leads" || navigationContext?.quickCreate !== "lead" || !navigationContext?.intentId || recordsLoading) return;
    setDraft({ ...emptyDraft, stage: "Novo lead" });
    setComposer(true);
    onNavigationContextConsumed();
  }, [key, navigationContext?.intentId, navigationContext?.quickCreate, recordsLoading, onNavigationContextConsumed]);
  useEffect(() => {
    if (key !== "clientes" || !navigationContext?.clientId || recordsLoading) return;
    if (!data.some(item => String(item.id) === String(navigationContext.clientId))) {
      notify("Não encontrei este cliente na carteira disponível para sua conta.");
      onNavigationContextConsumed();
    }
  }, [key, navigationContext?.intentId, navigationContext?.clientId, data, recordsLoading, onNavigationContextConsumed]);
  useEffect(() => {
    if (key !== "propostas" || navigationContext?.action !== "create" || !navigationContext?.intentId || recordsLoading) return;
    const client = (records.clients || []).find(item => String(item.id) === String(navigationContext.clientId));
    if (!client) notify("Não encontrei este cliente para preencher a proposta.");else {
      setDraft({
        ...emptyDraft,
        title: `Proposta para ${client.name}`,
        client: client.name,
        clientId: String(client.id),
        email: client.email || navigationContext.clientEmail || ""
      });
      setProposalServiceSearch("");
      setShowAllProposalServices(false);
      setComposer(true);
    }
    onNavigationContextConsumed();
  }, [key, navigationContext?.intentId, navigationContext?.action, navigationContext?.clientId, navigationContext?.clientEmail, records.clients, recordsLoading, onNavigationContextConsumed]);
  const convertLead = async (lead, data2 = {}) => {
    try {
      const conversionData = leadConversionPayload(data2);
      const result = await apiRequest(`/api/workspace/leads/${encodeURIComponent(lead.id)}/convert`, {
        method: "POST",
        body: JSON.stringify({
          data: conversionData
        })
      });
      await refreshRecords();
      notify(result.data.existing ? "Oportunidade vinculada ao cliente existente." : "Oportunidade convertida em cliente.");
      return true;
    } catch (error) {
      notify(error.message || "Não foi possível converter esta oportunidade.");
      return false;
    }
  };
  const updateLead = async (lead, patch) => {
    if (patch.stage === "Fechado") {
      const editableFields = leadFieldsBeforeConversion(patch);
      try {
        if (Object.keys(editableFields).length) {
          await persistRecords({
            ...records,
            leads: (records.leads || []).map(item => String(item.id) === String(lead.id) ? {
              ...item,
              ...editableFields
            } : item)
          });
        }
        return convertLead(lead, editableFields);
      } catch (error) {
        notify(error.message || "Não foi possível salvar as alterações antes de converter o lead.");
        return false;
      }
    }
    try {
      await persistRecords({
        ...records,
        leads: (records.leads || []).map(item => String(item.id) === String(lead.id) ? {
          ...item,
          ...patch
        } : item)
      });
      notify("Oportunidade atualizada.");
      return true;
    } catch (error) {
      notify(error.message || "Não foi possível atualizar a oportunidade.");
      return false;
    }
  };
  const moveLead = async (lead, stage) => {
    if (stage === "Fechado") return convertLead(lead);
    try {
      await persistRecords({
        ...records,
        leads: moveLeadById(records.leads || [], lead.id, stage)
      });
      notify(`${lead.name} movido para ${stage}.`);
    } catch (error) {
      notify(error.message || "Não foi possível mover a oportunidade.");
    }
  };
  const createLabel = key === "servicos" ? "Novo serviço" : key === "clientes" ? "Adicionar cliente" : key === "empresas" ? "Nova empresa" : key === "contatos" ? "Novo contato" : key === "propostas" ? "Criar proposta" : key === "contratos" ? "Novo contrato" : key === "pipeline" ? "Nova oportunidade" : "Adicionar lead";
  const importCatalog = async () => {
    const currentServices = records.services || [];
    const additions = mergeRequestedServiceCatalog(currentServices, requestedServiceCatalog);
    const completedServices = completeRequestedServiceCatalog(currentServices, requestedServiceCatalog);
    const repaired = completedServices.filter((item, index) => JSON.stringify(item) !== JSON.stringify(currentServices[index]));
    if (!additions.length && !repaired.length) {
      setCatalogSeedState("ready");
      notify("Catálogo já completo.");
      return true;
    }
    setCatalogSeedState("loading");
    try {
      await persistServices([...additions, ...completedServices]);
      setCatalogSeedState("ready");
      notify(additions.length ? `${additions.length} itens cadastrados e ${repaired.length} modelos completados.` : `Modelos de proposta e contrato completados em ${repaired.length} serviços.`);
      return true;
    } catch (error) {
      setCatalogSeedState("error");
      notify(error.message || "Não foi possível completar o catálogo.");
      return false;
    }
  };
  const updateServiceRecord = async (record, patch) => {
    const next = {
      ...records,
      services: (records.services || datasets.services).map(item => String(item.id) === String(record.id) ? {
        ...item,
        ...patch
      } : item)
    };
    try {
      await persistRecords(next);
      notify("Serviço atualizado e sincronizado no workspace.");
      return true;
    } catch (error) {
      notify(error.message || "Não foi possível salvar o serviço. Tente novamente.");
      return false;
    }
  };
  const deleteServiceRecord = async record => {
    try {
      await persistRecords({
        ...records,
        services: (records.services || datasets.services).filter(item => String(item.id) !== String(record.id))
      });
      notify("Serviço removido do workspace.");
      return true;
    } catch (error) {
      notify(error.message || "Não foi possível excluir o serviço. Tente novamente.");
      return false;
    }
  };
  useEffect(() => {
    if (key !== "servicos" || servicesLoading || servicesError || catalogSeedStarted.current) return;
    const currentServices = records.services || [];
    const additions = mergeRequestedServiceCatalog(currentServices, requestedServiceCatalog);
    const completedServices = completeRequestedServiceCatalog(currentServices, requestedServiceCatalog);
    const repaired = completedServices.some((item, index) => JSON.stringify(item) !== JSON.stringify(currentServices[index]));
    if (!additions.length && !repaired) return;
    catalogSeedStarted.current = true;
    void importCatalog();
  }, [key, servicesLoading, servicesError, records.services]);
  const createRecord = async event => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    const title = draft.title.trim();
    const id = Date.now();
    const tone = ["blue", "green", "purple", "amber"][id % 4];
    const common = {
      id,
      name: title,
      title,
      initials: title.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(),
      tone
    };
    let entry;
    if (key === "leads" || key === "pipeline" || key === "crm") entry = {
      ...common,
      company: draft.client || "Empresa nao informada",
      email: draft.email.trim().toLowerCase(),
      phone: draft.phone.trim(),
      source: draft.source.trim() || "Manual",
      service: draft.detail.trim() || "A definir",
      value: draft.value ? `R$ ${draft.value}` : "A definir",
      stage: draft.stage || "Novo lead",
      date: "Agora",
      owner: draft.owner.trim(),
      nextAction: draft.nextAction.trim(),
      closeDate: draft.closeDate,
      notes: draft.notes.trim(),
      chance: 50
    };else if (key === "clientes") {
      const serviceCharges = Object.values(draft.serviceCharges || {}).map(charge => ({
        ...charge,
        amount: charge.billingMode === "none" ? null : Number(charge.amount) || 0,
        installments: charge.billingMode === "installments" ? Number(charge.installments) : null
      }));
      const catalogServices = serviceCharges.map(charge => charge.service);
      const services = [...new Set([...catalogServices, ...draft.servicesText.split(",").map(item => item.trim()).filter(Boolean)])];
      const cpf = ["pf", "both"].includes(draft.clientType) ? draft.legalName.trim() : "";
      const cnpj = draft.clientType === "pj" ? draft.document.trim() : draft.clientType === "both" ? draft.companyDocument.trim() : "";
      const monthlyRevenue = serviceCharges.reduce((sum, charge) => {
        if (charge.billingMode !== "recurring") return sum;
        const [unit, count] = String(charge.frequency || "months:1").split(":");
        return sum + charge.amount * (unit === "days" ? 30 / Number(count || 1) : 1 / Number(count || 1));
      }, 0);
      const plannedTotal = serviceCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
      entry = {
        ...common,
        person: draft.client.trim() || (draft.clientType === "pj" ? "Contato não informado" : title),
        clientType: draft.clientType,
        legalName: draft.clientType === "pf" ? "" : draft.clientType === "both" ? draft.document.trim() : draft.legalName.trim(),
        document: cpf || cnpj,
        cpf,
        cnpj,
        companyDocument: cnpj,
        serviceCharges,
        billingMode: "per_service",
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        website: draft.website.trim(),
        address: draft.address.trim(),
        source: draft.source.trim() || "Manual",
        segment: draft.detail.trim() || "A definir",
        services,
        notes: draft.notes.trim(),
        projects: "0 projetos",
        servicePrice: plannedTotal || null,
        plannedRevenueMonthly: monthlyRevenue,
        value: monthlyRevenue ? `${new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL"
        }).format(monthlyRevenue)} / mês` : plannedTotal ? `${new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL"
        }).format(plannedTotal)} em cobranças planejadas` : "A definir",
        status: "Ativo",
        since: "Cliente desde hoje"
      };
    } else if (key === "empresas") entry = {
      ...common,
      segment: draft.detail || "A definir",
      city: (draft.city || "").trim(),
      size: draft.size || "A definir",
      people: "1 contato",
      email: draft.email.trim().toLowerCase(),
      phone: draft.phone.trim(),
      website: draft.website.trim(),
      address: draft.address.trim(),
      notes: draft.notes.trim(),
      status: "Prospect"
    };else if (key === "contatos") entry = {
      ...common,
      role: draft.detail || "Contato",
      company: draft.client || "Empresa nao informada",
      companyId: draft.companyId || "",
      email: draft.email,
      phone: draft.phone,
      status: "Contato",
      last: "Sem contato registrado"
    };else if (key === "servicos") {
      const pricing = validateCommercialServicePricing(draft.value, "");
      if (pricing.error) {
        notify(pricing.error);
        return;
      }
      entry = commercialServicePayload({
        common,
        draft: { ...draft, value: pricing.price },
        tone
      });
    }else if (key === "propostas") {
      const linkedClient = (records.clients || []).find(client => String(client.id) === String(draft.clientId)) || (records.clients || []).find(client => client.name?.trim().toLocaleLowerCase("pt-BR") === draft.client.trim().toLocaleLowerCase("pt-BR"));
      if (!linkedClient) {
        notify("Vincule a proposta a um cliente cadastrado antes de salvar.");
        return;
      }
      const selectedServices = resolveProposalServices(records.services || [], draft.serviceIds, draft.serviceId);
      const serviceSummary = summarizeProposalServices(selectedServices);
      entry = {
        ...common,
        client: draft.client || "Cliente nao informado",
        clientId: linkedClient?.id,
        email: draft.email.trim().toLowerCase(),
        code: `PROP-${id.toString().slice(-6)}`,
        value: draft.value ? `R$ ${draft.value}` : "A definir",
        status: "Rascunho",
        tone: "gray",
        date: "Criada agora",
        scope: draft.scope || serviceSummary.proposalScope || draft.detail || "Escopo a detalhar",
        deadline: draft.deadline || "A definir",
        paymentTerms: draft.paymentTerms || "A combinar",
        service: serviceSummary.label || draft.detail || "Servico a definir",
        serviceId: selectedServices[0]?.id || "",
        serviceIds: selectedServices.map(service => service.id)
      };
    } else {
      const linkedClient = (records.clients || []).find(client => String(client.id) === String(draft.clientId));
      const serviceTemplate = (records.services || []).find(service => String(service.id) === String(draft.serviceId));
      const amountText = String(draft.value || "").replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", ".");
      const amount = Number(amountText);
      const scope = draft.scope.trim() || serviceTemplate?.contractTemplate || serviceTemplate?.proposalTemplate || serviceTemplate?.description || "";
      const deadline = draft.deadline.trim() || serviceTemplate?.duration || "";
      if (!linkedClient) {
        notify("Selecione um cliente cadastrado para criar o contrato.");
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        notify("Informe um valor valido para o contrato.");
        return;
      }
      if (!scope.trim()) {
        notify("Descreva o escopo ou selecione um servico com modelo.");
        return;
      }
      if (!deadline.trim()) {
        notify("Informe o prazo ou selecione um servico com prazo definido.");
        return;
      }
      entry = {
        ...common,
        client: linkedClient.name,
        clientId: linkedClient.id,
        email: linkedClient.email || "",
        code: `CTR-${id.toString().slice(-6)}`,
        value: amount.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL"
        }),
        status: "Rascunho",
        tone: "gray",
        renewal: "A definir",
        progress: 0,
        service: serviceTemplate?.name || draft.detail || "",
        serviceId: serviceTemplate?.id || "",
        scope,
        deadline,
        paymentTerms: draft.paymentTerms || "A combinar",
        signatureEvents: []
      };
      entry.documentText = contractText(entry);
    }
    const recordKey = ["crm", "pipeline"].includes(key) ? "leads" : recordType;
    if (!composerSubmitLock.current.acquire()) return;
    setComposerSaving(true);
    try {
      await persistRecords({
        ...records,
        [recordKey]: [entry, ...(records[recordKey] || [])]
      });
      setComposer(false);
      setDraft({
        ...emptyDraft
      });
      notify(`${createLabel.replace(/^(Novo |Adicionar |Criar )/, "")} salvo no workspace.`);
    } catch (error) {
      if (error.code === "duplicate_lead") {
        setComposer(false);
        setDraft({
          ...emptyDraft
        });
        setFilter("Todos");
        setSearch(draft.email.trim() || draft.phone.trim());
        notify("Lead ja cadastrado. Mostrando a oportunidade existente.");
        return;
      }
      notify(error.message || "Não foi possível salvar o registro.");
    } finally {
      composerSubmitLock.current.release();
      setComposerSaving(false);
    }
  };
  const sendProposal = async (proposal, to, idempotencyKey, provider = "resend") => {
    if (localDemo) throw new Error("Envio de propostas por e-mail fica desativado no modo de demonstração local.");
    const result = await apiRequest(`/api/workspace/proposals/${proposal.id}/send-email`, {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({
        to,
        provider
      })
    });
    await persistRecords({
      ...records,
      proposals: (records.proposals || []).map(item => item.id === proposal.id ? {
        ...item,
        email: to,
        status: "Enviada",
        tone: "blue",
        emailDelivery: {
          status: "sent",
          provider,
          recipient: to,
          emailId: result.data.emailId,
          sentAt: result.data.sentAt
        },
        date: `Enviada em ${new Date(result.data.sentAt).toLocaleDateString("pt-BR")}`
      } : item)
    });
    notify(`Proposta enviada para ${to}.`);
    return result;
  };
  const acceptProposal = async proposal => {
    const now = (new Date()).toISOString();
    const suffix = now.replace(/\D/g, "").slice(0, 8);
    const selectedServices = resolveProposalServices(records.services || datasets.services, proposal.serviceIds, proposal.serviceId);
    const serviceSummary = summarizeProposalServices(selectedServices);
    const serviceTemplate = selectedServices[0] || (records.services || datasets.services).find(item => String(item.name || "").toLocaleLowerCase("pt-BR") === String(proposal.service || "").toLocaleLowerCase("pt-BR"));
    const contract = {
      title: proposal.title,
      client: proposal.client,
      clientId: proposal.clientId,
      sourceProposalId: proposal.id,
      code: `CTR-${suffix}`,
      value: proposal.value,
      status: "Rascunho",
      tone: "gray",
      renewal: "Vigência a definir",
      progress: 0,
      scope: proposal.scope || serviceSummary.contractScope || serviceTemplate?.contractTemplate || proposal.service,
      service: serviceSummary.label || proposal.service,
      serviceId: serviceTemplate?.id || "",
      serviceIds: selectedServices.map(service => service.id),
      paymentTerms: proposal.paymentTerms || "A combinar",
      deadline: proposal.deadline || serviceTemplate?.duration || "A definir",
      signatureEvents: [],
      documentText: ""
    };
    contract.documentText = contractText(contract);
    const project = {
      id: Date.now(),
      name: proposal.title,
      client: proposal.client,
      clientId: proposal.clientId,
      sourceProposalId: proposal.id,
      type: serviceSummary.label || proposal.service || "Projeto comercial",
      services: serviceSummary.names,
      status: "Em andamento",
      progress: 0,
      due: proposal.deadline || serviceTemplate?.duration || "A definir",
      team: serviceSummary.responsible,
      tone: serviceTemplate?.color || "blue",
      scope: proposal.scope || serviceSummary.proposalScope || serviceTemplate?.description || ""
    };
    const template = serviceSummary.tasks.length ? serviceSummary.tasks : /site|landing|web/i.test(proposal.title) ? ["Reunir briefing e referências", "Definir arquitetura e conteúdo", "Criar primeira versão", "Revisão interna", "Apresentar para aprovação", "Publicar e validar"] : ["Alinhar escopo e objetivos", "Preparar primeira entrega", "Revisar internamente", "Enviar para aprovação do cliente", "Aplicar ajustes finais", "Entregar projeto"];
    const projectTasks = template.map((title, index) => ({
      id: project.id + index + 1,
      title,
      project: project.name,
      projectId: project.id,
      client: project.client,
      clientId: proposal.clientId,
      sourceProposalId: proposal.id,
      due: proposal.deadline || "A definir",
      assignee: serviceSummary.responsible.join(", "),
      status: "A fazer",
      priority: index === 0 ? "Alta" : "Normal"
    }));
    try {
      const result = await apiRequest(`/api/workspace/proposals/${encodeURIComponent(proposal.id)}/accept`, {
        method: "POST",
        body: JSON.stringify({
          contract,
          project,
          tasks: projectTasks
        })
      });
      await refreshRecords();
      notify(result.data?.idempotent ? "Esta proposta já tinha sido convertida em contrato e projeto." : `Proposta aceita; contrato em rascunho, projeto e ${projectTasks.length} tarefas criados juntos. Revise o contrato antes de enviar para assinatura.`);
      return true;
    } catch (error) {
      notify(error.message || "Não foi possível concluir a aprovação.");
      return false;
    }
  };
  const archiveClient = async client => {
    const wasArchived = isArchivedClient(client);
    const nextClient = wasArchived ? restoreClientRecord(client) : archiveClientRecord(client);
    try {
      await persistRecords({
        ...records,
        clients: (records.clients || []).map(item => String(item.id) === String(client.id) ? nextClient : item)
      });
      notify(wasArchived ? `${client.name} foi restaurado para a carteira.` : `${client.name} foi arquivado. O histórico e os vínculos foram preservados.`);
      return true;
    } catch (error) {
      notify(error.message || "Não foi possível arquivar o cliente.");
      return false;
    }
  };
  const updateCommercialRecord = async (record, patch) => {
    if (key === "leads") return updateLead(record, patch);
    const rowKey = String(record.id || record.title || record.name);
    const next = {
      ...records,
      [recordType]: (records[recordType] || []).map(item => String(item.id || item.title || item.name) === rowKey ? {
        ...item,
        ...patch
      } : item)
    };
    try {
      await persistRecords(next);
      notify("Registro atualizado.");
      return true;
    } catch (error) {
      notify(error.message || "Não foi possível salvar as alterações. Tente novamente.");
      return false;
    }
  };
  const deleteCommercialRecord = async record => {
    if (key === "propostas") {
      const blockReason = proposalDeletionBlockReason(record, {
        contracts: records.contracts || [],
        projects: records.projects || []
      });
      if (blockReason) {
        notify(blockReason);
        return false;
      }
    }
    if (!confirmWorkspaceDelete(`Excluir "${record.name || record.title}" do workspace?`, preferences)) return false;
    try {
      await persistRecords({
        ...records,
        [recordType]: (records[recordType] || []).filter(item => String(item.id || item.title || item.name) !== String(record.id || record.title || record.name))
      });
      notify("Registro removido.");
      return true;
    } catch (error) {
      notify(error.message || "Não foi possível excluir o registro. Tente novamente.");
      return false;
    }
  };
  return <main className="commercial-screen"><header className="com-page-heading"><div><div className="com-breadcrumb">FOCUSSHUB <ChevronRight size={13} /> COMERCIAL <ChevronRight size={13} /> {current.tab.toUpperCase()}</div><p className="com-eyebrow">{current.eyebrow}</p><h1>{current.title}</h1><p className="com-description">{current.description}</p></div><button className="com-primary" onClick={() => {
        setDraft({
          ...emptyDraft
        });
        setProposalServiceSearch("");
        setShowAllProposalServices(false);
        setComposer(true);
      }}><Plus size={17} />{createLabel}<ChevronDown size={14} /></button></header><nav className="com-tabs" aria-label="Módulos comerciais">{Object.entries(config).map(([id, item]) => <button className={id === key ? "active" : ""} aria-current={id === key ? "page" : void 0} key={id} onClick={() => {
        const dirtyEditor = document.querySelector('[data-commercial-editor-dirty="true"]');
        if (id !== key && dirtyEditor && !window.confirm("Há alterações não salvas. Descartar as alterações?")) return;
        setLocalPage(id);
        setSearch("");
        setFilter("Todos");
        setExtraFilters({});
      }}><item.icon size={14} />{item.tab}</button>)}</nav>{activeLoadError && activeRecordCount > 0 && <div className="com-load-error" role="alert"><span>Não foi possível atualizar todos os dados desta área: {activeLoadError}</span><button type="button" className="com-secondary" onClick={() => refreshOneRecord(activeStoreKey)}>Tentar novamente</button></div>}{activeStoreLoading && activeRecordCount === 0 ? <div className="com-data-state" role="status">Carregando {current.title.toLocaleLowerCase("pt-BR")}...</div> : activeLoadError && activeRecordCount === 0 ? <div className="com-data-state com-data-state-error" role="alert"><strong>Não foi possível carregar {current.title.toLocaleLowerCase("pt-BR")}.</strong><span>{activeLoadError}</span><button type="button" className="com-secondary" onClick={() => refreshOneRecord(activeStoreKey)}>Tentar novamente</button></div> : key === "crm" || key === "pipeline" ? <PipelineView items={displayRows.leads} onUpdate={updateLead} onMove={moveLead} onCreateLead={stage => {
      setDraft({
        ...emptyDraft,
        stage
      });
      setComposer(true);
    }} onSearch={setSearch} search={search} mode={key} period={period} setPeriod={setPeriod} localDemo={localDemo} /> : key === "servicos" ? <ServicesView items={visible} totalItems={records.services?.length || 0} clients={displayRows.clients} onCreateProject={async (project, tasks) => {
      await persistRecords({
        ...records,
        projects: [project, ...(records.projects || [])],
        tasks: [...tasks, ...(records.tasks || [])]
      });
        }} onAction={notify} onUpdate={updateServiceRecord} onDelete={deleteServiceRecord} onImportCatalog={importCatalog} catalogImporting={catalogSeedState === "loading" || servicesLoading} catalogSeedState={catalogSeedState} search={search} setSearch={setSearch} preferences={preferences} /> : <ListView page={key} items={visible} relatedProjects={records.projects || []} relatedSubscriptions={relatedSubscriptions} relatedContracts={displayRows.contracts} onArchive={archiveClient} openClientId={key === "clientes" ? navigationContext?.clientId : ""} onClientOpened={onNavigationContextConsumed} openLeadId={key === "leads" ? navigationContext?.leadId : ""} leadRecords={displayRows.leads} leadRecordsLoading={recordLoadings.leads} leadRecordsLoadError={recordErrors.leads} onLeadOpened={onNavigationContextConsumed} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} extraFilterFields={extraFilterFields} extraFilters={extraFilters} setExtraFilters={setExtraFilters} onAction={notify} onAccept={acceptProposal} onSendProposal={sendProposal} localDemo={localDemo} onRefreshRecords={refreshRecords} onUpdate={updateCommercialRecord} onDelete={deleteCommercialRecord} clients={displayRows.clients} companies={displayRows.companies} contacts={displayRows.contacts} services={displayRows.services} tasks={records.tasks || []} totalItems={data.length} preferences={preferences} />}{composer && <div className="com-modal-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) setComposer(false);
    }}><form className="com-create-modal" onSubmit={createRecord}><header><div><small>{current.eyebrow}</small><h2>{createLabel}</h2></div><button type="button" aria-label="Fechar" onClick={() => setComposer(false)}><X size={15} /></button></header>{key === "clientes" && <label>Tipo de cadastro<select value={draft.clientType} onChange={e => setDraft({
            ...draft,
            clientType: e.target.value
          })}><option value="pf">Pessoa física</option><option value="pj">Pessoa jurídica</option><option value="both">Pessoa física e jurídica</option></select></label>}<label>{key === "clientes" ? draft.clientType === "pj" ? "Nome fantasia ou nome da empresa" : "Nome completo" : ["leads", "clientes", "empresas", "contatos"].includes(key) ? "Nome" : key === "servicos" ? "Nome do serviço" : key === "propostas" ? "Título da proposta" : key === "contratos" ? "Título do contrato" : "Nome da oportunidade"}<input autoFocus={true} required={true} value={draft.title} onChange={e => setDraft({
            ...draft,
            title: e.target.value
          })} placeholder={key === "clientes" ? "Nome do cliente" : "Digite um nome"} /></label>{key === "clientes" && <Fragment><label>{draft.clientType === "pj" ? "Razão social" : "CPF"}<input value={draft.legalName} onChange={e => setDraft({
              ...draft,
              legalName: e.target.value
            })} placeholder={draft.clientType === "pj" ? "Razão social registrada" : "000.000.000-00"} /></label>{draft.clientType === "both" && <label>CNPJ<input value={draft.companyDocument || ""} onChange={e => setDraft({
              ...draft,
              companyDocument: e.target.value
            })} placeholder="00.000.000/0000-00" /></label>}{(draft.clientType === "pj" || draft.clientType === "both") && <label>{draft.clientType === "both" ? "Razão social" : "CNPJ"}<input value={draft.document} onChange={e => setDraft({
              ...draft,
              document: e.target.value
            })} placeholder={draft.clientType === "both" ? "Razão social registrada" : "00.000.000/0000-00"} /></label>}<label>{draft.clientType === "pj" ? "Pessoa de contato" : "Nome para contato"}<input value={draft.client} onChange={e => setDraft({
              ...draft,
              client: e.target.value
            })} placeholder="Contato principal" /></label><label>E-mail<input type="email" value={draft.email} onChange={e => setDraft({
              ...draft,
              email: e.target.value
            })} /></label><label>Telefone / WhatsApp<input value={draft.phone} onChange={e => setDraft({
              ...draft,
              phone: e.target.value
            })} /></label><label>Segmento<input value={draft.detail} onChange={e => setDraft({
              ...draft,
              detail: e.target.value
            })} placeholder="Ex.: consultoria, saúde, varejo" /></label><ClientServiceBilling services={records.services || []} draft={draft} setDraft={setDraft} /><label>Site<input type="url" value={draft.website} onChange={e => setDraft({
              ...draft,
              website: e.target.value
            })} placeholder="https://" /></label><label>Endereço<input value={draft.address} onChange={e => setDraft({
              ...draft,
              address: e.target.value
            })} /></label><label>Origem<input value={draft.source} onChange={e => setDraft({
              ...draft,
              source: e.target.value
            })} placeholder="Indicação, site, campanha..." /></label><label>Observações<textarea rows={3} value={draft.notes} onChange={e => setDraft({
              ...draft,
              notes: e.target.value
            })} /></label></Fragment>}{["propostas", "contratos"].includes(key) && <label>Vincular cliente cadastrado<select required={["contratos", "propostas"].includes(key)} value={draft.clientId} onChange={e => {
            const client = (records.clients || []).find(item => item.id === e.target.value);
            setDraft({
              ...draft,
              clientId: client?.id || "",
              client: client?.name || draft.client,
              email: client?.email || draft.email
            });
          }}><option value="">Selecione um cliente</option>{(records.clients || []).map(client => <option value={client.id}>{client.name}</option>)}</select></label>}{key !== "clientes" && ["leads", "contatos"].includes(key) && <label>{key === "contatos" ? "Empresa" : "Cliente / empresa"}<input value={draft.client} onChange={e => setDraft({
            ...draft,
            clientId: "",
            ...(key === "contatos" ? { companyId: "" } : {}),
            client: e.target.value
          })} /></label>}{key === "contatos" && <label>Vincular empresa (opcional)<select value={draft.companyId || ""} onChange={e => { const company = (records.companies || []).find(item => String(item.id) === e.target.value); setDraft(current => ({ ...current, companyId: company?.id || "", client: company?.name || current.client })); }}><option value="">Sem vínculo cadastrado</option>{(records.companies || []).map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}{key !== "clientes" && ["leads", "clientes", "contatos"].includes(key) && <label>E-mail<input type="email" value={draft.email} onChange={e => setDraft({
            ...draft,
            email: e.target.value
          })} /></label>}{key === "propostas" && <label>E-mail destinatario<input type="email" value={draft.email} onChange={e => setDraft({
            ...draft,
            email: e.target.value
          })} placeholder="cliente@empresa.com" /></label>}{["leads", "contatos"].includes(key) && <label>Telefone<input value={draft.phone} onChange={e => setDraft({
            ...draft,
            phone: e.target.value
          })} /></label>}{["leads", "pipeline", "crm"].includes(key) && <Fragment><label>Origem<select value={draft.source} onChange={e => setDraft({
              ...draft,
              source: e.target.value
            })}><option value="">Manual</option><option>Indicação</option><option>Site</option><option>WhatsApp</option><option>E-mail</option><option>Instagram</option><option>Campanha</option><option>Outro</option></select></label><label>Próxima ação<input value={draft.nextAction} onChange={e => setDraft({
              ...draft,
              nextAction: e.target.value
            })} placeholder="Ex.: ligar para apresentar a proposta" /></label><label>Responsável<input value={draft.owner} onChange={e => setDraft({
              ...draft,
              owner: e.target.value
            })} placeholder="Nome da pessoa responsável" /></label><label>Fechamento previsto<input type="date" value={draft.closeDate} onChange={e => setDraft({
              ...draft,
              closeDate: e.target.value
            })} /></label><label>Observações<textarea rows={3} value={draft.notes} onChange={e => setDraft({
              ...draft,
              notes: e.target.value
            })} /></label></Fragment>}{key === "servicos" && <Fragment><label>Descrição do serviço<textarea rows={3} value={draft.description} onChange={e => setDraft({
              ...draft,
              description: e.target.value
            })} placeholder="Explique o que está incluído na entrega" /></label><label>Modelo de cobrança<select value={draft.cadence} onChange={e => setDraft({
              ...draft,
              cadence: e.target.value
            })}><option>Projeto fechado</option><option>Pagamento por etapas</option><option>Mensal</option><option>Anual</option><option>Recorrência personalizada</option></select></label></Fragment>}{!["empresas", "contatos"].includes(key) && <label>{key === "servicos" ? "Preço base" : "Valor estimado"}<input required={key === "contratos"} value={draft.value} onChange={e => setDraft({
            ...draft,
            value: e.target.value
          })} placeholder="Ex.: 2500,00" /></label>}{["propostas", "contratos"].includes(key) && <Fragment><label>Escopo da proposta/contrato<textarea rows={3} required={key === "contratos"} value={draft.scope} onChange={e => setDraft({
              ...draft,
              scope: e.target.value
            })} placeholder="Entregaveis, paginas, integracoes e limites do trabalho" /></label><label>Prazo estimado<input required={key === "contratos"} value={draft.deadline} onChange={e => setDraft({
              ...draft,
              deadline: e.target.value
            })} placeholder="Ex.: 20 dias uteis" /></label><label>Condicoes de pagamento<select value={draft.paymentTerms} onChange={e => setDraft({
              ...draft,
              paymentTerms: e.target.value
            })}><option>50% na aprovacao e 50% na entrega</option><option>100% na aprovacao</option><option>Parcelado em 3 etapas</option><option>Mensal recorrente</option><option>A combinar</option></select></label></Fragment>}{key === "propostas" ? <fieldset className="com-service-picker"><legend>Serviços do catálogo</legend><small>Selecione um ou mais itens; o valor total continua editável. {proposalServices.filtered.length} encontrados{proposalServiceSearch.trim() ? "" : " · mostrando os primeiros 8"}.</small><label className="com-proposal-service-search"><Search size={15} /><input type="search" aria-label="Buscar serviço no catálogo" placeholder="Buscar por serviço ou categoria..." value={proposalServiceSearch} onChange={event => setProposalServiceSearch(event.target.value)} /></label>{draft.serviceIds?.length > 0 && <p className="com-proposal-selected-services">Selecionados: {resolveProposalServices(records.services || [], draft.serviceIds, draft.serviceId).map(service => service.name).join(", ")}</p>}{proposalServices.visible.map(item => {
            const selectedIds = draft.serviceIds?.length ? draft.serviceIds.map(String) : draft.serviceId ? [String(draft.serviceId)] : [];
            return <label><input type="checkbox" checked={selectedIds.includes(String(item.id))} onChange={event => {
                const ids = new Set(selectedIds);
                if (event.target.checked) ids.add(String(item.id));else ids.delete(String(item.id));
                const nextIds = [...ids];
                const names = (records.services || []).filter(service => ids.has(String(service.id))).map(service => service.name);
                setDraft({
                  ...draft,
                  serviceIds: nextIds,
                  serviceId: nextIds[0] || "",
                  detail: names.join(" + ")
                });
              }} /><span>{item.catalogGroup ? `${item.catalogGroup} · ` : ""}{item.name}<small>{item.price || "Preço a definir"}</small></span></label>;
          })}{(records.services || []).length > 0 && !proposalServices.filtered.length && <span>Nenhum serviço encontrado. Ajuste a busca.</span>}{!proposalServiceSearch.trim() && !showAllProposalServices && proposalServices.filtered.length > 8 && <button type="button" className="com-proposal-show-services" onClick={() => setShowAllProposalServices(true)}>Mostrar todos os {proposalServices.filtered.length} serviços</button>}{!(records.services || []).length && <span>Cadastre o catálogo antes de criar propostas com serviços.</span>}</fieldset> : key === "contratos" ? <label>Serviço do catálogo<select value={draft.serviceId} onChange={e => {
            const selectedService = (records.services || []).find(item => String(item.id) === e.target.value);
            const numericPrice = parseCatalogPrice(selectedService?.price);
            setDraft({
              ...draft,
              detail: selectedService?.name || "",
              serviceId: selectedService?.id || "",
              value: numericPrice ? String(numericPrice) : draft.value,
              scope: selectedService?.contractTemplate || selectedService?.proposalTemplate || selectedService?.description || draft.scope,
              deadline: selectedService?.duration || draft.deadline,
              paymentTerms: selectedService?.cadence === "Mensal" ? "Mensal recorrente" : draft.paymentTerms
            });
          }}><option value="">Selecione um serviço</option>{(records.services || []).map(item => <option value={item.id}>{item.catalogGroup ? `${item.catalogGroup} · ` : ""}{item.name}{item.price ? ` · ${item.price}` : " · preço a definir"}</option>)}</select></label> : <label>{key === "servicos" ? "Categoria" : key === "empresas" ? "Segmento" : key === "contatos" ? "Cargo" : "Serviço / observações"}<input value={draft.detail} onChange={e => setDraft({
            ...draft,
            detail: e.target.value
          })} /></label>}{key === "empresas" && <Fragment><label>Cidade<input value={draft.city || ""} onChange={e => setDraft({ ...draft, city: e.target.value })} /></label><label>Porte<select value={draft.size || ""} onChange={e => setDraft({ ...draft, size: e.target.value })}><option value="">Selecione o porte</option><option>1 pessoa</option><option>2 a 10 pessoas</option><option>11 a 50 pessoas</option><option>51 a 200 pessoas</option><option>Mais de 200 pessoas</option></select></label><label>E-mail<input type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} /></label><label>Telefone<input type="tel" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} /></label><label>Site<input type="url" value={draft.website} onChange={e => setDraft({ ...draft, website: e.target.value })} placeholder="https://" /></label><label>Endereco<input value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} /></label><label className="wide">Observacoes<textarea rows={3} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label></Fragment>}<footer><button type="button" className="com-secondary" disabled={composerSaving} onClick={() => setComposer(false)}>Cancelar</button><button type="submit" className="com-primary" disabled={composerSaving}><Check size={15} />{composerSaving ? "Salvando…" : "Salvar"}</button></footer></form></div>}<Feedback message={toast} onClose={() => setToast("")} /></main>;
}
function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "blue",
  trend
}) {
  return <article className="com-metric"><span className={`com-metric-icon ${tone}`}><Icon size={18} /></span><div className="com-metric-copy"><small>{label}</small><strong>{value}</strong><span className={trend?.startsWith("-") ? "down" : "up"}>{trend && (trend.startsWith("-") ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />)}{trend} <i>{detail}</i></span></div></article>;
}
function StatusControl({
  page,
  statusDraft,
  setStatusDraft,
  disabled = false
}) {
  const options = page === "leads" ? ["Novo lead", "Contato realizado", "Reunião agendada", "Diagnóstico", "Proposta enviada", "Negociação", "Fechado", "Perdido"] : page === "propostas" ? ["Rascunho", "Enviada", "Visualizada", "Em negociação", "Recusada", "Expirada"] : page === "contratos" ? editableContractStatuses : page === "empresas" ? ["Prospect", "Cliente", "Inativo"] : page === "contatos" ? ["Decisor", "Influenciador", "Contato"] : ["Ativo", "Em atenção", "Inativo"];
  const existingSigningState = page === "contratos" && isLockedContractStatus(statusDraft) && !options.includes(statusDraft);
  const existingApprovedProposalState = page === "propostas" && statusDraft === "Aprovada";
  return <label>Status / etapa<select disabled={disabled} value={statusDraft} onChange={event => setStatusDraft(event.target.value)}>{existingSigningState && <option value={statusDraft} disabled={true}>{statusDraft} · estado já registrado</option>}{existingApprovedProposalState && <option value={statusDraft} disabled={true}>Aprovada · convertida</option>}{options.map(option => <option>{option}</option>)}</select>{page === "contratos" && <small>Sem provedor de assinatura conectado, o Focusshub não permite marcar um contrato como assinado ou ativo.</small>}{existingApprovedProposalState && <small>A aprovação cria o contrato, o projeto e suas tarefas em conjunto; esse status não pode ser definido manualmente.</small>}</label>;
}
function Toolbar({
  search,
  setSearch,
  filter,
  setFilter,
  filters = ["Todos"],
  placeholder = "Buscar...",
  extraFilterFields = [],
  extraFilters = {},
  onExtraFilterChange = () => {}
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeExtraFilters = Object.values(extraFilters).filter(Boolean).length;
  return <div className="com-toolbar"><label className="com-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={placeholder} aria-label={placeholder} />{search && <button type="button" aria-label="Limpar busca" onClick={() => setSearch("")}><X size={15} /></button>}</label><label className="com-filter"><SlidersHorizontal size={15} /><select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filtrar resultados">{filters.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label><div className="com-more-filter-wrap"><button type="button" className={"com-icon-action " + (filtersOpen || activeExtraFilters ? "active" : "")} aria-label="Mais filtros" title="Mais filtros" aria-expanded={filtersOpen} aria-controls="commercial-extra-filters" onClick={() => setFiltersOpen(open => !open)}><Filter size={16} />{activeExtraFilters > 0 && <span>{activeExtraFilters}</span>}</button>{filtersOpen && <section className="com-extra-filters" id="commercial-extra-filters" aria-label="Filtros adicionais"><header><strong>Filtros adicionais</strong><button type="button" onClick={() => extraFilterFields.forEach(field => onExtraFilterChange(field.key, ""))}>Limpar</button></header>{extraFilterFields.length ? extraFilterFields.map(field => <label key={field.key}>{field.label}<select value={extraFilters[field.key] || ""} onChange={event => onExtraFilterChange(field.key, event.target.value)}><option value="">Todos</option>{field.values.map(value => <option key={value} value={value}>{value}</option>)}</select></label>) : <p>Não há filtros adicionais para os registros atuais.</p>}</section>}</div></div>;
}
function ClientFinancialRecord({
  item,
  resource,
  onUpdate,
  onDelete,
  deleting = false
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    description: item.description || "",
    amount: String(item.amount ?? ""),
    date: String(item.date || item.dueDate || "").slice(0, 10),
    status: item.status || "Pendente"
  });
  useEffect(() => setDraft({
    description: item.description || "",
    amount: String(item.amount ?? ""),
    date: String(item.date || item.dueDate || "").slice(0, 10),
    status: item.status || "Pendente"
  }), [item]);
  const expense = resource === "expenses";
  const paid = isClientFinanceSettled(item);
  const cancelled = isClientFinanceCancelled(item);
  const today = clientFinanceDateKey();
  const save = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const patch = clientFinanceEditPatch(item, resource, draft);
    try {
      const saved = await onUpdate(patch);
      if (saved !== false) setEditing(false);
    } finally {
      setSaving(false);
    }
  };
  if (editing) return <form className="com-client-finance-edit" onSubmit={save}><label>Descrição<input required={true} value={draft.description} onChange={event => setDraft({
        ...draft,
        description: event.target.value
      })} /></label><label>Valor (R$)<input required={true} type="number" min="0.01" step="0.01" value={draft.amount} onChange={event => setDraft({
        ...draft,
        amount: event.target.value
      })} /></label><label>Data<input required={true} type="date" value={draft.date || today} onChange={event => setDraft({
        ...draft,
        date: event.target.value
      })} /></label><label>Status<select value={draft.status} disabled={paid} onChange={event => setDraft({
        ...draft,
        status: event.target.value
      })}><option>{paid ? item.status : "Pendente"}</option>{!paid && <Fragment><option>{expense ? "Paga" : "Recebida"}</option><option>Cancelada</option></Fragment>}</select>{paid && <small>A baixa já foi registrada e não pode ser revertida por esta edição.</small>}</label><div className="com-client-finance-edit-actions"><button type="button" className="com-secondary" disabled={saving} onClick={() => setEditing(false)}>Cancelar</button><button className="com-primary" type="submit" disabled={saving}><Check size={14} />{saving ? "Salvando..." : "Salvar"}</button></div></form>;
  const settlement = manualFinanceSettlementPatch({
    ...item,
    resource
  });
  return <article className="com-client-row com-client-finance-record" aria-busy={deleting}><CircleDollarSign size={15} /><div><b>{item.description || (expense ? "Despesa" : "Receita")}</b><small>{item.category || "Ficha do cliente"} · {item.date || item.dueDate || "Sem data"}{item.settledAt && ` · baixa ${new Date(item.settledAt).toLocaleDateString("pt-BR")}`}</small></div><strong>{new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
      }).format(Number(item.amount) || 0)}</strong><Badge tone={paid ? "green" : cancelled ? "neutral" : "amber"}>{paid ? expense ? "Paga" : "Recebida" : cancelled ? "Cancelada" : item.status || "Pendente"}</Badge><div className="com-client-finance-row-actions"><button type="button" className="com-secondary" disabled={deleting} onClick={() => setEditing(true)}>Editar</button>{settlement && <button type="button" className="com-secondary" disabled={deleting} onClick={() => onUpdate(settlement)}>{expense ? "Dar baixa" : "Marcar recebida"}</button>}<button type="button" className="com-secondary com-delete-action" disabled={deleting} onClick={onDelete}>{deleting ? "Excluindo..." : "Excluir"}</button></div></article>;
}
function ClientPlannedChargeRecord({
  charge,
  index,
  charges,
  client,
  localDemo,
  onSaved,
  onAction,
  onOpenTab
}) {
  const frequencyParts = String(charge.frequency || "months:1").split(":");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    service: charge.service || "",
    billingMode: charge.billingMode || "none",
    amount: String(charge.amount ?? ""),
    installments: String(charge.installments || 2),
    frequencyUnit: frequencyParts[0] === "days" ? "days" : "months",
    frequencyInterval: String(Number(frequencyParts[1]) || 1)
  });
  useEffect(() => {
    const parts = String(charge.frequency || "months:1").split(":");
    setDraft({
      service: charge.service || "",
      billingMode: charge.billingMode || "none",
      amount: String(charge.amount ?? ""),
      installments: String(charge.installments || 2),
      frequencyUnit: parts[0] === "days" ? "days" : "months",
      frequencyInterval: String(Number(parts[1]) || 1)
    });
  }, [charge]);
  const save = async event => {
    event.preventDefault();
    if (saving) return;
    const prepared = prepareClientServiceChargeUpdate(charges, index, draft);
    if (prepared.error) {
      setError(prepared.error);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/workspace/clients/${encodeURIComponent(client.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          data: {
            serviceCharges: prepared.charges
          }
        })
      });
      onSaved(prepared.charges);
      setEditing(false);
      onAction(localDemo ? "Planejamento atualizado neste navegador." : "Planejamento de cobrança atualizado na ficha do cliente.");
    } catch (saveError) {
      setError(saveError.message || "Não foi possível atualizar este planejamento. Confira sua permissão de edição no CRM.");
    } finally {
      setSaving(false);
    }
  };
  if (editing) return <form className="com-client-planned-edit" onSubmit={save}><label>Serviço<input required={true} maxLength="180" value={draft.service} onChange={event => setDraft({
        ...draft,
        service: event.target.value
      })} /></label><label>Condição de cobrança<select value={draft.billingMode} onChange={event => setDraft({
        ...draft,
        billingMode: event.target.value
      })}><option value="none">A definir</option><option value="single">Única</option><option value="installments">Parcelada</option><option value="recurring">Recorrente</option></select></label>{draft.billingMode !== "none" && <label>Valor total (R$)<input required={true} type="number" min="0.01" max="1000000" step="0.01" value={draft.amount} onChange={event => setDraft({
        ...draft,
        amount: event.target.value
      })} /></label>}{draft.billingMode === "installments" && <label>Número de parcelas<input required={true} type="number" min={Math.max(2, Number(charge.generatedInstallments) || 2)} max="24" step="1" value={draft.installments} onChange={event => setDraft({
        ...draft,
        installments: event.target.value
      })} /><small>{Number(charge.generatedInstallments) || 0} já emitidas; esse progresso será preservado.</small></label>}{draft.billingMode === "recurring" && <Fragment><label>Intervalo<select value={draft.frequencyUnit} onChange={event => setDraft({
          ...draft,
          frequencyUnit: event.target.value
        })}><option value="months">Meses</option><option value="days">Dias</option></select></label><label>Repetir a cada<input required={true} type="number" min="1" max="24" step="1" value={draft.frequencyInterval} onChange={event => setDraft({
          ...draft,
          frequencyInterval: event.target.value
        })} /></label></Fragment>}{error && <p role="alert">{error}</p>}<div className="com-client-finance-edit-actions"><button type="button" className="com-secondary" disabled={saving} onClick={() => {
        setEditing(false);
        setError("");
      }}>Cancelar</button><button type="submit" className="com-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar planejamento"}</button></div></form>;
  return <article className="com-client-row com-client-planned-record"><CircleDollarSign size={15} /><div><b>{charge.service}</b><small>{charge.billingMode === "recurring" ? `Recorrência · ${serviceFrequencyLabel(charge.frequency)}` : charge.billingMode === "installments" ? `${charge.installments || 2} parcelas · total ${new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL"
        }).format(charge.amount || 0)}` : charge.billingMode === "single" ? "Valor único planejado" : "Cobrança a definir"}</small></div><strong>{charge.billingMode === "installments" ? `${Number(charge.generatedInstallments) || 0}/${charge.installments || 2} emitidas · próxima ${new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
      }).format(splitInstallmentAmounts(charge.amount, charge.installments || 2)[Number(charge.generatedInstallments) || 0] || 0)}` : charge.amount ? new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
      }).format(charge.amount) : "A definir"}</strong><Badge>Planejado</Badge><div className="com-client-finance-row-actions"><button type="button" className="com-secondary" onClick={() => setEditing(true)}>Editar planejamento</button>{charge.billingMode === "recurring" && <button type="button" className="com-secondary" onClick={() => onOpenTab("Assinaturas", {
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        description: charge.service,
        amount: charge.amount,
        frequency: frequencyParts[0] || "months",
        frequencyInterval: Number(frequencyParts[1]) || 1,
        action: "create",
        intentId: crypto.randomUUID()
      })}>Criar assinatura</button>}{["single", "installments"].includes(charge.billingMode) && <button type="button" className="com-secondary" disabled={charge.billingMode === "installments" && (Number(charge.generatedInstallments) || 0) >= (Number(charge.installments) || 2)} onClick={() => onOpenTab("Cobranças", {
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        description: charge.billingMode === "installments" ? `${charge.service} - parcela ${(Number(charge.generatedInstallments) || 0) + 1}/${charge.installments}` : charge.service,
        amount: charge.billingMode === "installments" ? splitInstallmentAmounts(charge.amount, charge.installments || 2)[Number(charge.generatedInstallments) || 0] : charge.amount,
        installmentServiceId: charge.billingMode === "installments" ? charge.serviceId : void 0,
        installmentIndex: Number(charge.generatedInstallments) || 0,
        installmentCount: charge.installments,
        action: "create",
        intentId: crypto.randomUUID()
      })}>{charge.billingMode === "installments" ? "Gerar próxima parcela" : "Gerar cobrança"}</button>}</div></article>;
}
function ClientContractRecord({
  item,
  onSaved,
  onAction
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    renewal: item.renewal || "",
    internalNote: item.internalNote || ""
  });
  useEffect(() => setDraft({
    renewal: item.renewal || "",
    internalNote: item.internalNote || ""
  }), [item]);
  const save = async event => {
    event.preventDefault();
    if (saving) return;
    const prepared = prepareClientContractTrackingPatch(draft);
    if (prepared.error) {
      setError(prepared.error);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await apiRequest(`/api/workspace/contracts/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          data: prepared.patch
        })
      });
      onSaved({
        ...item,
        ...(result.data || prepared.patch)
      });
      setEditing(false);
      onAction("Acompanhamento do contrato atualizado na ficha do cliente.");
    } catch (saveError) {
      setError(saveError.message || "Não foi possível atualizar o acompanhamento do contrato. Confira sua permissão de edição no CRM.");
    } finally {
      setSaving(false);
    }
  };
  if (editing) return <form className="com-client-contract-edit" onSubmit={save}><label>Vigência / renovação<input maxLength="120" value={draft.renewal} onChange={event => setDraft({
        ...draft,
        renewal: event.target.value
      })} placeholder="Ex.: Renovação em 31/12/2027" /></label><label>Nota interna<textarea rows="2" maxLength="2000" value={draft.internalNote} onChange={event => setDraft({
        ...draft,
        internalNote: event.target.value
      })} placeholder="Próxima revisão, responsável e contexto interno" /></label>{error && <p role="alert">{error}</p>}<div className="com-client-finance-edit-actions"><button type="button" className="com-secondary" disabled={saving} onClick={() => {
        setEditing(false);
        setError("");
      }}>Cancelar</button><button type="submit" className="com-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar acompanhamento"}</button></div></form>;
  return <article className="com-client-row com-client-contract-record"><FileCheck2 size={16} /><div><b>{item.title || item.name || "Contrato"}</b><small>{item.code || "Sem código"} · {item.renewal || "Vigência a definir"}{item.internalNote ? ` · ${item.internalNote}` : ""}</small></div><strong>{item.value || "Valor a definir"}</strong><Badge tone={item.tone}>{item.status || "Rascunho"}</Badge><div className="com-client-finance-row-actions"><button type="button" className="com-secondary" onClick={() => setEditing(true)}>Editar acompanhamento</button></div></article>;
}
function ClientSubscriptionRecord({
  item,
  onToggle,
  onCancel,
  busyId = ""
}) {
  const paused = ["paused", "Pausada"].includes(item.status);
  const cancelled = ["canceled", "cancelled", "Cancelada"].includes(item.status);
  const status = {
    authorized: "Ativa",
    pending: "Aguardando autorização",
    paused: "Pausada",
    canceled: "Cancelada",
    cancelled: "Cancelada",
    failed: "Falhou",
    expired: "Expirada"
  }[item.status] || item.status || "Sem status";
  const frequency = item.cycle || `${item.frequencyInterval || 1} ${item.frequency === "days" ? "dia(s)" : "mês(es)"}`;
  const due = item.nextDue || item.dueAt;
  const formattedDue = due && !Number.isNaN(new Date(due).getTime()) ? new Date(due).toLocaleDateString("pt-BR", {
    timeZone: "UTC"
  }) : "Data não informada";
  return <article className="com-client-row com-client-subscription-record"><RefreshCw size={15} /><div><b>{item.service || item.description || "Assinatura"}</b><small>{frequency} · próxima cobrança {formattedDue}</small></div><strong>{new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
      }).format(Number(item.amount) || 0)}</strong><Badge tone={cancelled ? "amber" : paused ? "amber" : "green"}>{status}</Badge>{!cancelled && <div className="com-client-finance-row-actions"><button type="button" className="com-secondary" disabled={busyId === String(item.id)} onClick={() => onToggle(item, paused ? "authorized" : "paused")}>{busyId === String(item.id) ? "Salvando..." : paused ? "Retomar" : "Pausar"}</button><button type="button" className="com-secondary com-delete-action" disabled={busyId === String(item.id)} onClick={() => onCancel(item)}>{busyId === String(item.id) ? "Salvando..." : "Cancelar assinatura"}</button></div>}</article>;
}
function ClientBillingRecord({
  item,
  onAction,
  onCancel,
  onRefresh,
  refreshing,
  cancelling,
  localDemo
}) {
  const labels = {
    pending: "Aguardando pagamento",
    creating: "Criando",
    processing: "Em processamento",
    paid: "Paga",
    overdue: "Vencida",
    failed: "Falhou",
    refunded: "Estornada",
    canceled: "Cancelada",
    cancelled: "Cancelada",
    expired: "Expirada"
  };
  const due = item.dueAt || item.due;
  const ticketHref = safeClientFinanceExternalHref(item.paymentDetails?.ticketUrl);
  const dueLabel = clientFinanceDueDateLabel(due) || "Vencimento n\u00e3o informado";
  const paid = item.status === "paid" || item.status === "Paga";
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(item.paymentDetails?.pixCode || "");
      onAction("Código Pix copiado.");
    } catch {
      onAction("Não foi possível copiar o código Pix neste navegador.");
    }
  };
  return <article className="com-client-row com-client-billing-record" aria-busy={refreshing || cancelling}><CircleDollarSign size={15} /><div><b>{item.description || "Cobrança"}</b><small>{item.method || item.paymentDetails?.paymentMethod || "Pagamento"} · {dueLabel}</small></div><strong>{new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
      }).format(Number(item.amount) || 0)}</strong><Badge tone={paid ? "green" : "amber"}>{labels[item.status] || item.status || "Sem status"}</Badge><div className="com-client-finance-row-actions">{(localDemo || item.mpOrderId) && <button type="button" className="com-secondary" disabled={refreshing || cancelling} onClick={() => onRefresh(item)}><RefreshCw size={13} />{refreshing ? "Consultando..." : "Consultar status"}</button>}{item.paymentDetails?.pixCode && <button type="button" className="com-secondary" disabled={refreshing || cancelling} onClick={copyCode}>Copiar Pix</button>}{ticketHref && <a className="com-secondary" href={ticketHref} target="_blank" rel="noopener noreferrer">Abrir boleto</a>}{item.status === "pending" && (localDemo || ["created", "action_required"].includes(item.paymentDetails?.status)) && <button type="button" className="com-secondary com-delete-action" disabled={refreshing || cancelling} onClick={() => onCancel(item)}>{cancelling ? "Cancelando..." : "Cancelar cobran\u00e7a"}</button>}{!paid && <small className="com-client-provider-note">O status é atualizado pelo provedor de pagamento.</small>}</div></article>;
}
function ClientProfileModal({
  client: initialClient,
  onClose,
  onUpdate,
  onArchive,
  onAction,
  preferences
}) {
  const localDemo = isLocalDemoActive();
  const fileUploadRef = useRef(null);
  const [client, setClient] = useState(initialClient);
  const [tab, setTab] = useState("Resumo");
  const [financeFilter, setFinanceFilter] = useState("all");
  const [note, setNote] = useState("");
  const [contacts, setContacts] = useState(Array.isArray(initialClient.contacts) ? initialClient.contacts.filter(person => person && typeof person === "object" && !Array.isArray(person)) : []);
  const [contactDraft, setContactDraft] = useState({
    name: "",
    role: "",
    email: "",
    phone: ""
  });
  const [related, setRelated] = useState({});
  const [relatedErrors, setRelatedErrors] = useState({});
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [financeRetrying, setFinanceRetrying] = useState(false);
  const [projectModal, setProjectModal] = useState(false);
  const [projectSaving, setProjectSaving] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [financeDialog, setFinanceDialog] = useState(false);
  const [financeSaving, setFinanceSaving] = useState(false);
  const [billingRefreshingId, setBillingRefreshingId] = useState("");
  const [billingCancelingId, setBillingCancelingId] = useState("");
  const billingCancelLock = useRef(new Set());
  const [subscriptionActionId, setSubscriptionActionId] = useState("");
  const [deletingFinanceKeys, setDeletingFinanceKeys] = useState(() => new Set());
  const financeDeleteLocks = useRef(new Set());
  const [financeDraft, setFinanceDraft] = useState({
    kind: "single",
    description: "",
    amount: "",
    payerEmail: initialClient.email || "",
    method: "pix",
    dueDate: dateAfterDays(7),
    frequency: "months",
    frequencyInterval: "1",
    startAt: "",
    endAt: ""
  });
  const [projectDraft, setProjectDraft] = useState({
    name: "",
    type: "Site institucional",
    due: "",
    detail: ""
  });
  const tabs = ["Resumo", "Serviços", "Projetos", "Financeiro", "Comunicação", "Arquivos", "Suporte", "Histórico"];
  useEffect(() => {
    let active = true;
    setRelatedLoading(true);
    const resources = ["projects", "tasks", "contracts", "inbox", "files", "tickets", "approvals", "events", "revenues", "expenses", "settings"];
    (async () => {
      const requests = [...resources.map(name => [name, `/api/workspace/${name}`]), ["billing", "/api/billing/orders"], ["subscriptions", "/api/billing/subscriptions"]];
      const entries = await Promise.all(requests.map(async ([name, path]) => {
        try {
          return [name, await fetchAllRecords(path), ""];
        } catch (error) {
          return [name, [], error.message || "Sem acesso a este recurso."];
        }
      }));
      if (active) {
        setRelated(Object.fromEntries(entries.map(([name, rows]) => [name, rows])));
        setRelatedErrors(Object.fromEntries(entries.filter(([,, error]) => error).map(([name,, error]) => [name, error])));
      }
    })().finally(() => {
      if (active) setRelatedLoading(false);
    });
    return () => {
      active = false;
    };
  }, [initialClient.id]);
  const clientDefaultDueDays = Math.min(30, Math.max(1, Number((related.settings || []).find(item => item.key === "workspace-preferences")?.settings?.billing?.defaultDueDays) || 7));
  const projects = (related.projects || []).filter(item => belongsToClient(item, client, item.client));
  const tasks = (related.tasks || []).filter(item => belongsToClient(item, client, item.client));
  const billing = (related.billing || []).filter(item => belongsToClient(item, client, item.clientName || item.client));
  const revenues = (related.revenues || []).filter(item => belongsToClient(item, client, clientFinanceLegacyClientValue("revenues", item)));
  const expenses = (related.expenses || []).filter(item => belongsToClient(item, client, clientFinanceLegacyClientValue("expenses", item)));
  const contracts = (related.contracts || []).filter(item => belongsToClient(item, client, item.client));
  const subscriptions = (related.subscriptions || []).filter(item => belongsToClient(item, client, item.clientName || item.client));
  const messages = (related.inbox || []).filter(item => belongsToClient(item, client, item.company));
  const files = (related.files || []).filter(item => belongsToClient(item, client, item.client));
  const tickets = (related.tickets || []).filter(item => belongsToClient(item, client, item.client));
  const approvals = (related.approvals || []).filter(item => belongsToClient(item, client, item.client));
  const activity = (related.events || []).filter(item => belongsToClient(item, client, item.client));
  const notes = Array.isArray(client.notes) ? client.notes : [];
  const contactActions = clientContactActions(client.email, client.phone);
  const openTab = (page, context = null) => {
    if (["Cobranças", "Assinaturas", "Receitas", "Despesas"].includes(page)) {
      setTab("Financeiro");
      setFinanceFilter(clientFinanceFilterForPage(page));
      if (context?.action === "create") {
        const kind = page === "Assinaturas" ? "recurring" : page === "Receitas" ? "revenue" : page === "Despesas" ? "expense" : "single";
        setFinanceDraft(current => ({
          ...current,
          kind,
          description: context.description || current.description,
          amount: context.amount ? String(context.amount) : current.amount,
          dueDate: context.dueDate || dateAfterDays(clientDefaultDueDays),
          frequency: context.frequency || current.frequency,
          frequencyInterval: String(context.frequencyInterval || current.frequencyInterval),
          payerEmail: context.clientEmail || client.email || current.payerEmail,
          startAt: context.startAt || current.startAt,
          endAt: context.endAt || current.endAt
        }));
        setFinanceDialog(true);
      }
      return;
    }
    onClose();
    window.dispatchEvent(new CustomEvent("nexo:navigate", {
      detail: {
        page,
        context: context || null
      }
    }));
  };
  const saveClientFinance = async event => {
    event.preventDefault();
    if (financeSaving) return;
    if (financeDraft.kind === "recurring" && financeDraft.startAt && financeDraft.endAt && financeDraft.endAt < financeDraft.startAt) {
      onAction("A data final da recorrência precisa ser igual ou posterior à data inicial.");
      return;
    }
    const recurringTerms = financeDraft.kind === "recurring"
      ? normalizeClientSubscriptionTerms(financeDraft.frequency, financeDraft.frequencyInterval)
      : null;
    if (recurringTerms?.error) {
      onAction(recurringTerms.error);
      return;
    }
    setFinanceSaving(true);
    try {
      const recurring = financeDraft.kind === "recurring";
      const financeRecord = ["revenue", "expense"].includes(financeDraft.kind);
      const endpoint = financeRecord ? `/api/workspace/${financeDraft.kind === "revenue" ? "revenues" : "expenses"}` : recurring ? "/api/billing/subscriptions" : "/api/billing/orders";
      const payload = financeRecord ? {
        data: {
          code: `${financeDraft.kind === "revenue" ? "REC" : "DES"}-${String(Date.now()).slice(-5)}`,
          description: financeDraft.description.trim(),
          counterparty: client.name,
          clientId: client.id,
          category: "Ficha do cliente",
          date: clientFinanceDateKey(),
          amount: Number(financeDraft.amount),
          status: "Pendente"
        }
      } : {
        clientName: client.name,
        payerEmail: financeDraft.payerEmail.trim().toLowerCase(),
        description: financeDraft.description.trim(),
        amount: Number(financeDraft.amount),
        workspaceClientId: client.id,
        ...(recurring ? {
          frequency: recurringTerms.frequency,
          frequencyInterval: recurringTerms.frequencyInterval,
          ...(financeDraft.startAt ? {
            startAt: (new Date(`${financeDraft.startAt}T00:00:00`)).toISOString()
          } : {}),
          ...(financeDraft.endAt ? {
            endAt: (new Date(`${financeDraft.endAt}T23:59:59`)).toISOString()
          } : {})
        } : {
          method: financeDraft.method,
          dueDate: financeDraft.dueDate
        })
      };
      const result = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const key = financeRecord ? financeDraft.kind === "revenue" ? "revenues" : "expenses" : recurring ? "subscriptions" : "billing";
      const record = financeRecord ? result.data : result.data;
      setRelated(current => ({
        ...current,
        [key]: [record, ...(current[key] || [])]
      }));
      setFinanceDialog(false);
      setFinanceDraft(current => ({
        ...current,
        description: "",
        amount: ""
      }));
      onAction(financeRecord ? "Movimentação registrada no financeiro deste cliente." : recurring ? "Assinatura criada para este cliente." : "Cobrança criada para este cliente.");
    } catch (error) {
      onAction(error.message || "Não foi possível registrar a movimentação. Confira os dados e a conexão do financeiro.");
    } finally {
      setFinanceSaving(false);
    }
  };
  const addClientFile = async file => {
    if (!file) return;
    if (!file.size || file.size > 8 * 1024 * 1024) {
      onAction("O arquivo precisa ter até 8 MiB.");
      return;
    }
    setFileUploading(true);
    try {
      let record;
      if (localDemo) {
        record = clientFileRecordForUpload(client, {
          id: globalThis.crypto?.randomUUID?.() || `demo-file-${Date.now()}`,
          name: file.name,
          mimeType: file.type,
          size: file.size
        }, {
          localOnly: true
        });
      } else {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
          reader.onload = () => resolve(String(reader.result || ""));
          reader.readAsDataURL(file);
        });
        const uploaded = await apiRequest("/api/integrations/google/drive/upload", {
          method: "POST",
          body: JSON.stringify({
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            data: dataUrl.slice(dataUrl.indexOf(",") + 1)
          })
        });
        record = clientFileRecordForUpload(client, {
          ...uploaded.data,
          size: uploaded.data.size || file.size,
          mimeType: uploaded.data.mimeType || file.type
        });
      }
      const saved = await apiRequest("/api/workspace/files", {
        method: "POST",
        body: JSON.stringify({
          data: record
        })
      });
      setRelated(current => ({
        ...current,
        files: [saved.data, ...(current.files || [])]
      }));
      onAction(localDemo ? "Registro do arquivo vinculado a este cliente neste navegador; o conteúdo não foi enviado." : `Arquivo enviado e vinculado a ${client.name}.`);
    } catch (error) {
      onAction(error.message || "Não foi possível adicionar o arquivo a este cliente.");
    } finally {
      setFileUploading(false);
      if (fileUploadRef.current) fileUploadRef.current.value = "";
    }
  };
  const createProject = async event => {
    event.preventDefault();
    if (!projectDraft.name.trim()) return;
    setProjectSaving(true);
    try {
      const result = await apiRequest("/api/workspace/projects", {
        method: "POST",
        body: JSON.stringify({
          data: {
            name: projectDraft.name.trim(),
            client: client.name,
            clientId: client.id,
            type: projectDraft.type,
            detail: projectDraft.detail.trim(),
            status: "Em andamento",
            progress: 0,
            due: projectDraft.due || "A definir",
            team: [],
            source: "Ficha do cliente"
          }
        })
      });
      setRelated(current => ({
        ...current,
        projects: [result.data, ...(current.projects || [])]
      }));
      setProjectDraft({
        name: "",
        type: "Site institucional",
        due: "",
        detail: ""
      });
      setProjectModal(false);
      setTab("Projetos");
      onAction(`Projeto criado para ${client.name}.`);
    } catch (error) {
      onAction(error.message || "Não foi possível criar o projeto no workspace.");
    } finally {
      setProjectSaving(false);
    }
  };
  const saveProfile = async event => {
    event.preventDefault();
    if (profileSaving) return;
    setProfileSaving(true);
    try {
      const saved = await onUpdate(client);
      if (saved === false) return;
      onAction(localDemo ? "Perfil salvo neste navegador." : "Perfil do cliente sincronizado no workspace.");
    } catch (error) {
      onAction(error.message || "Não foi possível salvar o perfil do cliente.");
    } finally {
      setProfileSaving(false);
    }
  };
  const addNote = async event => {
    event.preventDefault();
    if (!note.trim() || noteSaving) return;
    setNoteSaving(true);
    const next = [{
      text: note.trim(),
      at: (new Date()).toISOString()
    }, ...notes];
    const updated = {
      ...client,
      notes: next
    };
    try {
      const saved = await onUpdate(updated);
      if (saved === false) return;
      setClient(updated);
      setNote("");
      onAction("Nota adicionada ao histórico do cliente.");
    } catch (error) {
      onAction(error.message || "Não foi possível salvar a nota.");
    } finally {
      setNoteSaving(false);
    }
  };
  const financialHistory = buildClientFinanceHistory({
    billing,
    subscriptions,
    revenues,
    expenses
  });
  const relationshipHistory = buildClientRelationshipHistory({
    notes,
    events: activity,
    finance: financialHistory,
    projects,
    tasks,
    tickets,
    approvals,
    contracts,
    files,
  });
  const plannedCharges = client.serviceCharges || [];
  const financeFilterCounts = clientFinanceFilterCounts({
    contracts,
    subscriptions,
    billing,
    revenues,
    expenses,
    plannedCharges
  });
  const financeFailedResources = clientFinanceFailedResources(financeFilter, relatedErrors);
  const retryClientFinance = async () => {
    if (financeRetrying || !financeFailedResources.length) return;
    const paths = {
      billing: "/api/billing/orders",
      subscriptions: "/api/billing/subscriptions",
      contracts: "/api/workspace/contracts",
      revenues: "/api/workspace/revenues",
      expenses: "/api/workspace/expenses"
    };
    setFinanceRetrying(true);
    const results = await Promise.all(financeFailedResources.map(async resource => {
      try {
        return {
          resource,
          rows: await fetchAllRecords(paths[resource]),
          error: ""
        };
      } catch (error) {
        return {
          resource,
          rows: null,
          error: error.message || "Não foi possível carregar esta fonte."
        };
      }
    }));
    setRelated(current => results.reduce((next, result) => result.rows ? {
      ...next,
      [result.resource]: result.rows
    } : next, current));
    setRelatedErrors(current => {
      const next = {
        ...current
      };
      for (const result of results) {
        if (result.error) next[result.resource] = result.error;else delete next[result.resource];
      }
      return next;
    });
    setFinanceRetrying(false);
  };
  const liveFeed = [...activity.map(item => ({
    title: item.title || item.type || "Atividade registrada",
    detail: item.at ? new Date(item.at).toLocaleString("pt-BR") : "Histórico do workspace",
    kind: "Atividade"
  })), ...notes.map(item => ({
    title: item.text,
    detail: item.at ? new Date(item.at).toLocaleString("pt-BR") : "Nota adicionada",
    kind: "Nota"
  })), ...tasks.map(item => ({
    title: item.title,
    detail: `${item.project || "Tarefa"} · ${item.status || "Pendente"}`,
    kind: "Tarefa"
  })), ...billing.map(item => ({
    title: item.description || "Cobrança",
    detail: `${item.status || "Em aberto"} · vence ${item.dueAt || item.due || item.expirationAt || "a definir"}`,
    kind: "Financeiro"
  })), ...approvals.map(item => ({
    title: item.title,
    detail: `${item.status || "Aguardando"} · ${item.project || "Aprovação"}`,
    kind: "Aprovação"
  }))].slice(0, 8);
  const addContact = async event => {
    event.preventDefault();
    if (!contactDraft.name.trim() || contactSaving) return;
    setContactSaving(true);
    const next = [{
      ...contactDraft,
      id: Date.now()
    }, ...contacts];
    const updated = {
      ...client,
      contacts: next
    };
    try {
      const saved = await onUpdate(updated);
      if (saved === false) return;
      setContacts(next);
      setClient(updated);
      setContactDraft({
        name: "",
        role: "",
        email: "",
        phone: ""
      });
      onAction("Contato adicionado à ficha do cliente.");
    } catch (error) {
      onAction(error.message || "Não foi possível salvar o contato.");
    } finally {
      setContactSaving(false);
    }
  };
  const deleteContact = async person => {
    if (contactSaving || !confirmWorkspaceDelete(`Remover ${person.name} dos contatos de ${client.name}?`, preferences)) return;
    setContactSaving(true);
    try {
      const updated = removeClientContact(client, person);
      const saved = await onUpdate(updated);
      if (saved === false) return;
      setContacts(updated.contacts);
      setClient(updated);
      onAction("Contato removido da ficha do cliente.");
    } catch (error) {
      onAction(error.message || "Não foi possível remover este contato.");
    } finally {
      setContactSaving(false);
    }
  };
  const setField = (field, value) => setClient(current => ({
    ...current,
    [field]: value
  }));
  const updateManualFinance = async (resource, item, patch) => {
    try {
      const result = await apiRequest(`/api/workspace/${resource}/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          data: patch
        })
      });
      setRelated(current => ({
        ...current,
        [resource]: (current[resource] || []).map(row => row.id === item.id ? {
          ...row,
          ...(result.data || patch)
        } : row)
      }));
      onAction("Movimentação financeira atualizada.");
      return true;
    } catch (error) {
      onAction(error.message || "Não foi possível atualizar a movimentação.");
      return false;
    }
  };
  const deleteManualFinance = async (resource, item) => {
    const key = `${resource}:${String(item?.id ?? "")}`;
    if (!item?.id || financeDeleteLocks.current.has(key)) return;
    financeDeleteLocks.current.add(key);
    if (!confirmWorkspaceDelete(`Excluir o lançamento “${item.description || "sem descrição"}” do financeiro deste cliente? Esta ação não pode ser desfeita.`, preferences)) {
      financeDeleteLocks.current.delete(key);
      return;
    }
    setDeletingFinanceKeys(current => new Set(current).add(key));
    try {
      await apiRequest(`/api/workspace/${resource}/${item.id}`, { method: "DELETE" });
      setRelated(current => ({
        ...current,
        [resource]: (current[resource] || []).filter(row => String(row.id) !== String(item.id))
      }));
      onAction("Lançamento removido do financeiro do cliente.");
    } catch (error) {
      onAction(error.message || "Não foi possível excluir o lançamento.");
    } finally {
      financeDeleteLocks.current.delete(key);
      setDeletingFinanceKeys(current => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };
  const cancelClientBilling = async item => {
    const key = String(item?.id ?? "");
    if (!key || billingCancelLock.current.has(key)) return;
    if (!window.confirm("Cancelar a cobran\u00e7a de " + new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(Number(item.amount) || 0) + "? O cliente n\u00e3o poder\u00e1 mais pagar este pedido.")) return;
    billingCancelLock.current.add(key);
    setBillingCancelingId(key);
    try {
      const result = await apiRequest("/api/billing/orders/" + encodeURIComponent(item.id) + "/cancel", { method: "POST" });
      const resolution = resolveClientBillingCancellation(result, related.billing || [], item.id);
      if (resolution.error) throw new Error(resolution.error);
      setRelated(current => ({
        ...current,
        billing: resolution.rows
      }));
      onAction(localDemo ? "Cobran\u00e7a fict\u00edcia cancelada neste navegador." : "Cancelamento confirmado pelo Mercado Pago.");
    } catch (error) {
      onAction(error.message || "N\u00e3o foi poss\u00edvel confirmar o cancelamento da cobran\u00e7a.");
    } finally {
      billingCancelLock.current.delete(key);
      setBillingCancelingId("");
    }
  };
  const refreshClientBilling = async item => {
    setBillingRefreshingId(item.id);
    try {
      const result = await apiRequest(`/api/billing/orders/${encodeURIComponent(item.id)}/refresh`, {
        method: "POST"
      });
      if (result.data) setRelated(current => ({
        ...current,
        billing: (current.billing || []).map(row => row.id === item.id ? result.data : row)
      }));
      onAction(localDemo ? "Status demonstrativo atualizado." : result.changed ? "Status confirmado pelo Mercado Pago." : "A cobrança já estava atualizada.");
    } catch (error) {
      onAction(error.message || "Não foi possível consultar o status do Mercado Pago.");
    } finally {
      setBillingRefreshingId("");
    }
  };
  const changeClientSubscription = async (item, status) => {
    if (subscriptionActionId) return;
    if (status === "canceled" && !window.confirm(`Cancelar as próximas cobranças da assinatura de ${client.name}?`)) return;
    setSubscriptionActionId(String(item.id));
    try {
      const result = await apiRequest(`/api/billing/subscriptions/${encodeURIComponent(item.id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status
        })
      });
      setRelated(current => ({
        ...current,
        subscriptions: (current.subscriptions || []).map(row => row.id === item.id ? {
          ...row,
          ...(result.data || {}),
          status: result.data?.status || status
        } : row)
      }));
      onAction(status === "canceled" ? "Assinatura cancelada; cobranças futuras interrompidas." : status === "paused" ? "Assinatura pausada." : "Assinatura retomada.");
    } catch (error) {
      onAction(error.message || "Não foi possível atualizar a assinatura.");
    } finally {
      setSubscriptionActionId("");
    }
  };
  const archiveClient = async () => {
    if (!onArchive || archiveSaving) return;
    const archived = isArchivedClient(client);
    if (!window.confirm(archived ? `Restaurar ${client.name} para a carteira?` : `Arquivar ${client.name}? O registro e o histórico continuarão salvos e poderão ser restaurados.`)) return;
    setArchiveSaving(true);
    try {
      const archived = await onArchive(client);
      if (archived !== false) onClose();
    } catch (error) {
      onAction(error.message || "Não foi possível arquivar o cliente.");
    } finally {
      setArchiveSaving(false);
    }
  };
  return <div className="com-client-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}><section className="com-client-profile" role="dialog" aria-modal="true" aria-label={`Perfil de ${client.name}`}><header className="com-client-head"><div className="com-client-identity"><Avatar initials={client.initials} tone={client.tone} /><div><div className="com-client-title-line"><h2>{client.name}</h2><Badge tone={client.status === "Ativo" ? "green" : "amber"}>{isArchivedClient(client) ? "Arquivado" : client.status}</Badge></div><p>{client.segment || "Segmento não informado"} · {client.since || "Cliente cadastrado"}</p></div></div><div className="com-client-head-actions">{contactActions.emailHref ? <a href={contactActions.emailHref} className="com-secondary"><Mail size={14} />E-mail</a> : <button type="button" className="com-secondary com-client-contact-disabled" disabled={true} title="Cadastre um e-mail valido para este cliente."><Mail size={14} />E-mail</button>}{contactActions.whatsappHref ? <a href={contactActions.whatsappHref} target="_blank" rel="noreferrer" className="com-secondary"><Phone size={14} />WhatsApp</a> : <button type="button" className="com-secondary com-client-contact-disabled" disabled={true} title="Cadastre um telefone com codigo do pais para este cliente."><Phone size={14} />WhatsApp</button>}<button className="com-close-button" aria-label="Fechar perfil" onClick={onClose}><X size={17} /></button></div></header><div className="com-client-summary"><article><small>Receita mensal</small><b>{clientMonthlyRevenueLabel(client)}</b></article><article><small>Projetos ativos</small><b>{projects.filter(project => project.status !== "Concluído").length}</b></article><article><small>Cobranças abertas</small><b>{clientFinanceOpenBillingCount(billing)}</b></article><article><small>Último contato</small><b>{client.lastContact || messages[0]?.time || "Sem registro"}</b></article></div><nav className="com-client-tabs" aria-label="Seções da ficha do cliente">{tabs.map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav><div className="com-client-body"><div className="com-client-content">{tab === "Resumo" && <div className="com-client-overview"><form className="com-client-info" onSubmit={saveProfile}><div className="com-client-section-heading"><div><h3>{client.clientType === "pf" ? "Dados da pessoa" : client.clientType === "both" ? "Dados da pessoa e da empresa" : "Dados da empresa"}</h3><p>Identificação, contato e faturamento do cliente.</p></div><button type="submit" className="com-primary" disabled={profileSaving}><Check size={14} />{profileSaving ? "Salvando..." : "Salvar perfil"}</button></div><div className="com-client-fields"><label>{client.clientType === "pj" ? "Nome da empresa" : "Nome completo"}<input value={client.name || ""} onChange={e => setField("name", e.target.value)} /></label>{["pj", "both"].includes(client.clientType) && <label>Razão social<input value={client.legalName || ""} onChange={e => setField("legalName", e.target.value)} /></label>}{client.clientType !== "pj" && <label>CPF<input value={client.cpf || (client.clientType === "pf" ? client.document : "") || ""} onChange={e => {
                    setField("cpf", e.target.value);
                    if (client.clientType === "pf") setField("document", e.target.value);
                  }} /></label>}{["pj", "both"].includes(client.clientType) && <label>CNPJ<input value={client.cnpj || client.companyDocument || (client.clientType === "pj" ? client.document : "") || ""} onChange={e => {
                    setField("cnpj", e.target.value);
                    setField("companyDocument", e.target.value);
                    if (client.clientType === "pj") setField("document", e.target.value);
                  }} /></label>}<label>Nome para contato<input value={client.person || ""} onChange={e => setField("person", e.target.value)} /></label><label>E-mail<input type="email" value={client.email || ""} onChange={e => setField("email", e.target.value)} /></label><label>Telefone / WhatsApp<input value={client.phone || ""} onChange={e => setField("phone", e.target.value)} /></label><label>Segmento<input value={client.segment || ""} onChange={e => setField("segment", e.target.value)} /></label><label>Site<input value={client.website || ""} onChange={e => setField("website", e.target.value)} /></label><label>Endereço<input value={client.address || ""} onChange={e => setField("address", e.target.value)} /></label><label>Status<select value={client.status || "Ativo"} onChange={e => setField("status", e.target.value)}><option>Ativo</option><option>Em atenção</option><option>Inativo</option></select></label><label>Serviços contratados<input value={(client.services || []).join(", ")} onChange={e => setField("services", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} placeholder="Separe os serviços por vírgula" /></label><label>Observações<textarea value={client.notes || ""} onChange={e => setField("notes", e.target.value)} rows="3" /></label></div></form><section className="com-client-info"><div className="com-client-section-heading"><div><h3>Contatos</h3><p>Pessoas vinculadas à empresa.</p></div></div><article className="com-client-contact-card"><span className="com-client-contact-avatar">{(client.person || "C").split(/\s+/).map(x => x[0]).slice(0, 2).join("")}</span><div><b>{client.person || "Contato principal"}</b><small>Contato principal · {client.email || "E-mail não informado"}</small><small>{client.phone || "Telefone não informado"}</small></div>{contactActions.emailHref ? <a href={contactActions.emailHref} aria-label="Enviar e-mail"><Mail size={15} /></a> : <span className="com-client-contact-icon-disabled" aria-disabled="true" title="Cadastre um e-mail para habilitar o contato."><Mail size={15} /></span>}</article>{contacts.map((person, index) => { const display = presentClientContact(person, index); return <article key={display.key} className="com-client-contact-card"><span className="com-client-contact-avatar secondary">{display.initials}</span><div><b>{display.name}</b><small>{display.role} · {display.email || "E-mail não informado"}</small><small>{display.phone || "Telefone não informado"}</small></div><button type="button" className="com-client-contact-remove" aria-label={`Remover ${display.name}`} title="Remover contato" disabled={contactSaving} onClick={() => deleteContact(person)}><X size={14} /></button></article>; })}<form className="com-add-contact-form" onSubmit={addContact}><b>Adicionar contato</b><div className="com-client-fields"><input aria-label="Nome do contato" required={true} placeholder="Nome" value={contactDraft.name} onChange={e => setContactDraft({
                    ...contactDraft,
                    name: e.target.value
                  })} /><input aria-label="Cargo do contato" placeholder="Cargo" value={contactDraft.role} onChange={e => setContactDraft({
                    ...contactDraft,
                    role: e.target.value
                  })} /><input aria-label="E-mail do contato" type="email" placeholder="E-mail" value={contactDraft.email} onChange={e => setContactDraft({
                    ...contactDraft,
                    email: e.target.value
                  })} /><input aria-label="Telefone do contato" placeholder="Telefone" value={contactDraft.phone} onChange={e => setContactDraft({
                    ...contactDraft,
                    phone: e.target.value
                  })} /></div><button className="com-secondary" type="submit" disabled={contactSaving}><Plus size={13} />{contactSaving ? "Salvando..." : "Adicionar contato"}</button></form></section></div>}{tab === "Serviços" && <section className="com-client-info"><div className="com-client-section-heading"><div><h3>Serviços contratados</h3><p>Catálogo, recorrência e valores vinculados a esta conta.</p></div><button className="com-secondary" onClick={() => openTab("Serviços")}>Abrir catálogo <ArrowRight size={14} /></button></div>{summarizeClientServices(client).map((service, index) => <article key={service.serviceId ?? service.id ?? index} className="com-client-row"><span className="com-client-row-icon"><Sparkles size={16} /></span><div><b>{service.name}</b><small>{service.amount} · {service.cadence}</small></div>{service.billingMode !== "none" && service.amountToCharge > 0 && (service.billingMode !== "installments" || service.serviceId) && service.installmentIndex < service.installmentCount && <button type="button" className="com-secondary com-client-charge-action" onClick={() => {
                const [frequency, interval] = service.frequency.split(":");
                openTab(service.billingMode === "recurring" ? "Assinaturas" : "Cobranças", {
                  clientId: client.id,
                  clientName: client.name,
                  clientEmail: client.email,
                  description: service.name,
                  amount: service.amountToCharge,
                  frequency,
                  frequencyInterval: Number(interval) || 1,
                  ...(service.billingMode === "installments" ? {
                    installmentServiceId: service.serviceId,
                    installmentIndex: service.installmentIndex,
                    installmentCount: service.installmentCount
                  } : {}),
                  action: "create",
                  intentId: globalThis.crypto?.randomUUID?.() || `${client.id}-${Date.now()}`
                });
              }}>{service.billingMode === "recurring" ? "Criar assinatura" : service.billingMode === "installments" ? `Gerar parcela ${service.installmentIndex + 1}/${service.installmentCount}` : "Gerar cobrança"}</button>}</article>)}{!summarizeClientServices(client).length && <EmptyState noun="serviços" onClear={() => openTab("Serviços")} />}<div className="com-client-actions"><button className="com-primary" onClick={() => openTab("Propostas", {
                clientId: client.id,
                clientName: client.name,
                clientEmail: client.email,
                action: "create",
                intentId: String(client.id) + "-" + Date.now()
              })}><Plus size={14} />Criar proposta</button><button className="com-secondary" onClick={() => openTab("Contratos")}>Ver contratos</button></div></section>}{tab === "Projetos" && <section className="com-client-info"><div className="com-client-section-heading"><div><h3>Projetos e tarefas</h3><p>Entregas e pendências relacionadas a {client.name}.</p></div><button type="button" className="com-primary" onClick={() => setProjectModal(true)}><Plus size={14} />Novo projeto</button></div>{projects.map((project, index) => <article key={project.id ?? index} className="com-client-project"><div><b>{project.name}</b><small>{project.type || "Projeto"} · prazo {project.due || "a definir"}</small></div><Badge tone={project.status === "Concluído" ? "green" : "blue"}>{project.status}</Badge><div className="com-client-progress"><i style={{
                  width: `${project.progress || 0}%`
                }} /></div><small>{project.progress || 0}% concluído</small></article>)}{tasks.map((task, index) => <article key={task.id ?? index} className="com-client-row"><CheckCircle2 size={15} /><div><b>{task.title}</b><small>{task.project} · {task.assignee}</small></div><Badge tone={task.status === "Concluída" ? "green" : "amber"}>{task.status}</Badge></article>)}{!projects.length && !tasks.length && <EmptyState noun="projetos" onClear={() => setProjectModal(true)} />}</section>}{tab === "Financeiro" && <section className="com-client-info">{financeDialog && <form className="com-client-finance-dialog" onSubmit={saveClientFinance}><header><div><h3>{financeDraft.kind === "recurring" ? "Nova assinatura" : financeDraft.kind === "revenue" ? "Nova receita" : financeDraft.kind === "expense" ? "Nova despesa" : "Nova cobrança"}</h3><p>Registrada diretamente no financeiro de {client.name}.</p></div><button type="button" className="com-close-button" aria-label="Fechar" onClick={() => setFinanceDialog(false)}><X size={15} /></button></header><div className="com-client-fields"><label>Tipo de cobrança<select value={financeDraft.kind} onChange={event => setFinanceDraft({
                    ...financeDraft,
                    kind: event.target.value
                  })}><option value="single">Única</option><option value="recurring">Recorrente</option><option value="revenue">Receita</option><option value="expense">Despesa</option></select></label><label>Descrição<input required={true} minLength="2" value={financeDraft.description} onChange={event => setFinanceDraft({
                    ...financeDraft,
                    description: event.target.value
                  })} placeholder="Ex.: Desenvolvimento do site" /></label>{["single", "recurring"].includes(financeDraft.kind) && <label>E-mail do pagador<input required={true} type="email" value={financeDraft.payerEmail} onChange={event => setFinanceDraft({
                    ...financeDraft,
                    payerEmail: event.target.value
                  })} placeholder="cliente@empresa.com" /></label>}<label>Valor (R$)<input required={true} type="number" min="0.01" step="0.01" value={financeDraft.amount} onChange={event => setFinanceDraft({
                    ...financeDraft,
                    amount: event.target.value
                  })} /></label>{financeDraft.kind === "single" ? <Fragment><label>Meio de pagamento<select value={financeDraft.method} onChange={event => setFinanceDraft({
                      ...financeDraft,
                      method: event.target.value
                    })}><option value="pix">Pix</option><option value="boleto">Boleto</option></select></label><label>Vencimento<input type="date" required={true} min={dateAfterDays(1)} max={dateAfterDays(30)} value={financeDraft.dueDate} onChange={event => setFinanceDraft({
                      ...financeDraft,
                      dueDate: event.target.value
                    })} /><small>Entre amanhã e 30 dias; o Mercado Pago aplica o vencimento.</small></label></Fragment> : financeDraft.kind === "recurring" ? <Fragment><label>Recorrência<select value={financeDraft.frequency} onChange={event => setFinanceDraft({
                      ...financeDraft,
                      frequency: event.target.value,
                      frequencyInterval: event.target.value === "days" ? "7" : "1"
                    })}><option value="months">Meses</option><option value="days">Dias</option></select></label><label>Repetir a cada<input type="number" min="1" max="24" step="1" required={true} value={financeDraft.frequencyInterval} onChange={event => setFinanceDraft({
                      ...financeDraft,
                      frequencyInterval: event.target.value
                    })} /><small>{financeDraft.frequency === "days" ? "Use 7 para uma cobrança semanal." : "Use 1 para uma cobrança mensal."}</small></label><label>Data de início<input type="date" value={financeDraft.startAt} onChange={event => setFinanceDraft({
                      ...financeDraft,
                      startAt: event.target.value
                    })} /></label><label>Encerrar em (opcional)<input type="date" min={financeDraft.startAt || void 0} value={financeDraft.endAt} onChange={event => setFinanceDraft({
                      ...financeDraft,
                      endAt: event.target.value
                    })} /></label></Fragment> : financeDraft.kind === "single" ? <p className="com-client-finance-hint">Cobrança avulsa emitida agora. O vencimento será definido pelo meio de pagamento.</p> : null}</div><footer><button type="button" className="com-secondary" onClick={() => setFinanceDialog(false)}>Cancelar</button><button type="submit" className="com-primary" disabled={financeSaving}><Check size={14} />{financeSaving ? "Salvando..." : financeDraft.kind === "recurring" ? "Criar assinatura" : financeDraft.kind === "revenue" ? "Registrar receita" : financeDraft.kind === "expense" ? "Registrar despesa" : "Gerar cobrança"}</button></footer></form>}<div className="com-client-section-heading"><div><h3>Financeiro e contratos</h3><p>Cobranças, recorrências e vigência dos contratos.</p></div><button className="com-primary" onClick={() => openTab("Cobranças", {
                clientId: client.id,
                clientName: client.name,
                clientEmail: client.email,
                action: "create",
                intentId: crypto.randomUUID()
              })}><Plus size={14} />Nova cobrança</button></div><div className="com-client-finance-filter" role="group" aria-label="Filtrar financeiro do cliente">{[{
                key: "all",
                label: "Tudo"
              }, {
                key: "billing",
                label: "Cobranças"
              }, {
                key: "contracts",
                label: "Contratos"
              }, {
                key: "subscriptions",
                label: "Assinaturas"
              }, {
                key: "revenues",
                label: "Receitas"
              }, {
                key: "expenses",
                label: "Despesas"
              }].map(item => <button key={item.key} type="button" className={financeFilter === item.key ? "active" : ""} aria-pressed={financeFilter === item.key} onClick={() => setFinanceFilter(item.key)}>{item.label}<span>{financeFilterCounts[item.key] || 0}</span></button>)}</div><div className="com-client-finance-actions"><button className="com-secondary" onClick={() => openTab("Receitas", {
                clientId: client.id,
                clientName: client.name,
                action: "list",
                intentId: crypto.randomUUID()
              })}>Ver receitas</button><button className="com-secondary" onClick={() => openTab("Despesas", {
                clientId: client.id,
                clientName: client.name,
                action: "list",
                intentId: crypto.randomUUID()
              })}>Ver despesas</button><button className="com-secondary" onClick={() => openTab("Receitas", {
                clientId: client.id,
                clientName: client.name,
                clientEmail: client.email,
                action: "create",
                intentId: crypto.randomUUID()
              })}>Nova receita</button><button className="com-secondary" onClick={() => openTab("Despesas", {
                clientId: client.id,
                clientName: client.name,
                action: "create",
                intentId: crypto.randomUUID()
              })}>Nova despesa</button></div>{relatedLoading && <p role="status">Carregando movimentações financeiras...</p>}{financeFailedResources.length > 0 && <div role="alert" className="com-client-finance-load-error"><span>Falha ao carregar: {financeFailedResources.map(resource => ({
                  billing: "billing",
                  subscriptions: "subscriptions",
                  contracts: "contracts",
                  revenues: "revenues",
                  expenses: "expenses"
                })[resource]).join(", ")}. Os resultados podem estar incompletos.</span><button type="button" className="com-secondary" disabled={financeRetrying} onClick={retryClientFinance}>{financeRetrying ? "Tentando novamente..." : "Tentar novamente"}</button></div>}{plannedCharges.map((charge, index) => ({
              charge,
              index
            })).filter(({
              charge
            }) => financeFilter === "all" || (financeFilter === "subscriptions" ? charge.billingMode === "recurring" : financeFilter === "billing" && charge.billingMode !== "recurring")).map(({
              charge,
              index
            }) => <ClientPlannedChargeRecord key={charge.serviceId ?? charge.id ?? index} charge={charge} index={index} charges={plannedCharges} client={client} localDemo={localDemo} onSaved={nextCharges => setClient(current => ({
              ...current,
              serviceCharges: nextCharges
            }))} onAction={onAction} onOpenTab={openTab} />)}{["all", "contracts"].includes(financeFilter) && contracts.map((contract, index) => <ClientContractRecord key={contract.id ?? index} item={contract} onSaved={updated => setRelated(current => ({
              ...current,
              contracts: (current.contracts || []).map(row => row.id === updated.id ? updated : row)
            }))} onAction={onAction} />)}{["all", "subscriptions"].includes(financeFilter) && subscriptions.map((subscription, index) => <ClientSubscriptionRecord key={subscription.id ?? index} item={subscription} busyId={subscriptionActionId} onToggle={changeClientSubscription} onCancel={item => changeClientSubscription(item, "canceled")} />)}{["all", "billing"].includes(financeFilter) && billing.map((bill, index) => <ClientBillingRecord key={bill.id ?? index} item={bill} onAction={onAction} onCancel={cancelClientBilling} onRefresh={refreshClientBilling} refreshing={String(billingRefreshingId) === String(bill.id)} cancelling={String(billingCancelingId) === String(bill.id)} localDemo={localDemo} />)}{["all", "revenues"].includes(financeFilter) && revenues.map((item, index) => <ClientFinancialRecord key={item.id ?? index} item={item} resource="revenues" onUpdate={patch => updateManualFinance("revenues", item, patch)} onDelete={() => deleteManualFinance("revenues", item)} deleting={deletingFinanceKeys.has(`revenues:${String(item.id ?? "")}`)} />)}{["all", "expenses"].includes(financeFilter) && expenses.map((item, index) => <ClientFinancialRecord key={item.id ?? index} item={item} resource="expenses" onUpdate={patch => updateManualFinance("expenses", item, patch)} onDelete={() => deleteManualFinance("expenses", item)} deleting={deletingFinanceKeys.has(`expenses:${String(item.id ?? "")}`)} />)}{!relatedLoading && !financeFilterCounts[financeFilter] && !financeFailedResources.length && <EmptyState noun="registros financeiros" onClear={() => setFinanceFilter("all")} />}{relatedLoading && financeFilterCounts[financeFilter] === 0 && <p role="status">Conferindo os registros financeiros...</p>}</section>}{tab === "Comunicação" && <section className="com-client-info"><div className="com-client-section-heading"><div><h3>Comunicação</h3><p>Conversas e aprovações relacionadas.</p></div><button className="com-primary" onClick={() => openTab("Caixa de entrada", {
                clientId: client.id,
                clientName: client.name,
                clientEmail: client.email,
                clientPhone: client.phone,
                action: "open",
                intentId: String(client.id) + "-" + Date.now()
              })}><MessageCircle size={14} />Abrir atendimento</button></div>{messages.map((message, index) => <article key={message.id ?? index} className="com-client-row"><MessageCircle size={16} /><div><b>{message.name}</b><small>{message.time} · {message.text}</small></div><Badge>{message.unread ? `${message.unread} não lidas` : "WhatsApp"}</Badge></article>)}{approvals.map((approval, index) => <article key={approval.id ?? index} className="com-client-row"><CheckCircle2 size={15} /><div><b>{approval.title}</b><small>{approval.project} · enviado {approval.sent}</small></div><Badge tone={approval.status === "Aprovado" ? "green" : "amber"}>{approval.status}</Badge></article>)}{!messages.length && !approvals.length && <EmptyState noun="conversas" onClear={() => openTab("Caixa de entrada", {
              clientId: client.id,
              clientName: client.name,
              clientEmail: client.email,
              clientPhone: client.phone,
              action: "open",
              intentId: String(client.id) + "-" + Date.now()
            })} />}</section>}{tab === "Arquivos" && <section className="com-client-info"><div className="com-client-section-heading"><div><h3>Arquivos do cliente</h3><p>Documentos e materiais vinculados aos projetos.</p></div><input ref={fileUploadRef} type="file" hidden={true} onChange={event => addClientFile(event.target.files?.[0])} /><button type="button" className="com-primary" disabled={fileUploading} onClick={() => fileUploadRef.current?.click()}><Plus size={14} />{fileUploading ? "Adicionando..." : "Adicionar arquivo"}</button></div>{files.map((file, index) => <article key={file.id ?? index} className="com-client-row"><FileText size={16} /><div><b>{file.name}</b><small>{file.project || "Arquivo do cliente"} · {file.date}</small></div><span>{file.size}</span></article>)}{!files.length && <EmptyState noun="arquivos" />}</section>}{tab === "Suporte" && <section className="com-client-info"><div className="com-client-section-heading"><div><h3>Suporte e tickets</h3><p>Solicitações técnicas abertas por este cliente.</p></div><button className="com-primary" onClick={() => openTab("Tickets", {
                clientId: client.id,
                clientName: client.name,
                action: "create",
                intentId: crypto.randomUUID()
              })}><Plus size={14} />Novo ticket</button></div>{tickets.map((item, index) => {
              const ticket = clientTicketPresentation(item);
              return <article key={item.id ?? index} className="com-client-row"><LifeBuoy size={16} /><div><b>{ticket.code} · {ticket.title}</b><small>{ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString("pt-BR") : "Sem data de atualização"}</small></div><Badge tone={ticket.tone}>{ticket.status}</Badge></article>;
            })}{!tickets.length && <EmptyState noun="tickets" onClear={() => openTab("Tickets", {
              clientId: client.id,
              clientName: client.name,
              action: "create",
              intentId: crypto.randomUUID()
            })} />}</section>}{tab === "Histórico" && <section className="com-client-info"><div className="com-client-section-heading"><div><h3>Linha do tempo</h3><p>Notas, eventos e movimentações de todos os módulos vinculados a {client.name}.</p></div></div><form className="com-client-note-form" onSubmit={addNote}><textarea rows="2" value={note} onChange={e => setNote(e.target.value)} placeholder="Registrar uma nota da reunião ou próximo passo?" /><button className="com-primary" type="submit" disabled={noteSaving}><Plus size={14} />{noteSaving ? "Salvando..." : "Adicionar nota"}</button></form>{relationshipHistory.map(item => <article key={item.id} className="com-client-history-row"><span className={"com-history-dot " + (item.tone || (item.kind === "Atividade" ? "blue" : ""))} /><div><b>{item.title}</b><small>{clientRelationshipHistoryDateLabel(item.date)} · {item.detail}{item.amount != null ? " · " + new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.amount) : ""}</small></div></article>)}{!relationshipHistory.length && <EmptyState noun="atividades" onClear={() => setTab("Resumo")} />}</section>}</div><aside className="com-client-live-feed"><div className="com-client-feed-heading"><div><h3>Atividade recente</h3><p>Movimentações desta conta</p></div><span><i /> {relatedLoading ? "Carregando" : Object.keys(relatedErrors).length ? "Parcial" : localDemo ? "Dados locais" : "Atualizado"}</span></div><div className="com-client-feed-list">{liveFeed.map((item, index) => <article key={`${item.kind}-${item.title}-${index}`} className="com-client-feed-item"><span className={`com-client-feed-dot tone-${index % 4}`}><i /></span><div><small>{item.kind}</small><b>{item.title}</b><p>{item.detail}</p></div></article>)}{!liveFeed.length && <div className="com-client-feed-empty"><Clock3 size={18} /><span>As próximas tarefas, cobranças e interações aparecerão aqui.</span></div>}</div><div className="com-client-quick-actions"><h4>Ações rápidas</h4><button onClick={() => {
              setTab("Projetos");
              setProjectModal(true);
            }}><CheckCircle2 size={15} />Criar projeto<ChevronRight size={14} /></button><button onClick={() => openTab("Propostas", {
              clientId: client.id,
              clientName: client.name,
              clientEmail: client.email,
              action: "create",
              intentId: String(client.id) + "-" + Date.now()
            })}><FileText size={15} />Criar proposta<ChevronRight size={14} /></button><button onClick={() => openTab("Cobranças", {
              clientId: client.id,
              clientName: client.name,
              clientEmail: client.email,
              action: "create",
              intentId: crypto.randomUUID()
            })}><CircleDollarSign size={15} />Gerar cobrança<ChevronRight size={14} /></button><button onClick={() => openTab("Caixa de entrada", {
              clientId: client.id,
              clientName: client.name,
              clientEmail: client.email,
              clientPhone: client.phone,
              action: "open",
              intentId: String(client.id) + "-" + Date.now()
            })}><MessageCircle size={15} />Abrir atendimento<ChevronRight size={14} /></button></div><div className="com-client-feed-contact"><span className="com-client-feed-contact-icon"><Building2 size={16} /></span><div><small>Contato principal</small><b>{client.person || "Não informado"}</b><span>{client.email || "Cadastre um e-mail"}</span></div></div></aside></div><footer className="com-client-footer"><span><ShieldCheck size={14} />{localDemo ? "Dados da demonstração salvos neste navegador" : "Ficha sincronizada no workspace"} · acesso ao portal depende de link e canal de verificação configurados</span><button type="button" className="com-client-archive" aria-label={`${isArchivedClient(client) ? "Restaurar" : "Arquivar"} cliente ${client.name}`} title={isArchivedClient(client) ? "Restaurar cliente" : "Arquivar cliente"} disabled={archiveSaving} onClick={archiveClient}>{isArchivedClient(client) ? <RefreshCw size={14} /> : <Archive size={14} />}<span>{archiveSaving ? "Salvando..." : isArchivedClient(client) ? "Restaurar cliente" : "Arquivar cliente"}</span></button><button className="com-secondary" onClick={() => openTab("Portal do cliente", {
          clientId: client.id,
          action: "select"
        })}><Copy size={13} />Configurar portal</button></footer>{projectModal && <div className="com-modal-backdrop" role="presentation" onMouseDown={event => {
        if (event.target === event.currentTarget && !projectSaving) setProjectModal(false);
      }}><form className="com-create-modal" role="dialog" aria-modal="true" aria-labelledby="client-project-title" onSubmit={createProject}><header><div><small>CLIENTE · {client.name}</small><h2 id="client-project-title">Novo projeto</h2></div><button type="button" aria-label="Fechar" disabled={projectSaving} onClick={() => setProjectModal(false)}><X size={15} /></button></header><label>Nome do projeto<input autoFocus={true} required={true} maxLength="140" value={projectDraft.name} onChange={event => setProjectDraft({
              ...projectDraft,
              name: event.target.value
            })} placeholder="Ex.: Novo site institucional" /></label><label>Tipo de serviço<select value={projectDraft.type} onChange={event => setProjectDraft({
              ...projectDraft,
              type: event.target.value
            })}>{["Site institucional", "Landing page", "Loja virtual", "Aplicativo", "Sistema web", "Automação", "Manutenção", "Outro"].map(type => <option>{type}</option>)}</select></label><label>Prazo previsto<input type="date" value={projectDraft.due} onChange={event => setProjectDraft({
              ...projectDraft,
              due: event.target.value
            })} /></label><label>Escopo e observações<textarea rows="3" value={projectDraft.detail} onChange={event => setProjectDraft({
              ...projectDraft,
              detail: event.target.value
            })} placeholder="Objetivo, entregas e informações iniciais" /></label><p>O projeto será salvo no workspace e vinculado a {client.name}.</p><footer><button type="button" className="com-secondary" disabled={projectSaving} onClick={() => setProjectModal(false)}>Cancelar</button><button type="submit" className="com-primary" disabled={projectSaving}><Plus size={14} />{projectSaving ? "Criando…" : "Criar projeto"}</button></footer></form></div>}</section></div>;
}
function exportCommercialCsv(page, items) {
  downloadCsvFile(`${page}-focusshub-${(new Date()).toISOString().slice(0, 10)}.csv`, recordsToCsv(items));
}
function ListView({
  page,
  items,
  relatedProjects = [],
  relatedSubscriptions = [],
  relatedContracts = [],
  search,
  setSearch,
  filter,
  setFilter,
  extraFilterFields = [],
  extraFilters = {},
  setExtraFilters = () => {},
  onAction,
  onUpdate,
  onDelete,
  onArchive,
  onAccept,
  onSendProposal,
  localDemo = false,
  onRefreshRecords,
  clients = [],
  companies = [],
  contacts = [],
  services = [],
  tasks = [],
  totalItems = 0,
  preferences,
  openClientId = "",
  onClientOpened = () => {},
  openLeadId = "",
  leadRecords = [],
  leadRecordsLoading = false,
  leadRecordsLoadError = "",
  onLeadOpened = () => {}
}) {
  const [selectedItem, setSelectedItem] = useState(null);
  const handledLeadNavigation = useRef("");
  const listPageRef = useRef(page);
  const [recordDraft, setRecordDraft] = useState({});
  const [editorBaseline, setEditorBaseline] = useState({});
  const [recordSaving, setRecordSaving] = useState(false);
  const [statusDraft, setStatusDraft] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [emailProvider, setEmailProvider] = useState("resend");
  const [sendingProposal, setSendingProposal] = useState(false);
  const [retryKey, setRetryKey] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [contractDocDraft, setContractDocDraft] = useState("");
  const [sendingContract, setSendingContract] = useState(false);
  const [syncingContract, setSyncingContract] = useState(false);
  useEffect(() => {
    if (listPageRef.current === page) return;
    listPageRef.current = page;
    setSelectedItem(null);
    setRecordDraft({});
    setEditorBaseline({});
    setStatusDraft("");
  }, [page]);
  const editableFields = commercialRecordEditorFields(page);
  const recordDirty = Boolean(selectedItem && (
    commercialRecordEditorIsDirty(page, editorBaseline, recordDraft, clients, companies)
    || statusDraft !== String(selectedItem.stage || selectedItem.status || "Ativo")
    || (page === "contratos" && contractDocDraft !== String(selectedItem.documentText || contractText(selectedItem)))
  ));
  const closeRecordEditor = () => {
    if (recordSaving) return;
    if (recordDirty && !window.confirm("Há alterações não salvas. Descartar as alterações?")) return;
    setSelectedItem(null);
  };
  const saveRecordChanges = async () => {
    const { patch, error } = editableFields.length
      ? buildCommercialRecordEditorPatch(page, recordDraft, clients, selectedItem, services, companies)
      : { patch: {} };
    if (error) {
      onAction?.(error);
      return;
    }
    if (page === "contratos" && selectedItem?.clicksign?.envelopeId && contractDocDraft !== selectedItem.documentText) {
      onAction?.("O documento não pode ser alterado depois de enviado para assinatura.");
      return;
    }
    setRecordSaving(true);
    try {
      const saved = await onUpdate?.(selectedItem, {
        ...patch,
        ...commercialStatusPatch(page, statusDraft, contractDocDraft, {
          includeContractDocument: page === "contratos" && contractDocDraft !== String(selectedItem.documentText || contractText(selectedItem)),
        }),
      });
      if (saved !== false) setSelectedItem(null);
    } catch (error) {
      onAction?.(error.message || "Não foi possível salvar as alterações.");
    } finally {
      setRecordSaving(false);
    }
  };
  const deleteSelectedRecord = async () => {
    setRecordSaving(true);
    try {
      const deleted = await onDelete?.(selectedItem);
      if (deleted !== false) setSelectedItem(null);
    } catch (error) {
      onAction?.(error.message || "Não foi possível excluir o registro.");
    } finally {
      setRecordSaving(false);
    }
  };
  useEffect(() => {
    if (page !== "clientes" || !openClientId) return;
    const client = items.find(item => String(item.id) === String(openClientId));
    if (!client) return;
    setSelectedItem(client);
    setStatusDraft(client.status || "Ativo");
    onClientOpened();
  }, [page, items, openClientId, onClientOpened]);
  useEffect(() => {
    if (page !== "leads" || !openLeadId) {
      handledLeadNavigation.current = "";
      return;
    }
    const id = String(openLeadId);
    if (handledLeadNavigation.current === id) return;

    const resolution = resolveLeadNavigation(leadRecords, id, {
      loading: leadRecordsLoading,
      loadError: leadRecordsLoadError,
    });
    if (resolution.status === "waiting" || resolution.status === "none") return;

    handledLeadNavigation.current = id;
    if (resolution.status === "found") {
      setSelectedItem(resolution.lead);
      setStatusDraft(resolution.lead.stage || resolution.lead.status || "Novo lead");
    } else {
      onAction?.("NÃ£o encontrei este lead na carteira disponÃ­vel para sua conta.");
    }
    onLeadOpened();
  }, [page, openLeadId, leadRecords, leadRecordsLoading, leadRecordsLoadError, onAction, onLeadOpened]);
  const sendContract = async () => {
    if (localDemo) {
      onAction("Assinatura digital externa desativada no modo de demonstração local.");
      return;
    }
    if (!selectedItem || !signerName.trim() || !signerEmail.trim()) return;
    if (/\[[^\]]{2,100}\]/.test(contractDocDraft)) {
      onAction("Preencha os campos entre colchetes antes de enviar o contrato.");
      return;
    }
    if (!window.confirm(`Ativar o envelope Clicksign e enviar o contrato para ${signerEmail.trim()}? A Clicksign notificara o signatario por e-mail.`)) return;
    setSendingContract(true);
    try {
      const result = await apiRequest(`/api/integrations/clicksign/contracts/${selectedItem.id}/send`, {
        method: "POST",
        body: JSON.stringify({
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim(),
          documentText: contractDocDraft
        })
      });
      const saved = result.data;
      await onRefreshRecords?.();
      setSelectedItem(saved);
      setStatusDraft(saved.status || "Rascunho");
      const nextDraft = commercialRecordEditorDraft(page, saved, clients, companies);
      setRecordDraft(nextDraft);
      setEditorBaseline(nextDraft);
      setContractDocDraft(saved.documentText || contractText(saved));
      onAction(result.warning || (result.notificationSent ? `Contrato ativado e notificacao enviada para ${signerEmail.trim()}.` : "Envelope ativado na Clicksign."));
    } catch (error) {
      onAction(error.message || "Não foi possível enviar o contrato para assinatura.");
    } finally {
      setSendingContract(false);
    }
  };
  const syncContract = async () => {
    if (localDemo) {
      onAction("Sincronização da Clicksign indisponível na demonstração local.");
      return;
    }
    if (!selectedItem || syncingContract) return;
    setSyncingContract(true);
    try {
      const result = await apiRequest(`/api/integrations/clicksign/contracts/${selectedItem.id}/sync`, {
        method: "POST",
        body: "{}"
      });
      const saved = result.data;
      await onRefreshRecords?.();
      setSelectedItem(saved);
      setStatusDraft(saved.status || "Rascunho");
      const nextDraft = commercialRecordEditorDraft(page, saved, clients, companies);
      setRecordDraft(nextDraft);
      setEditorBaseline(nextDraft);
      setContractDocDraft(saved.documentText || contractText(saved));
      onAction(`Status Clicksign sincronizado: ${saved.status}.`);
    } catch (error) {
      onAction(error.message || "Não foi possível sincronizar o contrato.");
    } finally {
      setSyncingContract(false);
    }
  };
  const notifyContractSigner = async () => {
    if (localDemo) {
      onAction("Notificações externas ficam desativadas na demonstração local.");
      return;
    }
    if (!selectedItem) return;
    try {
      const result = await apiRequest(`/api/integrations/clicksign/contracts/${selectedItem.id}/notify`, {
        method: "POST",
        body: "{}"
      });
      await onRefreshRecords?.();
      setSelectedItem(result.data);
      setStatusDraft(result.data.status || "Rascunho");
      const nextDraft = commercialRecordEditorDraft(page, result.data, clients, companies);
      setRecordDraft(nextDraft);
      setEditorBaseline(nextDraft);
      setContractDocDraft(result.data.documentText || contractText(result.data));
      onAction("Notificacao de assinatura reenviada pela Clicksign.");
    } catch (error) {
      onAction(error.message || "Não foi possível reenviar a notificacao.");
    }
  };
  const titles = {
    leads: ["Nome", "Empresa e serviço", "Origem", "Etapa", "Valor estimado", "Última atividade"],
    clientes: ["Cliente", "Contato principal", "Relacionamento", "Projetos", "Receita mensal", "Status"],
    empresas: ["Empresa", "Segmento", "Localização", "Porte", "Contatos", "Tipo"],
    contatos: ["Contato", "Cargo e empresa", "E-mail", "Telefone", "Último contato", "Perfil"],
    propostas: ["Proposta", "Cliente", "Código", "Valor", "Status", "Atualização"],
    contratos: ["Contrato", "Cliente", "Código", "Valor", "Vigência", "Status"]
  };
  const label = {
    leads: "leads",
    clientes: "clientes",
    empresas: "empresas",
    contatos: "contatos",
    propostas: "propostas",
    contratos: "contratos"
  }[page];
  const filterDefaults = page === "leads" ? ["Novo lead", "Contato realizado", "Reunião agendada", "Diagnóstico", "Proposta enviada", "Negociação", "Fechado", "Perdido", "Site", "Instagram", "Indicação", "Tráfego pago"] : page === "propostas" ? ["Em negociação", "Aprovada", "Rascunho", "Enviada", "Visualizada", "Recusada", "Expirada"] : page === "contratos" ? ["Ativo", "Assinado", "Aguardando assinatura", "Rascunho", "Concluído", "Cancelado"] : page === "clientes" ? ["Ativo", "Em atenção", "Inativo", "Arquivado"] : page === "empresas" ? ["Cliente", "Prospect", "Inativo"] : ["Decisor", "Influenciador", "Contato"];
  const filters = ["Todos", ...(page === "leads" ? ["Sem pr\u00f3xima a\u00e7\u00e3o"] : []), ...new Set([...filterDefaults, ...items.flatMap(item => page === "leads" ? [item.stage, item.source] : [item.archivedAt && page === "clientes" ? "Arquivado" : item.status])].filter(Boolean))];
  const clientRevenueAmount = client => {
    const linked = relatedSubscriptions.filter(subscription => belongsToClient(subscription, client, subscription.clientName || subscription.client));
    if (!linked.length) return clientMonthlyRevenue(client);
    return linked.reduce((sum, subscription) => {
      const status = String(subscription.status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
      if (!["authorized", "active"].includes(status)) return sum;
      const frequency = subscription.frequency || "months";
      const interval = subscription.frequencyInterval || subscription.interval || 1;
      return sum + recurringMonthlyAmount({
        billingMode: "recurring",
        amount: subscription.amount,
        frequency: `${frequency}:${interval}`
      });
    }, 0);
  };
  const upcomingRenewals = (relatedContracts || []).filter(contract => isCommercialDateWithinNextDays(contract.renewal || contract.renewalDate) && !["Cancelado", "Concluído", "Concluido"].includes(String(contract.status || "")) && items.some(client => belongsToClient(contract, client, contract.client))).length;
  const contractMonthlyRevenue = activeContractMonthlyRevenue(items);
  const clientRevenueLabel = client => {
    const amount = clientRevenueAmount(client);
    return amount > 0 ? `${new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(amount)} / mês` : "Sem recorrência";
  };
  const totalValue = items.reduce((sum, item) => sum + (page === "clientes" ? clientRevenueAmount(item) : parseDisplayAmount(item.value)), 0);
  const amountLabel = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(totalValue);
  const leadPipelineValue = items.filter(item => !["Fechado", "Perdido"].includes(item.stage)).reduce((sum, item) => sum + parseDisplayAmount(item.value), 0);
  const linkedActiveProjects = relatedProjects.filter(project => {
    const status = String(project.status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return !["concluido", "cancelado", "arquivado"].includes(status) && items.some(client => belongsToClient(project, client, project.client));
  }).length;
  const clientProjectCount = relatedProjects.length ? linkedActiveProjects : items.reduce((sum, item) => sum + (Number.parseInt(item.projects, 10) || 0), 0);
  const proposalApprovalCycle = averageProposalApprovalDays(items);
  const stats = page === "leads" ? [["Leads ativos", String(items.filter(item => !["Fechado", "Perdido"].includes(item.stage)).length), `${items.length} no cadastro`, Users, "blue"], ["Valor no pipeline", brl.format(leadPipelineValue), "soma das oportunidades abertas", CircleDollarSign, "green"], ["Taxa de conversão", `${Math.round(items.filter(item => item.stage === "Fechado").length / Math.max(items.length, 1) * 100)}%`, "negócios fechados", ArrowUpRight, "purple"], ["Sem pr\u00f3xima a\u00e7\u00e3o", String(countLeadsWithoutNextAction(items)), "leads abertos sem pr\u00f3ximo passo", Clock3, "amber"]] : page === "clientes" ? [["Clientes ativos", String(items.filter(item => item.status === "Ativo").length), `${items.length} na carteira`, Building2, "blue"], ["Receita recorrente", amountLabel, "média mensal dos serviços recorrentes", Wallet, "green"], ["Projetos ativos", String(clientProjectCount), "projetos ativos vinculados à carteira", FileText, "purple"], ["Renovações próximas", String(upcomingRenewals), "contratos nos próximos 30 dias", CalendarDays, "amber"]] : page === "propostas" ? [["Em aberto", String(items.filter(item => !["Aprovada", "Recusada", "Expirada"].includes(item.status)).length), "aguardando ou em negociação", FileText, "blue"], ["Valor proposto", amountLabel, "soma das propostas", CircleDollarSign, "green"], ["Taxa de aprovação", `${Math.round(items.filter(item => item.status === "Aprovada").length / Math.max(items.length, 1) * 100)}%`, "propostas aprovadas", CheckCircle2, "purple"], ["Tempo m\u00e9dio de aceite", formatElapsedDays(proposalApprovalCycle.days), proposalApprovalCycle.count ? String(proposalApprovalCycle.count) + (proposalApprovalCycle.count === 1 ? " proposta aprovada com datas" : " propostas aprovadas com datas") : "Sem datas de aprova\u00e7\u00e3o registradas", Clock3, "amber"]] : page === "contratos" ? [["Contratos ativos", String(items.filter(item => ["Ativo", "Assinado"].includes(item.status)).length), `${items.length} contratos`, FileCheck2, "blue"], ["Receita mensal", new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(contractMonthlyRevenue), "somente termos recorrentes", CircleDollarSign, "green"], ["Renovam em breve", String(items.filter(item => isCommercialDateWithinNextDays(item.renewal || item.renewalDate) && !["Cancelado", "Concluído", "Concluido"].includes(String(item.status || ""))).length), "nos próximos 30 dias", CalendarDays, "amber"], ["Valor contratado", amountLabel, "soma dos valores informados", Wallet, "purple"]] : null;
  const scheduleLeadFollowUp = async (lead, patch, due) => {
    const saved = await onUpdate?.(lead, patch);
    if (saved === false) return false;
    const updatedLead = { ...lead, ...patch };
    try {
      // Resolve the relation against fresh workspace data before inserting. If
      // the last response was lost, retrying updates its existing task.
      const currentTasks = await fetchAllRecords("/api/workspace/tasks");
      const existingTask = findOpenLeadFollowUpTask(currentTasks, lead.id);
      const taskData = buildLeadFollowUpTaskData(updatedLead, { action: patch.nextAction, due, existingTask });
      if (existingTask?.id) {
        await apiRequest(`/api/workspace/tasks/${encodeURIComponent(existingTask.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ data: taskData })
        });
      } else {
        await apiRequest("/api/workspace/tasks", {
          method: "POST",
          body: JSON.stringify({ data: taskData })
        });
      }
      await onRefreshRecords?.();
      onAction?.(existingTask ? "Tarefa vinculada ao lead atualizada." : "Próxima ação salva e agendada em Tarefas.");
      return true;
    } catch (error) {
      onAction?.(`Lead salvo, mas a tarefa não foi agendada. Tente novamente. ${error.message || ""}`.trim());
      return false;
    }
  };
  return <Fragment>{stats && <div className="com-metrics">{stats.map(([label2, value, detail, Icon, tone]) => <Metric key={label2} {...{
        label: label2,
        value,
        detail,
        icon: Icon,
        tone
      }} />)}</div>}<section className="com-panel"><div className="com-panel-heading"><div><h2>{page === "leads" ? "Todos os leads" : page === "clientes" ? "Sua carteira" : page === "empresas" ? "Empresas cadastradas" : page === "contatos" ? "Pessoas e decisores" : page === "propostas" ? "Todas as propostas" : "Todos os contratos"}</h2><p>{items.length} {label} encontrados <span>·</span> Atualizado há poucos minutos</p></div><div className="com-toolbar-actions"><button className="com-secondary" disabled={!items.length} onClick={() => {
            exportCommercialCsv(page, items);
            onAction(`${items.length} ${label} exportados em CSV.`);
          }}><Download size={15} /> Exportar CSV</button></div></div><Toolbar search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} filters={filters} placeholder={`Buscar ${label}...`} extraFilterFields={extraFilterFields} extraFilters={extraFilters} onExtraFilterChange={(field, value) => setExtraFilters(currentFilters => ({
        ...currentFilters,
        [field]: value
      }))} /><div className="com-table-wrap"><table className={`com-table com-table-${page}`}><thead><tr>{titles[page].map(title => <th key={title}>{title}</th>)}<th aria-label="Ações" /></tr></thead><tbody>{items.map((item, index) => <tr key={item.id ?? index}><td>{page === "leads" ? <Identity name={item.name} sub={item.email} initials={item.initials} tone={item.tone} /> : page === "clientes" || page === "empresas" || page === "contatos" ? <Identity name={item.name} sub={page === "contatos" ? item.role : page === "clientes" ? item.since : item.segment} initials={item.initials} tone={item.tone} /> : <div className="com-table-primary"><b>{item.title}</b><small>{item.code}</small></div>}</td>{page === "leads" && <Fragment><td><b>{item.company}</b><small>{item.service}</small></td><td><Badge tone={item.source === "Instagram" ? "purple" : item.source === "Indicação" ? "green" : "blue"}>{item.source}</Badge></td><td><Badge tone={stageTone(item.stage)}>{item.stage}</Badge></td><td className="com-amount">{item.value}</td><td className="com-muted">{item.date}</td></Fragment>}{page === "clientes" && <Fragment><td><b>{item.person}</b><small>{item.email}</small></td><td><span className="com-text-line">{item.segment}</span><small>{item.email}</small></td><td>{item.projects}</td><td className="com-amount">{clientRevenueLabel(item)}</td><td><Badge tone={item.status === "Ativo" ? "green" : "amber"}>{item.archivedAt ? "Arquivado" : item.status}</Badge></td></Fragment>}{page === "empresas" && <Fragment><td>{item.segment}</td><td><span className="com-text-line">{item.city || "Cidade nao informada"}</span><small>{item.email || item.phone || "Sem contato cadastrado"}</small></td><td>{item.size}</td><td>{companyContactCount(item, contacts, companies)} {companyContactCount(item, contacts, companies) === 1 ? "contato" : "contatos"}</td><td><Badge tone={item.status === "Cliente" ? "green" : "blue"}>{item.status}</Badge></td></Fragment>}{page === "contatos" && <Fragment><ContactChannelCells item={item} /><td className="com-muted">{item.last}</td><td><Badge tone={item.status === "Decisor" || item.status === "Decisora" ? "purple" : "blue"}>{item.status}</Badge></td></Fragment>}{(page === "propostas" || page === "contratos") && <Fragment><td><b>{item.client}</b><small>{item.code}</small></td><td className="com-amount">{item.value}</td>{page === "propostas" ? <Fragment><td><Badge tone={item.tone}>{item.status}</Badge></td><td className="com-muted">{item.date}</td></Fragment> : <Fragment><td><div className="com-contract-progress"><div className="com-progress"><i style={{
                          width: `${item.progress}%`
                        }} /></div><small>{item.renewal}</small></div></td><td><Badge tone={item.tone}>{item.status}</Badge></td></Fragment>}</Fragment>}<td><button className="com-row-more" aria-label={`Ações para ${item.name || item.title}`} onClick={() => {
                  setSelectedItem(item);
                  const initialDraft = commercialRecordEditorDraft(page, item, clients, companies);
                  setRecordDraft(initialDraft);
                  setEditorBaseline(initialDraft);
                  setStatusDraft(item.stage || item.status || "Ativo");
                  setSendTo(item.email || "");
                  setRetryKey(["sending", "failed"].includes(item.emailDelivery?.status) ? item.emailDelivery.key || "" : "");
                  setSignerName(item.signerName || item.person || "");
                  setSignerEmail(item.email || "");
                  setContractDocDraft(item.documentText || (page === "contratos" ? contractText(item) : ""));
                }}><Ellipsis size={18} /></button></td></tr>)}</tbody></table>{items.length === 0 && <EmptyState query={search} noun={label} onClear={() => {
          setSearch("");
          setFilter("Todos");
          setExtraFilters({});
        }} />}</div><div className="com-table-footer"><span>Mostrando <b>{items.length}</b> de <b>{totalItems}</b> {items.length === 1 ? label.replace(/s$/, "") : label} após busca e filtros.</span></div></section>{selectedItem && (page === "leads" ? <LeadRecordModal lead={selectedItem} onClose={() => setSelectedItem(null)} onSave={async patch => {
      const saved = await onUpdate?.(selectedItem, patch);
      if (saved !== false) setSelectedItem(null);
    }} onDelete={async () => {
      const deleted = await onDelete?.(selectedItem);
      if (deleted !== false) setSelectedItem(null);
    }} onSaveAndSchedule={async (patch, due) => {
      const saved = await scheduleLeadFollowUp(selectedItem, patch, due);
      if (saved) setSelectedItem(null);
      return saved;
    }} tasks={tasks} /> : page === "clientes" ? <ClientProfileModal key={clientProfileSelectionKey(selectedItem)} client={selectedItem} onClose={() => setSelectedItem(null)} onArchive={onArchive} onUpdate={updated => onUpdate?.(selectedItem, updated)} onAction={onAction} preferences={preferences} /> : <div className="com-modal-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) closeRecordEditor();
    }}><section className="com-create-modal com-edit-modal" data-commercial-editor-dirty={recordDirty ? "true" : "false"}><header><div><small>{page.toUpperCase()} · REGISTRO</small><h2>{selectedItem.name || selectedItem.title}</h2></div><button type="button" aria-label="Fechar" onClick={closeRecordEditor} disabled={recordSaving}><X size={15} /></button></header>{editableFields.length === 0 && <div className="com-record-details"><span>Cliente / empresa<b>{selectedItem.client || selectedItem.company || selectedItem.name || "?"}</b></span><span>Valor<b>{selectedItem.value || selectedItem.price || "A definir"}</b></span><span>Contato<b>{selectedItem.email || selectedItem.person || selectedItem.role || "?"}</b></span><span>Detalhes<b>{selectedItem.service || selectedItem.segment || selectedItem.description || selectedItem.code || "?"}</b></span></div>}{editableFields.length > 0 && <form className="com-commercial-editor" onSubmit={event => event.preventDefault()}><div className="com-commercial-editor-heading"><strong>Dados comerciais</strong><span>As alterações só serão aplicadas ao salvar.</span></div><div className="com-commercial-editor-grid">{editableFields.map(field => {
          const locked = (page === "propostas" && selectedItem.status === "Aprovada") || (page === "contratos" && Boolean(selectedItem.clicksign?.envelopeId || isLockedContractStatus(selectedItem.status)) && !["renewal", "progress"].includes(field.key));
          const value = recordDraft[field.key] ?? "";
          return <label key={field.key} className={field.wide ? "wide" : ""}>{field.label}{field.type === "client" ? <select required={field.required} disabled={recordSaving || locked} value={value} onChange={event => {
              const client = clients.find(item => String(item.id) === event.target.value);
              setRecordDraft(current => ({ ...current, clientId: event.target.value, ...(page === "propostas" ? { email: client?.email || "" } : {}) }));
            }}><option value="">Selecione um cliente</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select> : field.type === "company" ? <select disabled={recordSaving} value={value} onChange={event => setRecordDraft(current => ({ ...current, companyId: event.target.value, company: companies.find(item => String(item.id) === event.target.value)?.name || "" }))}><option value="">Sem vínculo cadastrado</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select> : field.type === "textarea" ? <textarea rows={3} required={field.required} disabled={recordSaving || locked} value={value} onChange={event => setRecordDraft(current => ({ ...current, [field.key]: event.target.value }))} /> : <input type={field.type === "number" ? "number" : field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"} inputMode={field.type === "currency" ? "decimal" : undefined} min={field.type === "number" ? "0" : undefined} max={field.type === "number" ? "100" : undefined} step={field.type === "number" ? "1" : undefined} required={field.required} disabled={recordSaving || locked} value={value} onChange={event => setRecordDraft(current => ({ ...current, [field.key]: event.target.value, ...(field.key === "company" ? { companyId: "" } : {}) }))} />}</label>;
        })}</div>{page === "propostas" && selectedItem.status === "Aprovada" && <small className="com-contract-locked-note">Esta proposta já originou contrato e projeto; os campos comerciais ficam bloqueados para preservar os vínculos.</small>}{page === "contratos" && isLockedContractStatus(selectedItem.status) && <small className="com-contract-locked-note">Termos bloqueados enquanto o contrato está em assinatura ou ativo. Renovação e progresso continuam editáveis.</small>}</form>}{page === "propostas" && <div className="com-proposal-email"><label>Enviar para<input type="email" required={true} value={sendTo} onChange={event => {
              setSendTo(event.target.value);
              setRetryKey("");
            }} placeholder="cliente@empresa.com" /></label><label>Enviar com<select value={emailProvider} onChange={event => {
              setEmailProvider(event.target.value);
              setRetryKey("");
            }}><option value="resend">Resend</option><option value="google">Gmail (Google Workspace)</option></select></label><small>{selectedItem.emailDelivery?.status === "sent" ? `Ultimo envio confirmado em ${new Date(selectedItem.emailDelivery.sentAt).toLocaleString("pt-BR")}` : selectedItem.emailDelivery?.status === "failed" ? "O envio anterior nao foi confirmado. Repetir mantem a mesma chave idempotente." : "O e-mail inclui escopo, valor, prazo e condicoes da proposta."}</small><button type="button" className="com-primary" disabled={recordSaving || sendingProposal || !sendTo.trim() || localDemo || recordDirty} onClick={async () => {
            if (!window.confirm(`Enviar esta proposta para ${sendTo.trim()} usando ${emailProvider === "google" ? "Gmail" : "Resend"}?`)) return;
            const key = retryKey || crypto.randomUUID();
            setRetryKey(key);
            setSendingProposal(true);
            try {
              await onSendProposal?.(selectedItem, sendTo.trim(), key, emailProvider);
              setSelectedItem({
                ...selectedItem,
                email: sendTo.trim(),
                status: "Enviada",
                tone: "blue",
                emailDelivery: {
                  status: "sent",
                  recipient: sendTo.trim(),
                  sentAt: (new Date()).toISOString()
                }
              });
              setStatusDraft("Enviada");
              setRecordDraft(current => ({ ...current, email: sendTo.trim() }));
              setEditorBaseline(current => ({ ...current, email: sendTo.trim() }));
              setRetryKey("");
            } catch (error) {
              onAction(error.message || "Não foi possível enviar a proposta.");
            } finally {
              setSendingProposal(false);
            }
          }}><Send size={14} />{sendingProposal ? "Enviando..." : localDemo ? "Envio externo desativado na demonstração" : selectedItem.emailDelivery?.status === "sent" ? "Enviar novamente" : "Enviar proposta"}</button></div>}{page === "contratos" && <div className="com-contract-document"><strong>Documento base para assinatura</strong><p>Revise e complete o texto antes do envio. Campos entre colchetes bloqueiam a assinatura. O contrato só será enviado quando você clicar no botão. Alterar os dados acima não reescreve este documento; revise o texto antes da assinatura.</p><textarea rows={16} value={contractDocDraft} onChange={event => setContractDocDraft(event.target.value)} disabled={recordSaving || Boolean(selectedItem.clicksign?.envelopeId) || isLockedContractStatus(selectedItem.status)} aria-label="Texto integral do contrato" /><button type="button" className="com-secondary" onClick={() => downloadContract({
            ...selectedItem,
            documentText: contractDocDraft
          })}><Download size={14} />Baixar modelo HTML para revisao</button>{selectedItem.clicksign?.envelopeId ? <div className="com-proposal-email"><b>Clicksign · {selectedItem.clicksign.status || "running"}</b><small>Signatario: {selectedItem.clicksign.signerEmail || signerEmail} · notificação: {selectedItem.clicksign.notificationStatus || "pendente"}</small><div className="com-toolbar-actions"><button type="button" className="com-secondary" disabled={syncingContract || recordDirty} onClick={syncContract}><RefreshCw size={14} />{syncingContract ? "Sincronizando..." : "Sincronizar status"}</button>{selectedItem.clicksign.notificationStatus !== "sent" && <button type="button" className="com-secondary" disabled={recordDirty} onClick={notifyContractSigner}><Send size={14} />Reenviar notificacao</button>}</div></div> : selectedItem.clicksign ? <div className="com-proposal-detail"><b>Envio interrompido</b><p>A solicitacao foi interrompida antes da confirmacao do ID do envelope. Consulte a conta Clicksign pelo codigo deste contrato antes de tentar novamente; o Focusshub bloqueia um segundo envio automatico para evitar duplicidade.</p></div> : <div className="com-proposal-email"><label>Nome completo do signatario<input required={true} value={signerName} onChange={event => setSignerName(event.target.value)} placeholder="Nome Sobrenome" /></label><label>E-mail do signatario<input required={true} type="email" value={signerEmail} onChange={event => setSignerEmail(event.target.value)} placeholder="cliente@empresa.com" /></label><button type="button" className="com-primary" disabled={recordSaving || sendingContract || !signerName.trim() || !signerEmail.trim() || contractDocDraft.length < 100 || localDemo || recordDirty || isLockedContractStatus(selectedItem.status)} onClick={sendContract}><Send size={14} />{sendingContract ? "Preparando envelope..." : localDemo ? "Assinatura externa desativada na demonstração" : "Enviar para assinatura Clicksign"}</button></div>}</div>}{page !== "servicos" && <StatusControl page={page} statusDraft={statusDraft} setStatusDraft={setStatusDraft} disabled={recordSaving || (page === "propostas" && selectedItem.status === "Aprovada") || (page === "contratos" && isLockedContractStatus(selectedItem.status))} />}<footer><button type="button" className="com-secondary com-delete-action" onClick={deleteSelectedRecord} disabled={recordSaving}>Excluir</button><span />{page === "propostas" && !["Aprovada", "Recusada", "Expirada"].includes(selectedItem.status) && <button type="button" className="com-secondary" disabled={recordDirty} onClick={async () => {
            const accepted = await onAccept?.(selectedItem);
            if (accepted) setSelectedItem(null);
          }}>Aceitar e iniciar</button>}<button type="button" className="com-primary" onClick={saveRecordChanges} disabled={recordSaving || !recordDirty}>{recordSaving ? "Salvando..." : "Salvar alteração"}</button></footer></section></div>)}</Fragment>;
}
function LeadRecordModal({
  lead,
  tasks = [],
  onClose,
  onSave,
  onSaveAndSchedule,
  onDelete
}) {
  const [draft, setDraft] = useState(() => ({
    name: lead.name || lead.title || "",
    company: lead.company || "",
    email: lead.email || "",
    phone: lead.phone || "",
    source: lead.source || "Manual",
    service: lead.service || "",
    amount: String(lead.value || "").replace(/^R\$\s*/i, ""),
    owner: lead.owner || "",
    nextAction: lead.nextAction || "",
    closeDate: lead.closeDate || "",
    notes: lead.notes || "",
    stage: lead.stage || "Novo lead"
  }));
  const [saving, setSaving] = useState(false);
  const [followUpDue, setFollowUpDue] = useState(() => dateAfterDays(1));
  const existingFollowUp = findOpenLeadFollowUpTask(tasks, lead.id);
  const canSchedule = Boolean(String(draft.nextAction || "").trim()) && !isTerminalLeadStage(draft.stage);
  const update = (field, value) => setDraft(current => ({
    ...current,
    [field]: value
  }));
  const save = async event => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      const cleanAmount = draft.amount.trim().replace(/^R\$\s*/i, "");
      await onSave({
        name: draft.name.trim(),
        title: draft.name.trim(),
        initials: draft.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(),
        company: draft.company.trim(),
        email: draft.email.trim().toLowerCase(),
        phone: draft.phone.trim(),
        source: draft.source,
        service: draft.service.trim(),
        value: cleanAmount ? "R$ " + cleanAmount : "A definir",
        owner: draft.owner.trim(),
        nextAction: draft.nextAction.trim(),
        closeDate: draft.closeDate,
        notes: draft.notes.trim(),
        stage: draft.stage
      });
    } finally {
      setSaving(false);
    }
  };
  const saveAndSchedule = async () => {
    if (!canSchedule || !followUpDue || saving) return;
    setSaving(true);
    try {
      const cleanAmount = draft.amount.trim().replace(/^R\$\s*/i, "");
      await onSaveAndSchedule?.({
        name: draft.name.trim(), title: draft.name.trim(),
        initials: draft.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(),
        company: draft.company.trim(), email: draft.email.trim().toLowerCase(), phone: draft.phone.trim(),
        source: draft.source, service: draft.service.trim(),
        value: cleanAmount ? "R$ " + cleanAmount : "A definir", owner: draft.owner.trim(),
        nextAction: draft.nextAction.trim(), closeDate: draft.closeDate, notes: draft.notes.trim(), stage: draft.stage
      }, followUpDue);
    } finally {
      setSaving(false);
    }
  };
  return <div className="com-modal-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget && !saving) onClose();
  }}><form className="com-create-modal com-lead-record-modal" role="dialog" aria-modal="true" aria-labelledby="lead-record-title" onSubmit={save}><header><div><small>LEAD · EDIÇÃO</small><h2 id="lead-record-title">Editar lead</h2></div><button type="button" aria-label="Fechar" onClick={onClose} disabled={saving}><X size={15} /></button></header><div className="com-lead-edit-fields"><label>Nome<input required={true} maxLength={160} value={draft.name} onChange={event => update("name", event.target.value)} /></label><label>Cliente / empresa<input maxLength={200} value={draft.company} onChange={event => update("company", event.target.value)} /></label><label>E-mail<input type="email" maxLength={254} value={draft.email} onChange={event => update("email", event.target.value)} /></label><label>Telefone<input type="tel" maxLength={40} value={draft.phone} onChange={event => update("phone", event.target.value)} /></label><label>Origem<select value={draft.source} onChange={event => update("source", event.target.value)}>{["Manual", "Indicação", "Site", "WhatsApp", "E-mail", "Instagram", "Campanha", "Outro"].map(value => <option key={value}>{value}</option>)}</select></label><label>Etapa<select value={draft.stage} onChange={event => update("stage", event.target.value)}>{["Novo lead", "Contato realizado", "Reunião agendada", "Diagnóstico", "Proposta enviada", "Negociação", "Fechado", "Perdido"].map(value => <option key={value}>{value}</option>)}</select></label><label>Serviço / oportunidade<input maxLength={240} value={draft.service} onChange={event => update("service", event.target.value)} /></label><label>Valor estimado<input inputMode="decimal" maxLength={32} value={draft.amount} onChange={event => update("amount", event.target.value)} placeholder="Ex.: 2500,00" /></label><label>Responsável<input maxLength={160} value={draft.owner} onChange={event => update("owner", event.target.value)} /></label><label>Fechamento previsto<input type="date" value={draft.closeDate} onChange={event => update("closeDate", event.target.value)} /></label><label className="wide">Próxima ação<input maxLength={240} value={draft.nextAction} onChange={event => update("nextAction", event.target.value)} /></label>{canSchedule && <><label className="wide">Prazo da tarefa<input type="date" min={dateAfterDays(0)} value={followUpDue} onChange={event => setFollowUpDue(event.target.value)} /></label><p className="com-muted wide" role="status">{existingFollowUp ? "Uma tarefa aberta ja esta vinculada a este lead; ela sera atualizada." : "A acao sera adicionada a lista Tarefas e vinculada a este lead."}</p></> }<label className="wide">Observações<textarea rows={3} maxLength={5e3} value={draft.notes} onChange={event => update("notes", event.target.value)} /></label></div><footer><button type="button" className="com-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="button" className="com-secondary com-delete-action" onClick={onDelete} disabled={saving}>Excluir</button><span />{canSchedule && <button type="button" className="com-secondary" onClick={saveAndSchedule} disabled={saving || !followUpDue}>{saving ? "Agendando..." : existingFollowUp ? "Salvar e atualizar tarefa" : "Salvar e agendar tarefa"}</button>}<button type="submit" className="com-primary" disabled={saving}>{saving ? "Salvando?" : "Salvar alterações"}</button></footer></form></div>;
}
function Identity({
  name,
  sub,
  initials,
  tone
}) {
  return <div className="com-identity"><Avatar initials={initials} tone={tone} /><span><b>{name}</b><small>{sub}</small></span></div>;
}
function ContactChannelCells({ item }) {
  const actions = clientContactActions(item.email, item.phone);
  return <Fragment><td>{actions.emailHref ? <a className="com-email" href={actions.emailHref}><Mail size={13} />{item.email}</a> : <span className="com-muted">E-mail não informado</span>}</td><td>{actions.phoneHref ? <a className="com-phone" href={actions.phoneHref}><Phone size={13} />{item.phone}</a> : <span className="com-muted">Telefone não informado</span>}</td></Fragment>;
}
function EmptyState({
  query,
  noun,
  onClear
}) {
  const messages = {
    leads: "Nenhum lead encontrado",
    clientes: "Nenhum cliente encontrado",
    empresas: "Nenhuma empresa encontrada",
    contatos: "Nenhum contato encontrado",
    propostas: "Nenhuma proposta encontrada",
    contratos: "Nenhum contrato encontrado",
    serviços: "Nenhum serviço encontrado"
  };
  return <div className="com-empty"><span><Search size={20} /></span><b>{messages[noun] || "Nenhum resultado encontrado"}</b><small>{query ? "Tente outro termo ou ajuste os filtros." : "Nenhum item corresponde aos filtros selecionados."}</small><button onClick={onClear}>Limpar busca e filtros</button></div>;
}
function stageTone(stage = "") {
  return commercialStageTone(stage);
}
function PipelineView({
  items = datasets.leads,
  onMove,
  onUpdate,
  onCreateLead,
  onSearch,
  search,
  mode,
  period,
  setPeriod,
  localDemo = false
}) {
  const periodItems = filterLeadsByPeriod(items, period);
  const openItems = periodItems.filter(item => !["Fechado", "Perdido"].includes(item.stage));
  const openPipelineValue = openItems.reduce((sum, item) => sum + parseDisplayAmount(item.value), 0);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [draggingId, setDraggingId] = useState("");
  const [dropStage, setDropStage] = useState("");
  const [dealDraft, setDealDraft] = useState({});
  const [savingDeal, setSavingDeal] = useState(false);
  const openDeal = item => {
    setSelectedDeal(item);
    setDealDraft({
      stage: item.stage || "Novo lead",
      value: item.value || "",
      chance: item.chance ?? 50,
      source: item.source || "Manual",
      service: item.service || "",
      owner: item.owner || "GS",
      closeDate: item.closeDate || "",
      nextAction: item.nextAction || "",
      notes: item.notes || ""
    });
  };
  const saveDeal = async event => {
    event.preventDefault();
    if (!selectedDeal || savingDeal) return;
    setSavingDeal(true);
    try {
      const saved = await persistPipelineLeadDeal(onUpdate, selectedDeal, dealDraft);
      if (saved) setSelectedDeal(null);
    } finally {
      setSavingDeal(false);
    }
  };
  const stagesFull = ["Novo lead", "Contato realizado", "Reunião agendada", "Diagnóstico", "Proposta enviada", "Negociação", "Fechado", "Perdido"];
  const stageColors = ["blue", "purple", "amber", "blue", "green", "amber", "green", "red"];
  return <Fragment><div className="com-metrics"><Metric label="Oportunidades abertas" value={String(openItems.length)} detail="em acompanhamento" icon={Users} tone="blue" /><Metric label="Valor total" value={brl.format(openPipelineValue)} detail="valor potencial em aberto" icon={CircleDollarSign} tone="green" /><Metric label="Ticket médio" value={brl.format(openPipelineValue / Math.max(openItems.length, 1))} detail="por oportunidade" icon={Wallet} tone="purple" /><Metric label="Conversão" value={`${Math.round(periodItems.filter(item => item.stage === "Fechado").length / Math.max(periodItems.length, 1) * 100)}%`} detail="negócios ganhos" icon={ArrowUpRight} tone="amber" /></div><section className="com-pipeline-panel"><div className="com-panel-heading"><div><h2>{mode === "crm" ? "Resumo do pipeline" : "Oportunidades por etapa"}</h2><p>Visão do avanço comercial <span>·</span> <span className="com-live"><i /> {localDemo ? "demonstração local · alterações salvas neste navegador" : "sincronizado no workspace"}</span></p></div><div className="com-pipeline-actions"><label className="com-search"><Search size={16} /><input value={search} onChange={event => onSearch(event.target.value)} placeholder="Buscar oportunidade..." aria-label="Buscar oportunidade" /></label><label className="com-period-filter"><CalendarDays size={15} /><select aria-label="Filtrar oportunidades por periodo" value={period} onChange={event => setPeriod(event.target.value)}><option value="all">Todos os periodos</option><option value="last7">Ultimos 7 dias</option><option value="last30">Ultimos 30 dias</option><option value="last90">Ultimos 90 dias</option><option value="undated">Sem data</option></select></label><button className="com-primary compact" onClick={() => onCreateLead?.("Novo lead")}><Plus size={16} /> Oportunidade</button></div></div><div className="com-stage-grid com-stage-grid-full">{stagesFull.map((stageName, index) => {
          const stageItems = periodItems.filter(item => (item.stage || "Novo lead") === stageName && (!search.trim() || `${item.name} ${item.company} ${item.service}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))));
          const sum = stageItems.reduce((amount, item) => amount + parseDisplayAmount(item.value), 0);
          return <section key={stageName} className={`com-stage ${dropStage === stageName ? "is-drop-target" : ""}`} onDragOver={event => {
            if (draggingId) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }
          }} onDragEnter={() => {
            if (draggingId) setDropStage(stageName);
          }} onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDropStage("");
          }} onDrop={event => {
            event.preventDefault();
            const leadId = event.dataTransfer.getData("text/plain");
            const lead = periodItems.find(candidate => String(candidate.id) === leadId);
            if (lead && lead.stage !== stageName) onMove?.(lead, stageName);
            setDraggingId("");
            setDropStage("");
          }}><div className="com-stage-heading"><span className={`com-stage-dot ${stageColors[index]}`} /><b>{stageName}</b><span className="com-stage-count">{stageItems.length}</span>{index < 6 && <button aria-label={`Adicionar oportunidade em ${stageName}`} onClick={() => onCreateLead?.(stageName)}><Plus size={17} /></button>}</div><small className="com-stage-total">{sum ? brl.format(sum) : "Sem valor previsto"}</small>{stageItems.map(item => <article key={item.id} className={`com-deal-card ${draggingId === String(item.id) ? "is-dragging" : ""}`} draggable={Boolean(item.id)} onDragStart={event => {
              if (!item.id) {
                event.preventDefault();
                return;
              }
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(item.id));
              setDraggingId(String(item.id));
            }} onDragEnd={() => {
              setDraggingId("");
              setDropStage("");
            }}><div className="com-deal-top"><Avatar initials={item.initials} tone={item.tone} small={true} /><button aria-label={`Ver oportunidade ${item.name}`} onClick={() => openDeal(item)}><MoreHorizontal size={16} /></button></div><b>{item.name}</b><small>{item.company}</small><div className="com-deal-service">{item.service}</div><div className="com-deal-bottom"><strong>{formatLeadAmount(item.value)}</strong><span>{item.date}</span></div><div className="com-deal-actions"><button className="com-deal-open" aria-label={`Abrir ficha de ${item.name}`} title={`Abrir ficha de ${item.name}`} onClick={() => openDeal(item)}>Abrir ficha <ArrowRight size={14} /></button>{index < 6 && <button className="com-deal-open com-deal-advance" aria-label={`Avançar ${item.name} para ${stagesFull[index + 1]}`} title={`Avançar para ${stagesFull[index + 1]}`} onClick={() => onMove?.(item, stagesFull[index + 1])}>Avançar <ArrowRight size={14} /></button>}</div></article>)}{!stageItems.length && <p className="com-stage-empty">Nenhuma oportunidade</p>}</section>;
        })}</div></section><section className="com-insight"><span><Sparkles size={17} /></span><p><b>Pipeline da agência</b> As etapas, oportunidades e valores são atualizados conforme os registros salvos.</p><button onClick={() => window.dispatchEvent(new CustomEvent("nexo:navigate", {
        detail: "CRM"
      }))}>Abrir visão geral <ArrowRight size={14} /></button></section>{selectedDeal && <div className="com-modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !savingDeal) setSelectedDeal(null);
    }}><form className="com-create-modal com-deal-modal" onSubmit={saveDeal}><header><div><small>OPORTUNIDADE · {selectedDeal.company}</small><h2>{selectedDeal.name}</h2></div><button type="button" aria-label="Fechar" onClick={() => setSelectedDeal(null)}><X size={15} /></button></header><div className="com-deal-edit-fields"><label>Etapa<select value={dealDraft.stage} onChange={event => setDealDraft({
              ...dealDraft,
              stage: event.target.value
            })}>{stagesFull.map(stage => <option key={stage}>{stage}</option>)}</select></label><label>Valor estimado<input value={dealDraft.value} onChange={event => setDealDraft({
              ...dealDraft,
              value: event.target.value
            })} /></label><label>Chance de fechamento (%)<input type="number" min="0" max="100" value={dealDraft.chance} onChange={event => setDealDraft({
              ...dealDraft,
              chance: Number(event.target.value)
            })} /></label><label>Origem<input value={dealDraft.source} onChange={event => setDealDraft({
              ...dealDraft,
              source: event.target.value
            })} /></label><label>Servico interessado<input value={dealDraft.service} onChange={event => setDealDraft({
              ...dealDraft,
              service: event.target.value
            })} /></label><label>Responsavel<input value={dealDraft.owner} onChange={event => setDealDraft({
              ...dealDraft,
              owner: event.target.value
            })} /></label><label>Fechamento previsto<input type="date" value={dealDraft.closeDate} onChange={event => setDealDraft({
              ...dealDraft,
              closeDate: event.target.value
            })} /></label><label>Proxima acao<input value={dealDraft.nextAction} onChange={event => setDealDraft({
              ...dealDraft,
              nextAction: event.target.value
            })} /></label><label className="wide">Observacoes<textarea rows="3" value={dealDraft.notes} onChange={event => setDealDraft({
              ...dealDraft,
              notes: event.target.value
            })} /></label></div><p className="com-deal-contact">Contato: {selectedDeal.email || "email nao informado"} · {selectedDeal.phone || "telefone nao informado"}</p><footer><button type="button" className="com-secondary" onClick={() => setSelectedDeal(null)}>Cancelar</button><button type="submit" className="com-primary"><Check size={14} />Salvar oportunidade</button></footer></form></div>}</Fragment>;
}
function ServicesView({
  items,
  totalItems,
  clients,
  onAction,
  onUpdate,
  onDelete,
  onImportCatalog,
  onCreateProject,
  search,
  setSearch,
  catalogImporting = false,
  catalogSeedState = "idle",
  preferences
}) {
  const blank = {
    name: "",
    category: "Presença digital",
    description: "",
    price: "",
    cadence: "Projeto fechado",
    duration: "",
    cost: "",
    responsible: "",
    checklist: "",
    proposalTemplate: "",
    contractTemplate: ""
  };
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(blank);
  const [clientId, setClientId] = useState("");
  const [tab, setTab] = useState("Detalhes");
  const parsePrice = parseCatalogPrice;
  const recurring = items.filter(item => /mensal|recorr/i.test(item.cadence || "")).length;
  const pricedServices = items.map(item => parsePrice(item.price)).filter(price => price > 0);
  const avgPrice = pricedServices.length ? Math.round(pricedServices.reduce((sum, price) => sum + price, 0) / pricedServices.length) : 0;
  const serviceContracts = items.map(service => ({
    service,
    count: clients.filter(client => {
      const names = [...(Array.isArray(client.services) ? client.services : []), ...(client.serviceCharges || []).map(charge => charge.service)].map(name => String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"));
      return names.includes(String(service.name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"));
    }).length
  })).sort((a, b) => b.count - a.count);
  const topContracted = serviceContracts[0]?.count ? serviceContracts[0].service.name : "Sem contratações";
  const [saving, setSaving] = useState(false);
  const save = async event => {
    event?.preventDefault?.();
    if (saving) return;
    const pricing = validateCommercialServicePricing(draft.price, draft.cost);
    if (pricing.error) {
      onAction(pricing.error);
      return;
    }
    const next = {
      ...selected,
      ...draft,
      name: draft.name.trim(),
      price: pricing.price ? `A partir de R$ ${pricing.price}` : "A combinar",
      cadence: draft.cadence || "Projeto fechado",
      duration: draft.duration || "A definir",
      cost: pricing.cost || "A definir",
      responsible: draft.responsible || "Equipe",
      templateTasks: draft.checklist.split("\n").map(line => line.trim()).filter(Boolean),
      proposalTemplate: draft.proposalTemplate,
      contractTemplate: draft.contractTemplate,
      margin: parsePrice(draft.price) ? Math.round((parsePrice(draft.price) - parsePrice(draft.cost)) / parsePrice(draft.price) * 100) : 0,
      color: selected?.color || "blue"
    };
    setSaving(true);
    try {
      const saved = await onUpdate(selected, next);
      if (saved === false) return;
      setSelected(next);
      setTab("Detalhes");
    } catch (error) {
      onAction(error.message || "Não foi possível salvar o serviço. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };
  const deleteService = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (!confirmWorkspaceDelete(`Excluir o serviço "${selected?.name || "sem nome"}" do catálogo?`, preferences)) return;
      const deleted = await onDelete(selected);
      if (deleted !== false) setSelected(null);
    } catch (error) {
      onAction(error.message || "Não foi possível excluir o serviço. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };
  const startProject = async () => {
    const clientRecord = clients.find(item => String(item.id) === clientId);
    if (!clientRecord) return onAction("Selecione um cliente cadastrado para criar o projeto.");
    if (!onCreateProject) return onAction("A gravação de projetos não está disponível no momento.");
    const records = buildServiceProject(selected, clientRecord);
    try {
      await onCreateProject(records.project, records.tasks);
      onAction(`Projeto e ${records.tasks.length} tarefas salvos para ${clientRecord.name}.`);
      setClientId("");
      setTab("Detalhes");
    } catch (error) {
      onAction(error.message || "Não foi possível salvar o projeto e as tarefas.");
    }
  };
  const editService = item => {
    setSelected(item);
    setDraft({
      name: item.name || "",
      category: item.category || "Geral",
      description: item.description || "",
      price: commercialServicePricingInput(item.price),
      cadence: item.cadence || "Projeto fechado",
      duration: item.duration || "",
      cost: commercialServicePricingInput(item.cost),
      responsible: item.responsible || "",
      checklist: (item.templateTasks || []).join("\n"),
      proposalTemplate: item.proposalTemplate || "",
      contractTemplate: item.contractTemplate || ""
    });
    setTab("Detalhes");
  };
  return <Fragment><div className="com-metrics"><Metric label="Serviços cadastrados" value={String(totalItems ?? items.length)} detail="no catálogo atual" icon={Sparkles} tone="blue" /><Metric label="Mais contratado" value={topContracted} detail={serviceContracts[0]?.count ? `${serviceContracts[0].count} cliente${serviceContracts[0].count === 1 ? "" : "s"}` : "Ainda sem clientes vinculados"} icon={ArrowUpRight} tone="green" /><Metric label="Serviços recorrentes" value={String(recurring)} detail="com cobrança recorrente" icon={RefreshCw} tone="purple" /><Metric label="Preço médio base" value={avgPrice ? new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
      }).format(avgPrice) : "—"} detail={avgPrice ? "média dos preços cadastrados" : "Cadastre preços para ver a média"} icon={Wallet} tone="amber" /></div><div className="com-service-toolbar"><div><h2>Catálogo de serviços</h2><p>{catalogSeedState === "loading" ? "Incluindo os serviços que você informou; preços e prazos permanecem sem valores inventados." : catalogSeedState === "error" ? "Não foi possível importar o catálogo automaticamente. Use o botão para tentar novamente." : "Preços e prazos ficam em aberto para você configurar antes de gerar propostas."}</p></div><label className="com-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar serviço..." aria-label="Buscar serviço" /></label><button className="com-secondary" type="button" onClick={onImportCatalog} disabled={catalogImporting}><Download size={14} />{catalogImporting ? "Preparando catálogo…" : totalItems > 0 ? "Completar modelos do catálogo" : "Cadastrar catálogo informado"}</button></div><div className="com-service-grid">{items.map((item, index) => <article key={item.id ?? index} className="com-service-card"><div className="com-service-top"><span className={`com-service-icon ${item.color}`}><Sparkles size={19} /></span><button aria-label={`Mais opções para ${item.name}`} onClick={() => editService(item)}><MoreHorizontal size={18} /></button></div><Badge tone={item.color}>{item.catalogGroup || item.category}</Badge><h3>{item.name}</h3><p>{item.description || "Descrição e escopo a configurar."}</p><div className="com-service-price"><b>{item.price || "Preço a definir"}</b><span>{item.cadence}</span></div><button className="com-service-link" onClick={() => editService(item)}>Configurar serviço <ArrowRight size={15} /></button></article>)}{items.length === 0 && <EmptyState query={search} noun="serviços" onClear={() => setSearch("")} />}</div>{selected && <div className="com-modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) setSelected(null);
    }}><section className="com-create-modal com-service-editor"><header><div><small>CATÁLOGO · TEMPLATE DE ENTREGA</small><h2>{selected.name}</h2></div><button type="button" aria-label="Fechar" onClick={() => setSelected(null)}><X size={15} /></button></header><nav className="com-service-editor-tabs">{["Detalhes", "Template do projeto"].map(name => <button type="button" className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}</button>)}</nav>{tab === "Detalhes" ? <form onSubmit={save}><div className="com-service-editor-fields"><label>Nome<input required={true} value={draft.name} onChange={e => setDraft({
                ...draft,
                name: e.target.value
              })} /></label><label>Categoria<select value={draft.category} onChange={e => setDraft({
                ...draft,
                category: e.target.value
              })}>{["Presença digital", "Conversão", "Desenvolvimento", "Automação", "Conteúdo", "Marca", "Performance", "Suporte", "Consultoria", "Geral"].map(value => <option>{value}</option>)}</select></label><label>Preço base (R$)<input inputMode="decimal" value={draft.price} onChange={e => setDraft({
                ...draft,
                price: e.target.value
              })} placeholder="4500,00" /></label><label>Modelo de cobrança<select value={draft.cadence} onChange={e => setDraft({
                ...draft,
                cadence: e.target.value
              })}><option>Projeto fechado</option><option>Pagamento por etapas</option><option>Mensal</option><option>Anual</option><option>Recorrência personalizada</option></select></label><label>Prazo médio<input value={draft.duration} onChange={e => setDraft({
                ...draft,
                duration: e.target.value
              })} placeholder="Ex.: 20 dias úteis" /></label><label>Custo estimado<input value={draft.cost} onChange={e => setDraft({
                ...draft,
                cost: e.target.value
              })} placeholder="Ex.: R$ 1.200" /></label><label>Responsável padrão<input value={draft.responsible} onChange={e => setDraft({
                ...draft,
                responsible: e.target.value
              })} placeholder="Iniciais ou nome" /></label><label className="wide">Descrição<textarea rows="3" value={draft.description} onChange={e => setDraft({
                ...draft,
                description: e.target.value
              })} /></label><label>Margem estimada<input readOnly={true} value={parsePrice(draft.price) ? `${Math.round((parsePrice(draft.price) - parsePrice(draft.cost)) / parsePrice(draft.price) * 100)}%` : "Informe preco e custo"} /></label><label className="wide">Modelo de proposta<textarea rows="3" value={draft.proposalTemplate} onChange={e => setDraft({
                ...draft,
                proposalTemplate: e.target.value
              })} placeholder="Escopo e condicoes comerciais padrao" /></label><label className="wide">Modelo de contrato<textarea rows="3" value={draft.contractTemplate} onChange={e => setDraft({
                ...draft,
                contractTemplate: e.target.value
              })} placeholder="Termos padrao para revisao" /></label></div><footer><button type="button" className="com-secondary com-delete-action" onClick={() => void deleteService()} disabled={saving}>Excluir serviço</button><span /><button className="com-primary" type="submit" disabled={saving}><Check size={14} />{saving ? "Salvando…" : "Salvar alterações"}</button></footer></form> : <div className="com-service-template"><label>Checklist padrão<textarea rows="8" value={draft.checklist} onChange={e => setDraft({
              ...draft,
              checklist: e.target.value
            })} placeholder="Briefing\nReceber materiais\nCriar primeira versão\nRevisão do cliente\nPublicação" /></label><p>Uma tarefa será criada para cada linha quando você iniciar um projeto por este serviço.</p><div className="com-project-from-template"><label>Cliente do projeto<select required={true} value={clientId} onChange={e => setClientId(e.target.value)}><option value="">Selecione um cliente cadastrado</option>{clients.map(item => <option value={item.id}>{item.name}</option>)}</select></label><button className="com-primary" type="button" disabled={!clientId} onClick={startProject}><Plus size={14} />Criar projeto e tarefas</button></div><button className="com-secondary" type="button" onClick={save}>Salvar template</button></div>}</section></div>}</Fragment>;
}
var _c, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c0, _c1, _c10, _c11, _c12, _c13, _c14, _c15, _c16, _c17, _c18;
