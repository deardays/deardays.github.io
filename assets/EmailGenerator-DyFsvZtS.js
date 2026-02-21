import{j as e}from"./framer-motion-6E75tBg3.js";import{r as y}from"./react-vendor-9l3RvKiN.js";import{B as x,b as f}from"./useInfluencerData-DgYyWdtE.js";import{D as C,a as E,b as k,c as D}from"./dialog-BsRQu4eJ.js";import{t as h}from"./index-kvcITcEx.js";import{C as B}from"./copy-Ck-R7ZBU.js";import"./tanstack-query-BtejbdqV.js";function F(r){if(!r)return"";const n=r.match(/instagram\.com\/([^/?]+)/);if(n)return n[1];if(!r.includes("/"))return r;const t=r.replace(/\/+$/,"").split("/");return t[t.length-1]||r}function R({open:r,onClose:n,data:t}){const[p,m]=y.useState(!1),i=()=>{const s=t.brandName||"[회사명]",o=t.productName||"[제품명]";return`[${s} x 디어데이즈] 공동구매 제안 ${o}`},l=()=>{const s=t.productName||"[제품명]",o=t.brandName||"[회사명]";let c="";return t.influencers.forEach((a,u)=>{if(a.name||a.profileUrl){const g=a.name||"[이름]",d=a.profileUrl?F(a.profileUrl):"handle",j=a.followers||"-",N=a.avgViews||"-",$=a.profileUrl?a.profileUrl:`https://www.instagram.com/${d}/`,w=a.category||"살림",v=a.maxComments&&a.maxComments!=="-"?` | 공구활성 댓글 ${a.maxComments}+`:"";c+=`${u+1}. @${d} | ${g} | 팔로워 ${j} | 평균 릴스 조회수 ${N}
   ${$}
   • ${w} 카테고리${v}

`}}),`안녕하세요, ${o} 담당자님.

공동구매 전문 에이전시 디어데이즈의 정준기 이사입니다.

${o}의 「${s}」를 살펴보니, 저희 협력 인플루언서들과 매우 좋은 핏을 가질 것 같아 연락드렸습니다.

■ 추천 인플루언서
공구 실적, 팔로워 소통도, 콘텐츠 품질 등 내부 검토를 거쳐 매칭한 인플루언서입니다.

${c}■ 최근 유사 카테고리 성과

• 키친 브랜드: N차 공구 진행, 인지도 제로 → 5차 연속 공구
• 식품 브랜드: 론칭 6시간 만에 첫 공구물량 전량소진 → N차 공구 진행
• 라이프스타일 브랜드: 신규 고객 유입 300% 증가
• 유아 브랜드: 3천만원 이상 매출

「${s}」도 좋은 결과를 기대할 수 있도록 하겠습니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 디어데이즈

• 누적 400건 이상의 공동구매 진행
• 300명 이상의 검증된 인플루언서와 직접 협업
• 콘텐츠 기획부터 판매 운영까지 원스톱 진행
• 데이터 기반 매칭으로 최적의 인플루언서 연계

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

해당 상품 또는 다른 상품으로 공동구매 진행이 가능하시다면, 편하신 채널(전화·이메일·카카오톡)로 회신 부탁드립니다.
또한 협업 전 궁금한 사항이 있다면 언제든지 전화주셔도 좋습니다.

감사합니다.
정준기 드림`},b=async()=>{const s=i(),o=l(),c=`제목: ${s}

${o}`;try{await navigator.clipboard.writeText(c),m(!0),h.success("이메일 내용이 복사되었습니다"),setTimeout(()=>m(!1),2e3)}catch(a){console.error("Failed to copy:",a),h.error("복사에 실패했습니다")}};return e.jsx(C,{open:r,onOpenChange:n,children:e.jsxs(E,{className:"max-w-3xl max-h-[80vh] bg-admin-card border-admin-border text-white",children:[e.jsx(k,{children:e.jsx(D,{className:"text-white",children:"이메일 생성"})}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-xs text-admin-text mb-2 block",children:"제목"}),e.jsx("div",{className:"bg-admin-bg border border-admin-border rounded px-4 py-3 text-sm",children:i()})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-xs text-admin-text mb-2 block",children:"본문"}),e.jsx("div",{className:"bg-admin-bg border border-admin-border rounded p-4 max-h-[40vh] overflow-y-auto",children:e.jsx("pre",{className:"text-sm whitespace-pre-wrap font-sans",children:l()})})]}),e.jsxs("div",{className:"flex justify-end gap-2 pt-2",children:[e.jsx(x,{variant:"outline",onClick:n,className:"border-admin-border hover:bg-admin-bg",children:"닫기"}),e.jsx(x,{onClick:b,className:"bg-admin-accent hover:bg-admin-accent/90 text-admin-bg",children:p?e.jsxs(e.Fragment,{children:[e.jsx(f,{className:"h-4 w-4 mr-2"}),"복사됨"]}):e.jsxs(e.Fragment,{children:[e.jsx(B,{className:"h-4 w-4 mr-2"}),"클립보드에 복사"]})})]})]})]})})}export{R as EmailGenerator};
