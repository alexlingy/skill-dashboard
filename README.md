# Skill Dashboard

A Claude Code side panel for every skill you have installed: a lamp shows whether each skill was actually loaded, and a slide switch makes a skill load in every conversation.

一個 Claude Code 側邊面板，列出你安裝的所有 skill：前面的燈號告訴你這個 skill 有沒有真的被載入，後面的滑動開關讓它在每個對話都一定載入。

## 面板

```
▾ Skills
╭──────────────────────────────╮
│ 作用中                         │
│ ● Academic Humanizer 強制      │
│ ● Deep Research                │
╰──────────────────────────────╯
搜尋 skill…

▾ ★ 常用
  ● Academic Humanizer    [   ●]   ← 橘色軌道：開
  ○ Academic Paper        [●   ]   ← 灰色軌道：關
  ○ Paper Reviewer        [●   ]
▸ 我的 skills  6
▸ academic-research-skills  14
▸ mattpocock-skills  12 · 1 強制

Enable Remote Control for all sessions  [●   ]
```

- **燈號（左）**：亮橘＝本回合有載入；淡橘＝這次對話稍早載入過（規則還在對話裡）；空心 ○＝還沒載入。
- **滑動開關（右）**：開了之後，每個對話的第一則訊息，面板都會明確要求 Claude 回答前先載入這個 skill；對話中途打開，下一則就載入。直到燈號亮起，這個要求才會拿掉。載入之後規則會留在對話裡，相關的地方就套用。設定會記住。沒開的 skill，Claude 還是會照它自己的判斷載入，燈號會告訴你有沒有。
- **在 Claude Desktop 與手機上**：燈號是 🟠（這次對話已觸發）或 ⚪（沒觸發）；開關是 ✅（強制）或 ⬜（自動），直接點就切換。Remote Control 也一樣。
- **作用中**：列出開著或這次對話載入過的 skill。
- **★ 常用**：放在最上面。點 skill 名稱展開說明，可以加入或移出常用。預設是 Academic Humanizer 和 ARS 的四個 skill。
- **分組**：其他 skill 依 plugin 分組，可以收合；收合時顯示數量和開了幾個。
- **搜尋**：打字時所有分組一起篩選（手機 app 沒有輸入框，不顯示搜尋）。
- **Remote Control**：最底下的開關就是 `/config` 裡的「Enable Remote Control for all sessions」，改的是之後開的對話。
- 新裝或移除 skill 不用重新掃描：每次送出訊息、打開面板或展開分組時，面板會重新讀取。被移除但還在常用或開著的 skill 會顯示「已移除」。
- 配色只用 Claude 主題的顏色，跟著淺色、深色或自訂主題變化。開關的位置和燈號的形狀也不同，不靠顏色也看得出狀態。
- 點最上面的「▾ Skills」把整個面板收成一行摘要。

面板會出現在終端機與 Claude 桌面 app 的本機 Code 對話。雲端對話（網頁、手機 app 開的 Code 對話）和 VS Code 擴充套件目前不顯示 mod 面板，請用文字指令：

```
/skill-dashboard                       列出常用、開著或已載入的 skill
/skill-dashboard on humanizer          打開開關（任何 skill 名稱都可以）
/skill-dashboard off academic-research-skills:deep-research
/skill-dashboard add init              加入常用（內建的 skill 也可以）
/skill-dashboard remove init           移出常用
```

舊的簡稱 `humanizer`、`research`、`paper`、`reviewer`、`pipeline` 仍然可用。0.2 版存下來的開關設定會自動沿用。

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

## 開發

`claude plugin validate .`、`claude plugin test .`。測試在 terminal、desktop、mobile 三種介面跑同一組檢查。

## License

MIT
