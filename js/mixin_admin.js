const adminMixin = {
  data() {
    return {
      borrowDialog: false,
      borrowLoading: false,
      borrowForm: { tno: '', stid: '' },
      borrowAlert: { show: false, type: 'info', message: '' },
      borrowHistoryDialog: false,
      borrowHistoryStId: '',
      returnDialog: false,
      returnLoading: false,
      returnForm: { tno: '', stid: '' },
      returnAlert: { show: false, type: 'info', message: '' },
      newBookDialog: false,
      newBookLoading: false,
      newBookForm: { 
          tno: '', book_name: '', author: '', publish_place: '', publish: '', 
          edition: '', year: '', series: '', source: '', room: '', cat: '', 
          aumark: '', vol: '', copy: '', lend: '', price: '', note: '' 
      },
      newBookAlert: { show: false, type: 'info', message: '' },
      profileDialog: false,
      profileLoading: false,
      profileForm: {
          id: '', nickname: '', level: '', login_ip: '', newPassword: '', confirmPassword: '', target_id: ''
      },
      profileAlert: { show: false, type: 'info', message: '' },
      opendayDialog: false,
      opendayLoading: false,
      opendaySelectedDate: null,
      opendayMap: {},
      opendayChanges: {},
      opendayCurrentForm: { status: 'open', note: '' },
      studentManageDialog: false,
      studentSearchId: '',
      studentFormVisible: false,
      studentIsNew: false,
      studentLoading: false,
      studentForm: { st_no: '', name: '', identification: '1', email: '', phone_a: '', department: '' },
      editBookDialog: false,
      editBookLoading: false,
      editBookForm: { tno: '', book_name: '', author: '', price: '', lend: '1' },
      
      // ================= 工讀生 / 管理員帳號管理 =================
      adminManageDialog: false,
      adminSearchId: '',
      adminFormVisible: false,
      adminIsNew: false,
      adminLoading: false,
      /*
       * 管理層級 Account Level Definition
       * 0: 一般借書人 (General Borrower)
       * 1: 工讀生 (Student Worker)
       * 2: 小組長 (Group Leader)
       * 3: 最高管理員 (Super Administrator)
       */
      adminForm: { id: '', nickname: '', level: 1, password: '' },
    };
  },
  methods: {
    openBorrowDialog() {
      this.borrowAlert.show = false;
      this.borrowForm = { tno: '', stid: '' };
      this.borrowDialog = true;
      this.$nextTick(() => {
          this.$refs.borrowTnoField.focus();
      });
      setTimeout(() => {
        if (this.$refs.borrowTnoField)
          this.$refs.borrowTnoField.focus();
      }, 200);
    },
    closeBorrowDialog() {
        this.borrowDialog = false;
    },
    openReturnDialog() {
      this.returnAlert.show = false;
      this.returnForm = { tno: '', stid: '' };
      this.returnDialog = true;
      this.$nextTick(() => {
          this.$refs.returnTnoField.focus();
      });
      setTimeout(() => {
        if (this.$refs.returnTnoField)
          this.$refs.returnTnoField.focus();
      }, 200);
    },
    closeReturnDialog() {
        this.returnDialog = false;
    },
    openNewBookDialog() {
      this.resetNewBookForm();
      this.newBookAlert.show = false;
      this.newBookDialog = true;
      this.$nextTick(() => {
          this.$refs.newBookTnoField.focus();
      });
      setTimeout(() => {
        if (this.$refs.newBookTnoField) this.$refs.newBookTnoField.focus();
      }, 200);
    },
    closeNewBookDialog() {
      this.newBookDialog = false;
    },
    resetNewBookForm() {
      this.newBookForm = { 
          tno: '', book_name: '', author: '', publish_place: '', publish: '', 
          edition: '', year: '', series: '', source: '', room: '', cat: '', 
          aumark: '', vol: '', copy: '', lend: '', price: '', note: '' 
      };
    },
    openProfileDialog() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert(this.$t('wsNotConnected'));
            return;
        }
        
        this.profileAlert.show = false;
        this.profileForm.newPassword = '';
        this.profileForm.confirmPassword = '';
        this.profileForm.target_id = '';
        this.isLoading = true;

        const request = { action: 'get_profile', payload: {} };
        const timeout = setTimeout(() => {
            this.requests.delete('get_profile');
            this.isLoading = false;
            alert(this.$t('requestTimeout'));
        }, 5000);

        this.requests.set('get_profile', (response) => {
            clearTimeout(timeout);
            this.isLoading = false;
            
            if (response.success) {
                this.profileForm.id = response.data.id;
                this.profileForm.nickname = response.data.nickname;
                this.profileForm.level = response.data.level;
                this.profileForm.login_ip = response.data.login_ip;
                this.profileDialog = true; 
            } else {
                alert(response.message || this.$t('alerts.getProfileFailed'));
            }
        });

        this.ws.send(JSON.stringify(request));
    },
    closeProfileDialog() {
        this.profileDialog = false;
    },
    submitPasswordChange() {
        if (!this.profileForm.newPassword && !this.profileForm.confirmPassword) {
            this.profileAlert = { show: true, type: 'warning', message: this.$t('alerts.enterNewPassword') };
            return;
        }
        
        if (this.profileForm.newPassword !== this.profileForm.confirmPassword) {
            this.profileAlert = { show: true, type: 'error', message: this.$t('alerts.passwordMismatch') };
            return;
        }

        this.profileLoading = true;
        this.profileAlert.show = false;

        const request = {
            action: 'update_password',
            payload: { 
                new_password: this.profileForm.newPassword,
                target_id: this.profileForm.target_id || ''
            }
        };

        const timeout = setTimeout(() => {
            this.requests.delete('update_password');
            this.profileLoading = false;
            this.profileAlert = { show: true, type: 'error', message: this.$t('requestTimeout') };
        }, 5000);

        this.requests.set('update_password', (response) => {
            clearTimeout(timeout);
            this.profileLoading = false;
            
            if (response.success) {
                this.profileAlert = { show: true, type: 'success', message: response.message };
                this.profileForm.newPassword = '';
                this.profileForm.confirmPassword = '';
            } else {
                this.profileAlert = { show: true, type: 'error', message: response.message || this.$t('alerts.updateFailed') };
            }
        });

        this.ws.send(JSON.stringify(request));
    },
    openBorrowHistoryDialog() {
      this.borrowHistoryStId = '';
      this.borrowHistoryDialog = true;
      this.$nextTick(() => {
          this.$refs.borrowHistoryStIdField.focus();
      });
      setTimeout(() => {
        if (this.$refs.borrowHistoryStIdField) this.$refs.borrowHistoryStIdField.focus();
      }, 200);
    },
    fetchBorrowHistory() {
        if (!this.borrowHistoryStId.trim()) {
            alert(this.$t('alerts.enterStudentId'));
            return;
        }
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert(this.$t('wsNotConnected'));
            return;
        }

        this.borrowHistoryDialog = false;
        this.currentTableMode = 'borrowHistory';
        this.searchQuery = '';
        this.books = [];
        this.isLoading = true;

        const request = { 
            action: 'borrow_history', 
            payload: { st_no: this.borrowHistoryStId } 
        };

        const timeout = setTimeout(() => {
            this.requests.delete('borrow_history');
            this.isLoading = false;
            alert(this.$t('requestTimeout'));
        }, 10000);

        this.requests.set('borrow_history', (response) => {
            clearTimeout(timeout);
            this.isLoading = false;
            
            if (response.success) {
                let results = response.data || [];
                
                results.forEach(book => {
                    if (!book.giveback_time || book.giveback_time.includes('1970-01-01') || book.giveback_time.includes('0001-01-01') || book.giveback_time === '0000-00-00 00:00:00') {
                        book.giveback_time = this.$t('alerts.notReturned');
                    }
                    if (book.lend_time && book.lend_time.includes('T')) {
                        book.lend_time = book.lend_time.replace('T', ' ').substring(0, 19);
                    }
                    if (book.giveback_time && book.giveback_time !== this.$t('alerts.notReturned') && book.giveback_time.includes('T')) {
                        book.giveback_time = book.giveback_time.replace('T', ' ').substring(0, 19);
                    }
                });

                this.books = results;
                this.page = 1;
            } else {
                alert(response.message || this.$t('alerts.queryFailed'));
            }
        });

        this.ws.send(JSON.stringify(request));
    },
    submitBorrow() {
        this.borrowAlert.show = false;
        
        if (!this.borrowForm.tno || !this.borrowForm.stid) {
            this.borrowAlert = { show: true, type: 'error', message: this.$t('fillAllFields') };
            return;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.borrowAlert = { show: true, type: 'error', message: this.$t('wsNotConnected') };
            return;
        }
        
        this.borrowLoading = true;

        const request = {
            action: 'borrow_book',
            payload: {
                tno: this.borrowForm.tno,
                stid: this.borrowForm.stid
            }
        };

        const timeout = setTimeout(() => {
            this.requests.delete('borrow_book');
            this.borrowLoading = false;
            this.borrowAlert = { show: true, type: 'error', message: this.$t('requestTimeout') };
        }, 10000);

        this.requests.set('borrow_book', (response) => {
            clearTimeout(timeout);
            this.borrowLoading = false;
            
            if (response.success) {
                this.borrowAlert = { show: true, type: 'success', message: response.message };
                this.borrowForm.tno = '';
                this.borrowForm.stid = '';
                this.$refs.borrowTnoField.focus();
            } else {
                this.borrowAlert = { show: true, type: 'error', message: response.message };
            }
        });

        this.ws.send(JSON.stringify(request));
    },
    submitReturn() {
        this.returnAlert.show = false;
        
        if (!this.returnForm.tno || !this.returnForm.stid) {
            this.returnAlert = { show: true, type: 'error', message: this.$t('fillAllFields') };
            return;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.returnAlert = { show: true, type: 'error', message: this.$t('wsNotConnected') };
            return;
        }
        
        this.returnLoading = true;

        const request = {
            action: 'return_book',
            payload: {
                tno: this.returnForm.tno,
                stid: this.returnForm.stid
            }
        };

        const timeout = setTimeout(() => {
            this.requests.delete('return_book');
            this.returnLoading = false;
            this.returnAlert = { show: true, type: 'error', message: this.$t('requestTimeout') };
        }, 10000);

        this.requests.set('return_book', (response) => {
            clearTimeout(timeout);
            this.returnLoading = false;
            
            if (response.success) {
                this.returnAlert = { show: true, type: 'success', message: response.message };
                this.returnForm.tno = '';
                this.returnForm.stid = '';
                this.$refs.returnTnoField.focus();
            } else {
                this.returnAlert = { show: true, type: 'error', message: response.message };
            }
        });

        this.ws.send(JSON.stringify(request));
    },
    submitNewBook() {
        this.newBookAlert.show = false;
        
        if (!this.newBookForm.tno || !this.newBookForm.book_name) {
            this.newBookAlert = { show: true, type: 'error', message: this.$t('alerts.newBookRequired') };
            return;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.newBookAlert = { show: true, type: 'error', message: this.$t('wsNotConnected') };
            return;
        }
        
        this.newBookLoading = true;

        const request = {
            action: 'new_book',
            payload: this.newBookForm
        };

        const timeout = setTimeout(() => {
            this.requests.delete('new_book');
            this.newBookLoading = false;
            this.newBookAlert = { show: true, type: 'error', message: this.$t('requestTimeout') };
        }, 10000);

        this.requests.set('new_book', (response) => {
            clearTimeout(timeout);
            this.newBookLoading = false;
            
            if (response.success) {
                this.newBookAlert = { show: true, type: 'success', message: response.message + ' ' + this.$t('alerts.newBookSuccessHint') };
                
                setTimeout(() => {
                    if (this.newBookDialog) {
                        this.resetNewBookForm();
                        this.newBookAlert.show = false;
                        this.$refs.newBookTnoField.focus();
                    }
                }, 3000);
            } else {
                this.newBookAlert = { show: true, type: 'error', message: response.message };
            }
        });

        this.ws.send(JSON.stringify(request));
    },
    fetchUnreturnedStats(targetStNo = null) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert(this.$t('wsNotConnected'));
            return;
        }

        this.currentTableMode = 'unreturned';
        this.searchQuery = '';
        this.books = [];
        this.isLoading = true;

        const request = {
            action: 'unreturned_stats',
            payload: {}
        };

        const timeout = setTimeout(() => {
            this.requests.delete('unreturned_stats');
            this.isLoading = false;
            alert(this.$t('requestTimeout'));
        }, 10000);

        this.requests.set('unreturned_stats', (response) => {
            clearTimeout(timeout);
            this.isLoading = false;
            
            if (response.success) {
                let results = response.data || [];
                
                results.forEach(book => {
                    if (!book.giveback_time || book.giveback_time.includes('1970-01-01') || book.giveback_time.includes('0001-01-01') || book.giveback_time === '0000-00-00 00:00:00') {
                        book.giveback_time = this.$t('alerts.notReturned');
                    }
                    if (book.lend_time && book.lend_time.includes('T')) {
                        book.lend_time = book.lend_time.replace('T', ' ').substring(0, 19);
                    }
                    if (book.giveback_time && book.giveback_time !== this.$t('alerts.notReturned') && book.giveback_time.includes('T')) {
                        book.giveback_time = book.giveback_time.replace('T', ' ').substring(0, 19);
                    }
                });
                
                if (targetStNo && typeof targetStNo === 'string') {
                    results = results.filter(book => book.st_no === targetStNo);
                    if (results.length === 0) {
                        alert(this.$t('alerts.noUnreturnedBooks', { stid: targetStNo }));
                    }
                }
                
                this.books = results;
                this.page = 1;
            } else {
                alert(response.message || this.$t('alerts.queryFailed'));
            }
        });

        this.ws.send(JSON.stringify(request));
    },
    fetchBlacklist() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert(this.$t('wsNotConnected'));
            return;
        }

        this.currentTableMode = 'blacklist';
        this.searchQuery = '';
        this.books = [];
        this.isLoading = true;

        const request = { action: 'list_freeze', payload: {} };

        const timeout = setTimeout(() => {
            this.requests.delete('list_freeze');
            this.isLoading = false;
            alert(this.$t('requestTimeout'));
        }, 10000);

        this.requests.set('list_freeze', (response) => {
            clearTimeout(timeout);
            this.isLoading = false;
            
            if (response.success) {
                this.books = response.data || [];
                this.page = 1;
            } else {
                alert(response.message || this.$t('alerts.queryFailed'));
            }
        });

        this.ws.send(JSON.stringify(request));
    },
    confirmRemoveBlacklist(item) {
      if (confirm(this.$t('alerts.confirmRemoveBlacklist', { stid: item.st_no, name: item.name }))) {
            this.removeBlacklist(item.st_no);
      }
    },
    removeBlacklist(stid) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        this.isLoading = true;
        const request = {
            action: 'remove_blacklist',
            payload: { stid: stid }
        };

        const timeout = setTimeout(() => {
            this.requests.delete('remove_blacklist');
            this.isLoading = false;
            alert(this.$t('requestTimeout'));
        }, 10000);

        this.requests.set('remove_blacklist', (response) => {
            clearTimeout(timeout);
            this.isLoading = false;
            
            if (response.success) {
                alert(response.message);
                this.fetchBlacklist();
            } else {
                alert(response.message || this.$t('alerts.removeBlacklistFailed'));
            }
        });

        this.ws.send(JSON.stringify(request));
    },
    openOpendayDialog() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert(this.$t('wsNotConnected'));
            return;
        }
        this.opendayDialog = true;
        this.opendaySelectedDate = null;
        this.opendayChanges = {};
        this.fetchOpendays();
    },
    fetchOpendays() {
        this.isLoading = true;
        const request = { action: 'get_opendays', payload: {} };

        const timeout = setTimeout(() => {
            this.requests.delete('get_opendays');
            this.isLoading = false;
            alert(this.$t('alerts.fetchOpendayTimeout'));
        }, 5000);

        this.requests.set('get_opendays', (response) => {
            clearTimeout(timeout);
            this.isLoading = false;
            if (response.success && response.data) {
                this.opendayMap = {};
                response.data.forEach(item => {
                    const dateStr = String(item.dayno);
                    if (dateStr.length === 8) {
                        const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                        this.opendayMap[formattedDate] = item;
                    }
                });
            }
        });
        this.ws.send(JSON.stringify(request));
    },
    onOpendayDateSelect(date) {
        const existingData = this.opendayChanges[date] || this.opendayMap[date];
        if (existingData) {
            this.opendayCurrentForm = { 
                status: existingData.status, 
                note: existingData.note || '' 
            };
        } else {
            this.opendayCurrentForm = { status: 'open', note: '' };
        }
    },
    tempSaveOpenday() {
        if (!this.opendaySelectedDate) return;
        
        this.$set(this.opendayChanges, this.opendaySelectedDate, {
            status: this.opendayCurrentForm.status,
            note: this.opendayCurrentForm.note
        });
    },
    getOpendayEvents(date) {
        return !!this.opendayChanges[date] || !!this.opendayMap[date];
    },
    getOpendayEventColor(date) {
        const data = this.opendayChanges[date] || this.opendayMap[date];
        if (!data) return '';
        if (data.status === 'open') return 'green';
        if (data.status === 'close') return 'red';
        if (data.status === 'mark') return 'orange';
        return 'grey';
    },
    submitOpendays() {
        if (Object.keys(this.opendayChanges).length === 0) {
            alert(this.$t('alerts.noChangesToSave'));
            return;
        }

        this.opendayLoading = true;
        const payloadArray = [];

        for (const [dateStr, data] of Object.entries(this.opendayChanges)) {
            const daynoInt = parseInt(dateStr.replace(/-/g, ''), 10);
            payloadArray.push({
                dayno: daynoInt,
                status: data.status,
                note: data.note
            });
        }

        const request = {
            action: 'update_opendays',
            payload: { days: payloadArray }
        };

        const timeout = setTimeout(() => {
            this.requests.delete('update_opendays');
            this.opendayLoading = false;
            alert(this.$t('requestTimeout'));
        }, 10000);

        this.requests.set('update_opendays', (response) => {
            clearTimeout(timeout);
            this.opendayLoading = false;
            if (response.success) {
                alert(this.$t('alerts.opendaySaveSuccess'));
                this.opendayChanges = {};
                this.fetchOpendays();
            } else {
                alert(response.message || this.$t('alerts.saveFailed'));
            }
        });

        this.ws.send(JSON.stringify(request));
    },
    openStudentManageDialog() {
        this.studentManageDialog = true;
        this.studentSearchId = '';
        this.studentFormVisible = false;
        setTimeout(() => { if (this.$refs.studentSearchIdField) this.$refs.studentSearchIdField.focus(); }, 200);
    },
    fetchStudent() {
        if (!this.studentSearchId.trim()) return;
        this.studentLoading = true;
        const request = { action: 'get_student', payload: { st_no: this.studentSearchId.trim() } };
        
        this.requests.set('get_student', (res) => {
            this.studentLoading = false;
            this.studentFormVisible = true;
            if (res.success && res.data) {
                this.studentIsNew = false;
                this.studentForm = {
                    st_no: res.data.st_no, name: res.data.name, identification: res.data.identification,
                    email: res.data.email, phone_a: res.data.phone_a, department: res.data.department
                };
            } else {
                this.studentIsNew = true;
                this.studentForm = { st_no: this.studentSearchId.trim(), name: '', identification: '1', email: '', phone_a: '', department: '' };
            }
        });
        this.ws.send(JSON.stringify(request));
    },
    saveStudent() {
        if (!this.studentForm.st_no || !this.studentForm.name) { alert(this.$t('alerts.newBookRequired')); return; }
        this.studentLoading = true;
        const request = { action: 'save_student', payload: this.studentForm };
        this.requests.set('save_student', (res) => {
            this.studentLoading = false;
            if (res.success) {
                alert(res.message);
                this.studentFormVisible = false;
                this.studentSearchId = '';
                setTimeout(() => { this.$refs.studentSearchIdField.focus(); }, 200);
            } else {
                alert(res.message || this.$t('alerts.saveFailed'));
            }
        });
        this.ws.send(JSON.stringify(request));
    },
    deleteStudent() {
        if (!confirm(this.$t('studentManage.confirmDelete'))) return;
        this.studentLoading = true;
        const request = { action: 'delete_student', payload: { st_no: this.studentForm.st_no } };
        this.requests.set('delete_student', (res) => {
            this.studentLoading = false;
            if (res.success) {
                alert(res.message);
                this.studentFormVisible = false;
                this.studentSearchId = '';
                setTimeout(() => { this.$refs.studentSearchIdField.focus(); }, 200);
            } else {
                alert(res.message || this.$t('alerts.updateFailed')); 
            }
        });
        this.ws.send(JSON.stringify(request));
    },
    openCollectionList() {
        this.searchQuery = '';
        this.currentTableMode = 'search';
        this.page = 1;
        this.loadAllBooks();
    },
    openEditBookDialog() {
        if (!this.selectedBook) return;
        
        let currentLend = '1'; 
        if (this.selectedBook.lend === '0' || this.selectedBook.lend === false || this.selectedBook.lend === 'false') {
            currentLend = '0';
        }

        this.editBookForm = {
            tno: this.selectedBook.tno || '',
            book_name: this.selectedBook.book_name || '',
            author: this.selectedBook.author || '',
            price: this.selectedBook.price || '',
            lend: currentLend
        };
        this.editBookDialog = true;
    },
    submitEditBook() {
        if (!this.editBookForm.tno || !this.editBookForm.book_name) {
            alert(this.$t('alerts.newBookRequired'));
            return;
        }
        this.editBookLoading = true;
        const request = { action: 'update_book', payload: this.editBookForm };
        
        this.requests.set('update_book', (res) => {
            this.editBookLoading = false;
            if (res.success) {
                alert(res.message);
                this.editBookDialog = false;
                this.closeModal();
                
                if (this.db) {
                    const tx = this.db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    const getReq = store.get(this.editBookForm.tno);
                    getReq.onsuccess = () => {
                        let book = getReq.result;
                        if (book) {
                            book.book_name = this.editBookForm.book_name;
                            book.book_name_lower = this.editBookForm.book_name.toLowerCase();
                            book.author = this.editBookForm.author;
                            book.author_lower = (this.editBookForm.author || '').toLowerCase();
                            book.price = this.editBookForm.price;
                            book.lend = this.editBookForm.lend === '1';
                            store.put(book);
                            
                            this.loadAllBooks();
                        }
                    };
                }
            } else {
                alert(res.message || this.$t('alerts.updateFailed'));
            }
        });
        this.ws.send(JSON.stringify(request));
    },

    // =========================================================================
    // 以下為修正後的【工讀生 / 管理員帳號管理】邏輯 (已替換為正確的 API Action)
    // =========================================================================
    openAdminManageDialog() {
        this.adminManageDialog = true;
        this.adminSearchId = '';
        this.adminFormVisible = false;
        setTimeout(() => { if (this.$refs.adminSearchIdField) this.$refs.adminSearchIdField.focus(); }, 200);
    },
    fetchAdmin() {
        if (!this.adminSearchId.trim()) return;
        this.adminLoading = true;
        
        // ✅ 修正：改為呼叫後端已定義的 admin_list_users API，拉取清單後比對
        const request = { action: 'admin_list_users', payload: {} };
        
        this.requests.set('admin_list_users', (res) => {
            this.adminLoading = false;
            this.adminFormVisible = true;
            
            if (res.success && res.data) {
                const user = res.data.find(u => u.id === this.adminSearchId.trim());
                if (user) {
                    this.adminIsNew = false;
                    this.adminForm = {
                        id: user.id, 
                        nickname: user.nickname || '', 
                        level: user.level,
                        password: '' // 編輯模式預設不填寫密碼
                    };
                } else {
                    this.adminIsNew = true;
                    this.adminForm = { id: this.adminSearchId.trim(), nickname: '', level: 1, password: '' };
                }
            } else {
                alert(res.message || this.$t('alerts.queryFailed'));
            }
        });
        this.ws.send(JSON.stringify(request));
    },
    saveAdmin() {
        if (!this.adminForm.id || !this.adminForm.nickname) { alert(this.$t('alerts.adminRequiredFields')); return; }
        if (this.adminIsNew && !this.adminForm.password) { alert(this.$t('alerts.adminPasswordRequired')); return; }

        this.adminLoading = true;
        
        // ✅ 修正：依據是否為新帳號，將 Action 分流為 Create 或 Update
        const action = this.adminIsNew ? 'admin_create_user' : 'admin_update_user';
        const request = { 
            action: action, 
            payload: {
                id: this.adminForm.id,
                nickname: this.adminForm.nickname,
                level: parseInt(this.adminForm.level, 10),
                password: this.adminForm.password
            }
        };
        
        this.requests.set(action, (res) => {
            this.adminLoading = false;
            if (res.success) {
                alert(res.message);
                this.adminFormVisible = false;
                this.adminSearchId = '';
                setTimeout(() => { this.$refs.adminSearchIdField.focus(); }, 200);
            } else {
                alert(res.message || this.$t('alerts.saveFailed'));
            }
        });
        this.ws.send(JSON.stringify(request));
    },
    deleteAdmin() {
        if (!confirm(this.$t('adminManage.confirmDelete'))) return;
        this.adminLoading = true;
        
        // ✅ 修正：改為呼叫後端的 admin_delete_user API
        const request = { action: 'admin_delete_user', payload: { id: this.adminForm.id } };
        
        this.requests.set('admin_delete_user', (res) => {
            this.adminLoading = false;
            if (res.success) {
                alert(res.message);
                this.adminFormVisible = false;
                this.adminSearchId = '';
                setTimeout(() => { this.$refs.adminSearchIdField.focus(); }, 200);
            } else {
                alert(res.message || this.$t('alerts.updateFailed'));
            }
        });
        this.ws.send(JSON.stringify(request));
    },
  }
};
