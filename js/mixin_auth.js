const authMixin = {
  data() {
    return {
      jwtToken: localStorage.getItem('lib_jwt') || null,
      loggedInUser: localStorage.getItem('lib_user') || '',
      loggedInLevel: localStorage.getItem('lib_level') || '',
      loginDialog: false,
      isLoggingIn: false,
      loginForm: { username: '', password: '' },
      logoutDialog: false,
      ws: null,
      intentionalLogout: false,
      requests: new Map(),
      keepAliveInterval: null,
    };
  },
  computed: {
    isLoggedIn() {
      return this.jwtToken !== null && this.jwtToken !== '';
    },
  },
  mounted() {
    if (this.isLoggedIn) {
      this.initSecureWebSocket();
    }
  },
  beforeDestroy() {
    this.stopKeepAlive();
    if (this.ws) {
      this.ws.close();
    }
  },
  methods: {
    closeLoginDialog() {
      this.loginDialog = false;
      this.loginForm.password = '';
    },
    async submitLogin() {
      if (!this.loginForm.username || !this.loginForm.password) return;
      this.isLoggingIn = true;

      const baseWsUrl = defaultUrl;
      if (!baseWsUrl) {
        alert(this.$t('alerts.wsUrlNotSet'));
        this.isLoggingIn = false;
        return;
      }
      const apiUrl = baseWsUrl.replace('wss://', 'https://').replace('/ws', '/api/login');

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({
            username: this.loginForm.username,
            password: this.loginForm.password
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          alert(this.$t('alerts.loginFailed') + (errData.error || this.$t('alerts.unknownError')));
          this.isLoggingIn = false;
          return;
        }

        const data = await response.json();

        this.jwtToken = data.token;
        this.loggedInUser = this.loginForm.username;
        this.loggedInLevel = data.level;

        localStorage.setItem('lib_jwt', data.token);
        localStorage.setItem('lib_user', this.loggedInUser);
        localStorage.setItem('lib_level', this.loggedInLevel);

        this.isLoggingIn = false;
        this.closeLoginDialog();
        this.loginForm.username = '';
        this.loginForm.password = '';

        this.initSecureWebSocket();

      } catch (error) {
        console.error("登入 API 呼叫失敗:", error);
        alert(this.$t('alerts.serverConnectionFailed'));
        this.isLoggingIn = false;
      }
    },
    submitLogout() {
      this.stopKeepAlive();
      this.jwtToken = null;
      this.loggedInUser = '';
      this.loggedInLevel = '';
      this.intentionalLogout = true;

      localStorage.removeItem('lib_jwt');
      localStorage.removeItem('lib_user');
      localStorage.removeItem('lib_level');

      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.logoutDialog = false;
    },
    forceLogout() {
      this.stopKeepAlive();
      this.jwtToken = null;
      this.loggedInUser = '';
      this.loggedInLevel = '';

      localStorage.removeItem('lib_jwt');
      localStorage.removeItem('lib_user');
      localStorage.removeItem('lib_level');

      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.logoutDialog = false;
    },
    startKeepAlive() {
      this.stopKeepAlive();
      this.keepAliveInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ action: 'ping' }));
        }
      }, 30000);
    },
    stopKeepAlive() {
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
      }
    },
    initSecureWebSocket() {
      // 加上 || 預設值的判斷
      const baseUrl = defaultUrl;
      const wsUrl = `${baseUrl}?token=${this.jwtToken}`;

      try {
        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => {
          console.log('WebSocket 安全連線已成功建立');
          this.startKeepAlive();
        };
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.action === 'pong') {
              return;
            }

            if (data.action && this.requests.has(data.action)) {
              const callback = this.requests.get(data.action);
              callback(data);
              this.requests.delete(data.action);
            } else {
              this.processRealTimeData(data);
            }
          } catch (e) {
            console.error('解析 WebSocket 資料失敗:', e);
          }
        };
        this.ws.onerror = (error) => console.error('WebSocket 發生錯誤:', error);
        this.ws.onclose = () => {
          console.log('WebSocket 連線已關閉');
          this.stopKeepAlive();
          if (!this.intentionalLogout && this.isLoggedIn) {
            alert(this.$t('alerts.wsDisconnectedAutoLogout'));
            this.forceLogout();
          }
          this.intentionalLogout = false;
        }
      } catch (err) {
        console.error('建立 WebSocket 連線失敗:', err);
      }
    },
    processRealTimeData(data) {
        console.log('接收到即時資料:', data);
    },
  },
};
