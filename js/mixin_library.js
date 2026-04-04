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
        return this.$t(`fields.${key}`) || key;
    },
    isSearchableField(key) {
        if (key === 'st_no') {
            return Number(this.loggedInLevel) >= 1;
        }
        return key === 'book_name' || key === 'author' || key === 'tno';
    },

    isHiddenField(key) {
        return ['book_name_lower', 'author_lower'].includes(key);
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
            alert('您的瀏覽器不支援推播通知功能');
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('需要開啟通知權限才能接收歸還通知');
                return;
            }

            const registration = await navigator.serviceWorker.register('sw.js');

            // 稍後在 Go 後端產生這把金鑰後，將它填入這裡
            const vapidPublicKey = "BBBRXBftZ5WkgwVlZgRQKIsg_KFV3jKT13zytc40eGydIGkgETncHe5QLwG-mKgJI6iIYlyi0POQgF-wptyb-fU"
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
            });

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
                alert('訂閱成功！當書籍歸還時，您將會收到瀏覽器通知。');
            } else {
                alert('訂閱請求失敗，請稍後再試。');
            }
        } catch (error) {
            console.error('訂閱過程發生錯誤:', error);
            alert('發生錯誤，無法完成訂閱。');
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
