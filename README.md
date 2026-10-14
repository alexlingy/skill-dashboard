# Skill Dashboard

A Claude Code side panel for five academic skills: see whether each one actually triggered, keep one switched on, or fire one for your next message without typing a slash command.

一個 Claude Code 側邊面板，管理五個學術 skill：看得到每個 skill 有沒有真的被觸發、可以用滑動開關讓它常駐，也可以按一下只套用到下一則訊息，不用再打 `/指令`。

| Skill | 來源 |
|---|---|
| Academic Humanizer | [alexlingy/academic-humanizer](https://github.com/alexlingy/academic-humanizer) |
| Deep Research / Academic Paper / Paper Reviewer / Academic Pipeline | [Imbad0202/academic-research-skills](https://github.com/Imbad0202/academic-research-skills) |

## 面板

```
Academic Humanizer
[━━● 常駐 ON]  [⚡ 下一則]
已觸發 2 次 · 最近：第 5 則訊息

Deep Research (未安裝)
[○━━ 常駐 OFF] [⚡ 下一則：待命]
本次對話尚未觸發
…
本回合觸發：academic-humanizer
```

- **常駐 ON/OFF**：開啟後，只要請求落在該 skill 的範圍內，Claude 會先載入它再回答。設定會記住（存在這台機器上）。
- **⚡ 下一則**：只對你送出的下一則訊息強制使用該 skill，用完自動關閉。
- **已觸發 / 本回合觸發**：skill 每次真的被載入（打 `/指令`、Claude 自己呼叫、或按鈕觸發）都會記錄。它顯示的是「有沒有被載入」，不是「每句話是否都套用了規則」。
- **(未安裝)**：這台機器的 Claude Code 沒有裝該 skill。
- 面板關掉後，輸入 `/skills` 重新打開。

面板會出現在 Claude 桌面 app、手機 app 與終端機。VS Code 擴充套件目前還不顯示 mod 面板，但在其他地方打開的常駐開關，在 VS Code 的對話裡一樣會生效。

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
