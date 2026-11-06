# OpenHubPanel

**All in one panel.**

Web sitelerini, uygulamalarını ve yönetim işlerini tek merkezde birleştir.

OpenHubPanel, geliştiricilerin, ajansların ve işletmelerin projelerini bağlayabileceği açık kaynak yönetim merkezi olarak geliştiriliyor. Hem bir uygulamanın admin paneli hem de birden fazla admin panelinin hub'ı olarak kullanılacak. Amaç; her proje için tekrar kullanıcı, yetki, form ve yönetim ekranı kurma yükünü azaltmak.

**Kurucu ve proje sorumlusu:** [Gokhan Gozukara](https://github.com/gokhangozukara) · **Lisans:** [MIT](LICENSE) · **İletişim:** [gokhangozukara@gmail.com](mailto:gokhangozukara@gmail.com)

OpenHubPanel herkesin kullanabileceği, değiştirebileceği ve ticari projelerine dahil edebileceği açık kaynak bir proje olarak geliştiriliyor. Kullanırken telif ve lisans bildirimini koruyun. Katkıda bulunmanız, deneyiminizi paylaşmanız ve projeyi başkalarına önermeniz bizi mutlu eder; bunlar kullanım şartı değildir.

**English — All in one panel:** OpenHubPanel is being built as an open-source admin panel and a hub for your websites, applications, and existing admin tools. Developers and agencies will be able to connect projects through a shared API contract and manage client workspaces with scoped access. Currently in early development: local UI preview and a tested database foundation; not production-ready. MIT licensed; contributions in English and Turkish are welcome. See [Contributing](CONTRIBUTING.md) and the [Security Policy](SECURITY.md).

## Kimler için?

- Müşterisine site yapan geliştirici: API'yi bağla, içerik yönetimini ve müşteri erişimini ortak panelde kur.
- Uygulama geliştiren ekip: kaynaklarını ve işlemlerini tanımla, ortak yönetim ekranlarını kullan.
- Ajans: müşterileri ayrı çalışma alanlarında yönet, her ekibe yalnızca gerekli erişimi ver.
- Birden fazla panel kullanan işletme: uygulamalarını tek merkezde bul ve desteklenen işlemleri buradan yap.

API ile entegre işlemler tek OpenHubPanel oturumundan yürütülecek. Harici panelin kendi ekranına tek giriş için o uygulamanın SSO desteği gerekir; yalnızca bağlantı eklemek bu desteği sağlamaz. [Entegrasyon yaklaşımı](03-Mimari/04-entegrasyon-ve-calisma-alanlari.md)

## Yerelde çalıştır

Node.js 24 ve Git gerekir. Yerel önizleme için Docker veya üretim anahtarı gerekmez.

```sh
git clone https://github.com/gokhangozukara/OpenHubPanel.git
cd OpenHubPanel
npx --yes pnpm@12.18.0 install --frozen-lockfile
npx --yes pnpm@12.18.0 dev
```

http://127.0.0.1:3000/preview adresini aç. **Önizleme örnek veri kullanır; canlı uygulamalara işlem yapmaz.** Üretimde bu yol kapalıdır. Kurulum, testler ve Docker ayrıntıları [geliştirme rehberinde](docs/DEVELOPMENT.md).

## Ana hedefler

- Uygulama kodunun ve arayüz tasarımının tamamı OpenHubPanel ekibine ait olacak.
- Mevcut Studio Admin / SwzHub panelinden kod veya tasarım kopyalanmayacak.
- SwzHub'dan daha sade, daha hızlı ve daha tutarlı bir kullanım sunacak.
- Modül, kullanıcı, rol, yetki, oturum ve denetim yönetimi ilk günden gerçek olacak.
- P0'da TOTP, güvenli oturum ve kurtarma kodları; e-posta doğrulama/bildirim. SMS, Google girişi ve passkey P1 kapsamındadır.
- Yüksek riskli işlemlerde ikinci doğrulama istenecek.

## Mevcut durum

İlk uygulama temeli ve yerel panel önizlemesi oluşturuldu. Bu sürüm geliştirme aşamasındadır; canlı müşteri yönetimine hazır değildir.

- Yerel kaynak ve kilit dosyası sürümleri incelendi; uzak kaynağın güncelliği uygulama öncesinde yeniden kontrol edilecek.
- SwzHub ve Studio Admin referans kopyaları yalnızca yerel araştırma alanında tutuluyor.
- Ürün stratejisi, güvenlik yaklaşımı, teknik mimari ve faz planı hazırlandı.
- Bağımsız inceleme yapıldı; güvenlik çelişkileri ve P0/P1 kapsamı düzeltildi.
- pnpm monorepo, Next.js uygulaması, TypeScript strict, Biome ve CI kuruldu.
- Yerel panel kabuğu; uygulama arama, alan değiştirme, ekip görünümü, tema ve örnek formları içeriyor.
- Gerçek PostgreSQL üzerinde ilk RLS/üyelik/audit sınırları test edildi.
- Gerçek giriş/TOTP, davet, connector ve pilot entegrasyonu henüz tamamlanmadı.

İlk kullanılabilir sürüm: müşteri çalışma alanları, güvenli giriş, kullanıcı/rol/oturum yönetimi, audit, belgeli connector sözleşmesi ve gerçek bir örnek yönetim işlemi. İkinci bağımsız örnek uygulama salt okunur bağlantıyla sözleşmeyi doğrulayacak. HubStag ve SwzHub örnek adaylardır; ürünün çalışması bunlara bağlı olmayacak. Bu belgeler uygulanmış güvenlik kontrolleri veya üretime hazır ürün iddiası değildir.

Önce [inceleme raporunu](01-Arastirma/03-bagimsiz-inceleme.md) ve [proje durumunu](PROJE-DURUMU.md) okuyabilirsiniz. Public repo hazırlığındaki açık kararlar [yayın kontrol listesindedir](04-Fazlar/01-public-repo-yayin-kontrolu.md).

## Okuma sırası

Geliştirmeyi devralan AI için [başlangıç görevi](07-AI-Teslim/UYGULAMAYA-BASLA.md) hazırdır. İlk gerçek kullanıcı kendi HubStag ekibimiz; [pilot ve mobil sırası](04-Fazlar/02-pilot-ve-mobil-plani.md) ayrıca kayıtlıdır.

Ürün yönü için önce [ADR-005](06-Kararlar/ADR-005-admin-panellerinin-hubu.md) ve [kullanıcı yolculukları](02-Strateji/03-kullanici-yolculuklari.md) okunur. Önceki incelemedeki tek kuruluş/salt okunur P0 sınırı bu kararla güncellenmiştir.

1. [01-Arastirma/01-kaynaklar-ve-surumler.md](01-Arastirma/01-kaynaklar-ve-surumler.md)
2. [01-Arastirma/03-bagimsiz-inceleme.md](01-Arastirma/03-bagimsiz-inceleme.md)
3. [02-Strateji/01-urun-stratejisi.md](02-Strateji/01-urun-stratejisi.md)
4. [02-Strateji/02-urun-gereksinimleri.md](02-Strateji/02-urun-gereksinimleri.md)
5. [03-Mimari/01-teknik-mimari.md](03-Mimari/01-teknik-mimari.md)
6. [03-Mimari/02-guvenlik-ve-2fa.md](03-Mimari/02-guvenlik-ve-2fa.md)
7. [05-Tasarim/01-deneyim-ve-arayuz.md](05-Tasarim/01-deneyim-ve-arayuz.md)
8. [04-Fazlar/00-yol-haritasi.md](04-Fazlar/00-yol-haritasi.md)
9. [07-AI-Teslim/TALIMLAR.md](07-AI-Teslim/TALIMLAR.md)

Güvenlik değişiklikleri için [ADR-004](06-Kararlar/ADR-004-guvenlik-incelemesi.md), test kapsamı için [tehdit modeli](03-Mimari/03-tehdit-modeli-ve-kabul-testleri.md) ayrıca okunur. Yerel kopyalar mevcutsa `01-Arastirma/02-swzhub-degerlendirmesi.md` ve `01-Arastirma/04-referans-kod-incelemesi.local.md` yalnızca yerel değerlendirme için okunabilir; public depoda bulunmaları beklenmez.

## Klasörler

- `01-Arastirma`: Kaynak, sürüm ve mevcut panel değerlendirmesi.
- `02-Strateji`: Ürün yönü, hedef kullanıcılar, kapsam ve ayrıştırıcılar.
- `03-Mimari`: Teknik yapı ve güvenlik modeli.
- `04-Fazlar`: Uygulama sırası, teslimatlar ve kabul ölçütleri.
- `05-Tasarim`: Kullanım ve arayüz ilkeleri.
- `06-Kararlar`: Değiştirilmesi kontrollü mimari kararlar.
- `07-AI-Teslim`: Sonraki geliştirme ajanları için çalışma kuralları.
- `BundanOrnekAlacaz`: Yalnızca yerelde tutulan referans kopyaları; public depoya ve build bağlamına dahil edilmez.

## Kod sahipliği kuralı

`BundanOrnekAlacaz` altındaki dosyalar referanstır. Bu dosyalardan doğrudan üretim koduna kopyalama yapılmayacaktır. Açık kaynak kütüphane kullanmak serbesttir; OpenHubPanel uygulama kodu, bileşen yapısı, stil sistemi ve iş akışları özgün olacaktır.

Referanslarda MIT lisansı bulunduğu için mevcut lisans dosyaları korunmuştur. Yalnızca araştırma amacıyla tutulan kopyalar public Git deposuna ve üretim paketine dahil edilmeyecektir. OpenHubPanel'in kendi kod ve belgeleri kökteki [MIT lisansı](LICENSE) ile sunulur; üçüncü taraf bileşenlerin kendi lisansları ve bildirimleri korunur. Katkıcılar kendi katkılarının telif hakkını korur.

## Katkı ve iletişim

Ekip daveti, müşteriye devir, bağlantı kesintisi ve veri taşıma ayrıntıları [günlük kullanım kontrolünde](02-Strateji/04-gunluk-kullanim-kontrolu.md) kayıtlıdır.

Kod, test, dokümantasyon, çeviri, erişilebilirlik ve tasarım geri bildirimleriyle katkıda bulunabilirsiniz. Başlangıç adımları [katkı rehberindedir](CONTRIBUTING.md). Hata ve özellik önerileri [GitHub Issues](https://github.com/gokhangozukara/OpenHubPanel/issues) üzerinden takip edilir; güvenlik açıkları [özel bildirim kanalına](SECURITY.md) gönderilmelidir.
