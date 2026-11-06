// Synthetic data for /preview only. No production service reads these fixtures.
export const workspaces = [
  { id: "atlas", name: "Atlas Ajans", initials: "AA", description: "Müşteri projeleri ve ekip" },
  { id: "ada", name: "Ada Tasarım", initials: "AT", description: "Tasarım ekibinin çalışma alanı" },
] as const;

export const applications = [
  {
    id: "content",
    workspace: "atlas",
    name: "İçerik Stüdyosu",
    category: "Web sitesi",
    description: "Yazılar, sayfalar ve içerik yönetimi",
    initials: "İS",
    color: "teal",
    status: "connected",
    permission: "Okuma ve düzenleme",
    resources: 2,
    updated: "Az önce",
  },
  {
    id: "support",
    workspace: "atlas",
    name: "Talep Merkezi",
    category: "Uygulama",
    description: "Müşteri talepleri ve destek kayıtları",
    initials: "TM",
    color: "blue",
    status: "connected",
    permission: "Salt okunur",
    resources: 1,
    updated: "2 dk önce",
  },
  {
    id: "portfolio",
    workspace: "atlas",
    name: "Portfolyo",
    category: "Web sitesi",
    description: "Proje vitrini ve yayınlanan çalışmalar",
    initials: "P",
    color: "amber",
    status: "pending",
    permission: "Bağlantı bekliyor",
    resources: 0,
    updated: "Henüz bağlanmadı",
  },
  {
    id: "design",
    workspace: "ada",
    name: "Tasarım Günlüğü",
    category: "Web sitesi",
    description: "Tasarım notları ve yayın akışı",
    initials: "TG",
    color: "teal",
    status: "connected",
    permission: "Salt okunur",
    resources: 1,
    updated: "5 dk önce",
  },
] as const;
export type PreviewApplication = (typeof applications)[number];

export const members = [
  {
    workspace: "atlas",
    name: "Demo Yönetici",
    initials: "DY",
    email: "yonetici@example.test",
    role: "Çalışma alanı sahibi",
    color: "teal",
  },
  {
    workspace: "atlas",
    name: "Deniz Kaya",
    initials: "DK",
    email: "deniz@example.test",
    role: "Yönetici",
    color: "blue",
  },
  {
    workspace: "atlas",
    name: "Ece Yılmaz",
    initials: "EY",
    email: "ece@example.test",
    role: "Editör",
    color: "amber",
  },
  {
    workspace: "ada",
    name: "Demo Yönetici",
    initials: "DY",
    email: "yonetici@example.test",
    role: "Görüntüleyici",
    color: "teal",
  },
] as const;

export const activities = [
  {
    workspace: "atlas",
    title: "İçerik başlığı düzenlendi",
    detail: "Deniz Kaya · İçerik Stüdyosu",
    time: "5 dk önce",
    type: "edit",
  },
  {
    workspace: "atlas",
    title: "Ece ekibe katıldı",
    detail: "Editör rolü ile daveti kabul etti",
    time: "24 dk önce",
    type: "member",
  },
  {
    workspace: "atlas",
    title: "Talep Merkezi bağlandı",
    detail: "Salt okunur erişim etkinleştirildi",
    time: "1 sa önce",
    type: "app",
  },
  {
    workspace: "ada",
    title: "Örnek çalışma alanı açıldı",
    detail: "Tasarım Günlüğü · Salt okunur",
    time: "5 dk önce",
    type: "app",
  },
] as const;
