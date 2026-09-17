# God’s Eye View — macOS 一鍵部署

以 [bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view) 為基礎，以獨立介面翻譯模組擴充上游程式，加入 macOS 一鍵部署、啟動、停止與移除腳本，以及繁體中文分析與操作文件。

## 快速開始

```bash
git clone https://github.com/PeterHung/gods-eye-view.git
cd gods-eye-view
./01-一鍵部署.command
```

也可以在 Finder 雙擊 `01-一鍵部署.command`。需要 macOS、Python 3 與網路；本次在 Apple Silicon macOS 驗證，另提供 Intel macOS 的 Node.js 安裝路徑。

部署會下載並驗證專案專用 Node.js 24.21.0、依鎖定檔安裝套件、驗證建置、啟動服務並開啟 [本機網頁](http://127.0.0.1:4173)。不更換系統 Node.js。下載 ZIP 若未保留執行權限，可先在終端機執行 `chmod +x ./*.command`。

| 腳本 | 用途 |
|---|---|
| `01-一鍵部署.command` | 安裝、建置、啟動、開啟網頁 |
| `02-啟動.command` | 啟動已部署服務並開啟網頁 |
| `03-停止.command` | 停止本專案服務 |
| `04-移除安裝.command` | 停止並移除專用執行環境、依賴、建置和日誌；保留原始碼與 API 設定 |
| `05-查看狀態.command` | 顯示安裝與服務健康狀態 |

終端機自動化可使用 `python3 scripts/manage.py start --no-open`；其他動作為 `deploy`、`stop`、`uninstall`、`status`。

## 網頁功能與部署範圍

本機網頁上方工具列的地球圖示右側提供「繁體中文／English」切換，主要面板、圖層狀態、導覽及金鑰設定會即時切換並記住選擇。首次使用依瀏覽器語言決定預設值；地名、航班代碼、HUD 遙測及來源資料保留原文。

本機網頁可操作地球、圖層與 Provider Settings。已實測基本影像、重設地球、USGS 地震圖層及 API 金鑰設定面板；未驗證需金鑰的語音、船舶或擬真 3D。

服務只監聽 `127.0.0.1:4173`。啟動使用上游 Vite 本機模式，以保留網頁金鑰編輯功能；這不是公網部署。關閉終端機不會停止服務，登出或重開機後需再次啟動。搬動資料夾前請先停止服務。

## 文件

- [操作說明](操作說明.md)
- [影片與技術分析](analysis/分析報告.md)
- [部署驗證摘要](evidence/驗證摘要.md)
- [上游功能與資料來源](source/README.md)

## 來源與授權

`source/` 是上游 commit `0d41b6be5490db1f10a171f238be75db4d4ec3b4` 的原始碼快照，再加入繁體中文／英文介面切換。本儲存庫以新提交匯入快照，沒有包含上游完整 Git 歷史。新增的管理腳本同樣以 MIT 授權提供。

原始碼與第三方資料／模型授權不同；請保留 [LICENSE](LICENSE)、[資料來源說明](source/DATA_SOURCES.md) 與模型來源資訊。第三方資料不因上傳此儲存庫而改採 MIT，部分附帶素材有非商用限制。

API 金鑰、專用 Node.js、node_modules、建置產物與原始執行日誌均不納入版本控制。
