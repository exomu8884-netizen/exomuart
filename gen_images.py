# -*- coding: utf-8 -*-
import os, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = "/sessions/cool-funny-mendel/mnt/블로그/exomu-art-2026-07-27"
os.makedirs(OUT, exist_ok=True)

BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
REG  = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
SERB = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"

SS = 2                      # supersampling factor
W, H = 1200, 630
W2, H2 = W*SS, H*SS

def f(path, size): return ImageFont.truetype(path, size*SS, index=0)
def hex2rgb(h):
    h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def lighten(c, a): return tuple(min(255,int(x+(255-x)*a)) for x in c[:3])
def darken(c, a):  return tuple(max(0,int(x*(1-a))) for x in c[:3])

# ---- per-category fixed palettes: (top, bottom, accent, accent2) ----
PAL = {
 "econ":    dict(top="#3a5aa0", bot="#132443", acc="#f0b429", acc2="#5f83d0"),
 "movie":   dict(top="#5b4a94", bot="#221a3d", acc="#c9a6ff", acc2="#8a6fd0"),
 "art":     dict(top="#a55a44", bot="#3f1c14", acc="#e6a862", acc2="#c8794f"),
 "psych":   dict(top="#9450bc", bot="#37174c", acc="#d6a6ee", acc2="#a860cc"),
 "books":   dict(top="#3d7565", bot="#132a24", acc="#8ad4b2", acc2="#4f9a80"),
 "knowhow": dict(top="#1a8090", bot="#072f37", acc="#5ad6de", acc2="#2fa6b0"),
}
def pal(key):
    p=PAL[key]
    return dict(top=hex2rgb(p["top"]), bot=hex2rgb(p["bot"]),
               acc=hex2rgb(p["acc"]), acc2=hex2rgb(p["acc2"]))

def wrap(draw, text, font, maxw):
    lines=[]; cur=""
    for ch in text:
        if ch=="\n": lines.append(cur); cur=""; continue
        test=cur+ch
        if draw.textlength(test,font=font)<=maxw or not cur: cur=test
        else: lines.append(cur); cur=ch
    if cur: lines.append(cur)
    return lines
def tc(draw,cx,y,s,font,fill):
    w=draw.textlength(s,font=font); draw.text((cx-w/2,y),s,font=font,fill=fill)

def exists(name): return os.path.exists(os.path.join(OUT,name))
def skippable(fn):
    def w(name,*a,**k):
        if exists(name): print("skip",name); return
        return fn(name,*a,**k)
    return w
def save(img, name):
    img=img.convert("RGB").resize((W,H), Image.LANCZOS)
    p=os.path.join(OUT,name); img.save(p,"PNG",optimize=True)
    print("saved",name,os.path.getsize(p)//1024,"KB")

# ---------------- background builders (numpy, full 2x res) ----------------
def radial(cin, cout, center):
    yy,xx=np.mgrid[0:H2,0:W2]
    cx,cy=center
    dist=np.sqrt((xx-cx)**2+(yy-cy)**2)
    maxd=math.hypot(max(cx,W2-cx),max(cy,H2-cy))
    t=np.clip(dist/maxd,0,1)[...,None]
    return np.array(cin,float)*(1-t)+np.array(cout,float)*t
def linear(ctop,cbot):
    t=np.linspace(0,1,H2)[:,None,None]
    arr=np.array(ctop,float)*(1-t)+np.array(cbot,float)*t
    return np.repeat(arr,W2,axis=1)
def bg_image(p, center=None):
    if center is None: center=(W2*0.30,H2*0.28)
    rad=radial(lighten(p["top"],0.18), darken(p["bot"],0.12), center)
    lin=linear(p["top"], p["bot"])
    arr=rad*0.5+lin*0.5
    noise=np.random.randint(-6,7,(H2,W2,1))
    arr=np.clip(arr+noise,0,255).astype("uint8")
    return Image.fromarray(arr,"RGB").convert("RGBA")

def drop_shadow(img, box, radius, blur, alpha=120, dy=9):
    """Composite a blurred rounded-rect shadow on a small local crop (fast)."""
    x0,y0,x1,y1=[int(v) for v in box]
    pad=int(blur*3)+int(dy)+6
    bx0,by0=max(0,x0-pad),max(0,y0-pad)
    bx1,by1=min(W2,x1+pad),min(H2,y1+int(dy)+pad)
    w,h=bx1-bx0,by1-by0
    if w<=0 or h<=0: return
    sh=Image.new("RGBA",(w,h),(0,0,0,0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [x0-bx0,y0-by0+dy,x1-bx0,y1-by0+dy],radius=radius,fill=(0,0,0,alpha))
    sh=sh.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(sh,(bx0,by0))

def glow_circle(img,cx,cy,r,color,alpha,blur):
    pad=int(blur*3)+int(r)+4
    bx0,by0=max(0,int(cx-pad)),max(0,int(cy-pad))
    bx1,by1=min(W2,int(cx+pad)),min(H2,int(cy+pad))
    w,h=bx1-bx0,by1-by0
    if w<=0 or h<=0: return
    g=Image.new("RGBA",(w,h),(0,0,0,0))
    ImageDraw.Draw(g).ellipse([cx-r-bx0,cy-r-by0,cx+r-bx0,cy+r-by0],fill=color+(alpha,))
    g=g.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(g,(bx0,by0))

# ---------------- CARD (img1) ----------------
def card(name, catlabel, title, datestr, key):
    p=pal(key)
    img=bg_image(p)
    # decorative translucent circles top-right
    ov=Image.new("RGBA",(W2,H2),(0,0,0,0)); od=ImageDraw.Draw(ov)
    od.ellipse([W2-560,-300,W2+260,520], fill=p["acc"]+(60,))
    od.ellipse([W2-820,60,W2-380,500], fill=p["acc2"]+(38,))
    od.ellipse([160,H2-360,520,H2+40], fill=p["acc2"]+(26,))
    img=Image.alpha_composite(img,ov)
    d=ImageDraw.Draw(img)
    # category chip with soft shadow
    chipf=f(BOLD,26)
    cw=d.textlength(catlabel,font=chipf)
    x0,y0=80*SS,90*SS; x1,y1=x0+cw+56*SS,y0+58*SS
    drop_shadow(img,[x0,y0,x1,y1],29*SS,14*SS,alpha=110,dy=8*SS)
    d=ImageDraw.Draw(img)
    d.rounded_rectangle([x0,y0,x1,y1],radius=29*SS,fill=p["acc"])
    d.text((x0+28*SS,y0+13*SS),catlabel,font=chipf,fill=darken(p["bot"],0.15))
    # title: serif bold, black offset shadow under white
    tf=f(SERB,60)
    lines=wrap(d,title,tf,W2-160*SS)
    y=245*SS if len(lines)<=2 else 195*SS
    lh=82*SS
    for ln in lines:
        d.text((80*SS+2*SS,y+2*SS),ln,font=tf,fill=(0,0,0,190))
        d.text((80*SS,y),ln,font=tf,fill=(255,255,255))
        y+=lh
    # bottom date + logo
    d.text((80*SS,H2-64*SS),datestr,font=f(REG,27),fill=lighten(p["top"],0.55))
    logo="exomu's home"; lf=f(BOLD,24)
    lw=d.textlength(logo,font=lf)
    d.text((W2-80*SS-lw,H2-62*SS),logo,font=lf,fill=p["acc"])
    save(img,name)

# ---------------- concept graphics on gradient bg (img2-5) ----------------
def base_bg(key, title):
    p=pal(key)
    img=bg_image(p, center=(W2*0.22,H2*0.20))
    d=ImageDraw.Draw(img)
    tf=f(BOLD,34)
    d.text((60*SS+2*SS,44*SS+2*SS),title,font=tf,fill=(0,0,0,150))
    d.text((60*SS,44*SS),title,font=tf,fill=(255,255,255))
    d.line([(60*SS,108*SS),(W2-60*SS,108*SS)],fill=p["acc"]+(180,),width=3*SS)
    return img,d,p

def rr_shadow(img,box,radius,fill,blur=12,alpha=110,dy=9):
    drop_shadow(img,box,radius,blur*SS,alpha=alpha,dy=dy*SS)
    ImageDraw.Draw(img).rounded_rectangle(box,radius=radius,fill=fill)
    return img

def flow(name,key,title,steps,note=None):
    img,d,p=base_bg(key,title)
    n=len(steps); bw=int((W2-80*SS-(n-1)*40*SS)/n); bh=180*SS
    y=380*SS; x=40*SS
    for i,(l1,l2) in enumerate(steps):
        shade=[p["acc"],p["acc2"],lighten(p["acc"],0.2),p["acc2"],p["acc"]][i%5]
        col=darken(shade,0.15)
        img=rr_shadow(img,[x,y,x+bw,y+bh],26*SS,col+(255,),blur=14,alpha=120,dy=10)
        d=ImageDraw.Draw(img)
        d.rounded_rectangle([x,y,x+bw,y+bh],radius=26*SS,outline=lighten(col,0.25)+(255,),width=2*SS)
        for j,ln in enumerate(wrap(d,l1,f(BOLD,27),bw-28*SS)):
            tc(d,x+bw/2,y+34*SS+j*40*SS,ln,f(BOLD,27),(255,255,255))
        if l2:
            for j,ln in enumerate(wrap(d,l2,f(REG,21),bw-28*SS)):
                tc(d,x+bw/2,y+bh-64*SS+j*30*SS,ln,f(REG,21),lighten(col,0.82))
        if i<n-1:
            ax=x+bw+8*SS; ay=y+bh/2
            d.line([(ax,ay),(ax+24*SS,ay)],fill=(255,255,255,220),width=5*SS)
            d.polygon([(ax+24*SS,ay-12*SS),(ax+24*SS,ay+12*SS),(ax+40*SS,ay)],fill=(255,255,255,230))
        x+=bw+40*SS
    if note: ImageDraw.Draw(img).text((60*SS,H2-52*SS),note,font=f(REG,20),fill=(255,255,255,150))
    save(img,name)

def barc(name,key,title,items,note=None):
    img,d,p=base_bg(key,title)
    y=200*SS; bh=64*SS; gap=36*SS; maxw=760*SS; x0=360*SS
    vmax=max(v for _,v,_ in items) or 1
    for lb,v,sub in items:
        d.text((60*SS,y+bh/2-18*SS),lb,font=f(BOLD,26),fill=(255,255,255))
        bw=int(maxw*v/vmax)
        grad=Image.new("RGB",(max(bw,1),bh))
        gd=ImageDraw.Draw(grad)
        c1=lighten(p["acc"],0.15); c2=p["acc2"]
        for xx in range(max(bw,1)):
            t=xx/max(bw,1)
            gd.line([(xx,0),(xx,bh)],fill=tuple(int(c1[i]+(c2[i]-c1[i])*t) for i in range(3)))
        mask=Image.new("L",(max(bw,1),bh),0)
        ImageDraw.Draw(mask).rounded_rectangle([0,0,max(bw,1)-1,bh-1],radius=12*SS,fill=255)
        img.paste(grad,(x0,y),mask)
        d=ImageDraw.Draw(img)
        d.text((x0+bw+16*SS,y+bh/2-17*SS),sub,font=f(BOLD,25),fill=lighten(p["acc"],0.3))
        y+=bh+gap
    if note: d.text((60*SS,H2-50*SS),note,font=f(REG,20),fill=(255,255,255,150))
    save(img,name)

def cmap(name,key,title,center,nodes,note=None):
    img,d,p=base_bg(key,title)
    cx,cy=W2/2,360*SS; R=250*SS; N=len(nodes); pos=[]
    for i in range(N):
        ang=math.pi*2*i/N-math.pi/2
        pos.append((cx+R*math.cos(ang)*1.55, cy+R*math.sin(ang)*0.82, nodes[i]))
    for x,y,nd in pos:
        d.line([(cx,cy),(x,y)],fill=lighten(p["acc"],0.2)+(150,),width=4*SS)
    for x,y,nd in pos:
        nw,nh=190*SS,80*SS
        img=rr_shadow(img,[x-nw/2,y-nh/2,x+nw/2,y+nh/2],16*SS,(255,255,255,255),blur=10,alpha=90,dy=7)
        d=ImageDraw.Draw(img)
        d.rounded_rectangle([x-nw/2,y-nh/2,x+nw/2,y+nh/2],radius=16*SS,outline=p["acc2"]+(255,),width=3*SS)
        for j,ln in enumerate(wrap(d,nd,f(BOLD,25),nw-22*SS)):
            tc(d,x,y-24*SS+j*30*SS,ln,f(BOLD,25),darken(p["bot"],0.05))
    r=96*SS
    img=rr_shadow(img,[cx-r,cy-r,cx+r,cy+r],r,p["acc"]+(255,),blur=16,alpha=120,dy=10)
    d=ImageDraw.Draw(img)
    for j,ln in enumerate(wrap(d,center,f(BOLD,32),2*r-40*SS)):
        tc(d,cx,cy-20*SS+j*36*SS,ln,f(BOLD,32),darken(p["bot"],0.1))
    if note: d.text((60*SS,H2-50*SS),note,font=f(REG,20),fill=(255,255,255,150))
    save(img,name)

def loop(name,key,title,nodes,note=None):
    img,d,p=base_bg(key,title)
    cx,cy=W2/2,375*SS; R=200*SS; N=len(nodes); pos=[]
    for i in range(N):
        ang=math.pi*2*i/N-math.pi/2
        pos.append((cx+R*math.cos(ang)*1.7, cy+R*math.sin(ang)*0.82))
    for i in range(N):
        x0,y0=pos[i]; x1,y1=pos[(i+1)%N]
        d.line([(x0,y0),(x1,y1)],fill=lighten(p["acc"],0.15)+(160,),width=5*SS)
        mx,my=x0*0.6+x1*0.4,y0*0.6+y1*0.4
        d.polygon([(mx,my-11*SS),(mx,my+11*SS),(mx+16*SS,my)],fill=p["acc"]+(230,))
    for (x,y),nd in zip(pos,nodes):
        w,h=220*SS,78*SS
        img=rr_shadow(img,[x-w/2,y-h/2,x+w/2,y+h/2],16*SS,(255,255,255,255),blur=10,alpha=90,dy=7)
        d=ImageDraw.Draw(img)
        d.rounded_rectangle([x-w/2,y-h/2,x+w/2,y+h/2],radius=16*SS,outline=p["acc2"]+(255,),width=3*SS)
        for j,ln in enumerate(wrap(d,nd,f(BOLD,24),w-20*SS)):
            tc(d,x,y-18*SS+j*30*SS,ln,f(BOLD,24),darken(p["bot"],0.05))
    if note: d.text((60*SS,H2-50*SS),note,font=f(REG,20),fill=(255,255,255,150))
    save(img,name)

def checklist(name,key,title,items,note=None):
    img,d,p=base_bg(key,title)
    y=180*SS
    for head_,body in items:
        img=rr_shadow(img,[56*SS,y,W2-56*SS,y+86*SS],14*SS,(255,255,255,255),blur=9,alpha=80,dy=6)
        d=ImageDraw.Draw(img)
        d.ellipse([78*SS,y+24*SS,116*SS,y+62*SS],fill=p["acc2"])
        d.line([(87*SS,y+43*SS),(96*SS,y+52*SS)],fill=(255,255,255),width=5*SS)
        d.line([(96*SS,y+52*SS),(110*SS,y+33*SS)],fill=(255,255,255),width=5*SS)
        d.text((138*SS,y+14*SS),head_,font=f(BOLD,28),fill=darken(p["bot"],0.05))
        d.text((138*SS,y+50*SS),body,font=f(REG,22),fill=(110,110,110))
        y+=104*SS
    if note: d.text((56*SS,H2-46*SS),note,font=f(REG,20),fill=(255,255,255,150))
    save(img,name)

def panel(name,key,title,big,sub,note=None):
    img,d,p=base_bg(key,title)
    d.line([(120*SS,240*SS),(120*SS,500*SS)],fill=p["acc"]+(230,),width=8*SS)
    bf=f(SERB,52)
    lines=wrap(d,big,bf,W2-300*SS)
    y=260*SS
    for ln in lines:
        d.text((160*SS+2*SS,y+2*SS),ln,font=bf,fill=(0,0,0,150))
        d.text((160*SS,y),ln,font=bf,fill=(255,255,255)); y+=74*SS
    for j,ln in enumerate(wrap(d,sub,f(REG,25),W2-320*SS)):
        d.text((160*SS,y+18*SS+j*38*SS),ln,font=f(REG,25),fill=lighten(p["acc"],0.3))
    if note: d.text((60*SS,H2-46*SS),note,font=f(REG,20),fill=(255,255,255,150))
    save(img,name)

# ---------------- symbolic scene graphics ----------------
def komorebi(name,key):
    p=pal(key); img=bg_image(p,center=(W2*0.7,H2*0.2)); d=ImageDraw.Draw(img)
    random.seed(11)
    for _ in range(46):
        cx=random.randint(0,W2); cy=random.randint(int(H2*0.05),int(H2*0.55))
        r=random.randint(30*SS,90*SS)
        d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=darken(p["bot"],0.25)+(90,))
    light=Image.new("RGBA",(W2,H2),(0,0,0,0)); ld=ImageDraw.Draw(light)
    for _ in range(70):
        cx=random.randint(60*SS,W2-60*SS); cy=random.randint(int(H2*0.35),H2-40*SS)
        r=random.randint(10*SS,34*SS)
        ld.ellipse([cx-r,cy-r,cx+r,cy+r],fill=p["acc"]+(random.randint(30,80),))
    light=light.filter(ImageFilter.GaussianBlur(6*SS))
    img=Image.alpha_composite(img,light); d=ImageDraw.Draw(img)
    d.text((60*SS,H2-92*SS),"코모레비 — 잎 사이로 스며드는 빛",font=f(SERB,34),fill=(255,255,255))
    d.text((W2-150*SS,H2-46*SS),"Claude 제작",font=f(REG,18),fill=lighten(p["acc"],0.4))
    save(img,name)

def window_light(name,key):
    p=pal(key); img=bg_image(p,center=(W2*0.25,H2*0.3)); d=ImageDraw.Draw(img)
    wx0,wy0,wx1,wy1=140*SS,150*SS,470*SS,540*SS
    beam=Image.new("RGBA",(W2,H2),(0,0,0,0)); bd=ImageDraw.Draw(beam)
    bd.polygon([(wx1,wy0),(wx1,wy1),(W2-120*SS,H2-80*SS),(W2-260*SS,120*SS)],
               fill=lighten(p["acc"],0.4)+(60,))
    beam=beam.filter(ImageFilter.GaussianBlur(10*SS))
    img=Image.alpha_composite(img,beam); d=ImageDraw.Draw(img)
    d.rectangle([wx0,wy0,wx1,wy1],fill=lighten(p["acc"],0.55)+(255,))
    d.rectangle([wx0,wy0,wx1,wy1],outline=darken(p["bot"],0.1)+(255,),width=10*SS)
    d.line([((wx0+wx1)//2,wy0),((wx0+wx1)//2,wy1)],fill=darken(p["bot"],0.1),width=8*SS)
    d.line([(wx0,(wy0+wy1)//2),(wx1,(wy0+wy1)//2)],fill=darken(p["bot"],0.1),width=8*SS)
    d.text((60*SS,H2-92*SS),"창으로 드는 빛 — 재현의 순간",font=f(SERB,34),fill=(255,255,255))
    d.text((W2-150*SS,H2-46*SS),"Claude 제작",font=f(REG,18),fill=lighten(p["acc"],0.4))
    save(img,name)

def mountain(name,key):
    p=pal(key); img=bg_image(p,center=(W2*0.5,H2*0.15)); d=ImageDraw.Draw(img)
    d.polygon([(0,H2),(W2*0.45,H2*0.35),(W2,H2)],fill=darken(p["bot"],0.15)+(255,))
    d.polygon([(0,H2),(W2*0.25,H2*0.55),(W2*0.7,H2*0.42),(W2,H2)],fill=darken(p["bot"],0.3)+(255,))
    bx,by=W2*0.42,H2*0.5
    img=rr_shadow(img,[bx-70*SS,by-70*SS,bx+70*SS,by+70*SS],70*SS,lighten(p["acc"],0.1)+(255,),blur=14,alpha=120,dy=10)
    d=ImageDraw.Draw(img)
    fx,fy=bx-110*SS,by+30*SS
    d.ellipse([fx-14*SS,fy-70*SS,fx+14*SS,fy-42*SS],fill=(20,20,20))
    d.line([(fx,fy-42*SS),(fx,fy)],fill=(20,20,20),width=12*SS)
    d.line([(fx,fy-30*SS),(bx-70*SS,by)],fill=(20,20,20),width=10*SS)
    d.line([(fx,fy),(fx-18*SS,fy+40*SS)],fill=(20,20,20),width=11*SS)
    d.line([(fx,fy),(fx+18*SS,fy+40*SS)],fill=(20,20,20),width=11*SS)
    d.text((60*SS,H2-92*SS),"산정을 향해 다시 바위를 밀며",font=f(SERB,34),fill=(255,255,255))
    d.text((W2-150*SS,H2-46*SS),"Claude 제작",font=f(REG,18),fill=lighten(p["acc"],0.4))
    save(img,name)

def availability(name,key):
    p=pal(key); img=bg_image(p,center=(W2*0.3,H2*0.25)); d=ImageDraw.Draw(img)
    random.seed(5)
    cx,cy=W2/2,H2*0.52
    pts=[]
    for _ in range(26):
        a=random.uniform(0,math.pi*2); r=random.uniform(60*SS,360*SS)
        pts.append((cx+math.cos(a)*r*1.4, cy+math.sin(a)*r*0.7))
    for i,(x,y) in enumerate(pts):
        for (x2,y2) in pts[i+1:i+3]:
            d.line([(x,y),(x2,y2)],fill=lighten(p["acc"],0.1)+(60,),width=2*SS)
    for i,(x,y) in enumerate(pts):
        bright = i%7==0
        rr=(26*SS if bright else 12*SS)
        col=(p["acc"] if bright else p["acc2"])
        if bright:
            glow_circle(img,x,y,rr*2,col,120,10*SS); d=ImageDraw.Draw(img)
        d.ellipse([x-rr,y-rr,x+rr,y+rr],fill=col+(255,))
    d.text((60*SS,H2-92*SS),"선명한 기억이 '흔함'으로 오인된다",font=f(SERB,34),fill=(255,255,255))
    d.text((W2-150*SS,H2-46*SS),"Claude 제작",font=f(REG,18),fill=lighten(p["acc"],0.4))
    save(img,name)

# ================= MATPLOTLIB (econ) =================
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties
FP_B=FontProperties(fname=BOLD); FP_R=FontProperties(fname=REG)
DARK="#0e1830"

def mpl_setup(ax,fig):
    fig.patch.set_facecolor(DARK); ax.set_facecolor(DARK)
    for s in ["top","right","left"]: ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color("#3a4a68")
    ax.tick_params(colors="#c8d0e0")
    ax.yaxis.grid(True,color="#22304c",linewidth=0.8); ax.set_axisbelow(True)
    ax.xaxis.grid(False)

def econ_line(name,title,labels,vals,hi_idx,ylabel,note):
    fig,ax=plt.subplots(figsize=(12,6.3),dpi=200); mpl_setup(ax,fig)
    ax.plot(labels,vals,color="#5f83d0",lw=3,marker="o",ms=8,mfc="#f0b429",mec="#f0b429",zorder=3)
    for i,v in enumerate(vals):
        ax.annotate(f"{v:,}",(i,v),textcoords="offset points",xytext=(0,12),
                    ha="center",color="#e8edf6",fontproperties=FP_B,fontsize=13)
    ax.set_title(title,color="#ffffff",fontproperties=FP_B,fontsize=22,pad=18,loc="left")
    ax.set_ylabel(ylabel,color="#9fb0cc",fontproperties=FP_R,fontsize=13)
    for lb in ax.get_xticklabels(): lb.set_fontproperties(FP_R)
    ax.margins(y=0.18)
    fig.text(0.12,0.02,note,color="#7a88a4",fontproperties=FP_R,fontsize=11)
    fig.tight_layout(rect=[0,0.04,1,1]); fig.savefig(os.path.join(OUT,name),facecolor=DARK)
    plt.close(fig); print("saved",name)

def econ_bar(name,title,labels,vals,hi_idx,note,unit=""):
    fig,ax=plt.subplots(figsize=(12,6.3),dpi=200); mpl_setup(ax,fig)
    colors=["#f0b429" if i in hi_idx else "#3f5c92" for i in range(len(vals))]
    bars=ax.bar(labels,vals,color=colors,width=0.6,zorder=3)
    for b,v in zip(bars,vals):
        ax.text(b.get_x()+b.get_width()/2,v+ (max(vals)*0.02),f"{v}{unit}",
                ha="center",va="bottom",color="#e8edf6",fontproperties=FP_B,fontsize=14)
    ax.set_title(title,color="#ffffff",fontproperties=FP_B,fontsize=22,pad=18,loc="left")
    for lb in ax.get_xticklabels(): lb.set_fontproperties(FP_R); lb.set_fontsize(13)
    ax.margins(y=0.16)
    fig.text(0.12,0.02,note,color="#7a88a4",fontproperties=FP_R,fontsize=11)
    fig.tight_layout(rect=[0,0.04,1,1]); fig.savefig(os.path.join(OUT,name),facecolor=DARK)
    plt.close(fig); print("saved",name)

def econ_hbar(name,title,labels,vals,note,unit="%"):
    fig,ax=plt.subplots(figsize=(12,6.3),dpi=200); mpl_setup(ax,fig)
    ax.xaxis.grid(True,color="#22304c",linewidth=0.8); ax.yaxis.grid(False)
    ypos=range(len(labels))
    colors=["#f0b429" if v>=0 else "#e06a6a" for v in vals]
    ax.barh(list(ypos),vals,color=colors,height=0.6,zorder=3)
    ax.set_yticks(list(ypos)); ax.set_yticklabels(labels,fontproperties=FP_R,fontsize=13)
    ax.invert_yaxis()
    for i,v in enumerate(vals):
        ax.text(v+(1 if v>=0 else -1),i,f"{v:+}{unit}",va="center",
                ha="left" if v>=0 else "right",color="#e8edf6",fontproperties=FP_B,fontsize=13)
    ax.axvline(0,color="#3a4a68",lw=1)
    ax.set_title(title,color="#ffffff",fontproperties=FP_B,fontsize=22,pad=18,loc="left")
    ax.margins(x=0.14)
    fig.text(0.12,0.02,note,color="#7a88a4",fontproperties=FP_R,fontsize=11)
    fig.tight_layout(rect=[0,0.04,1,1]); fig.savefig(os.path.join(OUT,name),facecolor=DARK)
    plt.close(fig); print("saved",name)

# ---- wrap all generators to skip already-produced files (idempotent) ----
for _fn in ["card","flow","barc","cmap","loop","checklist","panel","komorebi",
            "window_light","mountain","availability","econ_line","econ_bar","econ_hbar"]:
    globals()[_fn]=skippable(globals()[_fn])

# ==================================================================
# ============================ CARDS ===============================
CARDS=[
 ("13","econ","쉬운 경제학","금리 인하는 없다: 인플레이션이 되돌린 2026년, 금·환율·유동성 지도","2026-07-27 08:47"),
 ("14","psych","심리학용어사전","가용성 휴리스틱 — 쉽게 떠오르는 것을 흔한 것으로 착각하는 마음","2026-07-27 16:53"),
 ("15","movie","영화와 사상","빔 벤더스 '퍼펙트 데이즈' — 반복되는 하루에서 빛을 줍는 일","2026-07-27 23:12"),
 ("16","art","미술과 사상","페르메이르의 창 — 본다는 것을 다시 생각한다","2026-07-27 14:05"),
 ("17","books","도서와 사상","카뮈 『시지프 신화』 — 무의미한 반복 앞에서 왜 사는가","2026-07-27 07:29"),
]
for nn,key,cl,ti,dt in CARDS:
    card(f"{nn}_img1.png",cl,ti,dt,key)

# ---------- POST 13 econ (matplotlib) ----------
econ_line("13_img2.png","금값, 1월 고점에서 얼마나 내려왔나 (달러/온스)",
    ["1월","2월","3월","4월","5월","6월","7월"],[5595,5120,4780,4460,4210,4090,4038],
    {0}, "USD/oz","※ 월별 근사치 · 정보 제공용 예시 도식")
econ_bar("13_img3.png","2026 남은 FOMC, 시장이 매긴 확률",
    ["25bp 인상","50bp 인상","동결","인하"],[47,11,38,4],{0,1},
    "※ 보도 기반 대략치 · 시점에 따라 변동","%")
econ_line("13_img4.png","원·달러 환율 2026 흐름 (원/달러)",
    ["2월","3월","4월","5월","6월","7월초","7월말"],[1512,1498,1505,1489,1497,1497,1473],
    {6}, "KRW/USD","※ 월별 근사치 · 정보 제공용 예시 도식")
econ_hbar("13_img5.png","2026 상반기, 자산은 어디로 움직였나",
    ["금(연초 대비)","코스피 선행 EPS","원화 가치(7월)","미 정책금리 기대"],
    [-28,16,2,25],
    "※ 방향성 개념도 · 특정 종목 투자 권유 아님","%")

# ---------- POST 14 psych ----------
flow("14_img2.png","psych","가용성 휴리스틱이 작동하는 순서",
    [("사건을 접함","뉴스·경험"),("쉽게 떠오름","기억의 인출"),("'흔하다'고 판단","빈도 추정"),("확률 왜곡","의사결정")])
barc("14_img3.png","psych","체감 위험 vs 실제 빈도 (개념 비교)",
    [("비행기 사고",88,"체감↑·실제 낮음"),("자동차 사고",42,"체감↓·실제 높음"),
     ("복권 당첨",80,"체감↑·확률 희박"),("생활습관병",38,"체감↓·위험 큼")],
    "가용성 편향의 전형적 사례 · 개념 이해용")
availability("14_img4.png","psych")
checklist("14_img5.png","psych","가용성 편향을 줄이는 습관",
    [("기저율을 찾기","인상 대신 통계·빈도 확인"),("반례를 떠올리기","'떠오르지 않는' 사례 상상"),
     ("표본을 넓히기","한 사건이 아닌 추세로 보기"),("시간 두고 판단","즉각 반응 미루기")])

# ---------- POST 15 movie ----------
flow("15_img2.png","movie","반복되는 하루가 의미가 되기까지",
    [("같은 아침","루틴의 시작"),("성실한 반복","몸에 밴 일"),("작은 차이 발견","오늘의 빛"),("충만한 하루","의미의 생성")])
cmap("15_img3.png","movie","'퍼펙트 데이즈'가 건드리는 질문","일상",
    ["반복","시간","존재","빛","만족"])
panel("15_img4.png","movie","완벽한 날이란 무엇인가","다음은 다음, 지금은 지금.",
    "완벽한 날은 특별한 사건이 아니라, 반복 속에서 오늘의 빛을 알아채는 태도에서 온다.")
komorebi("15_img5.png","movie")

# ---------- POST 16 art ----------
flow("16_img2.png","art","페르메이르의 그림이 완성되는 빛의 길",
    [("창","빛의 입구"),("실내","일상의 무대"),("정지한 순간","응시의 대상"),("영원","기억이 됨")])
cmap("16_img3.png","art","'재현'을 둘러싼 개념들","재현",
    ["빛","응시","아우라","일상","실재"])
panel("16_img4.png","art","재현이란 무엇인가","그림은 대상을 옮기지 않는다.",
    "그림은 우리가 무엇을, 어떻게 바라보는지를 옮긴다 — 재현은 세계가 아니라 시선의 기록이다.")
window_light("16_img5.png","art")

# ---------- POST 17 books ----------
flow("17_img2.png","books","카뮈가 그린 부조리의 경로",
    [("세계의 침묵","의미를 묻다"),("부조리 자각","답 없음 직면"),("반항","그래도 산다"),("자유·열정","나의 삶")])
loop("17_img3.png","books","시지프의 반복 — 그리고 그 사이의 자각",
    ["바위를 민다","정상에 이른다","바위가 굴러떨어진다","내려간다","다시 시작"])
cmap("17_img4.png","books","시지프 신화의 핵심 개념","부조리",
    ["반항","자유","열정","의미","자각"])
mountain("17_img5.png","books")

print("ALL DONE")
