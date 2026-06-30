// ==UserScript==
// @name         CBİKO UEK Otomasyonu
// @namespace    https://uzaktanegitimkapisi.cbiko.gov.tr/
// @version      1.5
// @description  Uzaktan Eğitim Kapısı — Tam Otomatik Ders İzleyici + Sınav Cevaplama
// @homepage     https://uzaktanegitimkapisi.gov.tr/
// @author       mehmetakifsimsek
// @match        https://*.cbiko.gov.tr/*
// @match        https://uzaktanegitimkapisi.gov.tr/*
// @match        https://*.uzaktanegitimkapisi.gov.tr/*
// @icon         https://github.com/user-attachments/assets/6447e381-e56c-4995-ad3d-f62f272db3c3
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @connect      pollinations.ai
// @connect      text.pollinations.ai
// @updateURL    https://raw.githubusercontent.com/mehmetakifsimsek/cbiko-uzaktanegitim-otomasyonu/main/CB%C4%B0KO%20UEK%20Otomasyonu.js
// @downloadURL  https://raw.githubusercontent.com/mehmetakifsimsek/cbiko-uzaktanegitim-otomasyonu/main/CB%C4%B0KO%20UEK%20Otomasyonu.js
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const url = window.location.href.toLowerCase();
    const isVideo = url.includes('/video') || url.includes('/streams/') || url.includes('story.html') || url.includes('/scorm');
    const isSinav = url.includes('/sinav');
    const isAnket = url.includes('/anket');

    if (!isVideo && !isSinav && !isAnket) {
        console.log('[UEK] Bu sayfa otomasyon kapsamı dışında, betik sonlandırıldı.');
        return;
    }

    // SCORM/Storyline sayfalarında bu engellemeleri çalıştırma!
    const isSCORM = window.location.href.includes('story.html') || window.location.href.toLowerCase().includes('scorm') || typeof window.GetPlayer === 'function';

    if (!isSCORM) {
        // Hızlı ileri sararken sıfırlanmayı önlemek için seeking/seeked/ratechange olaylarını yakala ve durdur
        const preventResetEvents = ['seeking', 'seeked', 'ratechange'];
        preventResetEvents.forEach(type => {
            window.addEventListener(type, e => {
                if (e.target instanceof HTMLMediaElement) {
                    e.stopImmediatePropagation();
                }
            }, true); // capturing fazı, önce biz yakalayıp durduralım
        });

        // Sekme arka plana alındığında videonun durmasını önlemek için blur olayını yakala ve durdur
        window.addEventListener('blur', e => {
            e.stopImmediatePropagation();
        }, true);

        // Görünürlük değiştiğinde tetiklenen olayları engelle
        document.addEventListener('visibilitychange', e => {
            e.stopImmediatePropagation();
        }, true);

        // Doğrudan document.hidden veya document.visibilityState okuyan siteler için sahte değerler tanımla
        try {
            Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
        } catch(e) {}
    }

    const workerBlob = new Blob([`
        let timers = {};
        let nextId = 1;
        self.onmessage = function(e) {
            const msg = e.data;
            if (msg.cmd === 'setInterval') {
                const id = nextId++;
                timers[id] = setInterval(() => self.postMessage({ id: id }), msg.ms);
                self.postMessage({ created: id });
            } else if (msg.cmd === 'clearInterval') {
                if (timers[msg.id]) {
                    clearInterval(timers[msg.id]);
                    delete timers[msg.id];
                }
            }
        };
    `], { type: 'application/javascript' });

    let timerWorker = null;
    const workerCallbacks = {};

    try {
        timerWorker = new Worker(URL.createObjectURL(workerBlob));
        timerWorker.onmessage = function(e) {
            if (e.data.id && workerCallbacks[e.data.id]) {
                workerCallbacks[e.data.id]();
            }
        };
        console.log('[UEK] Web Worker timer oluşturuldu');
    } catch(e) {
        console.log('[UEK] Worker oluşturulamadı, normal timer kullanılacak');
    }

    function reliableSetInterval(callback, ms) {
        if (timerWorker) {
            const id = Object.keys(workerCallbacks).length + 1;
            workerCallbacks[id] = callback;
            timerWorker.postMessage({ cmd: 'setInterval', ms: ms });
            return { type: 'worker', id: id };
        } else {
            return { type: 'native', id: setInterval(callback, ms) };
        }
    }

    function reliableClearInterval(handle) {
        if (!handle) return;
        if (handle.type === 'worker' && timerWorker) {
            timerWorker.postMessage({ cmd: 'clearInterval', id: handle.id });
            delete workerCallbacks[handle.id];
        } else if (handle.type === 'native') {
            clearInterval(handle.id);
        }
    }

    function dualSetInterval(callback, ms) {
        const w = reliableSetInterval(callback, ms);
        const n = { type: 'native', id: setInterval(callback, ms * 1.5) };
        return { worker: w, native: n };
    }

    function dualClearInterval(handle) {
        if (!handle) return;
        reliableClearInterval(handle.worker);
        if (handle.native) clearInterval(handle.native.id);
    }

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(fn, 2000));
        } else {
            setTimeout(fn, 2000);
        }
    }

    onReady(function() {
        console.log('[UEK] Başlatılıyor...');
        if (typeof GM_deleteValue !== 'undefined') {
            GM_deleteValue('gemini_api_key');
            GM_deleteValue('openrouter_key');
        }

        window.addEventListener('blur', e => e.stopImmediatePropagation(), true);

        function setBadge(text, color) {
            let el = document.getElementById('uek-badge');
            if (!el) {
                el = document.createElement('div');
                el.id = 'uek-badge';
                el.style.cssText = `
                    position:fixed; bottom:10px; right:10px; z-index:99999;
                    background:rgba(0,0,0,0.85); padding:10px 16px;
                    border-radius:8px; font:bold 13px Arial,sans-serif;
                    box-shadow:0 2px 10px rgba(0,0,0,0.3);
                    cursor:move; user-select:none; max-width:300px;
                `;
                document.body.appendChild(el);

                let isDragging = false;
                let offsetX = 0;
                let offsetY = 0;

                el.addEventListener('mousedown', function(e) {
                    isDragging = true;
                    offsetX = e.clientX - el.getBoundingClientRect().left;
                    offsetY = e.clientY - el.getBoundingClientRect().top;
                    el.style.bottom = 'auto';
                    el.style.right = 'auto';
                });

                document.addEventListener('mousemove', function(e) {
                    if (!isDragging) return;
                    el.style.left = (e.clientX - offsetX) + 'px';
                    el.style.top = (e.clientY - offsetY) + 'px';
                });

                document.addEventListener('mouseup', function() {
                    isDragging = false;
                });

                el.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    
                    const oldMenu = document.getElementById('uek-context-menu');
                    if (oldMenu) oldMenu.remove();

                    const menuWidth = 180;
                    const menuHeight = 160;
                    let left = e.clientX;
                    let top = e.clientY;

                    if (left + menuWidth > window.innerWidth) {
                        left = window.innerWidth - menuWidth - 10;
                    }
                    if (top + menuHeight > window.innerHeight) {
                        top = window.innerHeight - menuHeight - 10;
                    }
                    if (left < 10) left = 10;
                    if (top < 10) top = 10;

                    const menu = document.createElement('div');
                    menu.id = 'uek-context-menu';
                    menu.style.cssText = `
                        position: fixed; left: ${left}px; top: ${top}px; z-index: 100000;
                        background: #1e1e1e; border: 1px solid #4CAF50; border-radius: 6px;
                        padding: 4px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                        font-family: Arial, sans-serif; font-size: 13px; color: #fff;
                        min-width: 170px;
                    `;

                    const item1 = document.createElement('div');
                    item1.textContent = '➡️ İçerik Atlamayı Tetikle';
                    item1.style.cssText = 'padding: 8px 12px; cursor: pointer; transition: background 0.2s;';
                    item1.onmouseover = () => item1.style.background = '#333';
                    item1.onmouseout = () => item1.style.background = 'none';
                    item1.onclick = () => {
                        menu.remove();
                        console.log('[UEK] Manuel İçerik Atlama tetiklendi');
                        setBadge('⚡ Manuel atlama tetiklendi...', '#FF9800');
                        if (typeof isStoryline !== 'undefined' && isStoryline) {
                            clickStorylineNext();
                        } else {
                            const video = getVideo();
                            if (video) startFF(video);
                            else goToNextLesson();
                        }
                    };

                    const item2 = document.createElement('div');
                    item2.textContent = '📝 Sınav Modunu Tetikle';
                    item2.style.cssText = 'padding: 8px 12px; cursor: pointer; transition: background 0.2s; border-top: 1px solid #333;';
                    item2.onmouseover = () => item2.style.background = '#333';
                    item2.onmouseout = () => item2.style.background = 'none';
                    item2.onclick = () => {
                        menu.remove();
                        console.log('[UEK] Manuel Sınav Modu tetiklendi');
                        setBadge('📝 Manuel Sınav Modu...', '#9C27B0');
                        if (typeof startQuizAutomation === 'function') {
                            startQuizAutomation();
                        } else {
                            console.log('[UEK] Hata: startQuizAutomation fonksiyonu bulunamadı!');
                        }
                    };

                    menu.appendChild(item1);
                    menu.appendChild(item2);
                    document.body.appendChild(menu);

                    const closeMenu = (e2) => {
                        if (!menu.contains(e2.target)) {
                            menu.remove();
                            document.removeEventListener('click', closeMenu);
                        }
                    };
                    setTimeout(() => document.addEventListener('click', closeMenu), 100);
                });
            }
            el.textContent = text;
            el.style.color = color || '#4CAF50';
            el.style.border = `1px solid ${color || '#4CAF50'}`;
        }

        const scoFrame = document.querySelector('iframe#ScoFrame');
        if (scoFrame) {
            const src = scoFrame.getAttribute('src') || scoFrame.src;
            if (src) {
                const overlay = document.createElement('div');
                overlay.style.cssText = 'background:#fff;width:80%;position:fixed;top:30%;left:10%;z-index:10900;border:2px solid #000;padding:20px;text-align:center;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
                overlay.innerHTML = `
                    <h1>Videolar Yeni Sekmede Açılacak</h1>
                    <h2 style="color:#666;">Tüm videolar tamamlanıncaya kadar bu ana sekmeyi KAPATMAYIN ve YENİLEMEYİN!</h2>
                    <a style="display:block;font-size:16px;background:#333;border-radius:5px;color:#fff;font-weight:bold;padding:10px;text-decoration:none;margin-top:15px;"
                       href="${src}" target="cnylmzUEK" rel="opener">Yeni Sekmede Aç</a>
                `;
                document.body.appendChild(overlay);
            }
            return;
        }

        function getActiveLessonIndex() {
            const items = document.querySelectorAll('#DvIcerik .konu-item');
            for (let i = 0; i < items.length; i++) {
                const td = items[i].closest('td');
                if (td && td.classList.contains('active')) {
                    return i;
                }
            }
            return -1;
        }

        function getLessonList() {
            return document.querySelectorAll('#DvIcerik .konu-item');
        }

        function goToNextLesson() {
            const lessons = getLessonList();
            const activeIdx = getActiveLessonIndex();

            console.log(`[UEK] Aktif ders: ${activeIdx + 1} / ${lessons.length}`);

            if (activeIdx < 0) {
                for (const lesson of lessons) {
                    const icon = lesson.querySelector('i.fa');
                    if (icon && (icon.classList.contains('fa-stop') || icon.classList.contains('fa-play'))) {
                        console.log('[UEK] Tamamlanmamış ders bulundu, tıklanıyor...');
                        setBadge('➡️ Tamamlanmamış derse geçiliyor...', '#FF9800');
                        setTimeout(() => { lesson.click(); }, 500);
                        return true;
                    }
                }
                setBadge('✅ Tüm dersler tamamlandı!', '#4CAF50');
                return false;
            }

            if (activeIdx + 1 < lessons.length) {
                const nextLesson = lessons[activeIdx + 1];
                const nextName = nextLesson.textContent.trim().replace(/\s+/g, ' ');
                console.log('[UEK] Sonraki ders:', nextName);
                setBadge(`➡️ Sonraki: ${nextName}`, '#2196F3');

                setTimeout(() => {
                    nextLesson.click();
                    setTimeout(() => {
                        const href = nextLesson.getAttribute('href');
                        if (href) {
                            window.location.href = href;
                        }
                    }, 1000);
                }, 1500);
                return true;
            } else {
                console.log('[UEK] Son ders tamamlandı!');
                setBadge('🎉 Tüm dersler tamamlandı!', '#4CAF50');
                return false;
            }
        }

        function clickPopups() {
            const selectors = [
                '.swal-button--confirm',
                '.swal2-confirm',
                '.swal-button',
                'button.confirm',
                '.modal .btn-primary',
                '.modal .btn-success',
                'button[data-bb-handler="confirm"]',
                '.bootbox-accept',
            ];
            let clicked = false;
            for (const sel of selectors) {
                document.querySelectorAll(sel).forEach(btn => {
                    if (btn.offsetParent !== null) {
                        btn.click();
                        clicked = true;
                        console.log('[UEK] Popup tıklandı:', btn.textContent.trim());
                    }
                });
            }
            const kw = ['tamam','evet','onayla','devam','ok','confirm','yes','kabul','kapat','tamamla'];
            document.querySelectorAll('button, a.btn, input[type="button"], input[type="submit"]').forEach(btn => {
                const t = (btn.textContent || btn.value || '').trim().toLowerCase();
                if (kw.some(k => t === k || (t.length < 20 && t.includes(k)))) {
                    if (btn.offsetParent !== null && !btn.disabled) {
                        btn.click();
                        clicked = true;
                        console.log('[UEK] Onay tıklandı:', t);
                    }
                }
            });
            return clicked;
        }

        let ffHandle = null;
        let videoEnded = false;
        let navigatingNext = false;

        function startFF(video) {
            if (ffHandle) return;
            videoEnded = false;
            console.log('[UEK] Hızlı ileri sarma başladı (Worker timer)');

            video.addEventListener('pause', function() {
                if (!videoEnded && !navigatingNext) {
                    setTimeout(() => video.play().catch(() => {}), 50);
                }
            });

            const ffCallback = () => {
                if (!video || videoEnded || navigatingNext) return;

                if (video.paused && !video.ended) {
                    video.play().catch(() => {});
                    return;
                }

                if (video.ended) {
                    videoEnded = true;
                    dualClearInterval(ffHandle);
                    ffHandle = null;
                    onVideoEnded();
                    return;
                }

                if (video.duration > 0) {
                    const newTime = video.currentTime + 5;
                    if (newTime >= video.duration - 0.2) {
                        video.currentTime = video.duration - 0.1;
                        setTimeout(() => {
                            if (!videoEnded) {
                                videoEnded = true;
                                dualClearInterval(ffHandle);
                                ffHandle = null;
                                onVideoEnded();
                            }
                        }, 1000);
                    } else {
                        video.currentTime = newTime;
                    }
                }
            };

            ffHandle = dualSetInterval(ffCallback, 100);
        }

        function stopFF() {
            if (ffHandle) {
                dualClearInterval(ffHandle);
                ffHandle = null;
            }
        }

        function onVideoEnded() {
            if (navigatingNext) return;

            if (isStoryline) {
                console.log('[UEK] Storyline slayt videosu bitti. Sonraki slayta geçiliyor...');
                setBadge('✅ Slayt tamamlandı — sonraki slayta geçiliyor...', '#2196F3');
                
                setTimeout(() => {
                    const clicked = clickStorylineNext();
                    if (clicked) {
                        videoEnded = false;
                    }
                }, 1500);
                return;
            }

            console.log('[UEK] Video bitti! Popup bekleniyor...');
            setBadge('✅ Video bitti — popup tıklanıyor...', '#2196F3');

            let popupAttempt = 0;
            const popupInterval = setInterval(() => {
                popupAttempt++;
                const clicked = clickPopups();

                if (clicked || popupAttempt > 5) {
                    clearInterval(popupInterval);

                    setTimeout(() => {
                        clickPopups();

                        setTimeout(() => {
                            navigatingNext = true;
                            setBadge('➡️ Sonraki derse geçiliyor...', '#FF9800');
                            goToNextLesson();
                        }, 1000);
                    }, 1500);
                }
            }, 2000);
        }

        const isStoryline = window.location.href.includes('story.html') || typeof window.GetPlayer === 'function';

        function getVideo() {
            const videos = document.querySelectorAll('video');
            if (videos.length === 0) return null;
            if (videos.length === 1) return videos[0];

            for (const v of videos) {
                try {
                    const src = v.src || v.currentSrc || '';
                    if (v.duration > 0 && !src.startsWith('data:')) {
                        return v;
                    }
                } catch(e) {}
            }

            for (const v of videos) {
                if (v.offsetParent !== null) {
                    return v;
                }
            }

            return videos[videos.length - 1];
        }

        function clickStorylineNext() {
            const candidates = document.querySelectorAll('[data-acc-text], [aria-label], [class*="next"], [id*="next"], button, a, div[role="button"]');
            const keywords = ['next', 'sonraki', 'ileri', 'devam', 'skip', 'geç', 'gec', 'sürdür', 'surdur'];
            
            for (const el of candidates) {
                if (el.offsetParent === null) continue;
                
                const accText = (el.getAttribute('data-acc-text') || '').toLowerCase();
                const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                const id = (el.id || '').toLowerCase();
                const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
                const text = el.textContent.trim().toLowerCase();
                
                const isMatch = keywords.some(kw => 
                    accText.includes(kw) || 
                    ariaLabel.includes(kw) || 
                    id.includes(kw) || 
                    cls.includes(kw) ||
                    (text.length < 30 && text.includes(kw))
                );
                
                if (isMatch) {
                    console.log('[UEK] Storyline Next slayt butonu tıklandı:', text || accText || ariaLabel || id);
                    el.click();
                    return true;
                }
            }
            return false;
        }

        function startVideo() {
            const video = getVideo();
            if (!video) {
                setBadge(isStoryline ? '⏳ Storyline slaytı bekleniyor...' : '⏳ Video aranıyor...', '#FF9800');
                if (isStoryline) {
                    setTimeout(() => {
                        if (!getVideo()) {
                            console.log('[UEK] Slaytta video bulunamadı, geçiş deneniyor');
                            clickStorylineNext();
                        }
                    }, 5000);
                }
                return;
            }

            if (!isStoryline) {
                const lessons = getLessonList();
                const activeIdx = getActiveLessonIndex();
                const activeName = activeIdx >= 0
                    ? lessons[activeIdx].textContent.trim().replace(/\s+/g, ' ')
                    : '?';
                console.log(`[UEK] Ders ${activeIdx + 1}/${lessons.length}: ${activeName}`);
                setBadge(`🎬 ${activeIdx + 1}/${lessons.length}: ${activeName}`, '#4CAF50');
            } else {
                setBadge(`🎬 Storyline Video Oynatılıyor...`, '#4CAF50');
            }

            const playBtn = document.querySelector('.vjs-big-play-button');
            if (playBtn) playBtn.click();

            try {
                if (typeof videojs !== 'undefined') {
                    const p = videojs.getPlayer('CbikoPl');
                    if (p) p.play().catch(() => {});
                }
            } catch(e) {}

            video.play().catch(() => {});

            setTimeout(() => startFF(video), 500);

            video.addEventListener('ended', () => {
                if (!videoEnded) {
                    videoEnded = true;
                    stopFF();
                    onVideoEnded();
                }
            });
        }

        function statusLoop() {
            if (navigatingNext) return;

            const video = getVideo();
            if (!video) {
                setBadge(isStoryline ? '⏳ Storyline slaytı yükleniyor...' : '⏳ Video bekleniyor...', '#FF9800');
                if (isStoryline) {
                    clickStorylineNext();
                }
                return;
            }

            if (video.ended && !videoEnded) {
                videoEnded = true;
                stopFF();
                onVideoEnded();
                return;
            }

            if (!videoEnded && video.duration > 0) {
                const pct = Math.floor((video.currentTime / video.duration) * 100);
                const kalan = Math.ceil((video.duration - video.currentTime) / 50);

                if (!isStoryline) {
                    const lessons = getLessonList();
                    const activeIdx = getActiveLessonIndex();

                    setBadge(
                        `🎬 Ders ${activeIdx+1}/${lessons.length} — %${pct} (~${kalan}sn kaldı)`,
                        '#4CAF50'
                    );
                } else {
                    setBadge(
                        `🎬 Storyline Slayt — %${pct} (~${kalan}sn kaldı)`,
                        '#4CAF50'
                    );
                }

                if (!ffHandle && !video.ended && !video.paused) {
                    startFF(video);
                }

                if (video.paused && !video.ended) {
                    video.play().catch(() => {});
                }
            }

            clickPopups();
        }

        window.addEventListener('blur', () => {
            const v = getVideo();
            if (v && v.paused && !v.ended) v.play().catch(() => {});
            document.title = "Can YILMAZ ;)";
        });

        const isSinavPage = window.location.href.toLowerCase().includes('/sinav');
        const isAnketPage = window.location.href.toLowerCase().includes('/anket');

        if (isSinavPage) {
            console.log('[UEK] Sınav sayfası tespit edildi!');
            setBadge('📝 Sınav modu — AI cevaplıyor...', '#9C27B0');
            setTimeout(startQuizAutomation, 3000);
            return;
        }

        if (isAnketPage) {
            console.log('[UEK] Anket sayfası tespit edildi!');
            setBadge('📝 Anket modu — Otomatik dolduruluyor...', '#FF9800');
            setTimeout(startSurveyAutomation, 3000);
            return;
        }

        setBadge('🤖 CBİKO UEK Otomasyonu Başlatılıyor...', '#4CAF50');
        setTimeout(startVideo, 2500);
        dualSetInterval(statusLoop, 3000);

        function startQuizAutomation() {
            let isProcessing = false;
            let answered = new Set();

            function getQuestionText() {
                const txt = document.body.innerText;
                const m = txt.match(/(\d+)\.\s*Soru\s*([\s\S]*?)(?=CUMHURBAŞKANLIĞI|SINAVI TAMAMLA|$)/);
                if (m) return m[0].trim();
                return txt.substring(0, 2000);
            }

            function getQuestionNum() {
                const m = document.body.innerText.match(/(\d+)\.\s*Soru/);
                return m ? parseInt(m[1]) : 0;
            }

            function pickAnswer(letter) {
                const idx = 'ABCDE'.indexOf(letter.toUpperCase());
                if (idx < 0) return false;

                const visibleRadios = Array.from(document.querySelectorAll('input[type="radio"]'))
                                           .filter(r => r.offsetParent !== null);

                if (visibleRadios.length > idx) {
                    visibleRadios[idx].click();
                    visibleRadios[idx].dispatchEvent(new Event('change', { bubbles: true }));
                    visibleRadios[idx].dispatchEvent(new Event('input', { bubbles: true }));
                    console.log('[UEK] Görünür radio tıklandı: ' + letter);
                    return true;
                }

                let clicked = false;
                document.querySelectorAll('label, td, li, div').forEach(el => {
                    if (el.offsetParent === null) return;
                    
                    const t = el.textContent.trim();
                    if (t.match(new RegExp('^' + letter + '\\s*[-)]'))) {
                        el.click();
                        const r = el.querySelector('input[type="radio"]');
                        if (r) {
                            r.click();
                            r.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        console.log('[UEK] Görünür şık/label tıklandı: ' + letter);
                        clicked = true;
                    }
                });
                return clicked;
            }

            function clickNext() {
                document.querySelectorAll('button, a, input[type="button"]').forEach(btn => {
                    const t = btn.textContent.trim().toUpperCase();
                    if (t.includes('SONRAKİ') || t.includes('SONRAKI')) btn.click();
                });
            }

            function clickFinish() {
                document.querySelectorAll('button, a, input[type="button"], input[type="submit"]').forEach(btn => {
                    const t = btn.textContent.trim().toUpperCase();
                    if (t.includes('SINAVI TAMAMLA') || t.includes('BİTİR')) {
                        setBadge('🎉 Sınav tamamlanıyor!', '#4CAF50');
                        btn.click();
                    }
                });
            }

            function makeGMRequest(url, options) {
                return new Promise((resolve, reject) => {
                    if (typeof GM_xmlhttpRequest === 'undefined') {
                        fetch(url, options).then(resolve).catch(reject);
                        return;
                    }

                    GM_xmlhttpRequest({
                        method: options.method || 'GET',
                        url: url,
                        headers: options.headers,
                        data: options.body,
                        onload: function(response) {
                            resolve({
                                ok: response.status >= 200 && response.status < 300,
                                status: response.status,
                                headers: response.responseHeaders,
                                json: async () => JSON.parse(response.responseText),
                                text: async () => response.responseText
                            });
                        },
                        onerror: function(err) {
                            reject(err);
                        }
                    });
                });
            }

            async function askAI(questionText, retries = 2, delay = 3000) {
                const systemPrompt = 'Sen bir sınav cevaplama asistanısın. Aşağıdaki çoktan seçmeli soruyu cevapla.\n\nKURALLAR:\n- SADECE doğru cevabın harfini yaz (A, B, C, D veya E)\n- Başka hiçbir şey yazma';
                const prompt = questionText;
                let lastError = 'Bilinmeyen Hata';

                // Pollinations AI ile çöz (Limitsiz, anahtarsız ve güvenli)
                for (let i = 0; i < retries; i++) {
                    try {
                        console.log('[UEK] Pollinations AI üzerinden soru çözülüyor...');
                        const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?system=${encodeURIComponent(systemPrompt)}`;
                        
                        const res = await makeGMRequest(url, {
                            method: 'GET',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        });

                        if (!res.ok) {
                            throw new Error(`API hatası (HTTP ${res.status})`);
                        }

                        const text = await res.text();
                        const ans = text.trim();
                        
                        if (/^[A-E]$/i.test(ans)) {
                            console.log('[UEK] Pollinations AI ile başarıyla cevap alındı:', ans);
                            return { answer: ans.toUpperCase() };
                        }

                        const patterns = [
                            /cevap\s*[:\-]?\s*([A-E])\b/i,
                            /şık\s*([A-E])\b/i,
                            /seçenek\s*([A-E])\b/i,
                            /([A-E])\s*seçeneği/i,
                            /([A-E])\s*şıkkı/i,
                            /\b([A-E])\b/i
                        ];
                        
                        for (const pattern of patterns) {
                            const m = ans.match(pattern);
                            if (m) {
                                const matchedAns = m[1].toUpperCase();
                                console.log('[UEK] Desen eşleşmesi ile cevap alındı:', matchedAns);
                                return { answer: matchedAns };
                            }
                        }

                        throw new Error(`Cevap formatı eşleşmedi: ${ans}`);

                    } catch (e) {
                        console.log('[UEK] Pollinations AI hatası:', e.message);
                        lastError = `Pollinations: ${e.message}`;
                        if (i < retries - 1) {
                            await new Promise(r => setTimeout(r, delay));
                        }
                    }
                }

                return { error: lastError };
            }

            async function processQuestion() {
                if (isProcessing) return;
                isProcessing = true;
                const qNum = getQuestionNum();
                if (!qNum || answered.has(qNum)) { isProcessing = false; return; }

                setBadge('📝 Soru ' + qNum + ' — AI düşünüyor...', '#9C27B0');
                const qText = getQuestionText();
                console.log('[UEK] Soru ' + qNum + ':', qText.substring(0, 150));

                const result = await askAI(qText);
                
                if (result && result.answer) {
                    const ans = result.answer;
                    setBadge('✅ Soru ' + qNum + ' → ' + ans, '#4CAF50');
                    pickAnswer(ans);
                    answered.add(qNum);

                    setTimeout(() => {
                        const totalText = document.body.innerText;
                        const soruNums = totalText.match(/Soru \d+/g);
                        const total = soruNums ? soruNums.length : 10;

                        if (qNum >= total) {
                            setBadge('🎉 Tüm sorular cevaplandı!', '#4CAF50');
                            setTimeout(clickFinish, 2000);
                        } else {
                            clickNext();
                            setTimeout(() => { isProcessing = false; processQuestion(); }, 3000);
                        }
                    }, 2000);
                } else {
                    const errDetail = (result && result.error) ? result.error : 'Bilinmeyen Hata';
                    console.log(`[UEK] Soru ${qNum} çözülemedi, varsayılan A şıkkı seçiliyor. Hata: ${errDetail}`);
                    setBadge(`⚠️ Soru ${qNum} çözülemedi (Varsayılan A seçiliyor)`, '#FF9800');
                    
                    pickAnswer('A');
                    answered.add(qNum);

                    setTimeout(() => {
                        const totalText = document.body.innerText;
                        const soruNums = totalText.match(/Soru \d+/g);
                        const total = soruNums ? soruNums.length : 10;

                        if (qNum >= total) {
                            setBadge('🎉 Tüm sorular cevaplandı!', '#4CAF50');
                            setTimeout(clickFinish, 2000);
                        } else {
                            clickNext();
                            setTimeout(() => { isProcessing = false; processQuestion(); }, 3000);
                        }
                    }, 2000);
                }
            }

            async function run() {
                dualSetInterval(() => clickPopups(), 5000);
                processQuestion();
            }

            run();
        }

        function startSurveyAutomation() {
            setBadge('📝 Anket Modu — Otomatik Dolduruluyor...', '#FF9800');
            
            setTimeout(() => {
                const names = new Set();
                document.querySelectorAll('input[type="radio"]').forEach(r => names.add(r.name));
                
                names.forEach(name => {
                    const radios = Array.from(document.querySelectorAll(`input[name="${name}"]`));
                    if (radios.length === 0) return;
                    
                    let target = null;
                    for (let i = radios.length - 1; i >= 0; i--) {
                        const r = radios[i];
                        const label = document.querySelector(`label[for="${r.id}"]`);
                        if (label) {
                            const txt = label.textContent.toLowerCase();
                            if (txt.includes('tamamen') || txt.includes('katılıyorum') || txt.includes('memnun') || txt.includes('evet') || txt.includes('çok iyi') || txt.includes('kolay')) {
                                target = r;
                                break;
                            }
                        }
                    }
                    
                    if (!target) {
                        target = radios[radios.length - 1];
                    }
                    
                    target.click();
                    target.dispatchEvent(new Event('change', { bubbles: true }));
                });

                // Checkbox'ları işaretle
                document.querySelectorAll('input[type="checkbox"]').forEach(c => {
                    if (c.offsetParent !== null && !c.checked) {
                        c.click();
                        c.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });

                // Metin alanlarını 4 adet boşluk tuşu ile doldur
                document.querySelectorAll('input[type="text"], textarea').forEach(t => {
                    if (t.offsetParent !== null) {
                        t.value = '    ';
                        t.dispatchEvent(new Event('input', { bubbles: true }));
                        t.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });

                setBadge('✅ Anket dolduruldu! Gönderiliyor...', '#4CAF50');
                
                setTimeout(() => {
                    const submitBtn = document.querySelector('input[type="submit"], button[type="submit"], button.btn-success, form[action*="Anket"] button, form[action*="anket"] button');
                    if (submitBtn) {
                        submitBtn.click();
                    } else {
                        const form = document.querySelector('form[action*="Anket"], form[action*="anket"]');
                        if (form) form.submit();
                    }
                }, 2000);
            }, 2000);
        }
    });

})();
