import type { AtlasLink, AtlasNode, NodeKind, Product, ProductKey } from "./types";
import { RELEASES } from "./releases";

/**
 * Documentation tree for help.okta.com (snapshot 24 Sep 2026).
 * add(id, label, url, product, parentId, kind) adds one page; many() adds a list under one parent.
 * Kinds: "doc" = documentation page, "rnhub" = product release-notes index,
 * "rnpage" = release-notes sub page (Production, Preview, archive...).
 */
export const PRODUCTS: Record<ProductKey, Product> = {
  root:  {name:"Okta Docs", color:"#8A94A6"},
  oie:   {name:"Identity Engine", color:"#3B82F6"},
  oce:   {name:"Classic Engine", color:"#8B5CF6"},
  wf:    {name:"Workflows", color:"#10B981"},
  oag:   {name:"Access Gateway", color:"#EF4444"},
  ispm:  {name:"ISPM", color:"#EC4899"},
  mcp:   {name:"Managed MCP Server", color:"#06B6D4"},
  aerial:{name:"Aerial", color:"#84CC16"},
  res:   {name:"Resources", color:"#94A3B8"},
  rn:    {name:"Release notes", color:"#D97706"}
};

const OIE="https://help.okta.com/oie/en-us/content/topics/";
const OCE="https://help.okta.com/en-us/content/topics/";
const WF ="https://help.okta.com/wf/en-us/content/topics/workflows/";
const OAG="https://help.okta.com/oag/en-us/Content/Topics/access-gateway/";
const ISP="https://help.okta.com/ispm/en-us/content/topics/ispm/";
const MCP="https://help.okta.com/mcp/en-us/content/topics/mcpserver/";
const AER="https://help.okta.com/aerial/en-us/content/topics/aerial/";
const CSH=(t: string, id: string)=>"https://help.okta.com/okta_help.htm?"+(t?"type="+t+"&":"")+"id="+id;


const nodes: AtlasNode[] = [];
const links: AtlasLink[] = [];
const byId: Record<string, AtlasNode> = {};

function add(id: string, label: string, url: string, prod: ProductKey, parent?: string | null, kind?: NodeKind): AtlasNode {
  const n: AtlasNode = { id, label, url, prod, kind: kind || "doc", parent: parent || null, level: 0 };
  if (parent) {
    if (!byId[parent]) throw new Error(`docsTree: unknown parent "${parent}" for "${id}"`);
    n.level = byId[parent].level + 1;
    links.push({ source: parent, target: id, kind: n.kind });
  }
  nodes.push(n); byId[id] = n; return n;
}
function many(parent: string, prod: ProductKey, base: string, list: [string, string, string][], kind?: NodeKind) {
  list.forEach(([id, label, path]) => add(id, label, path.startsWith("http") ? path : base + path, prod, parent, kind));
}

/* ---------- Root + product hubs ---------- */
add("root","Okta Documentation","https://help.okta.com/en-us/content/index.htm","root");
add("oie","Identity Engine",CSH("oie","csh-oie"),"oie","root");
add("oce","Classic Engine","https://help.okta.com/en-us/content/index-admin.htm","oce","root");
add("wf","Workflows",CSH("wf","ext-okta-workflows"),"wf","root");
add("oag","Access Gateway",CSH("oag","ext_oag_main"),"oag","root");
add("ispm","Identity Security Posture Mgmt",CSH("ispm","csh-ispm-home"),"ispm","root");
add("mcp","Okta Managed MCP Server",CSH("mcp","mcpserver-mcpserver"),"mcp","root");
add("aerial","Aerial",CSH("aerial","aerial-overview"),"aerial","root");
add("res","Resources","https://help.okta.com/en-us/content/index.htm","res","root");
add("rn","Release Notes","https://help.okta.com/oie/en-us/content/topics/releasenotes/okta-relnotes.htm","rn","root","rnhub");

/* ---------- Identity Engine ---------- */
add("oie-start","Get started",OIE+"identity-engine/oie-get-started.htm","oie","oie");
add("oie-idx","Identity Engine overview",OIE+"identity-engine/oie-index.htm","oie","oie-start");
add("oie-ai","Okta for AI Agents",CSH("oie","ai-agents"),"oie","oie");
many("oie-ai","oie",OIE,[
  ["oie-ai-home","AI agents home","ai-agents/ai-agents-home.htm"],
  ["oie-ai-disc","Discover AI agents","ai-agents/ai-agent-discover.htm"],
  ["oie-ai-man","Add AI agents manually",CSH("oie","ai-agent-add-manually")],
  ["oie-ai-mcp","Add MCP servers",CSH("oie","ai-agent-mcp-server")],
  ["oie-ai-oin","MCP server from OIN catalog",CSH("oie","ai-agent-mcp-server-oin")],
  ["oie-ai-conn","Connect AI agents to resources",CSH("oie","ai-agent-app-connection")],
  ["oie-ai-rs","Resource server connectors",CSH("oie","ai-agent-custom-rsc-svr")],
  ["oie-ai-imp","AI agent imports",CSH("oie","ai-agent-imports-enable")],
  ["oie-ai-gw","Agent Gateway",CSH("oie","agent-gateway")]
]);
add("oie-dash","Dashboard",OIE+"dashboard/dashboard.htm","oie","oie");
many("oie-dash","oie",OIE,[["oie-dash-org","View your org","dashboard/view-your-org.htm"]]);
add("oie-dir","Directory integrations",OIE+"directory/directory-integrations-main.htm","oie","oie");
many("oie-dir","oie",OIE,[
  ["oie-dir-ad","Active Directory agent","directory/ad-agent-main.htm"],
  ["oie-dir-ps","AD PowerShell scripts",CSH("oie","ad-agent-powershell-script")],
  ["oie-dir-db","On-prem connector for databases",CSH("oie","gen-db-connector")]
]);
add("oie-usgp","Users, groups & profiles",OIE+"users-groups-profiles/usgp-main.htm","oie","oie");
many("oie-usgp","oie",OIE,[
  ["oie-usgp-p","People","users-groups-profiles/usgp-people.htm"],
  ["oie-usgp-r","Realms","users-groups-profiles/realms/realms.htm"],
  ["oie-usgp-s","Import safeguards","users-groups-profiles/usgp-import-safeguard.htm"]
]);
add("oie-apps","Applications",OIE+"apps/apps_apps.htm","oie","oie");
many("oie-apps","oie",OIE,[
  ["oie-apps-gs","Apps: get started","apps/apps-overview-get-started.htm"],
  ["oie-apps-oiw","Okta Integration Wizard",CSH("oie","apps-oiw-oiw")],
  ["oie-apps-cimd","Client ID Metadata Documents",CSH("oie","apps-cimd-about")]
]);
add("oie-sec","Security",OIE+"security/security_authentication.htm","oie","oie");
many("oie-sec","oie",OIE,[
  ["oie-sec-ip","Supported IP service categories","security/network/supported-ip-service-categories.htm"],
  ["oie-sec-ti","ThreatInsight System Log events","security/threat-insight/configure-threatinsight-system-log.htm"],
  ["oie-sec-ea","Early Access & Beta features","security/manage-ea-and-beta-features.htm"],
  ["oie-sec-nfc","NFC authenticator",CSH("oie","configure-nfc-authenticator")],
  ["oie-sec-enr","Authenticator enrollment policy",CSH("oie","ext-create-mfa-policy")],
  ["oie-sec-uid","User identification policy",CSH("oie","add-rule-user-id-policy")],
  ["oie-sec-si","Customize sign-in page",CSH("oie","custom-sign-in-page")]
]);
add("oie-dev","Devices & Device Access","https://help.okta.com/oie/en-us/content/topics/oda/dbsso/oda-dbsso.htm","oie","oie");
many("oie-dev","oie",OIE,[
  ["oie-dev-db","Device-Bound SSO","oda/dbsso/oda-dbsso.htm"],
  ["oie-dev-psso","Platform SSO for macOS","oda/macos-pw-sync/about-psso.htm"],
  ["oie-dev-lx","Okta Verify on Linux","identity-engine/devices/ov-install-options-linux.htm"],
  ["oie-dev-dmfa","Desktop MFA factor discovery",CSH("oie","ext-dmfa-factor-discovery-win")]
]);
add("oie-iga","Identity Governance","https://help.okta.com/oie/en-us/content/topics/identity-governance/access-certification/iga-ac-stage-campaign.htm","oie","oie");
many("oie-iga","oie",OIE,[
  ["oie-iga-stage","Stage a campaign","identity-governance/access-certification/iga-ac-stage-campaign.htm"],
  ["oie-iga-cat","Resource catalog visibility",CSH("oie","ar-configure-catalog-visibility")]
]);
add("oie-prov","Provisioning",OIE+"provisioning/workday/workday-provisioning.htm","oie","oie");
many("oie-prov","oie",OIE,[
  ["oie-prov-wd","Workday provisioning","provisioning/workday/workday-provisioning.htm"],
  ["oie-prov-sf","SuccessFactors OAuth 2.0","provisioning/sfec/sfec-configure-oauth2.htm"]
]);
add("oie-rep","Reports",OIE+"reports/monitoring-and-reports.htm","oie","oie");
many("oie-rep","oie",OIE,[
  ["oie-rep-t","Report types","reports/report-types.htm"],
  ["oie-rep-sl","System Log","reports/reports_syslog.htm"]
]);
add("oie-up","Upgrade to Identity Engine",OIE+"identity-engine-upgrade/plan-upgrade-rollout.htm","oie","oie");
many("oie-up","oie",OIE,[["oie-up-f","Feature comparison","identity-engine-upgrade/features.htm"]]);
add("oie-dg","Deployment guides",OIE+"deploymentguides/aws/aws-deployment.htm","oie","oie");
add("oie-agents","Agent version histories",OIE+"settings/version_histories/ver_history_opp_agent.htm","oie","oie");

/* ---------- Classic Engine ---------- */
many("oce","oce",OCE,[
  ["oce-res","Resources (platforms, browsers, agents)","miscellaneous/reference-main.htm"],
  ["oce-up","Upgrade to Identity Engine",CSH("oie","csh-oie-upgrade-eligibility")],
  ["oce-opa","Okta Privileged Access","privileged-access/pam-overview.htm"],
  ["oce-ov","Okta Verify","mobile/okta-verify-overview.htm"],
  ["oce-iga","Identity Governance","identity-governance/iga.htm"],
  ["oce-ti","ThreatInsight","security/threat-insight/ti-index.htm"],
  ["oce-mfa","Multifactor Authentication","security/mfa/mfa-home.htm"],
  ["oce-hi","HealthInsight","security/healthinsight/healthinsight-security-task-recomendations.htm"],
  ["oce-ip","Supported IP service categories","security/network/supported-ip-service-categories.htm"],
  ["oce-safe","Import safeguards","users-groups-profiles/usgp-import-safeguard.htm"]
]);

/* ---------- Workflows ---------- */
add("wf-learn","Learn",WF+"learn/learn-workflows.htm","wf","wf");
many("wf-learn","wf",WF,[
  ["wf-l-el","Workflow elements","workflows-elements.htm"],
  ["wf-l-cards","About cards","learn/about-cards.htm"],
  ["wf-l-ev","About events","learn/about-events.htm"],
  ["wf-l-tab","About tables","learn/about-tables.htm"],
  ["wf-l-lim","Execution limits","learn/about-execution-limits.htm"]
]);
add("wf-build","Build flows",WF+"build/build-flows.htm","wf","wf");
many("wf-build","wf",WF,[
  ["wf-b-conn","Configure a connection","build/configure-connection.htm"],
  ["wf-b-mon","Scheduling & monitoring","build/set-monitor-options.htm"],
  ["wf-b-exp","Export & import flows","build/export-import-flows.htm"],
  ["wf-b-ver","Version history","build/version-history.htm"]
]);
add("wf-exec","Run flows",WF+"execute/run-flows.htm","wf","wf");
many("wf-exec","wf",WF,[
  ["wf-e-api","API endpoint trigger","execute/flow-api-endpoint.htm"],
  ["wf-e-hist","Execution history","execute/execution-history.htm"],
  ["wf-e-log","Flow logging","execute/flow-logging.htm"],
  ["wf-e-err","Error messages","execute/workflows-error-messages.htm"]
]);
add("wf-cb","Connector Builder",WF+"connector-builder/authentication.htm","wf","wf");
many("wf-cb","wf",WF,[
  ["wf-cb-o","OAuth 2.0 auth","connector-builder/authentication-oauth2.htm"],
  ["wf-cb-b","Basic auth","connector-builder/authentication-basic.htm"],
  ["wf-cb-c","Custom auth","connector-builder/authentication-custom.htm"],
  ["wf-cb-ib","Integration Builder",CSH("wf","csh-integration-builder")]
]);
add("wf-cr","Connector reference",WF+"connector-reference/box/box.htm","wf","wf");
many("wf-cr","wf",WF,[
  ["wf-cr-box","Box connector","connector-reference/box/box.htm"],
  ["wf-cr-adobe","Adobe User Management","connector-reference/adobeusermanagement/adobeusermanagement.htm"],
  ["wf-cr-zs","Zscaler connector",CSH("wf","ext-zscaler")]
]);
add("wf-ac","Access control",WF+"access-control/access-control.htm","wf","wf");
many("wf-ac","wf",WF,[
  ["wf-ac-r","Roles","access-control/access-control-roles.htm"],
  ["wf-ac-m","Manage roles","access-control/access-control-manage-roles.htm"]
]);

/* ---------- Access Gateway ---------- */
add("oag-about","About Access Gateway",OAG+"about-oag.htm","oag","oag");
many("oag-about","oag",OAG,[
  ["oag-main","Access Gateway main","ag-main.htm"],
  ["oag-arch","Architecture & components","about-oag-architecture-components.htm"],
  ["oag-refarch","Reference architectures","ref-architectures.htm"],
  ["oag-matrix","Supported technologies","https://help.okta.com/oag/en-us/content/topics/access-gateway/support-matrix.htm"]
]);
add("oag-deploy","Deploy",OAG+"about-oag-deployment-tasks.htm","oag","oag");
many("oag-deploy","oag",OAG,[
  ["oag-pre","Prerequisites","about-oag-prereqs.htm"],
  ["oag-cap","Capacity planning","capacity-planning-sizing.htm"],
  ["oag-inst","Install workflow","install-workflow.htm"],
  ["oag-gs","Get started","get-started.htm"]
]);
add("oag-apps","Applications",OAG+"about-application-integration.htm","oag","oag");
many("oag-apps","oag",OAG,[
  ["oag-apptypes","Application types","about-access-gateway-applications.htm"],
  ["oag-policy","Policies","learn-about-oag-policy.htm"],
  ["oag-cert","Certificates","about-oag-certificates.htm"],
  ["oag-api","Access Gateway API","api-enable-disable.htm"]
]);
add("oag-ops","Operate",OAG+"manage-deployment.htm","oag","oag");
many("oag-ops","oag",OAG,[
  ["oag-ha","High availability","about-high-availability.htm"],
  ["oag-mon","Monitoring","about-oag-monitoring.htm"],
  ["oag-bkp","Backup & restore","task-backup-intro.htm"],
  ["oag-upg","Upgrade","upgrade.htm"],
  ["oag-auto","Auto-Update","configure-auto-update.htm"],
  ["oag-ts","Troubleshooting","troubleshooting.htm"]
]);

/* ---------- ISPM ---------- */
many("ispm","ispm",ISP,[["ispm-ov","Overview","overview.htm"],["ispm-roles","Role assignment","roles.htm"],["ispm-det","Supported detections","supported-detections.htm"]]);
add("ispm-int","Integrations",ISP+"guides.htm","ispm","ispm");
many("ispm-int","ispm",ISP,[
  ["ispm-i-okta","Okta","okta.htm"],["ispm-i-entra","Microsoft Entra ID","microsoft-entra-id-azure-ad.htm"],["ispm-i-ad","AD on-premises","ad-on-prem.htm"],
  ["ispm-i-aws","AWS","aws.htm"],["ispm-i-gh","GitHub","github.htm"],["ispm-i-gws","Google Workspace","google-workspace.htm"],
  ["ispm-i-sf","Salesforce","salesforce.htm"],["ispm-i-sn","ServiceNow","servicenow.htm"],["ispm-i-wd","Workday","workday.htm"],
  ["ispm-i-oin","OIN & custom apps","okta-oin.htm"],["ispm-i-cs","CrowdStrike Falcon","connect-crowdstrike-falcon.htm"],["ispm-i-conn","Connection status","manage-connection-status.htm"]
]);
add("ispm-inv","Inventory",ISP+"inventory.htm","ispm","ispm");
many("ispm-inv","ispm",ISP,[["ispm-inv-f","Advanced filters","ispm-advanced-filters.htm"],["ispm-inv-ai","AI agents","ai-agent-overview.htm"],["ispm-inv-nhi","Non-human identities","nhi.htm"],["ispm-inv-wl","Workload identities","workload-identities-inventory.htm"]]);
add("ispm-mfa","MFA posture",ISP+"mfa-posture.htm","ispm","ispm");
many("ispm-mfa","ispm",ISP,[["ispm-mfa-m","Monitor MFA posture","monitor-mfa-posture.htm"],["ispm-mfa-g","Identify MFA gaps","identify-mfa-gaps.htm"]]);
add("ispm-rem","Issue remediation",ISP+"issue-remediation.htm","ispm","ispm");
many("ispm-rem","ispm",ISP,[["ispm-rem-h","Event hooks","remediation-event-hooks.htm"],["ispm-rem-hc","Configure event hook","config-event-hook.htm"],["ispm-rem-wf","Remediate with Workflows","remediation-okta-workflows.htm"]]);

/* ---------- MCP ---------- */
add("mcp-gs","Get started",MCP+"get-started.htm","mcp","mcp");
many("mcp-gs","mcp",MCP,[["mcp-feat","Supported features","mcpserver-supported-features.htm"],["mcp-auth","App authentication","okta-app-authentication-overview.htm"],["mcp-pkce","OIDC PKCE (browser)","oidc-pkce-browser-based.htm"],["mcp-scope","Scope-based tool loading","scope-based-tool-loading.htm"],["mcp-client","Client configuration","mcp-client-configuration-overview.htm"],["mcp-vsc","VS Code + Copilot","configure-vscode-github-copilot.htm"],["mcp-verify","Verify the connection","verify-the-connection.htm"]]);
add("mcp-uc","Use cases",MCP+"use-cases-okta-managed-mcp-server.htm","mcp","mcp");
many("mcp-uc","mcp",MCP,[["mcp-u-user","User management","user-management.htm"],["mcp-u-grp","Group management","group-management.htm"],["mcp-u-app","Application management","application-management.htm"],["mcp-u-pol","Policy management","policy-management.htm"],["mcp-u-log","System Log","system-log-management.htm"],["mcp-u-dev","Device assurance","device-assurance-management.htm"],["mcp-u-ac","Access certifications","access-certifications.htm"],["mcp-u-ar","Access requests","access-requests.htm"],["mcp-u-ent","Entitlements","entitlement-management.htm"],["mcp-u-cust","Customization","customization-management.htm"]]);
add("mcp-bp","Best practices",MCP+"best-practices.htm","mcp","mcp");

/* ---------- Aerial ---------- */
many("aerial","aerial",AER,[["aer-ov","Overview","overview.htm"],["aer-gs","Get started","get-started.htm"],["aer-users","Set up users","roles/set-up-users.htm"],["aer-member","Member role","roles/member.htm"],["aer-orgs","Associated orgs","view-associated-orgs.htm"],["aer-grp","Create org group","create-org-group.htm"],["aer-consent","Consent","aerial-consent.htm"],["aer-arc","Access request conditions","aerial-access-request-conditions.htm"],["aer-signin","Sign in to managed org","sign-in-managed-org.htm"],["aer-reg","Regions","regions.htm"]]);

/* ---------- Resources ---------- */
many("res","res","",[["res-arch","Architecture Center","https://help.okta.com/en/programs/arch/content/topics/arch/architecture-center.htm"],["res-dev","Okta Developer","https://developer.okta.com/documentation"],["res-sup","Support","https://support.okta.com/help/s"],["res-train","Training","https://www.okta.com/services/training/"],["res-a0","Auth0 Docs","https://auth0.com/docs"],["res-fga","Auth0 FGA Docs","https://docs.fga.dev"]]);

/* ---------- Release notes tree ---------- */
const RNO="https://help.okta.com/oie/en-us/content/topics/releasenotes/";
const RNC="https://help.okta.com/en-us/content/topics/releasenotes/";
add("rn-oie","Identity Engine release notes",RNO+"okta-relnotes.htm","oie","rn","rnhub");
many("rn-oie","oie",RNO,[["rn-oie-prod","IE Production","production.htm"],["rn-oie-prev","IE Preview","preview.htm"],["rn-oie-ea","IE Early Access","early-access.htm"],["rn-oie-ov","Okta Verify release notes","ov/oie-ov-release-notes.htm"],["rn-oie-iga","Identity Governance release notes","iga/iga-release-notes.htm"],["rn-oie-opa","Privileged Access release notes","privileged-access/privileged-access-release-notes.htm"],["rn-oie-arch","IE 2026 archive","archive/oie-relnotes-2026.htm"]],"rnpage");
many("rn-oie-opa","oie",RNO,[["rn-opa-plat","OPA Platform","privileged-access/opa-release-notes-platform.htm"],["rn-opa-dev","OPA Device Tools","privileged-access/opa-release-notes-device-tools.htm"]],"rnpage");
add("rn-oce","Classic Engine release notes",RNC+"okta-relnotes.htm","oce","rn","rnhub");
many("rn-oce","oce",RNC,[["rn-oce-prod","Classic Production","production.htm"],["rn-oce-prev","Classic Preview","preview.htm"],["rn-oce-ea","Classic Early Access","early-access.htm"],["rn-oce-ov","Okta Verify (Classic)","ov/oce-ov-release-notes.htm"],["rn-oce-iga","IGA (Classic)","iga/iga-release-notes.htm"],["rn-oce-opa","Privileged Access (Classic)","privileged-access/privileged-access-release-notes.htm"],["rn-oce-arch","Classic 2026 archive","archive/oce-relnotes-2026.htm"]],"rnpage");
add("rn-wf","Workflows release notes","https://help.okta.com/wf/en-us/content/topics/releasenotes/workflows/workflows-release-notes.htm","wf","rn","rnhub");
many("rn-wf","wf","https://help.okta.com/wf/en-us/content/topics/releasenotes/",[["rn-wf-prod","Workflows Production","workflows/production.htm"],["rn-wf-prev","Workflows Preview","workflows/preview.htm"],["rn-wf-22","Workflows 2022 archive","archive/wf-relnotes-2022.htm"],["rn-wf-21","Workflows 2021 archive","archive/wf-relnotes-2021.htm"]],"rnpage");
add("rn-oag","Access Gateway release notes","https://help.okta.com/oag/en-us/Content/Topics/ReleaseNotes/oag/oag-release-notes.htm","oag","rn","rnhub");
add("rn-oag-vh","OAG version history","https://help.okta.com/oag/en-us/content/topics/releasenotes/oag/oag-version-history.htm","oag","rn-oag","rnpage");
add("rn-ispm","ISPM announcements","https://help.okta.com/ispm/en-us/content/topics/releasenotes/ispm/ispm-rn.htm","ispm","rn","rnhub");
add("rn-mcp","MCP Server release notes","https://help.okta.com/mcp/en-us/content/topics/releasenotes/mcpserver/mcpserver-releasenotes.htm","mcp","rn","rnhub");
add("rn-aer","Aerial release notes","https://help.okta.com/aerial/en-us/content/topics/releasenotes/aerial/aerial-releasenotes.htm","aerial","rn","rnhub");
add("rn-api","Developer API release notes","https://developer.okta.com/docs/release-notes/","res","rn","rnhub");


/* ---------- Release entries become leaf nodes under their release-notes page ---------- */
RELEASES.forEach((r) => {
  const n = add(r.id, `${PRODUCTS[r.prod].name} ${r.ver} · ${r.chan}`, r.url, r.prod, r.parent, "release");
  n.rel = r;
});

const kids: Record<string, AtlasNode[]> = {};
nodes.forEach((n) => { if (n.parent) (kids[n.parent] = kids[n.parent] || []).push(n); });

export const NODES = nodes;
export const LINKS = links;
export const BY_ID = byId;
export const childrenOf = (id: string): AtlasNode[] => kids[id] || [];
export function pathOf(n: AtlasNode): string {
  const a: string[] = []; let c: AtlasNode | null = n;
  while (c) { a.unshift(c.label); c = c.parent ? byId[c.parent] : null; }
  return a.join(" › ");
}
