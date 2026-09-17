// Application-owned copy only. Provider data, place names and IDs stay intact.
const entries = `
View switcher|視角切換
Open compact Radio controls|開啟精簡廣播控制
community mapped|社群標記
LIVE|即時
CCTV + Street View fallback|監視器與街景備援
NO PLACE LEFT BEHIND|探索世界每個角落
ACTIVE STYLE|目前樣式
NORMAL|一般
Normal|一般
Style|樣式
VISUAL PRESETS|視覺樣式
LOCATION|位置
MAP SOURCE|地圖來源
Map source|地圖來源
DISPLAY|顯示
DATA LAYERS|資料圖層
SCENES|場景
CONTEXT|情境資訊
CCTV|監視器
MOVEMENT|移動目標
Movement|移動目標
Cameras|攝影機
INFRASTRUCTURE|基礎設施
Infrastructure|基礎設施
EVENTS|事件
Events|事件
UTILITIES|工具
Utilities|工具
Satellites|人造衛星
Live Flights|即時航班
Military Flights|軍用航班
Live Vessels|即時船舶
Street Traffic|道路車流
Transit|公共運輸
Bike Share|共享單車
Mapped ALPR Cameras|已標記車牌辨識攝影機
Mapped Installations|已標記設施
Data Centers|資料中心
Submarine Cables|海底電纜
Dams|水壩
Space Missions (30d)|太空任務（30 天）
Earthquakes (24h)|地震（24 小時）
Active Fires|活躍火點
Directions|路線規劃
Radio|廣播
ON|開啟
OFF|關閉
LOADING|載入中
ENABLING|啟用中
DISABLING|停用中
DEGRADED|品質下降
STALE|資料過期
PARTIAL|部分資料
FALLBACK|備援來源
UNAVAILABLE|無法取得
KEY REQUIRED|需要金鑰
READY|就緒
Ready|就緒
never|尚未更新
just now|剛剛
NO DATA|沒有資料
PROVIDER SETTINGS|設定服務
Administrator password|管理密碼
Paste administrator password|貼上管理密碼
UNLOCK SETTINGS|解鎖設定
LOCK SETTINGS|鎖定設定
RELOAD PAGE|重新載入網頁
Enter the administrator password to edit this server’s API keys.|輸入管理密碼，即可編輯此伺服器的 API 金鑰。
Use the password generated on the hosting server. Closing this panel locks it again.|請使用部署主機產生的管理密碼；關閉面板後會再次鎖定。
Paste API keys below, then save. Server keys are stored on this server. Google Maps and Cesium ion keys run in the browser; restrict them at the provider.|在下方貼上 API 金鑰後儲存。服務端金鑰保存在此伺服器；Google Maps 與 Cesium ion 金鑰會在瀏覽器使用，請在供應商端限制用途。
Existing keys are never displayed. Leave a field blank to keep its saved value.|已儲存的金鑰不會顯示；欄位留空即可保留原值。
Enter the administrator password first.|請先輸入管理密碼。
Unlocking…|解鎖中…
Incorrect administrator password. Try again.|管理密碼不正確，請重新輸入。
Unlock settings with the administrator password.|請使用管理密碼解鎖設定。
Cannot reach the settings service. Check the deployment and try again.|無法連線到設定服務，請確認部署後重試。
Saved on the server. Reload the page to apply changes.|已儲存至伺服器。請重新載入網頁以套用變更。
Browser key editing is not enabled on this server. Run the hosted-settings setup command on the deployment host, restart its Node service, then reload this page.|此伺服器尚未啟用網頁金鑰編輯。請先在部署主機執行啟用指令，重新啟動 Node 服務後，再重新整理此頁。
From the repository folder: node source/scripts/enable-hosted-settings.mjs https://your-site.example/gods-eye/ . Use your own deployment URL. Static hosting cannot save server keys.|在儲存庫目錄執行：node source/scripts/enable-hosted-settings.mjs https://your-site.example/gods-eye/ ，請換成實際部署網址。純靜態網站無法儲存服務端金鑰。
This deployment does not provide browser-based key editing. Ask the site administrator to configure the environment variables below on the hosting server. This page cannot verify whether those keys are configured.|此部署未提供網頁金鑰編輯功能。請由網站管理者在主機設定下列環境變數；此頁無法確認金鑰是否已設定。
Server keys require a backend. Google Maps and Cesium ion keys are included at build time; rebuild and redeploy after changing them. To edit keys on your own computer, use the local deployment script.|服務端金鑰需要後端服務。Google Maps 與 Cesium ion 金鑰會在建置時加入，變更後請重新建置並部署。如需在自己的電腦編輯金鑰，請使用本機部署腳本。
POWER UP|設定服務
POWERED UP|服務已設定
GROUND STATION · PROVIDER SETTINGS|控制台 · 服務設定
Power up the globe|設定資料與語音服務
SAVE KEYS|儲存金鑰
SAVING…|儲存中…
BROWSER-SIDE|瀏覽器端
GET KEY ↗|取得金鑰 ↗
CONFIGURED|已設定
EXTERNAL|外部設定
Close key setup|關閉金鑰設定
ESC to close|按 ESC 關閉
ESC to dismiss|按 ESC 關閉
The photorealistic 3D planet + place search|擬真 3D 地球與地點搜尋
Voice control — talk to the planet|語音控制，以說話操作地球
Live ships, worldwide|全球即時船舶
Live active-fire detections|活躍火點偵測
Real live traffic (keyless runs a simulation)|即時車流速度（無金鑰時使用模擬）
Bing imagery map stacks + world terrain|Bing 影像圖層與全球地形
More flight-polling credits (anonymous works without)|提高航班查詢額度（匿名模式不需金鑰）
Higher space-missions request allowance|提高太空任務查詢額度
The Google Maps key buys the photorealistic planet — everything else stacks on top.|Google Maps 金鑰可啟用擬真 3D，其他服務可依需求加入。
The globe already flies keyless. Every key below switches on another real feed — paste one and it's saved into this app's local configuration, then the server restarts itself. Server-side keys stay on this machine; Google Maps and Cesium ion run in the browser and must be provider-restricted. Keys you configured elsewhere are shown but never touched.|不需金鑰即可瀏覽地球。下方金鑰可啟用更多服務；儲存到本機設定後，伺服器會自動重新啟動。服務端金鑰留在本機；Google Maps 與 Cesium ion 金鑰會在瀏覽器使用，請在供應商端限制用途。已由外部設定的金鑰僅顯示狀態，不會被修改。
MISSION CONTROL · FIRST LAUNCH|任務控制台 · 首次使用
Choose your first view|選擇起始畫面
It feels like a forbidden cockpit—then you realize the sources are public and the data is real.|用控制台探索地球，整合公開來源的真實資料。
LIVE CONTACTS|即時目標
Aircraft, vessels and nearby intelligence|航班、船舶與周邊資訊
SPACE MISSIONS|太空任務
Launches, spacecraft and orbital context|發射任務、太空載具與軌道資訊
ENVIRONMENTAL|環境事件
Live earthquakes and active fires, from USGS and NASA|來自 USGS 與 NASA 的地震和活躍火點
EXPLORE MANUALLY|手動探索
Begin with a clean globe|從簡潔的地球畫面開始
Don't show this again|不再顯示
Tip: the GEV MIC button in the dock lets you talk to the map.|提示：下方麥克風按鈕可啟用語音操作。
Initializing systems...|正在初始化系統…
Initializing photorealistic world...|正在載入地球…
Restoring shared view...|正在還原分享畫面…
LOADING LIVE DATA|正在載入即時資料
syncing road network|正在同步道路資料
loading frames|正在載入影像
Search any location...|搜尋地名或座標…
Search any location|搜尋地點
Search location by name or coordinates|依地名或座標搜尋
Globe actions|地球操作
Clear selected data layers|清除選取的資料圖層
Turn off all selected data layers|關閉所有已選取的資料圖層
Copy share link|複製分享連結
Tilt map to oblique view|切換為傾斜視角
Return map to straight-down view|切換為垂直俯視
Toggle straight-down and tilted map views|切換俯視與傾斜視角
Reset map to north up|將地圖轉回北方朝上
Reset map bearing to north|將地圖轉回北方朝上
Reset to full globe view|回到完整地球畫面
Resetting to full globe view|正在回到地球畫面
Reset camera and return to full globe view|重設鏡頭並回到完整地球畫面
Collapse panel|收合面板
Expand panel|展開面板
Navigation, voice, and visual preset controls|位置、語音與視覺樣式控制
Pin visual presets|固定視覺樣式面板
Keep visual presets open|保持視覺樣式面板開啟
Pin location tray|固定位置面板
Keep location tray open|保持位置面板開啟
AI AGENT|AI 助理
VOICE STANDBY|語音待命
Voice control — activate to toggle voice; hold Space to speak|切換語音控制；長按空白鍵說話
Show the globe without a visual filter.|顯示沒有濾鏡的地球。
Emulate a green phosphor CRT with scanlines and screen curvature.|模擬綠色 CRT 螢幕、掃描線與曲面效果。
Simulate night-vision goggles with green intensification and a tube vignette.|模擬綠色夜視效果與暗角。
Simulate FLIR-style thermal contrast. Turn up Ironbow for color.|模擬熱像對比，可調高 Ironbow 加入色彩。
Apply bright cel-shaded color and illustrated outlines.|套用明亮的動畫色彩與輪廓。
Apply high-contrast monochrome film-noir grading.|套用高對比黑白電影色調。
Add a cold, snowy whiteout treatment to the scene.|套用寒冷的雪景效果。
CRT|CRT 螢幕
NVG|夜視
FLIR|熱像
Anime|動畫
Noir|黑白
Snow|雪景
Bloom|光暈
Sharpen|銳化
PARAMETERS|參數
DETECT|目標標籤
Density|密度
Models|模型
Draw|繪圖
Area|區域
Line|線段
Pin|標記
Clear|清除
Layout|版面
Tactical|戰術
Minimal|精簡
Clean UI|簡潔畫面
EXIT CLEAN VIEW|離開簡潔畫面
Scope|範圍
Shape|形狀
Primary|主要
Allocation|分配
Elastic|彈性
Weighted|加權
Fade|淡出
Feather|柔邊
Green|綠色
Cyan|青色
Amber|琥珀色
Red|紅色
ADJUST|調整
ENABLE|啟用
START|開始
STOP|停止
RESET|重設
NEW|新增
DEL|刪除
IMPORT|匯入
EXPORT PRESETS|匯出預設
CAPTURE SHOT|擷取鏡位
UPDATE SHOT|更新鏡位
AVAILABLE MISSIONS|可用任務
SELECT A MISSION TO INSPECT|選擇任務以查看詳細資訊
LOADING 30-DAY MISSION INDEX|正在載入 30 天任務索引
RUN LOG|執行紀錄
SCENE SUMMARY|場景摘要
CURRENT|目前
CONTACT|目標
CONTACTS|目標清單
COCKPIT|駕駛艙
EXIT COCKPIT|離開駕駛艙
FIRST PERSON|第一人稱
Outside|外部視角
AIRCRAFT|航空器
ALTITUDE|高度
ALTITUDE · FT|高度 · 英尺
GROUND SPEED|地速
GROUND SPEED · KTS|地速 · 節
LIVE TRACK · COURSE ALIGNED|即時航跡 · 航向對齊
CONTACTS · 250 KM|周邊目標 · 250 公里
CONTACTS CONTEXT OFF|周邊目標資訊已關閉
CONTEXT ONLY|僅供參考
LOCAL|當地
NEWS|新聞
SKY|天空
LIVE SIGNALS|即時訊號
TEMP|溫度
WIND|風速
PRECIP|降水
RESOLVING REGION|正在解析地區
ACQUIRING REGIONAL NEWS|正在取得地區新聞
AVAILABLE INPUTS ONLY · NOT AN ALL-CLEAR|僅顯示可取得資料，不代表確認安全
SOURCE-BACKED EVENTS · NO SYNTHETIC NEWS|依來源顯示事件，不產生虛構新聞
OBSERVED / MAPPED PINGS|觀測或地圖標記
NEAREST OBSERVED / MAPPED|最近的觀測或地圖標記
SELECT CONTEXT|選擇情境資訊
SEARCH NEARBY SITES|搜尋附近設施
SELECT CONTACTS TO LOAD OBSERVED / MAPPED PROXIMITY|選擇目標以載入附近觀測與地圖標記
RADIO|廣播
RADIO READY|廣播就緒
Radio off|廣播已關閉
NO STATION SELECTED|尚未選擇電台
DRAG TO TUNE|拖曳以調頻
ALL · DRAG THE NEEDLE|全部 · 拖曳指針
SNAPS TO AVAILABLE STATIONS|自動對準可用電台
DIRECTORY BAND|電台列表
DIRECTORY: RADIO BROWSER|目錄：RADIO BROWSER
STATION SITE|電台網站
STATION TAG|電台標籤
PLAY|播放
VOLUME|音量
PREV|上一個
NEXT|下一個
AUTO HOP OFF|自動切台：關閉
Enable Radio, then choose a globe marker or use next.|啟用廣播後，選擇地球上的標記或切到下一台。
Audio connects directly to the broadcaster after you press play. Your IP is visible to that broadcaster.|按下播放後會直接連線至電台，電台可看到您的 IP 位址。
CCTV OFF|監視器已關閉
Enable CCTV to load camera intersections|啟用監視器以載入攝影機位置
Enable CCTV to start camera-linked intelligence summaries.|啟用監視器以查看攝影機相關資訊摘要。
NEAREST|最近
CALIBRATION|校正
RESET CAL|重設校正
SAVE CAL|儲存校正
COVERAGE OFF|涵蓋範圍：關閉
PROJECTION ON|影像投影：開啟
CYCLE OFF|輪播：關閉
FOCUS|聚焦
FROM|起點
TO|終點
ESTIMATED FLIGHT PLAN|估計飛行計畫
ROUTE DATA UNAVAILABLE|無法取得路線資料
Data attribution|資料來源與授權
Weather data by Open-Meteo.com|天氣資料：Open-Meteo.com
All|全部
Operator|營運單位
Proximity|鄰近範圍
Celestial|天體
UNKNOWN|未知
`;
export const ZH_TW = Object.freeze(
  Object.fromEntries(
    entries
      .trim()
      .split('\n')
      .map((line) => line.split('|')),
  ),
);
