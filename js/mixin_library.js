const libraryMixin = {
  data() {
    return {
      db: null,
      isLoading: true,
      progressCount: 0,
      searchQuery: '',
      searchDebounce: null,
      books: [],
      page: 1,
      pageCount: 0,
      isModalOpen: false,
      selectedBook: null,
      currentTableMode: 'search',
    };
  },
  computed: {
    headers() {
        if (this.currentTableMode === 'unreturned') {
            return [
                { text: this.$t('fields.tno'), value: 'tno', sortable: false },
                { text: this.$t('fields.book_name'), value: 'book_name', sortable: false },
                { text: this.$t('fields.st_no'), value: 'st_no', sortable: true },
                { text: this.$t('fields.lend_time'), value: 'lend_time', sortable: true }
            ];
        }
        if (this.currentTableMode === 'blacklist') {
            return [
                { text: this.$t('fields.st_no'), value: 'st_no', sortable: true },
                { text: this.$t('fields.name'), value: 'name', sortable: false },
                { text: this.$t('fields.category'), value: 'category', sortable: true },
                { text: this.$t('fields.fines'), value: 'fines', sortable: true },
                { text: this.$t('fields.reason'), value: 'reason', sortable: false },
                { text: this.$t('fields.remarks'), value: 'remarks', sortable: false }
            ];
        }
        if (this.currentTableMode === 'borrowHistory') {
            return [
                { text: this.$t('fields.tno'), value: 'tno', sortable: false },
                { text: this.$t('fields.book_name'), value: 'book_name', sortable: false },
                { text: this.$t('fields.st_no'), value: 'st_no', sortable: true },
                { text: this.$t('fields.lend_time'), value: 'lend_time', sortable: true },
                { text: this.$t('fields.giveback_time'), value: 'giveback_time', sortable: true },
                { text: this.$t('fields.note'), value: 'note', sortable: false }
            ];
        }

        return [
            { text: this.$t('fields.tno'), value: 'tno', sortable: false },
            { text: this.$t('fields.book_name'), value: 'book_name', sortable: false },
            { text: this.$t('fields.author'), value: 'author', sortable: false },
            { text: this.$t('fields.room'), value: 'room', sortable: false }
        ];
    }
  },
  watch: {
    searchQuery(newQuery) {
        if (this.currentTableMode !== 'search') {
            if (newQuery === '' || newQuery === null) return;
            this.currentTableMode = 'search';
        }

        this.page = 1;
        clearTimeout(this.searchDebounce);
        this.isLoading = true;
        this.searchDebounce = setTimeout(async () => {
            if (!newQuery) {
                await this.loadAllBooks();
            } else {
                await this.performSearch(newQuery);
            }
            this.isLoading = false;
        }, 300);
    }
  },
  async created() {
    await initLibraryDB((count) => {
        this.progressCount = count;
        this.isLoading = true;
    });
    await this.initAndLoad();
  },
  beforeDestroy() {
    if (this.db) this.db.close();
  },
  methods: {
    async initAndLoad() {
        try {
            this.isLoading = true;
            this.db = await this.openDB();
            await this.loadAllBooks();
        } catch (err) {
            console.error(err);
        } finally {
            this.isLoading = false;
        }
    },
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                let store;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    store = db.createObjectStore(STORE_NAME, { keyPath: 'tno' });
                } else {
                    store = e.target.transaction.objectStore(STORE_NAME);
                }

                if (!store.indexNames.contains('book_name_lower')) {
                    store.createIndex('book_name_lower', 'book_name_lower', { unique: false });
                }
                if (!store.indexNames.contains('author_lower')) {
                    store.createIndex('author_lower', 'author_lower', { unique: false });
                }

                if (store.indexNames.contains('book_name')) {
                    store.deleteIndex('book_name');
                }
                if (store.indexNames.contains('author')) {
                    store.deleteIndex('author');
                }
            };

            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },
    loadAllBooks() {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not connected");

            const tx = this.db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const getAllReq = store.getAll();

            getAllReq.onsuccess = () => {
                this.books = getAllReq.result || [];
                resolve();
            };
            getAllReq.onerror = (e) => reject(e.target.error);
        });
    },
    async performSearch(query) {
        if (!this.db) return;

        const lowerCaseQuery = query.toLowerCase();
        const upperCaseQuery = query.toUpperCase();

        const tx = this.db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);

        const bookNameIndex = store.index('book_name_lower');
        const authorIndex = store.index('author_lower');

        const range = IDBKeyRange.bound(lowerCaseQuery, lowerCaseQuery + '\uffff');

        const tnoRangeOriginal = IDBKeyRange.bound(query, query + '\uffff');
        const tnoRangeUpper = IDBKeyRange.bound(upperCaseQuery, upperCaseQuery + '\uffff');

        const bookNamePromise = this.promisifyRequest(bookNameIndex.getAll(range));
        const authorPromise = this.promisifyRequest(authorIndex.getAll(range));
        const tnoPromiseOriginal = this.promisifyRequest(store.getAll(tnoRangeOriginal));
        const tnoPromiseUpper = (query !== upperCaseQuery)
            ? this.promisifyRequest(store.getAll(tnoRangeUpper))
            : Promise.resolve([]);

        try {
            const [bookNameResults, authorResults, tnoResultsOrg, tnoResultsUp] = await Promise.all([
                bookNamePromise, authorPromise, tnoPromiseOriginal, tnoPromiseUpper
            ]);

            const results = new Map();

            tnoResultsOrg.forEach(book => results.set(book.tno, book));
            tnoResultsUp.forEach(book => results.set(book.tno, book));
            bookNameResults.forEach(book => results.set(book.tno, book));
            authorResults.forEach(book => results.set(book.tno, book));

            this.books = Array.from(results.values());

        } catch (error) {
            console.error(error);
            this.books = [];
        }
    },
    promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    async openModal(item) {
        this.selectedBook = Object.assign({}, item);
        this.isModalOpen = true;

        if (this.isLoggedIn && this.ws && this.ws.readyState === WebSocket.OPEN) {
            const request = {
                action: 'get_book',
                payload: { tno: item.tno }
            };

            const timeout = setTimeout(() => {
                this.requests.delete('get_book');
            }, 5000);

            this.requests.set('get_book', (response) => {
                clearTimeout(timeout);
                this.updateBookStatusUI(response.data);
            });

            this.ws.send(JSON.stringify(request));
        } else {
            const defaultUrl = "wss://5517-60-248-186-181.ngrok-free.app/ws";
            const baseWsUrl = localStorage.getItem("wsUrl") || defaultUrl;
            const apiUrl = baseWsUrl.replace('wss://', 'https://').replace('ws://', 'http://').replace('/ws', '/api/book_status');

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': 'true'
                    },
                    body: JSON.stringify({ tno: item.tno })
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data) {
                        this.updateBookStatusUI(result.data);
                    }
                }
            } catch (error) {
                console.error("呼叫書籍狀態 API 發生例外錯誤:", error);
            }
        }
    },

		updateBookStatusUI(data) {
        if (!data) return;

        // 🟢 嚴格判斷：確保只有真正代表「可借」的值才會通過，強制過濾掉字串 "0" 或 false
        const isLendable = (data.is_lendable === true || data.is_lendable === 1 || data.is_lendable === '1' || data.is_lendable === 'true');

        this.$set(this.selectedBook, 'real_lendable', isLendable ? this.$t('status.lendable') : this.$t('status.notLendable'));

        if (data.is_borrowed) {
            this.$set(this.selectedBook, 'real_status', this.$t('status.borrowed'));
            if (data.expected_return_time) {
                this.$set(this.selectedBook, 'expected_return', data.expected_return_time);
            }
        } else {
            this.$set(this.selectedBook, 'real_status', this.$t('status.available'));
            // 如果從外借狀態變回在館內，要清空預期歸還日
            if (this.selectedBook.expected_return) {
                this.$delete(this.selectedBook, 'expected_return');
            }
        }
    },

    closeModal() {
        this.isModalOpen = false;
        setTimeout(() => { this.selectedBook = null; }, 300);
    },
		formatKey(key) {
        // 幫即時狀態欄位加上明確的中文標題，避免顯示英文 key
        if (key === 'real_lendable') return this.$t('lend_privilege');
        if (key === 'real_status') return this.$t('fields.real_status');
        if (key === 'expected_return') return this.$t('fields.expected_return');

        return this.$t(`fields.${key}`) || key;
    },

    isHiddenField(key) {
        // 隱藏容易讓使用者混淆的原始資料庫欄位
        // 把 lend 與 state 系列的原始資料過濾掉，只留 real_status 給使用者看
        const hidden = ['book_name_lower', 'author_lower', 'lend', 'state', 'Lend', 'State'];
        return hidden.includes(key);
    },
    isSearchableField(key) {
        if (key === 'st_no') {
            return Number(this.loggedInLevel) >= 1;
        }
        return key === 'book_name' || key === 'author' || key === 'tno';
    },

    handleDetailClick(key, value) {
        if (this.isSearchableField(key) && value) {
            this.closeModal();

            if (key === 'st_no') {
                this.fetchUnreturnedStats(value);
            } else {
                this.searchQuery = value;
            }
        }
    },

    // ==========================================
    // Web Push 推播通知相關邏輯
    // ==========================================
		async subscribeToNotification(tno) {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            alert(this.$t('alerts.pushUnsupported'));
            return;
        }

        try {
            // 1. 檢查與要求權限 (如果已經允許過，就不會再彈窗)
            if (Notification.permission !== 'granted') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    alert(this.$t('alerts.pushPermissionRequired'));
                    return;
                }
            }

            // 🟢 核心解法：等待焦點機制
            // 如果剛點完允許，焦點還在瀏覽器 UI 上，我們稍微等一下讓焦點回到網頁
            if (!document.hasFocus()) {
                console.log("等待網頁取得焦點...");
                await new Promise(resolve => {
                    const focusHandler = () => {
                        window.removeEventListener('focus', focusHandler);
                        resolve();
                    };
                    window.addEventListener('focus', focusHandler);

                    // 加上 500ms 的 Timeout 兜底，避免某些極端情況卡死
                    setTimeout(() => {
                        window.removeEventListener('focus', focusHandler);
                        resolve();
                    }, 500);
                });
            }

            // 2. 註冊 Service Worker (使用你更新的 js/sw.js 路徑)
            const registration = await navigator.serviceWorker.register('js/sw.js');

            // ⚠️ 記得把這裡換回你用 Go 產生的真正 Public Key！
            const vapidPublicKey = '這裡換成後端產生的_Base64_公鑰';

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
            });

            // 3. 呼叫後端 API 儲存訂閱
            const baseWsUrl = localStorage.getItem("wsUrl") || "wss://5517-60-248-186-181.ngrok-free.app/ws";
            const apiUrl = baseWsUrl.replace('wss://', 'https://').replace('ws://', 'http://').replace('/ws', '/api/subscribe_notification');

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tno: tno,
                    subscription: subscription
                })
            });

            if (response.ok) {
                alert(this.$t('alerts.pushSubscribeSuccess'));
            } else {
                alert(this.$t('alerts.pushSubscribeFailed'));
            }
        } catch (error) {
            console.error('訂閱過程發生錯誤:', error);
            alert(this.$t('alerts.pushUnexpectedError'));
        }
    },

    // 輔助函式：將 Base64 字串轉換為 Uint8Array
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
  }
};
