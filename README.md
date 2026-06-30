# CBİKO UEK Otomasyonu 🚀

Bu proje, T.C. Cumhurbaşkanlığı İnsan Kaynakları Ofisi (CBİKO) Uzaktan Eğitim Kapısı (UEK) portalı üzerindeki tüm eğitim süreçlerini (ders izleme, sınav çözme, anket doldurma) otonom hale getiren, tamamen **API anahtarsız, ücretsiz ve limitsiz** çalışan gelişmiş bir Tampermonkey kullanıcı betiğidir (Userscript).

---

## ✨ Özellikler

*   **⚡ Otomatik Ders & Video İzleyici:** Ders videolarını ve slaytları (Articulate Storyline dahil) otomatik algılar, arka planda veya ön planda hızlıca tamamlar ve beklemeden sıradaki derse geçer.
*   **📝 API Anahtarsız AI Sınav Çözücü:** Sınav sayfasındaki soruları otomatik olarak okur ve **Pollinations AI** altyapısı sayesinde hiçbir üyelik, API key veya ücret sınırı olmadan soruları analiz ederek en doğru seçeneği bulup işaretler ve testi bitirir.
*   **📋 Akıllı Anket Doldurucu:** Eğitim sonu değerlendirme anketlerini algılar. Çoktan seçmeli sorularda otomatik olarak en olumlu geri bildirimleri (örn. *Tamamen Katılıyorum*) işaretler, çoklu seçim (checkbox) kutularını doldurur ve yazılması zorunlu metin kutularını otomatik atlatarak anketi saniyeler içinde gönderir.
*   **⏰ Web Worker Arka Plan Zamanlayıcı:** Tarayıcı sekmesi arka plana alındığında veya bilgisayar kilitlendiğinde bile hız sınırlamalarına takılmadan dersleri otonom şekilde izlemeye devam eder.
*   **🎨 Kullanıcı Dostu Panel:** Ekranın sağ alt köşesinde sürecin ilerleme durumunu gösteren, sürüklenebilir şık ve dinamik bir panel bulunur.

---

## 🛠️ Kurulum Yöntemleri

Betiği tarayıcınıza yüklemek için aşağıdaki iki kurulum yönteminden birini kullanabilirsiniz. Öncelikle tarayıcınıza [Tampermonkey](https://www.tampermonkey.net/) (veya Violentmonkey) eklentisini kurduğunuzdan emin olun.

### 1. Yöntem: Tek Tıkla Otomatik Kurulum (Tavsiye Edilen)
En hızlı ve güncellemeleri otomatik almanızı sağlayan yöntemdir:
1. Aşağıdaki bağlantıya tıklayın:
   👉 [CBİKO UEK Otomasyonu Kurulum Bağlantısı](https://raw.githubusercontent.com/mehmetakifsimsek/cbiko-uzaktanegitim-otomasyonu/main/CB%C4%B0KO%20UEK%20Otomasyonu.js)
2. Açılan Tampermonkey ekranında **Yükle (Install)** butonuna basın.
3. Kurulum tamamlandı! Uzaktan Eğitim Kapısı portalına girdiğinizde betik otomatik olarak aktifleşecektir.

---

### 2. Yöntem: Manuel Kopyala-Yapıştır ile Kurulum
Bağlantı sorunu yaşanması durumunda manuel kurulum yapabilirsiniz:
1. Depoda yer alan [CBİKO UEK Otomasyonu.js](https://raw.githubusercontent.com/mehmetakifsimsek/cbiko-uzaktanegitim-otomasyonu/main/CB%C4%B0KO%20UEK%20Otomasyonu.js) dosyasının kodlarını tamamen kopyalayın.
2. Tarayıcınızda **Tampermonkey Kontrol Paneli**'ni açın.
3. Üst menüden **Yeni Betik Ekle** (`+` butonu) seçeneğine tıklayın.
4. Editördeki mevcut şablon kodların tamamını silip, kopyaladığınız kodları yapıştırın.
5. `Dosya` > `Kaydet` (veya `Ctrl + S`) yolunu izleyerek kaydedin.

---

## ⚠️ Yasal Uyarı

Bu betik kişisel eğitim süreçlerini kolaylaştırmak ve otomasyon testleri yapmak amacıyla geliştirilmiştir. Kullanımdan doğabilecek tüm sorumluluk kullanıcıya aittir.

## 📄 Lisans

Bu proje MIT Lisansı ile lisanslanmıştır.
