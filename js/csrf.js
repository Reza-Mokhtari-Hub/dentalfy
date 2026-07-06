/**
 * CSRF Token Manager برای فرانت‌اند
 */

const CSRFToken = {
  /**
   * CSRF token را از cookie می‌خواند
   */
  getToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'dental_csrf') {
        return decodeURIComponent(value);
      }
    }
    return null;
  },

  /**
   * یک GET request برای دریافت CSRF token ارسال می‌کند
   */
  async initializeToken() {
    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/auth/csrf-init`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        console.error('Failed to initialize CSRF token');
        return false;
      }
      
      // Token خودکار در cookie set می‌شود
      return this.getToken() !== null;
    } catch (error) {
      console.error('CSRF initialization error:', error);
      return false;
    }
  },

  /**
   * Headers برای CSRF-protected requests
   */
  getHeaders(additionalHeaders = {}) {
    const token = this.getToken();
    if (!token) {
      console.warn('CSRF token not found. Request may fail.');
    }
    
    return {
      'Content-Type': 'application/json',
      'x-csrf-token': token || '',
      ...additionalHeaders,
    };
  },
};

// CSRF token را هنگام load page initialize کن
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => CSRFToken.initializeToken());
} else {
  CSRFToken.initializeToken();
}
