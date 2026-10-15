# Skill Dashboard

A Claude Code side panel for five academic skills: see whether each one actually triggered, keep one switched on, or fire one for your next message without typing a slash command.

一個 Claude Code 側邊面板，管理五個學術 skill：看得到每個 skill 有沒有真的被觸發、可以用滑動開關讓它常駐，也可以按一下只套用到下一則訊息，不用再打 `/指令`。

| Skill | 來源 |
|---|---|
| Academic Humanizer | [alexlingy/academic-humanizer](https://github.com/alexlingy/academic-humanizer) |
| Deep Research / Academic Paper / Paper Reviewer / Academic Pipeline | [Imbad0202/academic-research-skills](https://github.com/Imbad0202/academic-research-skills) |

## 面板

```
▾ Skills  1 常駐 · ✓ 1

▸ Academic Humanizer  ✓          ⚡ [    ● ]   ← 橘底：常駐開
▸ Deep Research                  ⚡ [ ●    ]   ← 灰底：常駐關
▾ Academic Paper                 ⚡ [ ●    ]
    論文規劃、撰寫、修訂
    常駐：關 · ⚡ 下一則：未啟用
    本次對話尚未觸發
▸ Paper Reviewer                 ⚡ [ ●    ]
▸ Academic Pipeline              ⚡ [ ●    ]

本回合觸發：academic-humanizer
```

- **滑動開關（右側）**：橘底、圓點在右＝常駐開；灰底、圓點在左＝關。開啟後，只要請求落在該 skill 的範圍內，Claude 會先載入它再回答。設定會記住（存在這台機器上）。
- **⚡ 下一則**：只對你送出的下一則訊息強制使用該 skill，用完自動關閉；待命時亮橘色。
- **✓**：這個 skill 在本回合真的被載入了（打 `/指令`、Claude 自己呼叫、或按鈕觸發都算）。它顯示的是「有沒有被載入」，不是「每句話是否都套用了規則」。
- **收合**：點最上面的「▾ Skills」把整個面板收成一行摘要；點各 skill 名稱展開說明、觸發次數與安裝狀態。
- 配色用 Claude 主題的顏色，跟著淺色/深色主題變化。面板只在側邊，不會出現在對話輸入框附近。
- 面板關掉後，輸入 `/skill-dashboard` 重新打開；它也會用文字列出每個 skill 目前的狀態。
- 不想點按鈕，也可以直接打：`/skill-dashboard on humanizer`、`/skill-dashboard off humanizer`、`/skill-dashboard once reviewer`（可用 `humanizer`、`research`、`paper`、`reviewer`、`pipeline`）。

面板會出現在終端機與 Claude 桌面 app 的本機 Code 對話。雲端對話（網頁、手機 app 開的 Code 對話）目前不顯示 mod 面板，只能用上面的文字指令；VS Code 擴充套件也還不顯示。

## 安裝

在終端機的 Claude Code 輸入：

```
/plugin install skill-dashboard --marketplace alexlingy/skill-dashboard
```

出現 `Add marketplace?` 時按 `y`，再按 Enter 選 user scope。

或在 shell：

```
claude plugin install skill-dashboard --marketplace alexlingy/skill-dashboard
```

桌面 app：點輸入框旁的 **+** → **Plugins** → **Add marketplace**，填 `alexlingy/skill-dashboard`，再 **Add plugin**。

面板只顯示、控制 skill；skill 本身要另外安裝：

```
/plugin marketplace add Imbad0202/academic-research-skills
/plugin install academic-research-skills
```

Academic Humanizer 的安裝方式見它的 [README](https://github.com/alexlingy/academic-humanizer)。

## 開發

`claude plugin validate .`、`claude plugin test .`。測試在 terminal、desktop、mobile 三種介面跑同一組檢查。

## License

MIT
