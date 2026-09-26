(function(){
'use strict';
const HOME='/home/';
const UBUNTU='/Ubuntu/';
const DESKTOP='/Ubuntu/root/Desktop/';
const RECYCLE='/recycle-bin/';
const BG_DIR='/.config/background/';
const APP_DIR='/Ubuntu/mnt/data/';
const LANG_DIR='/assets/lang/';
const BOOT_COOKIE='xiaofang_booted';
const LANG_STORAGE='xiaofang_lang';
const PIN_STORAGE='xiaofang_pinned';
const bootScreen=document.getElementById('bootScreen');
const bootText=document.getElementById('bootText');
const bootSpinner=document.getElementById('bootSpinner');
const desktop=document.getElementById('desktop');
const windowsLayer=document.getElementById('windowsLayer');
const taskbarCenter=document.getElementById('taskbarCenter');
const startMenu=document.getElementById('startMenu');
const startBtn=document.getElementById('startBtn');
const powerEntry=document.getElementById('powerEntry');
const powerSubmenu=document.getElementById('powerSubmenu');
const desktopIcons=document.getElementById('desktopIcons');
const ctxMenu=document.getElementById('ctxMenu');
const dialogOverlay=document.getElementById('dialogOverlay');
const dialogTitle=document.getElementById('dialogTitle');
const dialogBody=document.getElementById('dialogBody');
const dialogFooter=document.getElementById('dialogFooter');
const toastEl=document.getElementById('toast');
const startPinnedSection=document.getElementById('startPinnedSection');
let windowZIndex=200;
const windows=new Map();
let nextWindowId=1;
const installedApps=[];
const appConfig={pc:{titleKey:'desktop.computer',icon:'pc',path:DESKTOP,root:UBUNTU},recycle:{titleKey:'desktop.recycle',icon:'recycle',path:RECYCLE,root:RECYCLE}};
let selectionMode=false;
const selectedPaths=new Set();
let dragState=null;
let suppressNextClick=false;
let LANG={};
let currentLang='zh-CN';
let pinnedApps=[];
try{pinnedApps=JSON.parse(localStorage.getItem(PIN_STORAGE)||'[]')||[];}catch(e){pinnedApps=[];}
function t(key,params){
let s=LANG[key]||key;
if(params){
Object.keys(params).forEach(function(k){
s=s.replace(new RegExp('\\{'+k+'\\}','g'),params[k]);
});
}
return s;
}
function detectDefaultLang(){
const nav=(navigator.language||'zh-CN').toLowerCase();
if(nav.indexOf('zh')===0)return 'zh-CN';
if(nav.indexOf('ja')===0)return 'ja-JP';
return 'en-US';
}
function loadLang(code){
return fetch(LANG_DIR+code+'.json?_t='+Date.now()).then(function(r){
if(!r.ok)throw new Error('lang not found');
return r.json();
}).then(function(data){
LANG=data;
currentLang=code;
document.documentElement.lang=code;
localStorage.setItem(LANG_STORAGE,code);
window.XiaofangI18N=LANG;
applyI18n();
}).catch(function(){
if(code!=='en-US')return loadLang('en-US');
});
}
function applyI18n(){
document.querySelectorAll('[data-i18n]').forEach(function(el){
const key=el.getAttribute('data-i18n');
el.textContent=t(key);
});
document.querySelectorAll('[data-i18n-title]').forEach(function(el){
const key=el.getAttribute('data-i18n-title');
el.setAttribute('title',t(key));
});
const titleEl=document.querySelector('title');
if(titleEl)titleEl.textContent=t('app.name');
}
function getCookie(name){
const match=document.cookie.match(new RegExp('(?:^|; )'+name.replace(/([.*+?^${}()|[\]\\])/g,'\\$1')+'=([^;]*)'));
return match?decodeURIComponent(match[1]):null;
}
function setCookie(name,value,days){
let expires='';
if(days){const d=new Date();d.setTime(d.getTime()+days*24*60*60*1000);expires='; expires='+d.toUTCString()}
document.cookie=name+'='+encodeURIComponent(value)+expires+'; path=/';
}
function deleteCookie(name){document.cookie=name+'=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'}
function toast(msg,dur){
toastEl.textContent=msg;
toastEl.classList.add('show');
clearTimeout(toastEl._t);
toastEl._t=setTimeout(function(){toastEl.classList.remove('show')},dur||2000);
}
function closeDialog(){dialogOverlay.classList.remove('open');dialogBody.innerHTML='';dialogFooter.innerHTML=''}
function showDialog(opts){
dialogTitle.textContent=opts.title||'';
dialogBody.innerHTML='';
if(opts.html){
dialogBody.innerHTML=opts.html;
}else{
if(opts.message){const p=document.createElement('p');p.textContent=opts.message;dialogBody.appendChild(p)}
if(opts.input!==undefined){
const inp=document.createElement('input');
inp.type='text';
inp.value=opts.input;
inp.id='dialogInput';
inp.setAttribute('autocomplete','off');
inp.setAttribute('autocorrect','off');
inp.setAttribute('autocapitalize','off');
inp.setAttribute('spellcheck','false');
inp.style.webkitUserSelect='text';
inp.style.userSelect='text';
dialogBody.appendChild(inp);
}
}
dialogFooter.innerHTML='';
(opts.buttons||[{text:t('btn.ok'),primary:true}]).forEach(function(b){
const btn=document.createElement('button');
btn.className='dialog-btn'+(b.primary?' primary':'')+(b.danger?' danger':'');
btn.textContent=b.text;
btn.addEventListener('click',function(){
const inp=document.getElementById('dialogInput');
if(b.onClick)b.onClick(inp?inp.value:null);else closeDialog();
});
dialogFooter.appendChild(btn);
});
dialogOverlay.classList.add('open');
const inp=document.getElementById('dialogInput');
if(inp){
setTimeout(function(){try{inp.focus();inp.select()}catch(e){}},80);
}
}
function api(action,data){
return fetch('/api.php?action='+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(function(r){return r.json()});
}
function loadWallpaper(){
const exts=['jpg','png','svg','xml','webp'];
let tried=0;
function tryNext(){
if(tried>=exts.length)return;
const url=BG_DIR+'wallpaper.'+exts[tried++];
const img=new Image();
img.onload=function(){desktop.style.backgroundImage="url('"+url+"')"};
img.onerror=tryNext;
img.src=url;
}
tryNext();
}
function runBootSequence(callback){
const booted=getCookie(BOOT_COOKIE);
if(booted==='restarted'){
bootSpinner.classList.add('show');
bootText.textContent=t('boot.restarting');
setTimeout(function(){
bootText.textContent=t('app.name');
bootSpinner.classList.remove('show');
setTimeout(function(){setCookie(BOOT_COOKIE,'yes',365);finishBoot(callback)},1200);
},1000);
}else{
bootText.textContent=t('app.name');
setTimeout(function(){setCookie(BOOT_COOKIE,'yes',365);finishBoot(callback)},2600);
}
}
function finishBoot(callback){
loadWallpaper();
bootScreen.classList.add('hide');
desktop.classList.add('show');
setTimeout(function(){bootScreen.style.display='none';if(callback)callback()},700);
}
function detectType(name,isDir){
if(isDir)return 'folder';
const ext=(name.split('.').pop()||'').toLowerCase();
if(ext==='xfapp')return 'xfapp';
if(['txt','md','log','ini','json','xml','html','htm','css','js','conf'].includes(ext))return 'txt';
if(ext==='jar')return 'jar';
if(ext==='java')return 'java';
if(['png','jpg','jpeg','gif','webp','bmp','svg'].includes(ext))return 'img';
if(['zip','rar','7z','tar','gz'].includes(ext))return 'zip';
if(ext==='apk')return 'apk';
if(['mp3','mp4','wav','avi','mkv','flac','ogg','webm'].includes(ext))return 'media';
return 'file';
}
function isTextFile(name){
const ext=(name.split('.').pop()||'').toLowerCase();
return ['txt','md','log','ini','json','xml','html','htm','css','js','conf','java'].includes(ext);
}
function isImageFile(name){
const ext=(name.split('.').pop()||'').toLowerCase();
return ['png','jpg','jpeg','gif','webp','bmp','svg'].includes(ext);
}
function isAudioFile(name){
const ext=(name.split('.').pop()||'').toLowerCase();
return ['mp3','wav','ogg','flac'].includes(ext);
}
function isVideoFile(name){
const ext=(name.split('.').pop()||'').toLowerCase();
return ['mp4','webm','mkv','avi'].includes(ext);
}
function readDir(path){
return new Promise(function(resolve,reject){
let rel=path.replace(/^\//,'');
if(rel.endsWith('/'))rel=rel.slice(0,-1);
fetch('/api.php?action=list&path='+encodeURIComponent(rel)+'&_t='+Date.now()).then(function(r){return r.json()}).then(function(d){
if(!d.ok){reject(new Error(d.error||'read fail'));return}
resolve(d.items.map(function(it){return {name:it.name,isDir:it.isDir}}));
}).catch(function(e){reject(e)});
});
}
function readBinary(path){
return new Promise(function(resolve,reject){
let rel=path.replace(/^\//,'');
const parts=rel.split('/').map(function(s){return encodeURIComponent(s)}).join('/');
fetch('/'+parts+'?_t='+Date.now()).then(function(r){
if(!r.ok){reject(new Error('HTTP '+r.status));return}
return r.arrayBuffer();
}).then(resolve).catch(reject);
});
}
function parseConf(text){
const result={author:'',id:'',version:'',introduce:''};
text.split(/\r?\n/).forEach(function(line){
const idx=line.indexOf(':');
if(idx>0){
const key=line.slice(0,idx).trim().toLowerCase();
const val=line.slice(idx+1).trim();
if(key in result)result[key]=val;
}
});
return result;
}
function scanApps(){
return readDir(APP_DIR).then(function(items){
const xfapps=items.filter(function(f){return !f.isDir&&f.name.toLowerCase().endsWith('.xfapp')});
const promises=xfapps.map(function(f){return loadApp(f.name)});
return Promise.all(promises).then(function(results){return results.filter(function(r){return r!==null})});
}).catch(function(err){console.warn('扫描失败',err);return []});
}
function loadApp(filename){
return readBinary(APP_DIR+filename).then(function(buf){return JSZip.loadAsync(buf)}).then(function(zip){
const confFile=zip.file('XiaofangOS.conf');
const iconFile=zip.file('icon.png');
const htmlFile=zip.file('webui/index.html');
if(!confFile||!htmlFile)return null;
return Promise.all([confFile.async('string'),iconFile?iconFile.async('base64'):Promise.resolve(null),htmlFile.async('string')]).then(function(results){
const conf=parseConf(results[0]);
if(!conf.id)return null;
const iconUrl=results[1]?'data:image/png;base64,'+results[1]:null;
return {file:filename,id:conf.id,name:conf.id,author:conf.author,version:conf.version,introduce:conf.introduce,icon:iconUrl,htmlContent:results[2]};
});
}).catch(function(err){console.warn('解析 '+filename+' 失败',err);return null});
}
function refreshApps(){
scanApps().then(function(apps){
installedApps.length=0;
apps.forEach(function(a){
const dup=installedApps.some(function(x){return x.id===a.id});
if(!dup)installedApps.push(a);
});
renderAppIcons();
renderStartPinned();
});
}
function isPointOverElement(x,y,el){
const r=el.getBoundingClientRect();
return x>=r.left && x<=r.right && y>=r.top && y<=r.bottom;
}
function attachDragHandlers(el,relPath,name,isDir,source,ctxOptions){
let longPressMenu=null;
let longPressSelect=null;
let dragging=false;
let startX=0,startY=0;
let movedEnough=false;
let startedOnEl=false;
function getPoint(e){
if(e.touches&&e.touches.length)return{x:e.touches[0].clientX,y:e.touches[0].clientY};
return{x:e.clientX,y:e.clientY};
}
function cleanupTimers(){
if(longPressMenu){clearTimeout(longPressMenu);longPressMenu=null}
if(longPressSelect){clearTimeout(longPressSelect);longPressSelect=null}
}
function endDrag(){
if(dragging){
dragging=false;
el.classList.remove('dragging');
clearDropHighlight();
dragState=null;
setTimeout(function(){suppressNextClick=false},50);
}
cleanupTimers();
}
function onStart(e){
if(selectionMode)return;
if(dragging)return;
const p=getPoint(e);
startX=p.x;startY=p.y;
movedEnough=false;
startedOnEl=true;
cleanupTimers();
longPressMenu=setTimeout(function(){
longPressMenu=null;
if(movedEnough||selectionMode)return;
suppressNextClick=true;
if(ctxOptions)ctxOptions(startX,startY);
},1000);
longPressSelect=setTimeout(function(){
longPressSelect=null;
if(movedEnough||selectionMode)return;
suppressNextClick=true;
dragging=false;
dragState=null;
el.classList.remove('dragging');
clearDropHighlight();
if(!selectionMode){
enterSelectionMode();
if(source==='home'){
toggleSelect(relPath,el);
}
}
},2000);
}
function onMove(e){
if(selectionMode)return;
if(!startedOnEl)return;
if(dragging&&!dragState)return;
const p=getPoint(e);
const dx=Math.abs(p.x-startX);
const dy=Math.abs(p.y-startY);
if(!dragging&&(dx>8||dy>8)){
if(!isPointOverElement(p.x,p.y,el)){
cleanupTimers();
startedOnEl=false;
setTimeout(function(){suppressNextClick=false},50);
return;
}
}
if(dx>8||dy>8){
movedEnough=true;
if(longPressMenu){clearTimeout(longPressMenu);longPressMenu=null}
if(longPressSelect){clearTimeout(longPressSelect);longPressSelect=null}
if(!dragging){
dragging=true;
suppressNextClick=true;
dragState={relPath:relPath,name:name,isDir:isDir,source:source};
el.classList.add('dragging');
if(navigator.vibrate)navigator.vibrate(20);
}
}
if(dragging){
if(e.cancelable)e.preventDefault();
highlightDropTarget(p.x,p.y);
}
}
function onEnd(e){
if(!startedOnEl){
cleanupTimers();
setTimeout(function(){suppressNextClick=false},50);
return;
}
if(!dragging){
cleanupTimers();
setTimeout(function(){suppressNextClick=false},50);
return;
}
const p=getPoint(e.changedTouches?e.changedTouches[0]:e);
const target=findDropTarget(p.x,p.y);
endDrag();
if(target)handleDrop(target);
}
el.addEventListener('mousedown',onStart);
el.addEventListener('touchstart',onStart,{passive:true});
document.addEventListener('mousemove',onMove);
document.addEventListener('touchmove',onMove,{passive:false});
document.addEventListener('mouseup',onEnd);
document.addEventListener('touchend',onEnd);
document.addEventListener('touchcancel',onEnd);
}
function highlightDropTarget(x,y){
clearDropHighlight();
const el=document.elementFromPoint(x,y);
if(!el)return;
const folder=el.closest('[data-drop-path]');
if(folder&&folder.getAttribute('data-drop-path'))folder.classList.add('drop-target');
const win=el.closest('.window');
if(win)win.classList.add('drag-hover');
}
function clearDropHighlight(){
document.querySelectorAll('.drop-target').forEach(function(el){el.classList.remove('drop-target')});
document.querySelectorAll('.drag-hover').forEach(function(el){el.classList.remove('drag-hover')});
}
function findDropTarget(x,y){
const el=document.elementFromPoint(x,y);
if(!el)return null;
const folder=el.closest('[data-drop-path]');
if(folder&&folder.getAttribute('data-drop-path')){
return {type:'folder',path:folder.getAttribute('data-drop-path'),el:folder};
}
const backBtn=el.closest('.back-btn');
if(backBtn&&!backBtn.disabled&&backBtn._parentPath){
return {type:'folder',path:backBtn._parentPath,el:backBtn};
}
const win=el.closest('.window');
if(win&&win._winPath){
return {type:'folder',path:win._winPath,el:win};
}
return null;
}
function handleDrop(target){
if(!dragState)return;
let dst=target.path;
if(dst===dragState.source)return;
const srcParent=dragState.relPath.replace(/\/[^\/]*$/,'');
if(dst===srcParent){toast(t('msg.same_dir'));return}
const srcs=[dragState.relPath];
toast(t('msg.moving'));
api('move',{srcs:srcs,dst:dst}).then(function(r){
if(r.ok&&r.results&&r.results[0]&&r.results[0].ok){
toast(t('msg.moved'));
renderDesktopIcons();
refreshWindows();
}else{
toast(t('msg.move_failed'));
}
});
}
function refreshWindows(){
windows.forEach(function(rec){
if(rec.win&&rec.config&&rec.config.title!=='应用'){
const contentEl=rec.el.querySelector('.window-content');
if(contentEl){
const scrollTop=contentEl.scrollTop;
const oldPath=rec.win.path;
contentEl.innerHTML='';
renderDir(contentEl,oldPath,rec.win);
setTimeout(function(){contentEl.scrollTop=scrollTop},0);
}
}
});
}
function renderAppIcons(){
installedApps.sort(function(a,b){return a.id.localeCompare(b.id)});
const old=desktopIcons.querySelectorAll('.icon[data-app-icon]');
old.forEach(function(el){el.remove()});
installedApps.forEach(function(app){
const icon=document.createElement('div');
icon.className='icon';
icon.setAttribute('data-app-icon','1');
icon.setAttribute('data-app-id',app.id);
const g=document.createElement('div');
g.className='icon-graphic';
if(app.icon){
const img=document.createElement('img');img.src=app.icon;g.appendChild(img);
}else{
g.innerHTML='<div style="width:40px;height:40px;background:linear-gradient(135deg,#6ab0e0,#2c6a9c);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:700">'+app.name.charAt(0).toUpperCase()+'</div>';
}
const label=document.createElement('div');
label.className='icon-label';label.textContent=app.name;
icon.appendChild(g);icon.appendChild(label);
let timer=null,lastTap=0;
function doOpen(){openAppWindow(app)}
icon.addEventListener('dblclick',function(e){e.preventDefault();if(timer){clearTimeout(timer);timer=null}if(suppressNextClick)return;doOpen()});
icon.addEventListener('click',function(e){
if(suppressNextClick)return;
if(timer){clearTimeout(timer);timer=null;return}
timer=setTimeout(function(){
if(suppressNextClick){timer=null;return}
doOpen();
timer=null;
},250);
});
icon.addEventListener('touchend',function(e){
if(suppressNextClick){e.preventDefault();return}
e.preventDefault();
const now=Date.now();
if(now-lastTap<300){if(timer){clearTimeout(timer);timer=null}doOpen();lastTap=0}
else{lastTap=now;timer=setTimeout(function(){if(suppressNextClick){timer=null;return}doOpen();timer=null},250)}
},{passive:false});
attachDragHandlers(icon,'',app.name,false,'app',function(x,y){
const isPinned=pinnedApps.indexOf(app.id)>=0;
const items=[
{text:t('ctx.open'),onClick:function(){openAppWindow(app)}},
{sep:true}
];
if(isPinned){
items.push({text:t('ctx.unpin_start')||'从开始菜单取消固定',onClick:function(){
pinnedApps=pinnedApps.filter(function(x){return x!==app.id});
localStorage.setItem(PIN_STORAGE,JSON.stringify(pinnedApps));
renderStartPinned();
toast(t('msg.unpinned')||'已取消固定');
}});
}else{
items.push({text:t('ctx.pin_start')||'固定到开始菜单',onClick:function(){
if(pinnedApps.indexOf(app.id)<0)pinnedApps.push(app.id);
localStorage.setItem(PIN_STORAGE,JSON.stringify(pinnedApps));
renderStartPinned();
toast(t('msg.pinned')||'已固定到开始菜单');
}});
}
items.push({text:t('ctx.uninstall'),danger:true,onClick:function(){confirmUninstallApp(app)}});
showContextMenu(x,y,items);
});
desktopIcons.appendChild(icon);
});
}
function renderStartPinned(){
if(!startPinnedSection)return;
startPinnedSection.innerHTML='';
if(!pinnedApps.length)return;
const sep=document.createElement('div');
sep.className='start-sep';
startPinnedSection.appendChild(sep);
const title=document.createElement('div');
title.className='start-section-title';
title.textContent=t('start.pinned')||'已固定';
startPinnedSection.appendChild(title);
pinnedApps.forEach(function(appId){
const app=installedApps.find(function(a){return a.id===appId});
if(!app)return;
const item=document.createElement('div');
item.className='start-item';
const iconWrap=document.createElement('div');
iconWrap.className='start-item-icon';
if(app.icon){
const img=document.createElement('img');
img.src=app.icon;
iconWrap.appendChild(img);
}else{
iconWrap.innerHTML='<div style="width:20px;height:20px;background:linear-gradient(135deg,#6ab0e0,#2c6a9c);border-radius:3px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700">'+app.name.charAt(0).toUpperCase()+'</div>';
}
const label=document.createElement('span');
label.textContent=app.name;
item.appendChild(iconWrap);
item.appendChild(label);
item.addEventListener('click',function(){
openAppWindow(app);
startMenu.classList.remove('open');
});
startPinnedSection.appendChild(item);
});
}
function confirmUninstallApp(app){
showDialog({title:t('dlg.uninstall_title'),message:t('msg.uninstall_app',{name:app.name}),buttons:[
{text:t('btn.cancel'),onClick:closeDialog},
{text:t('ctx.uninstall'),danger:true,onClick:function(){
closeDialog();
doUninstallApp(app);
}}
]});
}
function doUninstallApp(app){
api('delete',{target:'Ubuntu/mnt/data/'+app.file}).then(function(r){
if(r.ok){
toast(t('msg.uninstalled'));
closeWindowsByAppId(app.id);
pinnedApps=pinnedApps.filter(function(x){return x!==app.id});
localStorage.setItem(PIN_STORAGE,JSON.stringify(pinnedApps));
refreshApps();
}else{
toast(t('msg.failed'));
}
});
}
function closeWindowsByAppId(appId){
const toClose=[];
windows.forEach(function(rec,winId){
if(rec.config&&rec.config.id===appId){
toClose.push(winId);
}
});
toClose.forEach(function(winId){closeWindow(winId)});
}
function renderDesktopIcons(){
readDir(HOME).then(function(items){
items.sort(function(a,b){if(a.isDir!==b.isDir)return a.isDir?-1:1;return a.name.localeCompare(b.name)});
const existing={};
desktopIcons.querySelectorAll('.icon[data-from-home]').forEach(function(el){
const name=el.getAttribute('data-rel-path').replace(/^home\//,'');
existing[name]=el;
});
const keepNames=new Set();
items.forEach(function(f){
keepNames.add(f.name);
const relPath='home/'+f.name;
let icon=existing[f.name];
if(!icon){
icon=document.createElement('div');
icon.className='icon';
icon.setAttribute('data-from-home','1');
icon.setAttribute('data-rel-path',relPath);
const g=document.createElement('div');
g.className='icon-graphic';
if(f.isDir){
g.innerHTML='<div style="width:44px;height:34px;background:linear-gradient(180deg,#ffd980,#e0a83a);border-radius:4px;position:absolute;top:8px;left:2px"></div><div style="width:20px;height:8px;background:#ffd980;border-radius:4px 4px 0 0;position:absolute;top:3px;left:6px"></div>';
}else{
const type=detectType(f.name,false);
if(type==='xfapp'){
g.innerHTML='<div style="width:32px;height:40px;background:#e8d4f0;border:2px solid #8a5aa8;border-radius:3px 8px 3px 3px;position:absolute;top:4px;left:8px"></div><div style="position:absolute;top:14px;left:12px;font-size:16px;font-weight:900;color:#8a5aa8;font-family:Georgia">X</div>';
}else{
g.innerHTML='<div style="width:32px;height:40px;background:#f8fafd;border:2px solid #8aa2ba;border-radius:3px 8px 3px 3px;position:absolute;top:4px;left:8px"></div><div style="position:absolute;top:12px;left:13px;width:18px;height:2px;background:#a0b4c8;box-shadow:0 6px 0 #a0b4c8,0 12px 0 #a0b4c8"></div>';
}
}
const label=document.createElement('div');
label.className='icon-label';label.textContent=f.name;
icon.appendChild(g);icon.appendChild(label);
const checkbox=document.createElement('div');
checkbox.className='icon-checkbox';
checkbox.innerHTML='✓';
icon.appendChild(checkbox);
let timer=null,lastTap=0;
function doOpen(){
if(selectionMode){toggleSelect(relPath,icon);return}
if(f.isDir)openApp('pc',HOME+f.name+'/');
else openPreview(relPath,f.name,false);
}
icon.addEventListener('dblclick',function(e){e.preventDefault();if(timer){clearTimeout(timer);timer=null}if(suppressNextClick)return;doOpen()});
icon.addEventListener('click',function(e){
if(suppressNextClick)return;
if(selectionMode){toggleSelect(relPath,icon);return}
if(timer){clearTimeout(timer);timer=null;return}
timer=setTimeout(function(){if(suppressNextClick){timer=null;return}doOpen();timer=null},250);
});
icon.addEventListener('touchend',function(e){
if(suppressNextClick){e.preventDefault();return}
if(selectionMode){e.preventDefault();toggleSelect(relPath,icon);return}
e.preventDefault();
const now=Date.now();
if(now-lastTap<300){if(timer){clearTimeout(timer);timer=null}doOpen();lastTap=0}
else{lastTap=now;timer=setTimeout(function(){if(suppressNextClick){timer=null;return}doOpen();timer=null},250)}
},{passive:false});
if(f.isDir)icon.setAttribute('data-drop-path',relPath);
attachDragHandlers(icon,relPath,f.name,f.isDir,'home',function(x,y){
showItemContextMenu(x,y,relPath,f.name,f.isDir,false);
});
}
const checkbox=icon.querySelector('.icon-checkbox');
if(selectionMode){
checkbox.classList.add('show');
if(selectedPaths.has(relPath))icon.classList.add('selected');
else icon.classList.remove('selected');
}else{
checkbox.classList.remove('show');
icon.classList.remove('selected');
}
});
Object.keys(existing).forEach(function(name){
if(!keepNames.has(name)){
existing[name].remove();
}
});
items.forEach(function(f){
const relPath='home/'+f.name;
const el=desktopIcons.querySelector('.icon[data-rel-path="'+relPath.replace(/"/g,'\\"')+'"]');
if(el)desktopIcons.appendChild(el);
});
}).catch(function(err){console.warn('桌面读取失败',err)});
}
function toggleSelect(relPath,icon){
const checkbox=icon.querySelector('.icon-checkbox');
if(selectedPaths.has(relPath)){
selectedPaths.delete(relPath);
icon.classList.remove('selected');
}else{
selectedPaths.add(relPath);
icon.classList.add('selected');
}
updateSelectionUI();
}
function enterSelectionMode(){
selectionMode=true;
selectedPaths.clear();
document.querySelectorAll('.icon[data-from-home]').forEach(function(el){
const cb=el.querySelector('.icon-checkbox');
if(cb)cb.classList.add('show');
});
updateSelectionUI();
}
function exitSelectionMode(){
selectionMode=false;
selectedPaths.clear();
document.querySelectorAll('.icon[data-from-home]').forEach(function(el){
el.classList.remove('selected');
const cb=el.querySelector('.icon-checkbox');
if(cb)cb.classList.remove('show');
});
document.querySelectorAll('.sel-toolbar').forEach(function(el){el.remove()});
}
function updateSelectionUI(){
document.querySelectorAll('.sel-toolbar').forEach(function(el){el.remove()});
if(!selectionMode)return;
const bar=document.createElement('div');
bar.className='sel-toolbar';
const cnt=document.createElement('span');
cnt.className='sel-count';
cnt.textContent=t('sel.selected',{n:selectedPaths.size});
bar.appendChild(cnt);
const btnAll=document.createElement('button');
btnAll.textContent=t('sel.select_all');
btnAll.addEventListener('click',function(){
document.querySelectorAll('.icon[data-from-home]').forEach(function(el){
const rel=el.getAttribute('data-rel-path');
if(rel){
selectedPaths.add(rel);
el.classList.add('selected');
}
});
updateSelectionUI();
});
bar.appendChild(btnAll);
const btnCancel=document.createElement('button');
btnCancel.textContent=t('btn.cancel');
btnCancel.addEventListener('click',exitSelectionMode);
bar.appendChild(btnCancel);
const btnMove=document.createElement('button');
btnMove.textContent=t('sel.move');
btnMove.addEventListener('click',function(){
if(!selectedPaths.size)return;
pickFolder(t('dlg.pick_folder_title'),function(dst){
if(!dst)return;
const srcs=Array.from(selectedPaths);
toast(t('msg.moving'));
api('move',{srcs:srcs,dst:dst}).then(function(r){
if(r.ok){toast(t('msg.moved'));exitSelectionMode();renderDesktopIcons();refreshWindows()}
else{toast(t('msg.move_failed'))}
});
});
});
bar.appendChild(btnMove);
const btnDel=document.createElement('button');
btnDel.className='danger';
btnDel.textContent=t('sel.delete');
btnDel.addEventListener('click',function(){
if(!selectedPaths.size)return;
showDialog({title:t('dlg.batch_delete_title'),message:t('msg.batch_delete',{n:selectedPaths.size}),buttons:[
{text:t('btn.cancel'),onClick:closeDialog},
{text:t('ctx.delete'),danger:true,onClick:function(){
closeDialog();
const srcs=Array.from(selectedPaths);
let done=0;
srcs.forEach(function(s){
api('trash',{target:s}).then(function(){
done++;
if(done===srcs.length){
toast(t('msg.deleted_to_trash'));
exitSelectionMode();
renderDesktopIcons();
refreshWindows();
}
});
});
}}
]});
});
bar.appendChild(btnDel);
desktopIcons.insertBefore(bar,desktopIcons.firstChild);
}
function openPreview(relPath,name,isDir){
if(isDir){openApp('pc','/'+relPath+'/');return}
const winId='prev-'+nextWindowId++;
const winEl=document.createElement('div');
winEl.className='window';
const p=getCenterPosition(640);
winEl.style.left=p.left+'px';
winEl.style.top=p.top+'px';
winEl.style.width=Math.min(640,window.innerWidth-20)+'px';
winEl.style.height=Math.min(480,window.innerHeight-140)+'px';
winEl.style.zIndex=++windowZIndex;
const titleBar=document.createElement('div');
titleBar.className='window-titlebar';
const titleDiv=document.createElement('div');
titleDiv.className='window-title';
titleDiv.innerHTML='<span class="title-icon"></span><span>'+t('app.name')+' - '+name+'</span>';
const controls=document.createElement('div');
controls.className='window-controls';
const closeBtn=document.createElement('button');
closeBtn.className='window-control-btn close';
closeBtn.innerHTML='✕';
closeBtn.addEventListener('click',function(e){e.stopPropagation();closeWindow(winId)});
controls.appendChild(closeBtn);
titleBar.appendChild(titleDiv);titleBar.appendChild(controls);
const contentEl=document.createElement('div');
contentEl.className='window-content preview-content';
const fileUrl='/'+relPath.split('/').map(function(s){return encodeURIComponent(s)}).join('/');
if(isTextFile(name)){
contentEl.innerHTML='<div class="preview-text">'+t('preview.loading')+'</div>';
api('read',{path:relPath}).then(function(r){
const pre=contentEl.querySelector('.preview-text');
if(r.ok){pre.textContent=r.content||''}
else{pre.textContent=t('preview.failed')}
}).catch(function(){contentEl.innerHTML='<div class="preview-unknown">'+t('preview.failed')+'</div>'});
}else if(isImageFile(name)){
contentEl.innerHTML='<div class="preview-wrap"><img src="'+fileUrl+'" alt=""></div>';
}else if(isAudioFile(name)){
contentEl.innerHTML='<div class="preview-wrap"><audio controls autoplay src="'+fileUrl+'"></audio></div>';
}else if(isVideoFile(name)){
contentEl.innerHTML='<div class="preview-wrap"><video controls autoplay src="'+fileUrl+'"></video></div>';
}else{
contentEl.innerHTML='<div class="preview-unknown">'+t('preview.unknown')+'<div>'+name+'</div></div>';
}
const resizeHandle=document.createElement('div');
resizeHandle.className='window-resize';
winEl.appendChild(titleBar);winEl.appendChild(contentEl);winEl.appendChild(resizeHandle);
windowsLayer.appendChild(winEl);
makeDraggable(winEl,titleBar);
makeResizable(winEl,resizeHandle);
winEl.addEventListener('mousedown',function(){winEl.style.zIndex=++windowZIndex;focusWindow(winId)});
const taskbarBtn=document.createElement('button');
taskbarBtn.className='taskbar-btn active';
taskbarBtn.innerHTML='<span class="tb-icon"></span><span>'+name+'</span>';
taskbarBtn.addEventListener('click',function(){focusWindow(winId)});
taskbarCenter.appendChild(taskbarBtn);
windows.set(winId,{el:winEl,taskbarBtn:taskbarBtn,config:{title:name}});
focusWindow(winId);
}
function openAppWindow(app){
const winId='app-'+app.id+'-'+nextWindowId++;
const winEl=document.createElement('div');
winEl.className='window';
const p=getCenterPosition(720);
const winW=Math.min(720,window.innerWidth-20);
const winH=Math.min(520,window.innerHeight-140);
winEl.style.left=p.left+'px';
winEl.style.top=p.top+'px';
winEl.style.width=winW+'px';
winEl.style.height=winH+'px';
winEl.style.zIndex=++windowZIndex;
const titleBar=document.createElement('div');
titleBar.className='window-titlebar';
const titleDiv=document.createElement('div');
titleDiv.className='window-title';
if(app.icon){
titleDiv.innerHTML='<span class="title-icon"><img src="'+app.icon+'"></span><span>'+t('app.name')+' - '+app.name+'</span>';
}else{
titleDiv.innerHTML='<span class="title-icon"></span><span>'+t('app.name')+' - '+app.name+'</span>';
}
const controls=document.createElement('div');
controls.className='window-controls';
const closeBtn=document.createElement('button');
closeBtn.className='window-control-btn close';
closeBtn.innerHTML='✕';
closeBtn.addEventListener('click',function(e){e.stopPropagation();closeWindow(winId)});
controls.appendChild(closeBtn);
titleBar.appendChild(titleDiv);titleBar.appendChild(controls);
const contentEl=document.createElement('div');
contentEl.className='window-content app-content';
const iframe=document.createElement('iframe');
iframe.setAttribute('sandbox','allow-scripts allow-forms allow-modals allow-popups allow-same-origin');
iframe.srcdoc=app.htmlContent;
contentEl.appendChild(iframe);
const resizeHandle=document.createElement('div');
resizeHandle.className='window-resize';
winEl.appendChild(titleBar);winEl.appendChild(contentEl);winEl.appendChild(resizeHandle);
windowsLayer.appendChild(winEl);
makeDraggable(winEl,titleBar);
makeResizable(winEl,resizeHandle);
winEl.addEventListener('mousedown',function(){winEl.style.zIndex=++windowZIndex;focusWindow(winId)});
const taskbarBtn=document.createElement('button');
taskbarBtn.className='taskbar-btn active';
if(app.icon){
taskbarBtn.innerHTML='<span class="tb-icon"><img src="'+app.icon+'"></span><span>'+app.name+'</span>';
}else{
taskbarBtn.innerHTML='<span class="tb-icon"></span><span>'+app.name+'</span>';
}
taskbarBtn.addEventListener('click',function(){focusWindow(winId)});
taskbarCenter.appendChild(taskbarBtn);
windows.set(winId,{el:winEl,taskbarBtn:taskbarBtn,config:app});
focusWindow(winId);
}
function openTextEditor(relPath,fileName){
const winId='txt-'+nextWindowId++;
const winEl=document.createElement('div');
winEl.className='window';
const p=getCenterPosition(600);
const winW=Math.min(600,window.innerWidth-20);
const winH=Math.min(500,window.innerHeight-140);
winEl.style.left=p.left+'px';
winEl.style.top=p.top+'px';
winEl.style.width=winW+'px';
winEl.style.height=winH+'px';
winEl.style.zIndex=++windowZIndex;
const titleBar=document.createElement('div');
titleBar.className='window-titlebar';
const titleDiv=document.createElement('div');
titleDiv.className='window-title';
titleDiv.innerHTML='<span class="title-icon"></span><span>'+t('win.texteditor')+' - '+fileName+'</span>';
const controls=document.createElement('div');
controls.className='window-controls';
const closeBtn=document.createElement('button');
closeBtn.className='window-control-btn close';
closeBtn.innerHTML='✕';
closeBtn.addEventListener('click',function(e){e.stopPropagation();closeWindow(winId)});
controls.appendChild(closeBtn);
titleBar.appendChild(titleDiv);titleBar.appendChild(controls);
const contentEl=document.createElement('div');
contentEl.className='window-content app-content';
contentEl.style.padding='0';
contentEl.innerHTML='<div style="height:100%;display:flex;flex-direction:column;background:#f5f7fa"><div style="background:linear-gradient(180deg,#e6edf7,#d3deec);padding:10px 14px;display:flex;gap:8px;border-bottom:1px solid #b8c8da"><button id="txtBtnSave" style="padding:6px 14px;border-radius:6px;border:1px solid #3a8eef;background:#4a9eff;color:#fff;font-size:13px;cursor:pointer;font-family:inherit">'+t('btn.save')+'</button><button id="txtBtnClear" style="padding:6px 14px;border-radius:6px;border:1px solid #b8c8da;background:#f0f4fa;color:#1e2b3a;font-size:13px;cursor:pointer;font-family:inherit">'+t('btn.clear')+'</button><span id="txtStatus" style="margin-left:auto;font-size:12px;color:#5b6f82;align-self:center"></span></div><textarea id="txtEditor" style="flex:1;padding:16px;border:none;outline:none;resize:none;font-size:15px;line-height:1.6;background:#fff;color:#1e2b3a;font-family:Consolas,Monaco,monospace;-webkit-user-select:text;user-select:text"></textarea></div>';
const resizeHandle=document.createElement('div');
resizeHandle.className='window-resize';
winEl.appendChild(titleBar);winEl.appendChild(contentEl);winEl.appendChild(resizeHandle);
windowsLayer.appendChild(winEl);
makeDraggable(winEl,titleBar);
makeResizable(winEl,resizeHandle);
winEl.addEventListener('mousedown',function(){winEl.style.zIndex=++windowZIndex;focusWindow(winId)});
const taskbarBtn=document.createElement('button');
taskbarBtn.className='taskbar-btn active';
taskbarBtn.innerHTML='<span class="tb-icon"></span><span>'+fileName+'</span>';
taskbarBtn.addEventListener('click',function(){focusWindow(winId)});
taskbarCenter.appendChild(taskbarBtn);
windows.set(winId,{el:winEl,taskbarBtn:taskbarBtn,config:{title:fileName}});
focusWindow(winId);
const editor=contentEl.querySelector('#txtEditor');
const status=contentEl.querySelector('#txtStatus');
api('read',{path:relPath}).then(function(r){
if(r.ok){editor.value=r.content;status.textContent=t('editor.status.loaded')}
else{status.textContent=t('editor.status.read_failed')}
}).catch(function(){status.textContent=t('editor.status.read_failed')});
contentEl.querySelector('#txtBtnSave').addEventListener('click',function(){
api('write',{path:relPath,content:editor.value}).then(function(r){
if(r.ok){status.textContent=t('editor.status.saved',{time:new Date().toLocaleTimeString()});toast(t('msg.saved'))}
else{status.textContent=t('editor.status.save_failed');toast(t('msg.save_failed'))}
});
});
contentEl.querySelector('#txtBtnClear').addEventListener('click',function(){
editor.value='';status.textContent=t('editor.status.cleared');
});
}
function renderDir(contentEl,path,win){
contentEl.innerHTML='';
win.path=path;
win._winPath=path.replace(/^\//,'');
const bar=document.createElement('div');
bar.className='win-toolbar';
const backBtn=document.createElement('button');
backBtn.className='back-btn';backBtn.innerHTML='◀';
const pathDisplay=document.createElement('span');
pathDisplay.className='path-display';pathDisplay.textContent=path;
bar.appendChild(backBtn);bar.appendChild(pathDisplay);
contentEl.appendChild(bar);
if(path===RECYCLE){
const tb=document.createElement('div');
tb.className='recycle-toolbar';
const btn=document.createElement('button');
btn.textContent=t('msg.trash_clear');
btn.addEventListener('click',emptyTrash);
tb.appendChild(btn);
contentEl.appendChild(tb);
}
function canGoUp(){if(path===UBUNTU)return false;return true}
if(!canGoUp())backBtn.disabled=true;
let parentPath=null;
if(canGoUp()){
let p=path.replace(/\/$/,'');
const idx=p.lastIndexOf('/');
parentPath=idx<=0?'/':p.slice(0,idx+1);
if(parentPath.length<UBUNTU.length)parentPath=UBUNTU;
backBtn._parentPath=parentPath.replace(/^\//,'');
backBtn.setAttribute('data-drop-path',backBtn._parentPath);
}
backBtn.onclick=function(){
if(!canGoUp())return;
win.path=parentPath;
renderDir(contentEl,parentPath,win);
};
const list=document.createElement('div');
list.className='item-list';
const loading=document.createElement('div');
loading.className='empty-message';loading.textContent=t('msg.loading');
list.appendChild(loading);
contentEl.appendChild(list);
readDir(path).then(function(items){
if(path===DESKTOP){
readDir(HOME).then(function(homeItems){
homeItems.forEach(function(h){
let exists=items.some(function(i){return i.name===h.name});
if(!exists)items.push(h);
});
finishRender(items);
}).catch(function(){finishRender(items)});
}else{finishRender(items)}
function finishRender(items){
list.innerHTML='';
if(!items.length){
const em=document.createElement('div');
em.className='empty-message';em.textContent=t('msg.empty_folder');
list.appendChild(em);return;
}
items.sort(function(a,b){if(a.isDir!==b.isDir)return a.isDir?-1:1;return a.name.localeCompare(b.name)});
const baseRel=path.replace(/^\//,'');
items.forEach(function(f){
const type=detectType(f.name,f.isDir);
const item=document.createElement('div');
item.className='list-item';
const icon=document.createElement('div');
icon.className='item-icon ic-'+type;
if(type==='jar'){const s=document.createElement('div');s.className='steam';icon.appendChild(s)}
const info=document.createElement('div');
info.className='item-info';
const nm=document.createElement('div');
nm.className='item-name';nm.textContent=f.name;
const mt=document.createElement('div');
mt.className='item-meta';mt.textContent=f.isDir?t('prop.type_folder'):t('prop.type_file');
info.appendChild(nm);info.appendChild(mt);
item.appendChild(icon);item.appendChild(info);
const relPath=baseRel+'/'+f.name;
if(f.isDir)item.setAttribute('data-drop-path',relPath);
item.addEventListener('dblclick',function(e){
e.preventDefault();
if(f.isDir){
const newPath=(path.replace(/\/$/,''))+'/'+f.name+'/';
win.path=newPath;
renderDir(contentEl,newPath,win);
}else{
openPreview(relPath,f.name,false);
}
});
attachDragHandlers(item,relPath,f.name,f.isDir,path,function(x,y){
const inRecycle=path.indexOf('recycle-bin')>=0;
showItemContextMenu(x,y,relPath,f.name,f.isDir,inRecycle);
});
list.appendChild(item);
});
}
}).catch(function(err){
list.innerHTML='';
const em=document.createElement('div');
em.className='empty-message';em.innerHTML=t('msg.read_failed')+'<br><br>'+err.message;
list.appendChild(em);
});
}
function getCenterPosition(width){
const r=windowsLayer.getBoundingClientRect();
const w=Math.min(width,r.width-20);
const h=360;
let left=(r.width-w)/2+(Math.random()*40-20);
let top=(r.height-h)/2+(Math.random()*40-20);
left=Math.max(10,Math.min(left,r.width-w-10));
top=Math.max(10,Math.min(top,r.height-h-10));
return{left:left,top:top};
}
function makeDraggable(winEl,handleEl){
let sx=0,sy=0,sl=0,st=0,dragging=false;
function pos(e){
if(e.touches&&e.touches.length)return{x:e.touches[0].clientX,y:e.touches[0].clientY};
return{x:e.clientX,y:e.clientY};
}
function onStart(e){
if(e.target.closest('.window-control-btn'))return;
const p=pos(e);
dragging=true;sx=p.x;sy=p.y;
const r=winEl.getBoundingClientRect();
const lr=windowsLayer.getBoundingClientRect();
sl=r.left-lr.left;st=r.top-lr.top;
winEl.style.zIndex=++windowZIndex;
if(e.cancelable)e.preventDefault();
}
function onMove(e){
if(!dragging)return;
const p=pos(e);
let nl=sl+(p.x-sx);
let nt=st+(p.y-sy);
const lw=windowsLayer.clientWidth,lh=windowsLayer.clientHeight;
const ww=winEl.offsetWidth,wh=winEl.offsetHeight;
const mv=40;
nl=Math.max(-ww+mv,Math.min(nl,lw-mv));
nt=Math.max(0,Math.min(nt,lh-mv));
winEl.style.left=nl+'px';winEl.style.top=nt+'px';
if(e.cancelable)e.preventDefault();
}
function onEnd(){dragging=false}
handleEl.addEventListener('mousedown',onStart);
document.addEventListener('mousemove',onMove);
document.addEventListener('mouseup',onEnd);
handleEl.addEventListener('touchstart',onStart,{passive:false});
document.addEventListener('touchmove',onMove,{passive:false});
document.addEventListener('touchend',onEnd);
document.addEventListener('touchcancel',onEnd);
}
function makeResizable(winEl,handleEl){
let sx=0,sy=0,sw=0,sh=0,resizing=false;
function pos(e){
if(e.touches&&e.touches.length)return{x:e.touches[0].clientX,y:e.touches[0].clientY};
return{x:e.clientX,y:e.clientY};
}
function onStart(e){
const p=pos(e);
resizing=true;sx=p.x;sy=p.y;
sw=winEl.offsetWidth;sh=winEl.offsetHeight;
winEl.style.zIndex=++windowZIndex;
if(e.cancelable)e.preventDefault();
if(e.stopPropagation)e.stopPropagation();
}
function onMove(e){
if(!resizing)return;
const p=pos(e);
let nw=sw+(p.x-sx);
let nh=sh+(p.y-sy);
const lw=windowsLayer.clientWidth,lh=windowsLayer.clientHeight;
const r=winEl.getBoundingClientRect();
const lr=windowsLayer.getBoundingClientRect();
const maxW=lw-(r.left-lr.left)-4;
const maxH=lh-(r.top-lr.top)-4;
nw=Math.max(240,Math.min(nw,maxW));
nh=Math.max(160,Math.min(nh,maxH));
winEl.style.width=nw+'px';
winEl.style.height=nh+'px';
if(e.cancelable)e.preventDefault();
}
function onEnd(){resizing=false}
handleEl.addEventListener('mousedown',onStart);
document.addEventListener('mousemove',onMove);
document.addEventListener('mouseup',onEnd);
handleEl.addEventListener('touchstart',onStart,{passive:false});
document.addEventListener('touchmove',onMove,{passive:false});
document.addEventListener('touchend',onEnd);
document.addEventListener('touchcancel',onEnd);
}
function closeWindow(winId){
const rec=windows.get(winId);
if(!rec)return;
const el=rec.el,tb=rec.taskbarBtn;
el.classList.add('closing');
if(tb)tb.classList.remove('active');
el.addEventListener('transitionend',function(){if(el.parentNode)el.remove()},{once:true});
if(tb&&tb.parentNode)tb.remove();
windows.delete(winId);
}
function focusWindow(winId){
const rec=windows.get(winId);
if(!rec)return;
rec.el.style.zIndex=++windowZIndex;
windows.forEach(function(r,id){if(r.taskbarBtn)r.taskbarBtn.classList.toggle('active',id===winId)});
}
function openApp(appId,customPath){
const cfg=appConfig[appId];
if(!cfg)return;
const startPath=customPath||cfg.path;
const winId=appId+'-'+nextWindowId++;
const winEl=document.createElement('div');
winEl.className='window';
const p=getCenterPosition(480);
const winW=Math.min(480,window.innerWidth-20);
const winH=Math.min(420,window.innerHeight-140);
winEl.style.left=p.left+'px';winEl.style.top=p.top+'px';
winEl.style.width=winW+'px';
winEl.style.height=winH+'px';
winEl.style.zIndex=++windowZIndex;
const titleBar=document.createElement('div');
titleBar.className='window-titlebar';
const titleDiv=document.createElement('div');
titleDiv.className='window-title';
titleDiv.innerHTML='<span class="title-icon '+cfg.icon+'"></span><span>'+t('app.name')+' - '+t(cfg.titleKey)+'</span>';
const controls=document.createElement('div');
controls.className='window-controls';
const closeBtn=document.createElement('button');
closeBtn.className='window-control-btn close';
closeBtn.innerHTML='✕';
closeBtn.addEventListener('click',function(e){e.stopPropagation();closeWindow(winId)});
controls.appendChild(closeBtn);
titleBar.appendChild(titleDiv);titleBar.appendChild(controls);
const contentEl=document.createElement('div');
contentEl.className='window-content';
const resizeHandle=document.createElement('div');
resizeHandle.className='window-resize';
winEl.appendChild(titleBar);winEl.appendChild(contentEl);winEl.appendChild(resizeHandle);
windowsLayer.appendChild(winEl);
makeDraggable(winEl,titleBar);
makeResizable(winEl,resizeHandle);
winEl.addEventListener('mousedown',function(){winEl.style.zIndex=++windowZIndex;focusWindow(winId)});
const win={path:startPath,el:winEl,root:cfg.root};
renderDir(contentEl,startPath,win);
const taskbarBtn=document.createElement('button');
taskbarBtn.className='taskbar-btn active';
taskbarBtn.innerHTML='<span class="tb-icon '+cfg.icon+'"></span><span>'+t(cfg.titleKey)+'</span>';
taskbarBtn.addEventListener('click',function(){focusWindow(winId)});
taskbarCenter.appendChild(taskbarBtn);
windows.set(winId,{el:winEl,taskbarBtn:taskbarBtn,config:cfg,win:win});
focusWindow(winId);
}
function refreshRecycleIfOpen(){
windows.forEach(function(rec){
if(rec.config&&rec.config.titleKey==='desktop.recycle'&&rec.win){
const contentEl=rec.el.querySelector('.window-content');
if(contentEl){contentEl.innerHTML='';renderDir(contentEl,rec.win.path,rec.win)}
}
});
}
function bindIcon(iconEl,appId){
let timer=null,lastTap=0;
iconEl.addEventListener('dblclick',function(e){e.preventDefault();if(timer){clearTimeout(timer);timer=null}openApp(appId)});
iconEl.addEventListener('click',function(){
if(timer){clearTimeout(timer);timer=null;return}
timer=setTimeout(function(){openApp(appId);timer=null},250);
});
iconEl.addEventListener('touchend',function(e){
e.preventDefault();
const now=Date.now();
if(now-lastTap<300){if(timer){clearTimeout(timer);timer=null}openApp(appId);lastTap=0}
else{lastTap=now;timer=setTimeout(function(){openApp(appId);timer=null},250)}
},{passive:false});
}
bindIcon(document.getElementById('icon-pc'),'pc');
bindIcon(document.getElementById('icon-recycle'),'recycle');
startBtn.addEventListener('click',function(e){
e.stopPropagation();
startMenu.classList.toggle('open');
if(!startMenu.classList.contains('open')){
powerSubmenu.classList.remove('open');
powerEntry.classList.remove('open');
}
});
startMenu.querySelectorAll('.start-item[data-app]').forEach(function(item){
item.addEventListener('click',function(){
const appId=item.getAttribute('data-app');
if(appId==='terminal'){
if(window.XiaofangOpenTerminal)window.XiaofangOpenTerminal();
startMenu.classList.remove('open');
return;
}
openApp(appId);
startMenu.classList.remove('open');
});
});
powerEntry.addEventListener('click',function(e){
e.stopPropagation();
const willOpen=!powerSubmenu.classList.contains('open');
powerSubmenu.classList.toggle('open',willOpen);
powerEntry.classList.toggle('open',willOpen);
});
document.getElementById('menuRestart').addEventListener('click',function(){
deleteCookie(BOOT_COOKIE);setCookie(BOOT_COOKIE,'restarted',365);location.reload();
});
document.getElementById('menuShutdown').addEventListener('click',function(){
deleteCookie(BOOT_COOKIE);
document.body.innerHTML='<div class="shutdown-screen"><div class="shutdown-dots"><span></span><span></span><span></span><span></span><span></span></div><div class="shutdown-text">'+t('shutdown.doing')+'</div></div>';
setTimeout(function(){
document.body.innerHTML='<div class="shutdown-done">'+t('shutdown.done')+'</div>';
try{window.close()}catch(e){}
},2200);
});
document.addEventListener('click',function(e){
if(!startMenu.contains(e.target)&&e.target!==startBtn){
startMenu.classList.remove('open');
powerSubmenu.classList.remove('open');
powerEntry.classList.remove('open');
}
if(!ctxMenu.contains(e.target))ctxMenu.classList.remove('open');
if(selectionMode&&!e.target.closest('.icon')&&!e.target.closest('.sel-toolbar')&&!e.target.closest('.ctx-menu')){
exitSelectionMode();
}
});
function updateTime(){
const now=new Date();
document.getElementById('taskbarTime').textContent=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
}
updateTime();setInterval(updateTime,1000);
function showContextMenu(x,y,items){
ctxMenu.innerHTML='';
items.forEach(function(it){
if(it.sep){const s=document.createElement('div');s.className='ctx-sep';ctxMenu.appendChild(s);return}
const el=document.createElement('div');
el.className='ctx-item'+(it.danger?' danger':'');
el.textContent=it.text;
el.addEventListener('click',function(){ctxMenu.classList.remove('open');it.onClick()});
ctxMenu.appendChild(el);
});
const mx=Math.min(x,window.innerWidth-200);
const my=Math.min(y,window.innerHeight-items.length*40-20);
ctxMenu.style.left=mx+'px';ctxMenu.style.top=my+'px';
ctxMenu.classList.add('open');
}
function showItemContextMenu(x,y,relPath,name,isDir,inRecycle){
const items=[];
if(!inRecycle){
if(name.toLowerCase().endsWith('.xfapp')&&!isDir)items.push({text:t('ctx.install'),onClick:function(){installApp(name)}});
if(!isDir&&name.toLowerCase().endsWith('.txt'))items.push({text:t('ctx.open_with_editor'),onClick:function(){openTextEditor(relPath,name)}});
if(!isDir&&(isTextFile(name)||isImageFile(name)||isAudioFile(name)||isVideoFile(name)))items.push({text:t('ctx.preview'),onClick:function(){openPreview(relPath,name,false)}});
if(isDir)items.push({text:t('ctx.open'),onClick:function(){openApp('pc','/'+relPath+'/')}});
items.push({sep:true});
items.push({text:t('ctx.properties'),onClick:function(){showStat(relPath)}});
items.push({text:t('ctx.rename'),onClick:function(){renameItem(relPath,name)}});
items.push({text:t('ctx.move'),onClick:function(){pickFolder(t('dlg.pick_folder_title'),function(dst){
if(!dst)return;
api('move',{srcs:[relPath],dst:dst}).then(function(r){
if(r.ok){toast(t('msg.moved'));renderDesktopIcons();refreshWindows()}
else{toast(t('msg.move_failed'))}
});
})}});
items.push({text:t('ctx.copy_to'),onClick:function(){pickFolder(t('dlg.pick_folder_title'),function(dst){
if(!dst)return;
api('copy',{srcs:[relPath],dst:dst}).then(function(r){
if(r.ok){toast(t('msg.copied'));renderDesktopIcons();refreshWindows()}
else{toast(t('msg.copy_failed'))}
});
})}});
items.push({sep:true});
items.push({text:t('ctx.delete'),danger:true,onClick:function(){trashItem(relPath)}});
}else{
items.push({text:t('ctx.restore'),onClick:function(){restoreItem(relPath)}});
items.push({sep:true});
items.push({text:t('ctx.properties'),onClick:function(){showStat(relPath)}});
items.push({text:t('ctx.delete_forever'),danger:true,onClick:function(){deletePermanently(relPath,name)}});
}
showContextMenu(x,y,items);
}
function showStat(relPath){
fetch('/api.php?action=stat&path='+encodeURIComponent(relPath)+'&_t='+Date.now()).then(function(r){return r.json()}).then(function(d){
if(!d.ok){toast(t('msg.failed'));return}
let html='<div class="stat-panel">';
html+='<div class="stat-row"><div class="stat-label">'+t('prop.name')+'</div><div class="stat-value">'+escapeHtml(d.name)+'</div></div>';
html+='<div class="stat-row"><div class="stat-label">'+t('prop.path')+'</div><div class="stat-value">'+escapeHtml(d.path)+'</div></div>';
html+='<div class="stat-row"><div class="stat-label">'+t('prop.type')+'</div><div class="stat-value">'+escapeHtml(d.type)+'</div></div>';
html+='<div class="stat-row"><div class="stat-label">'+t('prop.size')+'</div><div class="stat-value">'+escapeHtml(d.sizeText)+'</div></div>';
html+='<div class="stat-row"><div class="stat-label">'+t('prop.mtime')+'</div><div class="stat-value">'+escapeHtml(d.mtimeText)+'</div></div>';
if(d.isDir)html+='<div class="stat-row"><div class="stat-label">'+t('prop.count')+'</div><div class="stat-value">'+d.count+'</div></div>';
html+='</div>';
showDialog({title:t('dlg.properties_title'),html:html,buttons:[{text:t('btn.ok'),primary:true,onClick:closeDialog}]});
}).catch(function(){toast(t('msg.failed'))});
}
function escapeHtml(s){
return String(s==null?'':s).replace(/[&<>"']/g,function(c){
return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
});
}
function pickFolder(title,callback){
const overlay=document.createElement('div');
overlay.className='picker-overlay open';
let curPath='home';
const picker=document.createElement('div');
picker.className='picker';
picker.innerHTML='<div class="picker-title">'+escapeHtml(title)+'</div><div class="picker-path" id="pickPath">/home</div><div class="picker-list" id="pickList"></div><div class="picker-footer"><button class="dialog-btn" id="pickCancel">'+t('btn.cancel')+'</button><button class="dialog-btn primary" id="pickOk">'+t('pick.choose')+'</button></div>';
overlay.appendChild(picker);
document.body.appendChild(overlay);
const pathEl=picker.querySelector('#pickPath');
const listEl=picker.querySelector('#pickList');
function load(){
pathEl.textContent='/'+curPath;
listEl.innerHTML='<div style="padding:20px;text-align:center;color:#888;font-size:13px">'+t('msg.loading')+'</div>';
readDir('/'+curPath).then(function(items){
listEl.innerHTML='';
const up=document.createElement('div');
up.className='picker-item';
up.innerHTML='<span style="font-size:18px">↩</span><span>'+t('pick.up')+'</span>';
up.addEventListener('click',function(){
if(curPath==='home')return;
const parts=curPath.split('/');
parts.pop();
curPath=parts.join('/')||'home';
load();
});
listEl.appendChild(up);
items.filter(function(f){return f.isDir}).forEach(function(f){
const it=document.createElement('div');
it.className='picker-item';
it.innerHTML='<div class="ic ic-folder"></div><span>'+escapeHtml(f.name)+'</span>';
it.addEventListener('click',function(){
curPath=curPath+'/'+f.name;
load();
});
listEl.appendChild(it);
});
if(!items.filter(function(f){return f.isDir}).length){
const em=document.createElement('div');
em.style.cssText='padding:16px;text-align:center;color:#999;font-size:12px';
em.textContent=t('pick.no_subfolder');
listEl.appendChild(em);
}
}).catch(function(){
listEl.innerHTML='<div style="padding:20px;text-align:center;color:#e16b6b;font-size:13px">'+t('pick.failed')+'</div>';
});
}
load();
picker.querySelector('#pickCancel').addEventListener('click',function(){
overlay.remove();
callback(null);
});
picker.querySelector('#pickOk').addEventListener('click',function(){
overlay.remove();
callback(curPath);
});
overlay.addEventListener('click',function(e){
if(e.target===overlay){
overlay.remove();
callback(null);
}
});
}
function installApp(filename){
api('install_check',{src:'home/'+filename}).then(function(r){
if(r.error){toast(t('msg.install_fail')+': '+r.error,3000);return}
if(r.decision==='fail'){
toast(t('msg.install_fail_newer',{old:r.oldVersion,new:r.newVersion}),3500);
return;
}
let msg='';
if(r.reason==='upgrade')msg=t('msg.install_overwrite',{old:r.oldVersion,new:r.newVersion})+'\n'+t('msg.install_after',{id:r.id});
else if(r.reason==='same_version')msg=t('msg.install_same',{v:r.newVersion})+'\n'+t('msg.install_after',{id:r.id});
else msg=t('msg.install_confirm',{name:filename})+'\n'+t('msg.install_after',{id:r.id});
showDialog({
title:t('dlg.install_title'),
message:msg,
buttons:[
{text:t('btn.cancel'),onClick:closeDialog},
{text:t('ctx.install'),primary:true,onClick:function(){closeDialog();doInstall(filename,r.id)}}
]
});
});
}
function doInstall(filename,targetId){
toast(t('msg.installing'),1500);
const xhr=new XMLHttpRequest();
const srcParts=('home/'+filename).split('/').map(function(s){return encodeURIComponent(s)}).join('/');
xhr.open('GET','/'+srcParts,true);
xhr.responseType='arraybuffer';
xhr.onload=function(){
if(xhr.status!==200){toast(t('msg.read_src_failed'));return}
const buf=xhr.response;
const xhr2=new XMLHttpRequest();
xhr2.open('POST','/api.php?action=install',true);
xhr2.setRequestHeader('X-Target-Path','Ubuntu/mnt/data/'+targetId+'.xfapp');
xhr2.onload=function(){
if(xhr2.status===200){toast(t('msg.install_ok',{name:targetId+'.xfapp'}));refreshApps();renderDesktopIcons()}
else{toast(t('msg.install_fail'))}
};
xhr2.send(buf);
};
xhr.send();
}
function trashItem(relPath){
api('trash',{target:relPath}).then(function(r){
if(r.ok){toast(t('msg.deleted_to_trash'));renderDesktopIcons();refreshRecycleIfOpen();refreshWindows()}
else{toast(t('msg.failed'))}
});
}
function renameItem(relPath,oldName){
showDialog({
title:t('dlg.rename_title'),
message:t('dlg.rename_msg',{name:oldName}),
input:oldName,
buttons:[
{text:t('btn.cancel'),onClick:closeDialog},
{text:t('btn.ok'),primary:true,onClick:function(newName){
closeDialog();
if(!newName||newName===oldName)return;
const parent=relPath.replace(/\/[^\/]*$/,'');
const to=parent+'/'+newName;
api('rename',{from:relPath,to:to}).then(function(r){
if(r.ok){toast(t('msg.renamed'));renderDesktopIcons();refreshRecycleIfOpen();refreshWindows()}
else{toast(t('msg.failed'))}
});
}}
]
});
}
function deletePermanently(relPath,name){
showDialog({
title:t('dlg.delete_title'),
message:t('msg.permanent_delete',{name:name}),
buttons:[
{text:t('btn.cancel'),onClick:closeDialog},
{text:t('ctx.delete'),danger:true,onClick:function(){
closeDialog();
api('delete',{target:relPath}).then(function(r){
if(r.ok){toast(t('msg.deleted'));renderDesktopIcons();refreshApps();refreshRecycleIfOpen();refreshWindows()}
else{toast(t('msg.failed'))}
});
}}
]
});
}
function restoreItem(relPath){
api('restore',{target:relPath}).then(function(r){
if(r.ok){toast(t('msg.restored'));renderDesktopIcons();refreshRecycleIfOpen();refreshWindows()}
else{toast(t('msg.failed'))}
});
}
function emptyTrash(){
showDialog({
title:t('dlg.empty_trash_title'),
message:t('msg.trash_emptying'),
buttons:[
{text:t('btn.cancel'),onClick:closeDialog},
{text:t('msg.trash_empty_btn'),danger:true,onClick:function(){
closeDialog();
api('empty_trash',{}).then(function(r){
if(r.ok){toast(t('msg.trash_empty'));refreshRecycleIfOpen()}
else{toast(t('msg.failed'))}
});
}}
]
});
}
function newFolder(){
showDialog({
title:t('dlg.new_folder_title'),
input:t('dlg.new_folder_title'),
buttons:[
{text:t('btn.cancel'),onClick:closeDialog},
{text:t('btn.create'),primary:true,onClick:function(name){
closeDialog();
if(!name)return;
api('mkdir',{path:'home/'+name}).then(function(r){
if(r.ok){toast(t('msg.created'));renderDesktopIcons()}
else{toast(t('msg.failed'))}
});
}}
]
});
}
function newTextFile(){
showDialog({
title:t('dlg.new_text_title'),
input:'新建文本.txt',
buttons:[
{text:t('btn.cancel'),onClick:closeDialog},
{text:t('btn.create'),primary:true,onClick:function(name){
closeDialog();
if(!name)return;
api('mkfile',{path:'home/'+name}).then(function(r){
if(r.ok){toast(t('msg.created'));renderDesktopIcons()}
else{toast(t('msg.failed'))}
});
}}
]
});
}
function showLanguageMenu(){
const langs=[
{code:'zh-CN',label:'简体中文'},
{code:'en-US',label:'English'},
{code:'ja-JP',label:'日本語'}
];
let html='<div class="lang-list">';
langs.forEach(function(l){
html+='<div class="lang-item'+(l.code===currentLang?' active':'')+'" data-code="'+l.code+'">'+l.label+'</div>';
});
html+='</div>';
showDialog({
title:t('dlg.language_title'),
html:html,
buttons:[{text:t('btn.cancel'),onClick:closeDialog}]
});
setTimeout(function(){
document.querySelectorAll('.lang-item').forEach(function(el){
el.addEventListener('click',function(){
const code=el.getAttribute('data-code');
closeDialog();
loadLang(code).then(function(){
renderDesktopIcons();
refreshApps();
refreshWindows();
renderStartPinned();
applyI18n();
});
});
});
},50);
}
desktop.addEventListener('contextmenu',function(e){
e.preventDefault();
if(e.target.closest('.window')||e.target.closest('.taskbar')||e.target.closest('.start-menu')||e.target.closest('.icon'))return;
showContextMenu(e.clientX,e.clientY,[
{text:t('ctx.refresh'),onClick:function(){renderDesktopIcons();refreshApps()}},
{sep:true},
{text:t('ctx.new_folder'),onClick:newFolder},
{text:t('ctx.new_text'),onClick:newTextFile},
{sep:true},
{text:t('ctx.scan_apps'),onClick:refreshApps},
{text:t('ctx.language'),onClick:showLanguageMenu}
]);
});
document.addEventListener('contextmenu',function(e){
if(!e.target.closest('.icon')&&!e.target.closest('.list-item')&&!e.target.closest('.desktop'))e.preventDefault();
});
window.XiaofangGetZIndex=function(){return ++windowZIndex};
window.XiaofangCloseWindow=closeWindow;
window.XiaofangMakeDraggable=makeDraggable;
window.XiaofangMakeResizable=makeResizable;
window.XiaofangFocusWindow=focusWindow;
window.XiaofangRegisterWindow=function(winId,winEl,config){
const taskbarBtn=document.createElement('button');
taskbarBtn.className='taskbar-btn active';
if(config.iconClass==='terminal'){
taskbarBtn.innerHTML='<span class="tb-icon terminal"></span><span>'+config.title+'</span>';
}else if(config.iconClass){
taskbarBtn.innerHTML='<span class="tb-icon '+config.iconClass+'"></span><span>'+config.title+'</span>';
}else{
taskbarBtn.innerHTML='<span class="tb-icon"></span><span>'+config.title+'</span>';
}
taskbarBtn.addEventListener('click',function(){focusWindow(winId)});
taskbarCenter.appendChild(taskbarBtn);
windows.set(winId,{el:winEl,taskbarBtn:taskbarBtn,config:config});
focusWindow(winId);
};
const savedLang=localStorage.getItem(LANG_STORAGE)||detectDefaultLang();
loadLang(savedLang).then(function(){
runBootSequence(function(){
renderDesktopIcons();
refreshApps();
renderStartPinned();
api('cleanup',{}).then(function(r){if(r.deleted>0)console.log(t('msg.cleanup_log',{n:r.deleted}))}).catch(function(){});
setInterval(renderDesktopIcons,8000);
setInterval(refreshApps,15000);
});
});
})();