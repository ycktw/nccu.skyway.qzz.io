window.app = new Vue({
    el: '#app',
    vuetify: new Vuetify(),
    // 引入拆分出去的三大核心模組
    mixins: [authMixin, libraryMixin, adminMixin],
    i18n,
    data: {
        currentLocale: i18n.locale,
        gitHash: (window.__APP_GIT_HASH__ && window.__APP_GIT_HASH__ !== '__APP_GIT_HASH_VALUE__') ? window.__APP_GIT_HASH__ : 'dev',
        deployTime: (window.__APP_DEPLOY_TIME__ && window.__APP_DEPLOY_TIME__ !== '__APP_DEPLOY_TIME_VALUE__') ? window.__APP_DEPLOY_TIME__ : 'local',
        feedbackDialog: false,
        feedbackMessage: '',
        feedbackSending: false,
    },
    watch: {
        currentLocale(newLang) {
            this.$i18n.locale = newLang;
            localStorage.setItem('lib_lang', newLang);
        },
    },
    mounted() {
        window.addEventListener('keydown', this.handleKeydown);
        window.addEventListener('beforeunload', this.handleBeforeUnload);
    },
    beforeDestroy() {
        window.removeEventListener('keydown', this.handleKeydown);
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
    },
    methods: {
        closeAllDialogs() {
            if (this.isModalOpen) this.closeModal();
            if (this.loginDialog) this.closeLoginDialog();
            if (this.borrowDialog) this.closeBorrowDialog();
            if (this.returnDialog) this.closeReturnDialog();
            if (this.newBookDialog) this.closeNewBookDialog();
            if (this.profileDialog) this.closeProfileDialog();

            this.logoutDialog = false;
            this.borrowHistoryDialog = false;
            this.opendayDialog = false;
            this.studentManageDialog = false;
            this.editBookDialog = false;
            this.adminManageDialog = false;
            this.feedbackDialog = false;
        },
        openFeedbackDialog() {
            this.feedbackMessage = '';
            this.feedbackDialog = true;
        },
        closeFeedbackDialog() {
            this.feedbackDialog = false;
            this.feedbackMessage = '';
        },
        async submitFeedback() {
            const message = (this.feedbackMessage || '').trim();
            if (!message) {
                alert(this.$t('alerts.feedbackEmpty'));
                return;
            }

            const baseWsUrl = defaultUrl;
            const apiUrl = baseWsUrl.replace('wss://', 'https://').replace('ws://', 'http://').replace('/ws', '/api/feedback');

            const headers = {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            };

            if (this.jwtToken) {
                headers.Authorization = `Bearer ${this.jwtToken}`;
            }

            const payload = {
                message,
                locale: this.currentLocale,
                gitHash: this.gitHash,
                deployTime: this.deployTime,
                pageUrl: window.location.href,
                user: this.isLoggedIn ? this.loggedInUser : 'guest'
            };

            this.feedbackSending = true;

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                alert(this.$t('alerts.feedbackSuccess'));
                this.closeFeedbackDialog();
            } catch (error) {
                console.error('送出意見回饋失敗:', error);
                alert(this.$t('alerts.feedbackFailed'));
            } finally {
                this.feedbackSending = false;
            }
        },
        handleBeforeUnload(e) {
            // 如果已登入，防止使用者不小心關閉分頁或重整導致斷線
            if (this.isLoggedIn) {
                e.preventDefault();
                e.returnValue = '';
            }
        },
        handleKeydown(e) {
						if (e.key === 'Escape') {
							this.closeAllDialogs();
							return;
						}

						// 2. 判斷目前是否有任何對話框開啟
                        const isAnyDialogOpen = this.isModalOpen || this.loginDialog || this.logoutDialog ||
                                                            this.borrowDialog || this.returnDialog || this.newBookDialog ||
                                                            this.profileDialog || this.borrowHistoryDialog ||
                                                            this.opendayDialog || this.studentManageDialog ||
                                                            this.editBookDialog || this.adminManageDialog ||
                                                            this.feedbackDialog;

						const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            const isUserTyping = activeTag === 'input' || activeTag === 'textarea';

            // 如果有對話框開啟，或是使用者正在輸入文字，就不觸發左右鍵換頁
            if (isAnyDialogOpen || isUserTyping) {
                return;
            }

            // 3. 左右方向鍵切換分頁
            if (e.key === 'ArrowLeft') {
                if (this.page > 1) this.page--;
            } else if (e.key === 'ArrowRight') {
                if (this.page < this.pageCount) this.page++;
            }
        },
    }
});

async function logStorageStatus() {
    // 1. Cache Storage
    if ('caches' in window) {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
            const cache = await caches.open(key);
            const requests = await cache.keys();
            console.log(`[CacheStorage] "${key}" 有 ${requests.length} 筆`);
        }
        if (cacheKeys.length === 0) {
            console.log('[CacheStorage] 無任何快取');
        }
    } else {
        console.log('[CacheStorage] 不支援');
    }

    // 2. IndexedDB
    if ('indexedDB' in window) {
        if (indexedDB.databases) {
            // 新版瀏覽器支援
            const dbs = await indexedDB.databases();
            if (dbs.length === 0) {
                console.log('[IndexedDB] 無任何資料庫');
            } else {
                dbs.forEach(db => {
                    console.log(`[IndexedDB] 資料庫名稱: ${db.name}, 版本: ${db.version}`);
                });
            }
        } else {
            console.log('[IndexedDB] 無法列出所有資料庫（瀏覽器不支援 indexedDB.databases）');
        }
    } else {
        console.log('[IndexedDB] 不支援');
    }

    // 3. localStorage & sessionStorage
    function calcStorageSize(storage, label) {
        let total = 0, count = 0;
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            const value = storage.getItem(key);
            total += (key.length + value.length) * 2; // 2 bytes per char
            count++;
        }
        console.log(`[${label}] 共 ${count} 筆，約 ${(total / 1024).toFixed(2)} KB`);
    }
    if ('localStorage' in window) {
        calcStorageSize(localStorage, 'localStorage');
    }
    if ('sessionStorage' in window) {
        calcStorageSize(sessionStorage, 'sessionStorage');
    }
}
