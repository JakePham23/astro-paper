export type TopicMeta = {
  label: string;
  shortLabel: string;
  desc: string;
};

type BilingualTopicMeta = {
  vi: TopicMeta;
  en: TopicMeta;
};

export const TOPIC_METADATA: Record<string, BilingualTopicMeta> = {
  "00-root": {
    vi: {
      label: "00 · Tổng quan kho kiến thức",
      shortLabel: "00 · Tổng quan",
      desc: "Điểm bắt đầu và bản đồ toàn bộ tài liệu.",
    },
    en: {
      label: "00 · Knowledge Base Overview",
      shortLabel: "00 · Overview",
      desc: "Starting point and full map of all documentation.",
    },
  },
  "01-claude-cli-multi-agent": {
    vi: {
      label: "01 · Claude CLI & Multi-Agent",
      shortLabel: "01 · Claude CLI & Multi-Agent",
      desc: "CLI cơ bản, git worktree, subagent, workflow và prompt.",
    },
    en: {
      label: "01 · Claude CLI & Multi-Agent",
      shortLabel: "01 · Claude CLI & Multi-Agent",
      desc: "CLI fundamentals, git worktree, subagents, workflows, and prompts.",
    },
  },
  "02-quy-trinh-phan-mem": {
    vi: {
      label: "02 · Quy trình phần mềm (SDLC)",
      shortLabel: "02 · Quy trình phần mềm",
      desc: "Từ BRD, SRS/PRD, thiết kế, code review đến release & phê duyệt.",
    },
    en: {
      label: "02 · Software Process (SDLC)",
      shortLabel: "02 · Software Process",
      desc: "From BRD, SRS/PRD, design, and code review to release & approval.",
    },
  },
  "03-ap-dung-voi-agent": {
    vi: {
      label: "03 · Áp dụng với Agent",
      shortLabel: "03 · Áp dụng với Agent",
      desc: "Agent làm gì ở từng giai đoạn và cách kiểm soát đầu ra.",
    },
    en: {
      label: "03 · Applying with Agents",
      shortLabel: "03 · Applying with Agents",
      desc: "What agents do at each stage and how to control output quality.",
    },
  },
  "04-mau": {
    vi: {
      label: "04 · Mẫu tài liệu (Templates)",
      shortLabel: "04 · Mẫu tài liệu",
      desc: "Các template BRD, SRS, ADR, Test Plan, Release Checklist.",
    },
    en: {
      label: "04 · Document Templates",
      shortLabel: "04 · Document Templates",
      desc: "Templates for BRD, SRS, ADR, Test Plan, and Release Checklist.",
    },
  },
  "05-backend-senior": {
    vi: {
      label: "05 · Backend Senior",
      shortLabel: "05 · Backend Senior",
      desc: "Auth, phân quyền, database, API, scale triệu user, Kafka, bảo mật.",
    },
    en: {
      label: "05 · Senior Backend",
      shortLabel: "05 · Senior Backend",
      desc: "Auth, authorization, databases, APIs, million-user scale, Kafka, and security.",
    },
  },
  "06-database-chuyen-sau": {
    vi: {
      label: "06 · Database chuyên sâu",
      shortLabel: "06 · Database chuyên sâu",
      desc: "Postgres internals, index tuning, lock, replication, sharding, Redis.",
    },
    en: {
      label: "06 · Database Deep Dive",
      shortLabel: "06 · Database Deep Dive",
      desc: "Postgres internals, index tuning, locks, replication, sharding, and Redis.",
    },
  },
  "07-he-thong-server": {
    vi: {
      label: "07 · Hệ thống & Server",
      shortLabel: "07 · Hệ thống & Server",
      desc: "Linux, network, load balancer, Docker, Kubernetes, CI/CD, sự cố.",
    },
    en: {
      label: "07 · Systems & Servers",
      shortLabel: "07 · Systems & Servers",
      desc: "Linux, networking, load balancers, Docker, Kubernetes, CI/CD, and incidents.",
    },
  },
  "08-aws-cloud": {
    vi: {
      label: "08 · AWS Cloud",
      shortLabel: "08 · AWS Cloud",
      desc: "IAM, VPC, compute, storage, edge, bảo mật, FinOps và Well-Architected.",
    },
    en: {
      label: "08 · AWS Cloud",
      shortLabel: "08 · AWS Cloud",
      desc: "IAM, VPC, compute, storage, edge, security, FinOps, and Well-Architected.",
    },
  },
  "09-rag-agent-code-intelligence": {
    vi: {
      label: "09 · RAG, Agent & Code Intelligence",
      shortLabel: "09 · RAG, Agent & Code Intel",
      desc: "LLM, RAG, Tree-sitter, symbol graph, A2A/MCP, governance.",
    },
    en: {
      label: "09 · RAG, Agent & Code Intelligence",
      shortLabel: "09 · RAG, Agent & Code Intel",
      desc: "LLMs, RAG, Tree-sitter, symbol graphs, A2A/MCP, and governance.",
    },
  },
  "10-review-sach": {
    vi: {
      label: "10 · Review Sách",
      shortLabel: "10 · Review Sách",
      desc: "Tóm tắt sách, key takeaways và trích dẫn hay.",
    },
    en: {
      label: "10 · Book Reviews",
      shortLabel: "10 · Book Reviews",
      desc: "Book summaries, key takeaways, and notable quotes.",
    },
  },
};

export function getTopicMeta(folder: string, locale: string = "vi"): TopicMeta {
  const entry = TOPIC_METADATA[folder];
  if (!entry) {
    return { label: folder, shortLabel: folder, desc: "" };
  }
  return locale === "en" ? entry.en : entry.vi;
}
