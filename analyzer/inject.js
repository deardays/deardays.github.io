// public/analyzer/inject.js
// 북마클릿에서 로드되어 Instagram 페이지 컨텍스트에서 실행
(async function() {
  'use strict';

  // ========== 유효성 검사 ==========
  if (!location.hostname.includes('instagram.com')) {
    alert('Instagram 페이지에서 실행해주세요.');
    return;
  }

  var pathMatch = location.pathname.match(/^\/([^\/\?]+)/);
  if (!pathMatch || ['p','reel','stories','explore','direct','accounts','reels'].includes(pathMatch[1])) {
    alert('인플루언서 프로필 페이지에서 실행해주세요.\n예: instagram.com/username');
    return;
  }

  var username = pathMatch[1];

  // ========== 로딩 오버레이 ==========
  var overlay = document.createElement('div');
  overlay.id = 'ig-analyzer-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:system-ui;';
  overlay.innerHTML = '<div style="font-size:24px;margin-bottom:12px;">📊 분석 중...</div><div id="ig-analyzer-status" style="font-size:14px;color:#aaa;">프로필 데이터 추출 중</div>';
  document.body.appendChild(overlay);

  var statusEl = document.getElementById('ig-analyzer-status');
  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

  try {
    // ========== 1. 프로필 데이터 추출 (현재 DOM) ==========
    setStatus('프로필 데이터 추출 중...');
    var profile = extractProfileData(username);

    // ========== 2. 피드 게시물 추출 ==========
    setStatus('피드 게시물 수집 중...');
    var feedPosts = await extractFeedPosts(username);

    // ========== 3. 개별 게시물 메타 데이터 fetch (병렬) ==========
    var nonPinned = feedPosts.filter(function(p) { return !p.isPinned; });
    var recent = nonPinned.slice(0, 10);
    var dealRecent = recent.filter(function(p) { return p.isDeal; });
    var firstNonPinned = nonPinned.length > 0 ? nonPinned[0] : null;
    var postsToFetch = dealRecent.slice();
    if (firstNonPinned && postsToFetch.indexOf(firstNonPinned) === -1) {
      postsToFetch.push(firstNonPinned);
    }

    setStatus('게시물 ' + postsToFetch.length + '개 상세 데이터 수집 중...');
    await Promise.all(postsToFetch.map(function(post) {
      return fetchSinglePostMeta(post.href).then(function(meta) {
        post.comments = meta.comments;
        post.likes = meta.likes;
        post.date = meta.date;
      }).catch(function() {});
    }));

    // ========== 4. 릴스 데이터 추출 (same-origin fetch) ==========
    setStatus('릴스 데이터 수집 중...');
    var reels = await extractReelsData(username);

    // ========== 5. 통계 계산 ==========
    var stats = calculateStats(feedPosts, reels);

    // ========== 6. 페이로드 구성 + 리다이렉트 ==========
    var payload = {
      username: username,
      profile: profile,
      feedPosts: feedPosts.map(function(p, i) {
        return {
          index: i + 1,
          href: p.href,
          isPinned: p.isPinned,
          isReel: p.isReel,
          isDeal: p.isDeal,
          caption: p.caption || '',
          comments: p.comments || 0,
          likes: p.likes || 0,
          date: p.date || ''
        };
      }),
      reels: reels,
      stats: stats
    };

    setStatus('분석 완료! 결과 페이지로 이동합니다...');
    await new Promise(function(r) { setTimeout(r, 500); });

    var TARGET_ORIGIN = 'https://deardays.kr';
    window.location = TARGET_ORIGIN + '/admin/analyzer#' + encodeURIComponent(JSON.stringify(payload));

  } catch(e) {
    overlay.innerHTML = '<div style="font-size:20px;color:#ff6b6b;">❌ 분석 실패</div>' +
      '<div style="font-size:14px;color:#aaa;margin-top:8px;">' + e.message + '</div>' +
      '<div style="font-size:12px;color:#666;margin-top:16px;">탭하여 닫기</div>';
    overlay.addEventListener('click', function() { overlay.remove(); });
  }

  // ========== 함수 정의 ==========

  function parseViewCount(viewStr) {
    if (!viewStr) return 0;
    var num = viewStr.replace(/,/g, '');
    if (num.includes('만')) return parseFloat(num.replace('만', '')) * 10000;
    if (num.includes('천')) return parseFloat(num.replace('천', '')) * 1000;
    if (num.includes('M')) return parseFloat(num.replace('M', '')) * 1000000;
    if (num.includes('K')) return parseFloat(num.replace('K', '')) * 1000;
    return parseFloat(num) || 0;
  }

  function extractProfileData(username) {
    var data = {
      username: username,
      displayName: '',
      profileLink: 'https://www.instagram.com/' + username + '/',
      followers: 0,
      bio: '',
      externalLink: '',
      hasBroadcastChannel: false
    };

    // 표시 이름
    var displayNameEl = document.querySelector('header section span[dir="auto"]') ||
      document.querySelector('header span[style*="font-weight"]');
    if (displayNameEl && displayNameEl.textContent.trim() !== username) {
      data.displayName = displayNameEl.textContent.trim();
    }
    if (!data.displayName) {
      var metaTitle = document.querySelector('meta[property="og:title"]');
      if (metaTitle) {
        var titleContent = metaTitle.getAttribute('content');
        var nameMatch = titleContent && titleContent.match(/^([^(]+)\(/);
        if (nameMatch) data.displayName = nameMatch[1].trim();
      }
    }

    // 팔로워 수
    var followerLink = document.querySelector('a[href$="/followers/"]');
    if (followerLink) {
      var followerSpan = followerLink.querySelector('span span') || followerLink.querySelector('span');
      if (followerSpan) data.followers = parseViewCount(followerSpan.textContent.trim());
    }
    if (!data.followers) {
      var statsElements = document.querySelectorAll('header section ul li, header ul li');
      statsElements.forEach(function(li) {
        var text = li.textContent;
        if (text.includes('팔로워') || text.includes('followers')) {
          var match = text.match(/[\d,.]+[만천KM]?/);
          if (match) data.followers = parseViewCount(match[0]);
        }
      });
    }

    // 바이오
    var bioSection = document.querySelector('header section > div:last-child');
    if (bioSection) {
      var bioSpan = bioSection.querySelector('span');
      if (bioSpan && !bioSpan.querySelector('a[href$="/followers/"]')) {
        data.bio = bioSpan.textContent.trim();
      }
    }
    if (!data.bio) {
      var metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        var content = metaDesc.getAttribute('content');
        var bioMatch = content && content.match(/계정: '([^']+)'/);
        if (bioMatch) data.bio = bioMatch[1];
      }
    }

    // 외부 링크
    var externalLinkEl = document.querySelector('a[href*="l.instagram.com/?u="]');
    if (externalLinkEl) {
      var urlMatch = externalLinkEl.href.match(/u=([^&]+)/);
      if (urlMatch) data.externalLink = decodeURIComponent(urlMatch[1]);
    }
    if (!data.externalLink) {
      var bioLinks = document.querySelectorAll('header a[rel="me nofollow noopener noreferrer"]');
      if (bioLinks.length > 0) data.externalLink = bioLinks[0].href;
    }
    if (!data.externalLink) {
      var linkInBio = document.querySelector('a[href*="linktr.ee"], a[href*="bit.ly"], a[href*="linkin.bio"]');
      if (linkInBio) data.externalLink = linkInBio.href;
    }

    // 방송 채널
    var scripts = document.querySelectorAll('script[type="application/json"]');
    for (var s = 0; s < scripts.length; s++) {
      var sc = scripts[s].textContent || '';
      if (sc.includes('"has_channel":true') || sc.includes('"broadcast_channel":')) {
        data.hasBroadcastChannel = true;
        break;
      }
    }

    return data;
  }

  async function extractFeedPosts(username) {
    var posts = [];

    var postLinks = [];
    for (var wait = 0; wait < 20; wait++) {
      postLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
      if (postLinks.length > 0) break;
      if (wait === 2 || wait === 5) window.scrollBy(0, 300);
      await new Promise(function(r) { setTimeout(r, 500); });
    }

    var dealKeywords = ['공구', '공동구매', '선착순', '이벤트', 'open', '오픈', '마감'];

    for (var i = 0; i < postLinks.length; i++) {
      var link = postLinks[i];
      var href = link.getAttribute('href');

      var isPinned = false;
      var svgs = link.querySelectorAll('svg');
      for (var s = 0; s < svgs.length; s++) {
        var lbl = svgs[s].getAttribute('aria-label') || '';
        if (lbl.includes('고정') || lbl.toLowerCase().includes('pin')) { isPinned = true; break; }
      }
      if (!isPinned) {
        var titles = link.querySelectorAll('title');
        for (var j = 0; j < titles.length; j++) {
          if ((titles[j].textContent || '').includes('고정') || (titles[j].textContent || '').toLowerCase().includes('pin')) { isPinned = true; break; }
        }
      }

      var caption = '';
      var imgs = link.querySelectorAll('img');
      for (var im = 0; im < imgs.length; im++) {
        var alt = imgs[im].getAttribute('alt') || '';
        if (alt.length > caption.length) caption = alt;
      }

      var isDeal = false;
      var captionLower = caption.toLowerCase();
      for (var ki = 0; ki < dealKeywords.length; ki++) {
        if (captionLower.includes(dealKeywords[ki].toLowerCase())) { isDeal = true; break; }
      }

      posts.push({
        index: i + 1,
        href: href,
        isPinned: isPinned,
        isReel: href.includes('/reel/'),
        isDeal: isDeal,
        caption: caption.substring(0, 60),
        comments: 0,
        likes: 0,
        date: ''
      });
    }

    return posts;
  }

  async function fetchSinglePostMeta(href) {
    try {
      var resp = await fetch('https://www.instagram.com' + href, { credentials: 'include' });
      if (!resp.ok) return { comments: 0, likes: 0, date: '' };

      var fullText = await resp.text();
      var html = fullText.substring(0, 30000);

      var result = { comments: 0, likes: 0, date: '' };
      var metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
      if (metaMatch) {
        var desc = metaMatch[1];
        var commentMatch = desc.match(/([\d,]+)\s*comment/i);
        if (commentMatch) result.comments = parseInt(commentMatch[1].replace(/,/g, ''), 10) || 0;
        if (!result.comments) {
          var krMatch = desc.match(/댓글\s*([\d,]+)/);
          if (krMatch) result.comments = parseInt(krMatch[1].replace(/,/g, ''), 10) || 0;
        }
        var likeMatch = desc.match(/([\d,]+)\s*like/i);
        if (likeMatch) result.likes = parseInt(likeMatch[1].replace(/,/g, ''), 10) || 0;
        if (!result.likes) {
          var krLikeMatch = desc.match(/좋아요\s*([\d,]+)/);
          if (krLikeMatch) result.likes = parseInt(krLikeMatch[1].replace(/,/g, ''), 10) || 0;
        }
        var months = { 'january':1,'february':2,'march':3,'april':4,'may':5,'june':6,'july':7,'august':8,'september':9,'october':10,'november':11,'december':12 };
        var dateMatch = desc.match(/- (\w+ \d{1,2}, \d{4})/i);
        if (dateMatch) {
          var parts = dateMatch[1].match(/(\w+)\s+(\d{1,2}),\s*(\d{4})/);
          if (parts && months[parts[1].toLowerCase()]) {
            result.date = parts[3] + '-' + String(months[parts[1].toLowerCase()]).padStart(2, '0') + '-' + String(parseInt(parts[2])).padStart(2, '0');
          }
        }
        if (!result.date) {
          var krDateMatch = desc.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
          if (krDateMatch) {
            result.date = krDateMatch[1] + '-' + String(parseInt(krDateMatch[2])).padStart(2, '0') + '-' + String(parseInt(krDateMatch[3])).padStart(2, '0');
          }
        }
      }
      if (!result.date) {
        var timeMatch = html.match(/<time[^>]*datetime="(\d{4}-\d{2}-\d{2})/i);
        if (timeMatch) result.date = timeMatch[1];
      }
      return result;
    } catch(e) {
      return { comments: 0, likes: 0, date: '' };
    }
  }

  async function extractReelsData(username) {
    // Instagram은 SPA이므로 fetch+DOMParser로는 릴스 데이터를 못 가져옴.
    // 릴스 탭을 클릭하여 SPA 내부 네비게이션 후 렌더링된 DOM에서 추출.
    var originalUrl = location.href;

    try {
      // 1. 릴스 탭 클릭 또는 SPA 네비게이션
      var reelsTab = document.querySelector('a[href="/' + username + '/reels/"]') ||
        document.querySelector('a[href*="/' + username + '/reels"]');

      if (reelsTab) {
        reelsTab.click();
      } else {
        // 탭을 못 찾으면 직접 URL 변경 (SPA가 감지)
        history.pushState(null, '', '/' + username + '/reels/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }

      // 2. 릴스 콘텐츠 렌더링 대기 (최대 10초)
      // 피드에 있던 reel 링크 수 기억 (SPA 전환 감지)
      var feedReelCount = document.querySelectorAll('a[href*="/reel/"]').length;
      // SPA 전환 시작 대기
      await new Promise(function(r) { setTimeout(r, 1000); });

      var reelLinks = [];
      for (var wait = 0; wait < 40; wait++) {
        await new Promise(function(r) { setTimeout(r, 250); });
        reelLinks = document.querySelectorAll('a[href*="/reel/"]');
        // SPA 전환 확인: 릴스 탭 URL이거나 링크 수가 변경된 경우만 처리
        var onReelsTab = location.pathname.includes('/reels');
        if (reelLinks.length > 0 && (onReelsTab || reelLinks.length !== feedReelCount)) break;
        // 스크롤로 lazy load 트리거
        if (wait === 5 || wait === 15) window.scrollBy(0, 300);
      }

      // 3. 릴스 DOM에서 데이터 추출 (확장프로그램과 동일한 로직)
      var reelsInfo = [];
      reelLinks.forEach(function(link, index) {
        try {
          var isPinned = false;
          var svgs = link.querySelectorAll('svg');
          for (var i = 0; i < svgs.length; i++) {
            var label = svgs[i].getAttribute('aria-label') || '';
            if (label.includes('고정') || label.toLowerCase().includes('pin')) { isPinned = true; break; }
          }
          if (!isPinned) {
            var titles = link.querySelectorAll('title');
            for (var j = 0; j < titles.length; j++) {
              var titleText = titles[j].textContent || '';
              if (titleText.includes('고정') || titleText.toLowerCase().includes('pin')) { isPinned = true; break; }
            }
          }

          var views = '';

          // 방법 1: svg aria-label로 찾기
          var allSvgs = link.querySelectorAll('svg');
          for (var k = 0; k < allSvgs.length; k++) {
            var ariaLabel = allSvgs[k].getAttribute('aria-label') || '';
            if (ariaLabel.includes('조회') || ariaLabel.toLowerCase().includes('view') || ariaLabel.toLowerCase().includes('play')) {
              var parentDiv = allSvgs[k].parentElement;
              if (parentDiv && parentDiv.nextElementSibling) {
                views = parentDiv.nextElementSibling.textContent.trim();
                break;
              }
            }
          }

          // 방법 2: 오버레이 span에서 숫자 패턴
          if (!views) {
            var overlaySpans = link.querySelectorAll('span');
            for (var m = 0; m < overlaySpans.length; m++) {
              var spanText = overlaySpans[m].textContent.trim();
              if (spanText && /^[\d,.]+[만천KMB]?$/.test(spanText)) { views = spanText; break; }
            }
          }

          // 방법 3: div 내부 텍스트에서 숫자 패턴
          if (!views) {
            var allDivs = link.querySelectorAll('div');
            for (var n = 0; n < allDivs.length; n++) {
              var divText = allDivs[n].textContent.trim();
              if (divText && /^[\d,.]+[만천KMB]?$/.test(divText) && divText.length < 15) { views = divText; break; }
            }
          }

          if (views) {
            reelsInfo.push({
              index: index + 1,
              views: parseViewCount(views),
              isPinned: isPinned,
              href: link.getAttribute('href') || ''
            });
          }
        } catch(e) {}
      });

      // 4. 원래 페이지로 복귀 (프로필)
      history.pushState(null, '', '/' + username + '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await new Promise(function(r) { setTimeout(r, 500); });

      return reelsInfo;
    } catch(e) {
      // 실패 시 원래 URL로 복귀
      try { history.pushState(null, '', '/' + username + '/'); } catch(ex) {}
      return [];
    }
  }

  function calculateStats(feedPosts, reels) {
    // 피드 통계 (공구 게시물 기준)
    var dealPosts = feedPosts.filter(function(p) { return !p.isPinned && p.isDeal; });
    var avgLikes = 0, maxLikes = 0, avgComments = 0, maxComments = 0;
    if (dealPosts.length > 0) {
      var totalLikes = 0, totalComments = 0;
      dealPosts.forEach(function(p) {
        totalLikes += p.likes || 0;
        totalComments += p.comments || 0;
        if ((p.likes || 0) > maxLikes) maxLikes = p.likes;
        if ((p.comments || 0) > maxComments) maxComments = p.comments;
      });
      avgLikes = Math.round(totalLikes / dealPosts.length);
      avgComments = Math.round(totalComments / dealPosts.length);
    }

    // 릴스 통계 (고정 제외, 최근 10개)
    var nonPinnedReels = reels.filter(function(r) { return !r.isPinned; });
    var recentReels = nonPinnedReels.slice(0, 10);
    var avgViews = 0, maxViews = 0;
    if (recentReels.length > 0) {
      var totalViews = 0;
      recentReels.forEach(function(r) {
        totalViews += r.views;
        if (r.views > maxViews) maxViews = r.views;
      });
      avgViews = Math.round(totalViews / recentReels.length);
    }

    // 최근 게시물 날짜
    var lastPostDate = '';
    var nonPinnedFeed = feedPosts.filter(function(p) { return !p.isPinned; });
    for (var i = 0; i < nonPinnedFeed.length; i++) {
      if (nonPinnedFeed[i].date) { lastPostDate = nonPinnedFeed[i].date; break; }
    }

    return { avgViews: avgViews, maxViews: maxViews, avgLikes: avgLikes, maxLikes: maxLikes, avgComments: avgComments, maxComments: maxComments, lastPostDate: lastPostDate };
  }
})();
