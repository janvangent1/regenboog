/**
 * Analytics Tracker - Client-side visitor tracking
 * Tracks page visits, duration, and visitor information
 */
(function() {
  'use strict';

  // Cookie helper functions
  function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + '=' + value + ';expires=' + expires.toUTCString() + ';path=/';
  }

  function getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  // Generate UUID v4
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Generate hash from string (simple hash function)
  function hashString(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Get or create visitor ID
  function getVisitorId() {
    let visitorId = getCookie('regenboog_visitor_id');
    
    if (!visitorId) {
      // Try to generate from IP + User-Agent as fallback
      const userAgent = navigator.userAgent || '';
      const fallbackId = 'fallback_' + hashString(userAgent + navigator.language);
      
      // Try to set cookie, if it fails we'll use fallback
      try {
        visitorId = generateUUID();
        setCookie('regenboog_visitor_id', visitorId, 30);
      } catch (e) {
        visitorId = fallbackId;
      }
    }
    
    return visitorId;
  }

  // Get current page path
  function getCurrentPage() {
    return window.location.pathname + window.location.search;
  }

  // Track visit start
  function trackVisitStart() {
    const visitorId = getVisitorId();
    const page = getCurrentPage();
    const userAgent = navigator.userAgent || '';
    const referrer = document.referrer || '';

    const visitStartTime = Date.now();
    sessionStorage.setItem('regenboog_visit_start', visitStartTime.toString());
    sessionStorage.setItem('regenboog_visit_page', page);

    // Send tracking request (fire and forget)
    fetch('/api/track-visit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        visitor_id: visitorId,
        page: page,
        user_agent: userAgent,
        referrer: referrer
      })
    }).catch(err => {
      // Silently fail - analytics should not break the site
      console.debug('Analytics tracking failed:', err);
    });
  }

  // Track visit end
  function trackVisitEnd() {
    const visitStart = sessionStorage.getItem('regenboog_visit_start');
    const page = sessionStorage.getItem('regenboog_visit_page');
    
    if (!visitStart || !page) {
      return; // No visit to end
    }

    const visitorId = getVisitorId();
    const duration = Math.floor((Date.now() - parseInt(visitStart, 10)) / 1000);

    // Send end tracking request
    fetch('/api/track-visit-end', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        visitor_id: visitorId,
        page: page,
        duration: duration
      }),
      keepalive: true // Important for beforeunload events
    }).catch(err => {
      // Silently fail
      console.debug('Analytics end tracking failed:', err);
    });

    // Clean up session storage
    sessionStorage.removeItem('regenboog_visit_start');
    sessionStorage.removeItem('regenboog_visit_page');
  }

  // Initialize tracking
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackVisitStart);
  } else {
    trackVisitStart();
  }

  // Track when leaving the page
  window.addEventListener('beforeunload', trackVisitEnd);
  
  // Also track on pagehide (for mobile browsers)
  window.addEventListener('pagehide', trackVisitEnd);

  // Track visibility change (when tab becomes hidden)
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // Page is being hidden, track end
      trackVisitEnd();
    } else {
      // Page is visible again, start new visit
      trackVisitStart();
    }
  });
})();
