# HubPanel Deneyim ve Arayüz İlkeleri

## Tasarım hedefi

**All in one panel:** Kullanıcı hangi müşteri alanında ve uygulamada olduğunu her zaman görür. İlk deneyim boş dashboard yerine “Çalışma alanı oluştur → Uygulama bağla → Bağlantıyı test et → Ekibini davet et → İlk işi yap” akışıdır.

HubPanel ilk bakışta sade, günlük kullanımda hızlı ve yönetim açısından güvenilir hissettirmelidir. Amaç Studio Admin'den daha süslü değil, daha anlaşılır ve daha verimli olmaktır.

## Kendi tasarım dili

- HubPanel'e özgü logo ve sembol.
- Kendi renk, boşluk, gölge, köşe ve tipografi tokenları.
- Studio Admin'den birebir alınmış sidebar, kart veya tema kullanılmayacak.
- Tema desteği ilk günden kendi bileşen sistemimizle kurulacak.
- Açık tema varsayılan; koyu tema ve sistem teması desteklenecek.
- Yüksek kontrast ve okunabilirlik öncelikli olacak.

## Ana yerleşim

- Sol tarafta sabitlenebilir, daraltılabilir ana menü.
- Üstte global arama, bildirim, hızlı işlem ve kullanıcı menüsü.
- Üstte belirgin çalışma alanı seçici ve aktif uygulama; alan geçişinde eski form/liste durumu temizlenir. Global arama ve hızlandırıcılar P1 kapsamındadır.
- İçerik alanında net sayfa başlığı ve tek ana eylem.
- Mobilde alt veya çekmece menü; kritik işlemler tek elle erişilebilir.
- Sayfa başına gereksiz kart ve grafik yerine öncelikli bilgi.

## Navigasyon

```text
Genel Bakış
Çalışma Alanı Seçici
Uygulamalar
  Bağlı uygulamalar
  Uygulama bağla
Kullanıcılar
Roller ve Yetkiler
İşlem Kaydı
Güvenlik
  Oturumlar
  2FA Yönetimi
Ayarlar
```

Bu menü kullanıcı izinlerine göre filtrelenir. Yetkisi olmayan öğe gizlenir; ilgili API de ayrıca reddeder.

## Ana ekran

Ana ekranda yalnızca karar vermeye yardım eden bilgiler bulunur:

- Uygulama sağlığı
- Bekleyen işlemler
- Son güvenlik olayları
- Son kullanılan işlemler
- Favori kısayollar
- Sistem uyarıları

Kullanıcı isterse widget düzenini değiştirebilir. İlk sürümde sabit ve sade yerleşim tercih edilecek.

## Global arama ve komut paleti

Tek arama alanından şu sonuçlar dönebilir:

- Kullanıcı
- Rol
- Uygulama
- Ayar
- İşlem kaydı
- Hızlı komut

Komut paleti `Ctrl/Cmd + K` ile açılır. Komutlar kullanıcı yetkisine göre filtrelenir ve sunucuda tekrar kontrol edilir.

## Tutarlı ekran kalıbı

Her yönetim ekranı aynı düzeni kullanır:

1. Başlık ve kısa açıklama
2. Tek ana eylem
3. Arama ve filtreler
4. Liste veya detay
5. Seçili öğe işlemleri
6. Boş, yükleniyor ve hata durumları

Liste ekranlarında sayfa durumu URL'de tutulacak. Filtre, sıralama ve sayfa bağlantısı paylaşılabilir olacak.

URL'ye token, OTP veya hassas kişisel arama metni yazılmaz. Paylaşılabilir filtreler sunucuda izin kontrolünden geçer. Global arama, komut paleti ve favoriler P1; P0 ekran içi filtre ve sade gezinmeyle başlar.

## Form standardı

- Alanların amacı kısa ve açık.
- Satır içi doğrulama.
- Kaydetmeden önce değişiklik özeti.
- Hata olduğunda girilen veri kaybolmaz.
- Yıkıcı işlemlerde açık onay ve mümkünse geri alma.
- Kritik işlemlerde yeniden doğrulama.

## Tablolar

- Cursor tabanlı sayfalama.
- Kolon göster/gizle.
- URL üzerinden filtre.
- Toplu seçim.
- Sabit başlık.
- Mobil için kart görünümü.
- Erişilebilir klavye kontrolleri.

## Bildirimler

- İşlem sonucu için kısa toast.
- Kalıcı uyarılar için bildirim merkezi.
- Güvenlik olayları ayrı önem seviyesiyle gösterilecek.
- E-posta veya SMS bildirim tercihi kullanıcı bazında yönetilecek.

## Erişilebilirlik

- WCAG 2.2 AA hedefi.
- Klavye ile tam kullanım.
- Görünür odak durumu.
- Yeterli renk kontrastı.
- Form alanlarında etiket.
- Hata mesajlarının ekran okuyucuya iletilmesi.
- Hareket azaltma tercihi.

## Performans beklentisi

- İlk yüklemede gereksiz istemci JavaScript'i gönderilmemeli.
- Ağır grafik ve tablolar tembel yüklenmeli.
- Kullanıcı işlemleri için iyimser arayüz yalnızca güvenli olduğunda kullanılmalı.
- Yavaş bağlantıda iskelet yükleme gösterilmeli.

## İlk sürüm ekranları

Uygulama bağlama ekranı teknik ayarları bağlantı kurulumu sırasında gösterir; günlük kullanıcı yalnızca işinin ekranını görür. Bağlantı kartı, API yönetimi ve SSO durumları anlaşılır etiketlerle ayrılır. Kurulumda örnek uygulama seçeneği bulunur.

Kurtarma ekranı yönetim erişimi vermez; kullanıcı yeni TOTP'yi doğrulayıncaya kadar yalnızca kurulum ve çıkış işlemleri görünür. İlk yönetici/davet kurulumunda henüz mevcut olmayan TOTP istenmez.

- Giriş
- 2FA doğrulama
- 2FA kurulum
- Kurtarma kodları
- Davet kabulü, parola sıfırlama ve kısıtlı hesap kurtarma
- Genel bakış
- Çalışma alanı oluşturma/seçme ve üyeler
- Uygulama bağlama, bağlantı testi ve hata giderme
- Kaynak liste/detay ve örnek başlık güncelleme formu
- Uygulamalar
- Uygulama detayı
- Kullanıcılar
- Kullanıcı detayı
- Roller ve yetkiler
- İşlem kaydı
- Güvenlik/oturumlar
- Profil ve güvenlik ayarları
