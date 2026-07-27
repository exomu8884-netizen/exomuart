# -*- coding: utf-8 -*-
import os, json
OUT="/sessions/cool-funny-mendel/mnt/블로그/exomu-art-2026-07-27"

CSS=""":root{--bg:#f7f7f5;--card:#ffffff;--ink:#1c1c1c;--sub:#8a8a8a;--line:#ececec;--sidebar-w:240px;}
*{box-sizing:border-box}
body{margin:0;font-family:'Pretendard','Malgun Gothic','Apple SD Gothic Neo',sans-serif;background:var(--bg);color:var(--ink);line-height:1.75}
a{color:inherit;text-decoration:none}
.layout{display:flex;min-height:100vh}
.sidebar{width:var(--sidebar-w);flex-shrink:0;background:#141319;color:#eee;padding:28px 20px;position:sticky;top:0;height:100vh;overflow-y:auto}
.sidebar .logo{display:block;font-weight:800;font-size:1.35rem;letter-spacing:-.5px;color:#fff;margin-bottom:6px}
.sidebar .logo span{color:#c9a6ff}
.sidebar .tagline{color:#8a8a95;font-size:.8rem;margin-bottom:28px}
.sidebar nav a{display:block;padding:11px 14px;margin-bottom:4px;border-radius:8px;color:#cfcfd6;font-size:.95rem;font-weight:600}
.sidebar nav a:hover{background:#232230;color:#fff}
.sidebar nav a.active{background:#2c2a3d;color:#fff}
main.content{flex:1;min-width:0;padding:36px 44px 80px;max-width:900px}
.hero{padding-bottom:14px;border-bottom:1px solid var(--line);margin-bottom:26px}
.hero h1{font-size:1.6rem;margin:0 0 6px}
.hero p{color:var(--sub);margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:22px}
.pcard{background:var(--card);border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.05);transition:transform .15s}
.pcard:hover{transform:translateY(-3px)}
.pcard img{width:100%;display:block;aspect-ratio:1200/630;object-fit:cover}
.pcard .pc-body{padding:16px 18px}
.pc-cat{display:inline-block;font-size:.72rem;font-weight:700;color:#fff;padding:3px 10px;border-radius:20px;margin-bottom:8px}
.pcard h3{font-size:1.02rem;margin:0 0 6px;line-height:1.4}
.pcard .pc-date{color:var(--sub);font-size:.8rem}
.empty-note{color:var(--sub);font-size:.92rem;padding:30px 0}
article.post{background:var(--card);border-radius:16px;padding:40px 44px;box-shadow:0 2px 14px rgba(0,0,0,.06)}
article.post .pc-cat{margin-bottom:14px}
article.post h1{font-size:1.85rem;margin:.1em 0 .2em;line-height:1.35}
article.post .meta{color:var(--sub);font-size:.9rem;margin-bottom:22px}
article.post img{max-width:100%;border-radius:10px;margin:20px 0;display:block}
article.post h3{font-size:1.2rem;margin-top:1.8em;margin-bottom:.5em}
article.post p{margin:0 0 1.1em}
.note{background:#fafaf5;border-left:4px solid #d8c98a;padding:14px 16px;font-size:.9rem;color:#6b6144;border-radius:6px;margin:1.2em 0}
.tags{margin-top:2em;padding-top:1.4em;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:8px}
.tag{background:#f0f0ee;color:#666;font-size:.8rem;padding:5px 12px;border-radius:20px}
footer.sitefoot{text-align:center;color:#aaa;font-size:.82rem;padding:30px 0}
footer.sitefoot a{color:#999;text-decoration:underline}
.backlink{display:inline-block;margin-top:30px;color:#888;font-size:.9rem}
.stats-box{margin-top:22px;padding:16px 14px;background:#1c1b26;border-radius:10px;font-size:.82rem}
.stats-row{display:flex;justify-content:space-between;padding:5px 0;color:#cfcfd6}
.stats-row b{color:#fff;font-weight:700}
.stats-pop{margin-top:10px;padding-top:10px;border-top:1px solid #2c2b3a}
.stats-pop-title{color:#8a8a95;font-size:.72rem;margin-bottom:6px}
.stats-pop ol{margin:0;padding-left:18px;color:#cfcfd6}
.stats-pop li{margin-bottom:5px;line-height:1.4;font-size:.82rem}
.stats-pop a{color:#cfcfd6}
.stats-pop a:hover{color:#fff}
.post-views{margin-top:1.6em;padding-top:1em;border-top:1px solid var(--line);color:var(--sub);font-size:.88rem}
@media (max-width:760px){.layout{flex-direction:column}.sidebar{position:static;height:auto;width:100%}main.content{padding:24px 18px 60px}}"""

CATS=[
 ("movie","영화와 사상","#4a3b78","영화를 실마리 삼아 시간·정체성·자유를 사유하는 1인칭 에세이"),
 ("art","미술과 사상","#8a4a3a","그림 한 점에서 출발해 재현과 실재를 되묻는 미술 에세이"),
 ("books","도서와 사상","#2f5d4f","책을 다시 읽으며 우리 삶의 질문으로 확장하는 독서 에세이"),
 ("psych","심리학용어사전","#8040a8","심리학 용어 하나를 정의와 실험, 일상 사례로 풀어내는 사전"),
 ("econ","쉬운 경제학","#2b4a86","금리·환율·증시를 유동성과 거시의 눈으로 쉽게 읽는 경제 이야기"),
 ("knowhow","노하우","#136b7a","광고가 아닌 정보성 비교·구매·실용 가이드"),
]
CATNAME={k:(n,c) for k,n,c,d in CATS}

# id, cat, title, card_img, date(카드/목록 표기), time(post meta용 작성시각), subtitle
POSTS=[
 ("01","econ","기준금리 2.75% 시대, 내 통장은 어떻게 지켜야 할까","01_card.png","2026.07.26","",""),
 ("02","econ","코스피 조정, AI 반도체 거품일까 기회일까","02_card.png","2026.07.26","",""),
 ("03","movie","놀란의 '오디세이', 3천 년 된 이야기를 왜 지금 IMAX로 찍었나","03_card.png","2026.07.26","",""),
 ("04","art","산을 그렸지만 산이 아니다 — 한국 추상의 거장 유영국 읽기","04_card.png","2026.07.26","",""),
 ("05","knowhow","2026 제습기 고르는 법 — 평수별 용량부터 전기세까지 한눈에","05_card.png","2026.07.26","",""),
 ("06","psych","인지부조화: 마음이 스스로에게 하는 거짓말","06_card.png","2026.07.26","",""),
 ("07","books","사피엔스, 낯선 사람과 협력하게 만든 상상의 힘","07_card.png","2026.07.26","",""),
 ("08","econ","원·달러 1470원과 WGBI 편입 — 외국인 돈은 지금 어디로 흐르나","08_img1.png","2026-07-26 09:34","",""),
 ("09","movie","『블레이드 러너』의 복제인간은 기억으로 인간이 되는가","09_img1.png","2026-07-26 22:11","",""),
 ("10","psych","학습된 무기력 — 벗어날 수 있는데도 포기하는 마음의 함정","10_img1.png","2026-07-26 12:48","",""),
 ("11","art","로스코의 색면 앞에서 우리는 왜 울게 되는가","11_img1.png","2026-07-26 16:27","",""),
 ("12","knowhow","2026 공기청정기 고르는 법 — CADR·필터·평수 핵심만","12_img1.png","2026-07-26 19:05","",""),
 # ---- today (2026-07-27) ----
 ("13","econ","금리 인하는 없다: 인플레이션이 되돌린 2026년, 금·환율·유동성 지도",
   "13_img1.png","2026-07-27 08:47","2026-07-27 08:47","긴축으로 돌아선 통화정책이 자산의 지형을 어떻게 바꾸는가"),
 ("14","psych","가용성 휴리스틱 — 쉽게 떠오르는 것을 흔한 것으로 착각하는 마음",
   "14_img1.png","2026-07-27 16:53","2026-07-27 16:53","선명한 기억이 확률 판단을 어떻게 왜곡하는가"),
 ("15","movie","빔 벤더스 '퍼펙트 데이즈' — 반복되는 하루에서 빛을 줍는 일",
   "15_img1.png","2026-07-27 23:12","2026-07-27 23:12","관람 전 사유 · 반복이라는 형식과 오늘의 빛에 대하여"),
 ("16","art","페르메이르의 창 — 본다는 것을 다시 생각한다",
   "16_img1.png","2026-07-27 14:05","2026-07-27 14:05","창으로 든 빛 앞에서 재현과 응시를 되묻다"),
 ("17","books","카뮈 『시지프 신화』 — 무의미한 반복 앞에서 왜 사는가",
   "17_img1.png","2026-07-27 07:29","2026-07-27 07:29","부조리를 자각한 자리에서 자유를 발견하는 법"),
]

TAGS={
 "13":["미국금리","인플레이션","금","원달러","자산배분"],
 "14":["인지편향","휴리스틱","트버스키","카너먼","의사결정"],
 "15":["퍼펙트데이즈","빔벤더스","일상","반복","코모레비"],
 "16":["페르메이르","재현","빛","응시","일상의미술"],
 "17":["카뮈","시지프신화","부조리","자유","실존주의"],
}

def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
def counts():
    c={k:0 for k,_,_,_ in CATS}
    for p in POSTS: c[p[1]]+=1
    return c
CNT=counts()

def head(title, active=None):
    nav=""
    for k,n,c,d in CATS:
        cls=' class="active"' if k==active else ''
        nav+=f'<a href="category-{k}.html"{cls}>{n} ({CNT[k]})</a>\n'
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)} — exomu's home</title>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3169773352082499" crossorigin="anonymous"></script>
<style>
{CSS}
</style></head><body>
<div class="layout">
<aside class="sidebar">
<a class="logo" href="index.html">exomu<span>'s home</span></a>
<div class="tagline">매일 새로 쌓는 개인 아카이브</div>
<nav>
{nav}</nav>
<div class="stats-box">
<div class="stats-row"><span>누적 방문자</span><b id="stat-total">–</b></div>
<div class="stats-row"><span>오늘 방문자</span><b id="stat-today">–</b></div>
<div class="stats-pop">
<div class="stats-pop-title">인기 게시물</div>
<ol id="stat-popular"><li>불러오는 중…</li></ol>
</div>
</div>
</aside>
<main class="content">
<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-3169773352082499" data-ad-slot="6448432776" data-ad-format="auto" data-full-width-responsive="true"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({{}});</script>
"""

FOOT="""</main></div><footer class="sitefoot"><a href="mailto:exomu@naver.com">exomu@naver.com</a></footer>
<script>
(function(){
var NS="exomuart", API="https://abacus.jasoncameron.dev";
function hit(k){return fetch(API+"/hit/"+NS+"/"+k).then(function(r){return r.json()}).then(function(j){return j.value||0})}
function get(k){return fetch(API+"/get/"+NS+"/"+k).then(function(r){return r.ok?r.json():{value:0}}).then(function(j){return j.value||0}).catch(function(){return 0})}
function todayKey(){
 var d=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Seoul"}));
 var y=d.getFullYear(),m=("0"+(d.getMonth()+1)).slice(-2),day=("0"+d.getDate()).slice(-2);
 return "day-"+y+m+day;
}
var tk=todayKey(), flag="exomu_v_"+tk;
if(!localStorage.getItem(flag)){
 hit("total-visits"); hit(tk); localStorage.setItem(flag,"1");
}
var totalEl=document.getElementById("stat-total"), todayEl=document.getElementById("stat-today");
if(totalEl) get("total-visits").then(function(v){totalEl.textContent=v.toLocaleString()});
if(todayEl) get(tk).then(function(v){todayEl.textContent=v.toLocaleString()});
var popEl=document.getElementById("stat-popular");
if(popEl){
 fetch("posts.json").then(function(r){return r.json()}).then(function(posts){
  return Promise.all(posts.map(function(p){return get("post-"+p.id).then(function(v){return {id:p.id,title:p.title,views:v}})}));
 }).then(function(list){
  list.sort(function(a,b){return b.views-a.views});
  popEl.innerHTML = list.slice(0,5).map(function(p){return '<li><a href="post-'+p.id+'.html">'+p.title+'</a></li>'}).join("");
 }).catch(function(){popEl.innerHTML='<li>통계를 불러올 수 없습니다</li>'});
}
var art=document.querySelector("article.post[data-post-id]");
var vEl=document.getElementById("post-view-count");
if(art&&vEl){
 hit("post-"+art.getAttribute("data-post-id")).then(function(v){vEl.textContent=v.toLocaleString()});
}
})();
</script>
</body></html>"""

def pcard(p):
    nn,ck,title,img,date,tm,sub=p
    name,color=CATNAME[ck]
    return f"""<a class="pcard" href="post-{nn}.html">
<img src="{img}" alt="{esc(title)}">
<div class="pc-body">
<span class="pc-cat" style="background:{color}">{name}</span>
<h3>{esc(title)}</h3>
<div class="pc-date">{date}</div>
</div></a>"""

def posts_in(ck, limit=None):
    ps=[p for p in POSTS if p[1]==ck]
    ps.sort(key=lambda p:int(p[0]), reverse=True)
    return ps[:limit] if limit else ps

# ---- index.html ----
html=head("exomu's home")
html+='<div class="hero"><h1>exomu\'s home</h1><p>영화·미술·도서·심리·경제·노하우를 매일 새로 쌓아가는 개인 아카이브입니다.</p></div>\n'
for k,n,c,d in CATS:
    html+=f'<section class="catsec"><h2 style="font-size:1.3rem;margin:38px 0 14px;padding-left:13px;border-left:5px solid {c}">{n}</h2>\n'
    ps=posts_in(k, limit=7)
    if ps:
        html+='<div class="grid">\n'+"\n".join(pcard(p) for p in ps)+'\n</div>\n'
    else:
        html+='<div class="empty-note">아직 글이 없습니다. 곧 채워집니다.</div>\n'
    html+='</section>\n'
html+=FOOT
open(os.path.join(OUT,"index.html"),"w",encoding="utf-8").write(html)
print("wrote index.html")

# ---- category pages (only categories with new posts today) ----
TODAY={"econ","psych","movie","art","books"}
for k,n,c,d in CATS:
    if k not in TODAY: continue
    h=head(n,active=k)
    h+=f'<div class="hero"><h1>{n}</h1><p>{d}</p></div>\n'
    ps=posts_in(k, limit=7)
    if ps:
        h+='<div class="grid">\n'+"\n".join(pcard(p) for p in ps)+'\n</div>\n'
    else:
        h+='<div class="empty-note">아직 글이 없습니다. 곧 채워집니다.</div>\n'
    h+=FOOT
    open(os.path.join(OUT,f"category-{k}.html"),"w",encoding="utf-8").write(h)
    print("wrote category-%s.html"%k)

# ---- posts.json (full manifest) ----
manifest=[{"id":p[0],"cat":p[1],"title":p[2]} for p in POSTS]
open(os.path.join(OUT,"posts.json"),"w",encoding="utf-8").write(
    json.dumps(manifest,ensure_ascii=False,indent=1))
print("wrote posts.json", len(manifest),"posts")

# ---- post pages ----
from articles import BODIES
def post_page(p):
    nn,ck,title,img,date,tm,sub=p
    name,color=CATNAME[ck]
    tags="".join(f'<span class="tag">#{t}</span>' for t in TAGS[nn])
    h=head(title,active=ck)
    h+=f'<article class="post" data-post-id="{nn}">\n'
    h+=f'<span class="pc-cat" style="background:{color}">{name}</span>\n'
    h+=f'<h1>{esc(title)}</h1>\n'
    h+=f'<div class="meta">{tm} · {esc(sub)}</div>\n'
    h+=f'<img src="{img}" alt="{esc(title)}">\n'
    h+=BODIES[nn]
    h+=f'\n<div class="tags">{tags}</div>\n'
    h+='<div class="post-views">조회수 <b id="post-view-count">–</b></div>\n'
    h+='<a class="backlink" href="index.html">← 목록으로</a>\n'
    h+='</article>\n'
    h+=FOOT
    open(os.path.join(OUT,f"post-{nn}.html"),"w",encoding="utf-8").write(h)
    print("wrote post-%s.html"%nn)

for p in POSTS:
    if p[0] in TAGS:  # only today's new posts
        post_page(p)

print("DONE")
