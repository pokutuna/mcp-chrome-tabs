# JXA への全面移行ガイド

`src/browser/{chrome,safari,arc}.ts` を AppleScript から JXA (osascript -l JavaScript) に移行するための作業メモ。Chrome は `fix-multi-chrome-instance` ブランチで先行実施済み。Safari と Arc は未着手。

## なぜ JXA に移行するのか

### 直接の動機: Chrome の複数インスタンス問題

`tell application "Google Chrome"` は同一 bundle id (`com.google.Chrome`) のプロセスが複数あるとき **最新起動プロセス** を掴む。Playwright MCP のような別ツールが headless Chrome を後から起動すると、ユーザーの本来の Chrome ではなく headless 側に Apple Event が届いてしまう。

JXA の `Application("Google Chrome")` は逆に **最古起動プロセス** を掴むため、ユーザーの Chrome を先に起動しておけば確実に本物に届く (deanishe.net の経験的観測。Apple 公式ドキュメントには記載なし)。

PID 指定で特定のプロセスを狙う公式 API (`NSAppleEventDescriptor descriptorWithProcessIdentifier:` / `SBApplication applicationWithProcessIdentifier:`) は ObjC bridge が必要で、JXA からだと Chrome の sdef 解決に失敗するので採用していない。

### 二次的なメリット (Safari/Arc にも効く)

1. **JSON でデータをやり取りできる** — AppleScript はカスタムセパレータ文字列 (`<|SEP:xxx|>`) でフィールドを連結する必要があり、本文中にセパレータが現れた場合の分離が脆弱。JXA なら `JSON.stringify` / `JSON.parse` で安全に往復できる。
2. **値の型が明示的** — AppleScript の `id of aWindow` は number か string か曖昧 (Arc は UUID で string、Chrome は number)。JXA なら `String(w.id())` で確定できる。
3. **コード量が減る** — `repeat with ... in ...` / `tell ... end tell` のネストが消えて、見通しが良くなる。
4. **エラーハンドリングが try/catch で書ける** — AppleScript の `try ... on error` ブロックが消える。

## 既存の AppleScript 実装の差分ポイント (browser ごと)

| 項目 | Chrome (移行済) | Safari | Arc |
|---|---|---|---|
| Window ID | number | number | UUID (string) |
| Tab ID | number | **存在しない** (index で代用) | UUID (string) |
| 現在のタブ | `active tab of window` | `current tab of window` | `active tab of window` |
| JS 実行 | `execute javascript` | `do JavaScript` | `execute javascript` (戻り値が `"..."` でラップされ `\uXXXX` でエスケープされている可能性あり) |
| Allow JS from AppleEvents 設定 | View > Developer 必須 | Develop メニュー > Allow JavaScript from Apple Events | 同左 |

### Safari の固有問題

- **Tab に unique id が無い** ので `tabId = index` で代用している。タブを閉じると後続タブの index が変わって参照が壊れる (README にも明記)。JXA に移行しても解消しない既存問題。
- AppleScript の `tab N` (index 指定) は JXA だと `window.tabs[index - 1]` (0-origin) になる。

### Arc の固有問題

- `make new tab` の戻り値オブジェクトから `id` を取れない。AppleScript 版は `id of (active tab)` で代用している。JXA も同じ workaround が必要。
- `execute javascript` の戻り値が `"..."` でラップされているケースがあり、`JSON.parse` でデコードしている。JXA だと `app.execute(t, {javascript: "..."})` の戻り値が string として返るので、同じ後処理 (string が `"..."` で囲まれていたら JSON.parse) が必要かは要検証。

## Chrome JXA 化での具体的な書き換えパターン

### Before (AppleScript)

```typescript
const sep = separator();
const appleScript = `
  tell application "${applicationName}"
    set output to ""
    repeat with aWindow in (every window)
      set windowId to id of aWindow
      repeat with aTab in (every tab of aWindow)
        set tabId to id of aTab
        set tabTitle to title of aTab
        set tabURL to URL of aTab
        set output to output & windowId & "${sep}" & tabId & ...
      end repeat
    end repeat
    return output
  end tell
`;
const result = await executeAppleScript(appleScript);
const lines = result.trim().split("\n");
for (const line of lines) {
  const [wId, tId, title, url] = line.split(sep);
  // ...
}
```

### After (JXA)

```typescript
const script = `
  const app = Application(${jsonStringLiteral(applicationName)});
  const out = [];
  for (const w of app.windows()) {
    const windowId = String(w.id());
    for (const t of w.tabs()) {
      out.push({
        windowId,
        tabId: String(t.id()),
        title: t.title(),
        url: t.url(),
      });
    }
  }
  JSON.stringify(out);
`;
const result = await executeJXA(script);
const parsed = JSON.parse(result) as Tab[];
```

ポイント:
- セパレータは不要 (JSON.stringify で往復)
- `(every tab of aWindow)` → `w.tabs()` (関数呼び出し)
- `id of aWindow` → `w.id()` (関数呼び出し)
- 文字列リテラルは `jsonStringLiteral()` で JS 文字列リテラルに埋め込み (escape は JSON.stringify が担う)

### Tab ID 指定での参照

AppleScript:
```applescript
tell window id "${windowId}"
  tell tab id "${tabId}"
    ...
  end tell
end tell
```

JXA:
```javascript
const win = app.windows.byId(Number(windowId));
const tab = win.tabs.byId(Number(tabId));
```

Safari の場合は `byId` が使えないので `win.tabs[index - 1]` (index は 1-origin で渡されてくるので -1 する) になる見込み。

### `with timeout` の代替

AppleScript の `with timeout of N seconds ... end timeout` は JXA で表現できない。Chrome 版では諦めて、osascript の execFile timeout (`osascript.ts` の 5 秒) と `retry` wrapper でカバーしている。

```typescript
// osascript.ts
export async function executeJXA(script: string): Promise<string> {
  return retry(async () => {
    const { stdout, stderr } = await execFileAsync(
      "osascript",
      ["-l", "JavaScript", "-e", script],
      { timeout: 5 * 1000, maxBuffer: 10 * 1024 * 1024 }
    );
    if (stderr) console.error("JXA stderr:", stderr);
    return stdout.trim();
  });
}
```

suspended tab で `execute javascript` がハングするケースは、osascript プロセスごと SIGTERM されてリトライに任せる方針。

### エラーハンドリング

AppleScript の `try ... on error errMsg` は JXA の `try { ... } catch (e) { ... }` で書ける。Chrome 版では JXA 内 try は使わず、外側 (TypeScript) で `JSON.parse` の失敗を見て対応している。Safari/Arc のように分岐の多い処理 (active tab 取得など) は JXA 内 try/catch を使うほうが読みやすい場合がある。

## 移行作業のステップ案

1. **Safari**
   - `getSafariTabList` を JXA で書き直す (Tab に id がないので `tabId: String(index + 1)` を保持)
   - `getPageContent`: `app.windows.byId(...)` の Safari 版相当 (`app.windows.whose({id: ...})[0]` か `for` ループでマッチング) を確認
   - `openURL`: `app.Tab({url: ...})` で新規 tab を作って `front_window.tabs.push(newTab)`
   - `do JavaScript` は JXA だと `app.doJavaScript("...", {in: tab})` の形になる (Safari の sdef に準拠)

2. **Arc**
   - Chrome とほぼ同じ構造。`execute javascript` の戻り値ラップ問題は AppleScript 版と同じ後処理を保持
   - `make new tab` の id 取得不可問題は `app.windows[0].activeTab().id()` で代用

3. **executeAppleScript の削除可否**
   - 全 browser を JXA 化したら `executeAppleScript` / `escapeAppleScript` / `separator` は不要になる可能性がある。`osascript.ts` から削除して問題ないか確認

## テスト戦略

- e2e (Playwright) は Chrome のみ対象なので、Safari/Arc の JXA 化は **手動確認**しかない
- ローカルで以下を確認:
  1. `npm run dev` で MCP server 起動 → Claude Code 等から `list_tabs` / `read_tab_content` / `open_in_new_tab` を順に呼んで結果が AppleScript 版と一致するか
  2. 複数 window を開いて全 tab が列挙されるか
  3. JS が実行できるか (タブ内容が取れるか)
  4. 新規 tab を開いた直後にその tab の content が読めるか (TabRef がすぐ使えるか)

## 参考

- Chrome 移行のコミット: `c43be9d` (`fix-multi-chrome-instance` ブランチ)
- JXA で複数インスタンスのうち最古を掴む挙動: https://www.deanishe.net/snippet/multiple-app-instances/
- CI 上で AppleScript/JXA テストが動かなかった経緯: PR #131 のコメント

## このドキュメントを書いた時点の状態

- branch `fix-multi-chrome-instance`: Chrome 移行済み、main にマージ前 (PR 未作成)
- branch `ci-enable-e2e`: PR #131 として close 済み (hosted runner で AppleScript ベース e2e は動かないと結論)
- Safari/Arc の JXA 化は未着手
