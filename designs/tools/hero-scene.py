# hero-scene.py — generates the routr hero use-case dot scene (page/scene/motion renders).
# Usage: python3 hero-scene.py scene|motion [yaw pitch] [outname]. Requires Pillow-free SVG + Playwright for shots.
import math
U=62; CC=math.cos(math.radians(30)); SS=0.5
OX,OY=1066,240
YAW=0.0; PITCH=0.0; PIV=(2.9,2.7,0.5)
def rot(x,y,z):
    x-=PIV[0]; y-=PIV[1]; z-=PIV[2]
    cy,sy=math.cos(YAW),math.sin(YAW)
    x,y = x*cy - y*sy, x*sy + y*cy
    cp,sp=math.cos(PITCH),math.sin(PITCH)
    ux,uy=0.70710678,-0.70710678
    vx,vy,vz=x,y,z
    crx=uy*vz; cry=-ux*vz; crz=ux*vy-uy*vx
    duv=ux*vx+uy*vy
    x=vx*cp+crx*sp+ux*duv*(1-cp)
    y=vy*cp+cry*sp+uy*duv*(1-cp)
    z=vz*cp+crz*sp
    return x+PIV[0],y+PIV[1],z+PIV[2]
def iso(x,y,z=0.0):
    x,y,z=rot(x,y,z)
    return (OX+(x-y)*U*CC, OY+(x+y)*U*SS - z*U)
TOP='#D9FBFA'; LEFT='#6ED9D8'; RIGHT='#2F7E7D'; HOT='#FFFFFF'; TEAL='#5FCFCE'
dots=[]; under=[]; labels=[]
ST=0.115
def fr(a,b,st=ST):
    v=a+st/2
    while v<b:
        yield v; v+=st
def box(x0,y0,z0,dx,dy,dz,rt=2.1,rl=1.9,rr=1.75,topmask=None,xmask=None):
    for x in fr(x0,x0+dx):
        for y in fr(y0,y0+dy):
            c=topmask(x-x0,y-y0) if topmask else None
            sx,sy=iso(x,y,z0+dz); dots.append((sx,sy,rt if c is None else 2.3,TOP if c is None else c))
    for x in fr(x0,x0+dx):
        for z in fr(z0,z0+dz):
            sx,sy=iso(x,y0+dy,z); dots.append((sx,sy,rl,LEFT))
    for y in fr(y0,y0+dy):
        for z in fr(z0,z0+dz):
            if xmask and xmask(y,z): continue
            sx,sy=iso(x0+dx,y,z); dots.append((sx,sy,rr,RIGHT))
def cyl(cx,cy,z0,r,h):
    for x in fr(cx-r,cx+r):
        for y in fr(cy-r,cy+r):
            if (x-cx)**2+(y-cy)**2<=r*r:
                sx,sy=iso(x,y,z0+h); dots.append((sx,sy,2.1,TOP))
    n=max(8,int(2*math.pi*r/ST))
    for i in range(n):
        th=2*math.pi*i/n
        vis=math.cos(th)+math.sin(th)
        if vis>0.12:
            t=vis/1.414
            col=LEFT if math.sin(th)>math.cos(th) else RIGHT
            for z in fr(z0,z0+h):
                sx,sy=iso(cx+r*math.cos(th),cy+r*math.sin(th),z)
                dots.append((sx,sy,1.85,col))
def hotdot(x,y,z,r=2.4):
    sx,sy=iso(x,y,z); dots.append((sx,sy,r,HOT))

def ast_mask(u,v):
    cu,cv=0.675,0.5
    for k in range(6):
        th=math.pi*k/3+math.pi/6
        ex,ey=math.cos(th)*0.36,math.sin(th)*0.36
        pu,pv=u-cu,v-cv
        t=max(0.0,min(1.0,(pu*ex+pv*ey)/(0.36*0.36)))
        if math.hypot(pu-t*ex,pv-t*ey)<0.1: return '#0C4B4A'
    return None
def server(px,py):
    for i in range(3):
        z=i*0.58
        box(px,py,z,1.35,1.0,0.34)
        hotdot(px+1.35,py+0.22,z+0.18); hotdot(px+1.35,py+0.42,z+0.18)
    return (px+0.675,py+0.5)
def camera(px,py):
    box(px+0.62,py+0.52,0,0.2,0.2,1.05)       # pole
    box(px,py,1.05,1.55,0.62,0.6)             # body
    cxf,czf=py+0.31,1.35                      # lens on +x face
    n=14
    for i in range(n):
        th=2*math.pi*i/n
        sx,sy=iso(px+1.55,cxf+0.17*math.cos(th),czf+0.17*math.sin(th))
        dots.append((sx,sy,2.0,HOT))
    hotdot(px+1.55,cxf,czf+0.0,1.6)
    return (px+0.77,py+0.31)
def scaip(px,py):
    box(px,py,0,1.25,1.25,0.4)
    for x in fr(px+0.625-0.34,px+0.625+0.34):
        for y in fr(py+0.625-0.34,py+0.625+0.34):
            if (x-px-0.625)**2+(y-py-0.625)**2<=0.34**2:
                sx,sy=iso(x,y,0.52); dots.append((sx,sy,2.2,HOT))
    hotdot(px+1.25,py+0.2,0.2,1.7); hotdot(px+1.25,py+0.45,0.2,1.7)
    return (px+0.625,py+0.625)
def radio(px,py):
    box(px,py,0,0.66,0.42,1.15)
    for gy in fr(py+0.07,py+0.36,0.11):
        for gz in fr(0.66,1.04,0.11):
            sx,sy=iso(px+0.66,gy,gz); dots.append((sx,sy,1.7,HOT))
    ax,ay=px+0.14,py+0.14
    for z in fr(1.15,1.62,0.1):
        sx,sy=iso(ax,ay,z); dots.append((sx,sy,1.9,'#9FEDEC'))
    tx,ty=iso(ax,ay,1.68)
    for rr_ in (11,19):
        for adeg in (-75,-45,-15,15):
            th=math.radians(adeg)
            dots.append((tx+rr_*math.cos(th),ty+rr_*math.sin(th),1.8,TEAL))
    return (px+0.33,py+0.21)
def intercom(px,py):
    yc=py+0.55
    def m(y,z):
        if (y-yc)**2+(z-1.42)**2<0.26**2: return True
        if py+0.14<y<py+0.96 and 0.68<z<1.16: return True
        if (y-yc)**2+(z-0.36)**2<0.22**2: return True
        return False
    box(px,py,0,0.3,1.1,1.75,xmask=m)
    fx=px+0.3
    for i in range(14):
        th=2*math.pi*i/14
        sx,sy=iso(fx,yc+0.15*math.cos(th),1.42+0.15*math.sin(th))
        dots.append((sx,sy,1.9,HOT))
    sx,sy=iso(fx,yc,1.42); dots.append((sx,sy,2.0,HOT))
    for gy in fr(py+0.2,py+0.92,0.155):
        for gz in fr(0.74,1.12,0.13):
            sx,sy=iso(fx,gy,gz); dots.append((sx,sy,1.6,HOT))
    sx,sy=iso(fx,yc,0.36); dots.append((sx,sy,3.6,HOT))
    for i in range(12):
        th=2*math.pi*i/12
        sx,sy=iso(fx,yc+0.12*math.cos(th),0.36+0.12*math.sin(th))
        dots.append((sx,sy,1.4,'#9FEDEC'))
    return (px+0.15,py+0.55)
def ast_glyph():
    px,py=P['pbx']; cx,cy=px+0.675,py+0.5; zt=2*0.58+0.34
    for k in range(3):
        th=math.pi/6+k*math.pi/3
        ex,ey=math.cos(th)*0.34,math.sin(th)*0.34
        x1,y1=iso(cx-ex,cy-ey,zt); x2,y2=iso(cx+ex,cy+ey,zt)
        lab_extra.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#0A4A49" stroke-width="4.5" stroke-linecap="round"/>')
def sos():
    sx,sy=iso(P['scaip'][0]+0.625,P['scaip'][1]+0.625,0.52)
    lab_extra.append(f'<text x="{sx:.1f}" y="{sy+5:.1f}" text-anchor="middle" font-family="Poppins" font-size="18" font-weight="700" fill="#0B3D3D">SOS</text>')
lab_extra=[]
def label(txt,ax,ay,dy=30):
    labels.append((txt,ax,ay+dy))

def floor():
    cxf,cyf=iso(2.9,2.7)
    g=0.55
    x=-0.8
    while x<6.6:
        y=-0.8
        while y<6.6:
            sx,sy=iso(x,y)
            d=math.hypot(sx-cxf,(sy-cyf)*1.8)
            o=max(0.0,0.10*(1-d/540))
            if o>0.004: under.append(f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="1.4" fill="#FFFFFF" fill-opacity="{o:.3f}"/>')
            y+=g
        x+=g
import sys, json as _json
MODE=sys.argv[1] if len(sys.argv)>1 else 'page'
if MODE=='motion' and len(sys.argv)>3:
    YAW=math.radians(float(sys.argv[2])); PITCH=math.radians(float(sys.argv[3]))
VARIANT='v2'
OUT=sys.argv[4] if len(sys.argv)>4 else ('usecases-'+MODE)
floor()
P={'scaip':(3.3,-0.3),'camera':(-0.5,2.2),'pbx':(5.9,2.9),'intercom':(0.9,5.0),'radio':(4.6,5.4)}
centers={}
# draw connection lines first (v2)
CEN=(2.95,2.75)
bases={'scaip':(P['scaip'][0]+0.62,P['scaip'][1]+0.62),'camera':(P['camera'][0]+0.78,P['camera'][1]+0.31),
 'pbx':(P['pbx'][0]+0.67,P['pbx'][1]+0.5),'intercom':(P['intercom'][0]+0.15,P['intercom'][1]+0.55),
 'radio':(P['radio'][0]+0.33,P['radio'][1]+0.21)}
if VARIANT=='v2':
    cxs,cys=iso(*CEN)
    for k,(bx,by) in bases.items():
        sx,sy=iso(bx,by)
        ex,ey=cxs+(sx-cxs)*0.8,cys+(sy-cys)*0.8
        under.append(f'<line x1="{cxs:.1f}" y1="{cys:.1f}" x2="{ex:.1f}" y2="{ey:.1f}" stroke="#5FCFCE" stroke-opacity="0.35" stroke-width="1.2"/>')
    under.append(f'<circle cx="{cxs:.1f}" cy="{cys:.1f}" r="52" fill="url(#halo)"/>')
    under.append(f'<circle cx="{cxs:.1f}" cy="{cys:.1f}" r="5.5" fill="#5FCFCE"/>')
    if MODE!='scene':
        under.append(f'<text x="{cxs:.1f}" y="{cys+26:.1f}" text-anchor="middle" font-family="Poppins" font-size="15" font-weight="600" fill="#FFFFFF">routr<tspan fill="#5FCFCE">.</tspan></text>')
server(*P['pbx']); camera(*P['camera']); scaip(*P['scaip']); sos(); ast_glyph(); radio(*P['radio']); intercom(*P['intercom'])
L={'scaip':'build a scaip network','camera':'connect camera networks','pbx':'scale your pbx','intercom':'wire up intercoms','radio':'bridge radio over ip'}
off={'scaip':(0,-112),'camera':(10,-142),'pbx':(0,46),'intercom':(0,42),'radio':(0,46)}
lab_svg=[]; anchors={'labels':[],'hub':None}
cxs_,cys_=iso(*CEN)
anchors['hub']={'x':cxs_,'y':cys_}
for k,(bx,by) in bases.items():
    sx,sy=iso(bx,by)
    dx,dy=off[k]
    w=len(L[k])*6.7+24
    anchors['labels'].append({'key':k,'text':L[k],'x':sx-w/2+dx,'y':sy+dy,'w':w})
    if MODE!='scene':
        lab_svg.append(f'<g><rect x="{sx-w/2+dx:.1f}" y="{sy+dy:.1f}" width="{w:.0f}" height="24" rx="12" fill="#121414" fill-opacity="0.92" stroke="#FFFFFF" stroke-opacity="0.14"/><text x="{sx+dx:.1f}" y="{sy+dy+16:.1f}" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="11.5" fill="#9fb8b7">{L[k]}</text></g>')
if MODE=='scene':
    _json.dump(anchors,open('scene-anchors.json','w'),indent=1)
svg_dots=''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{c}"/>' for x,y,r,c in dots)
svg=f'''<svg width="1440" height="780" viewBox="0 0 1440 780" fill="none" style="position:absolute;inset:0">
<defs><radialGradient id="halo"><stop offset="0" stop-color="#5FCFCE" stop-opacity="0.3"/><stop offset="1" stop-color="#5FCFCE" stop-opacity="0"/></radialGradient>
<radialGradient id="scene"><stop offset="0" stop-color="#5FCFCE" stop-opacity="0.06"/><stop offset="1" stop-color="#5FCFCE" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="1060" cy="420" rx="520" ry="330" fill="url(#scene)"/>
{''.join(under)}{svg_dots}{''.join(lab_extra)}{''.join(lab_svg)}</svg>'''
COPY='' if MODE!='page' else '<div class="copy"><div class="badge"><span class="d"></span>The signaling engine behind Fonoster&nbsp;&nbsp;&rarr;</div><h1>The SIP server<br>built for the cloud.</h1><div class="sub">A lightweight SIP proxy, location server, and registrar.</div><div class="ctas"><div class="b1">Get started</div><div class="b2">View on GitHub</div></div></div>'
BODYBG='' if MODE=='scene' else "background:#161616;background-image:radial-gradient(#ffffff08 1px,transparent 1px);background-size:26px 26px;"
html=f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1440px;height:780px;{BODYBG}position:relative;overflow:hidden;font-family:'Poppins',sans-serif}}
.copy{{position:absolute;left:80px;top:150px;max-width:620px}}
.badge{{display:inline-flex;align-items:center;gap:8px;background:#202020;border:1px solid #333;border-radius:999px;padding:7px 14px;color:#8d8d8d;font-size:13px}}
.badge .d{{width:8px;height:8px;border-radius:50%;background:#8d8d8d}}
h1{{margin-top:26px;font-size:76px;font-weight:600;letter-spacing:-2.6px;line-height:1.04;color:#fff}}
.sub{{margin-top:22px;font-size:19px;color:#8d8d8d;line-height:1.5}}
.ctas{{margin-top:30px;display:flex;gap:12px}}
.b1{{background:#5FCFCE;color:#001a1a;font-weight:500;font-size:15px;padding:13px 26px;border-radius:10px}}
.b2{{background:#202020;border:1px solid #3a3a3a;color:#fff;font-weight:500;font-size:15px;padding:13px 26px;border-radius:10px}}
</style></head><body>
{svg}
{COPY}</body></html>'''
open(OUT+'.html','w').write(html)
print('ok',MODE,OUT,len(dots),'dots')
