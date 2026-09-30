# JXA によるブラウザー操作

この文書は、ブラウザー操作に JXA（`osascript -l JavaScript`）を使う設計と、ブラウザーごとの確認事項をまとめたものです。Chrome、Safari、Arc の実装はすべて JXA を使用し、AppleScript は使用しません。

## Chrome で JXA を採用した理由

同じ bundle ID（`com.google.Chrome`）を持つプロセスが複数あると、AppleScript の `tell application "Google Chrome"` は新しく起動したプロセスを選択することがあります。別ツールが起動した headless Chrome が後から選択されると、ユーザーが操作している Chrome に Apple Event が届きません。

JXA の `Application("Google Chrome")` は、複数プロセスがある場合に最も古く起動したプロセスを選択する挙動が経験的に観測されています。この挙動は公式 API ではなく、起動順に依存するヒューリスティックです。対象の Chrome より先に別プロセスが起動している場合は、そのプロセスが選択される可能性があります。

PID を指定して Apple Event の送信先を確実に固定する公式 API は、`NSAppleEventDescriptor descriptorWithProcessIdentifier:` や `SBApplication applicationWithProcessIdentifier:` などの Objective-C bridge を必要とします。このプロジェクトでは、JXA から Chrome の sdef を解決できなくなる制約があるため採用していません。

JXA には、次の実装上の利点もあります。

- タブ一覧や内容を JSON で受け渡せるため、区切り文字を本文から除外する必要がない。
- `String(w.id())` のように ID の型を明示できる。
- AppleScript の `tell` / `repeat` の入れ子が減り、処理の対応関係を追いやすい。
- JavaScript の `try` / `catch` でエラー処理を書ける。

## ブラウザーごとの ID と API

| 項目            | Chrome                                  | Safari                                | Arc                                     |
| --------------- | --------------------------------------- | ------------------------------------- | --------------------------------------- |
| Window ID       | 数値を文字列化                          | 数値を文字列化                        | UUID 文字列                             |
| Tab ID          | 数値を文字列化                          | 固有 ID はなく、タブの index を使用   | 主に UUID 文字列                        |
| 現在のタブ      | `activeTab()`                           | `currentTab()`                        | `activeTab` プロパティ                  |
| JavaScript 実行 | `app.execute(tab, { javascript: ... })` | `app.doJavaScript(code, { in: tab })` | `app.execute(tab, { javascript: ... })` |

Safari の `tabId` はタブの位置を表す値です。タブを閉じると後続タブの index が変わるため、取得済みの `TabRef` が別のタブを指す可能性があります。Safari の window には ID がありますが、tab には Chrome や Arc のような固有 ID がありません。このため、Safari では Chrome のような `tabs.byId(...)` による参照はできず、index で参照します。

Arc の window ID は UUID です。tab ID も多くは UUID ですが、短い英小文字の ID を持つタブもあります。どちらも `:` を含まないため、`ID:<windowId>:<tabId>` の形式で扱えます。

Arc は `app.windows()` や `w.tabs()` が返す要素参照と、`activeTab()` の呼び出しが返すタブを解決できず、-1700（型を変換できない）になります。このため window と tab は index か `byId` で参照し、active tab は `w.activeTab.id()` のようにプロパティとして参照します。active tab を直接操作する方法も環境によって失敗するため、先に front window と active tab の ID を解決し、ID 指定で操作します。

タブ一覧では、index で取得した tab ID から `byId` で tab を参照し直してから各プロパティを読みます。走査中にタブが閉じて index がずれても、別々のタブのプロパティが 1 件に混ざりません。

`make new tab` の戻り値から tab ID を取得できないため、新規タブの参照には active tab の ID を使います。Arc の `execute javascript` の戻り値は文字列としてラップまたはエスケープされる場合があるため、`"` で囲まれた値は `JSON.parse` で復元します。

## 実装方針

各ブラウザーの JXA は、window と tab を走査して `{ windowId, tabId, title, url }` の配列を作り、`JSON.stringify` で返します。TypeScript 側で `JSON.parse` して `Tab[]` に変換します。アプリケーション名は JSON 文字列リテラルとして JXA に埋め込み、入力値によるスクリプト構文の破壊を防ぎます。

Chrome では `app.windows.byId(Number(windowId))` と `win.tabs.byId(Number(tabId))` を使います。Safari では window ID を使って window を検索し、tab は 1-origin の index を 0-origin の配列位置に変換して参照します。Arc では window と tab の UUID を文字列のまま扱います。

Safari のページ内容は `app.doJavaScript(script, { in: tab })` で取得します。Safari の `make new tab` は新規タブを背面に作るため、Chrome と挙動を揃えるよう `currentTab` を新規タブに切り替えます。

JXA には AppleScript の `with timeout` に相当する構文がありません。通常の JXA 実行は `osascript.ts` の `execFile` timeout（既定 5 秒）とリトライで保護します。ページ内容取得は suspended tab で停止する可能性があるため、全ブラウザーで timeout を 3 秒、`maxRetries` を 0 とし、同じ Apple Event を再送しません。timeout になると `osascript` プロセスを終了し、呼び出し元へエラーを返します。

AppleScript の `with timeout` は Apple Event の応答待ちだけを制限しますが、`execFile` の timeout は `osascript` プロセス全体を制限します。この差により、スクリプトの起動やタブの走査も 3 秒の予算に含まれます。20 タブの実測では、`osascript` の起動が 40〜50ms、正常なタブの `execute javascript` が 124〜225ms でした。所要時間は DOM のサイズにほとんど依存せず、5MB の Gmail でも 216ms です。一方 suspended tab は 10 秒でも応答しません。正常応答とハングの二分が明確で中間の分布がないため、3 秒はどちらの側にも十分な余裕があります。timeout を延ばしても救えるタブはなく、ハング時の待ち時間が伸びるだけです。

JXA の実行エラーと JSON の解析エラーは TypeScript 側で処理します。ブラウザー固有の分岐が増える場合は、JXA 内の `try` / `catch` でブラウザー API のエラーを構造化して返す方法も検討できます。

## 除外ホストの判定

ページ内容の取得前に、各ブラウザーの `getTabInfo` でページの JavaScript を実行せずに対象タブの ID と URL を解決し、除外ホストであればその時点で拒否します。続く `getPageContent` には解決済みの ID を渡すため、途中で active tab が変わっても解決したタブを読みます。解決後に除外ホストへ遷移した場合に備え、取得後の URL でも再度判定します。

## 実ブラウザーでの確認状況

- Chrome: E2E で確認済み。
- Safari: ローカルページを開き、タブ一覧、`getTabInfo`、`getPageContent`、除外ホストの拒否、`openURL` 後の current tab を確認済み。
- Arc: ローカルページを開き、タブ一覧、`getTabInfo`、`getPageContent`、除外ホストの拒否、`openURL` 後の active tab を確認済み。確認した環境では、`execute` の戻り値はエスケープされていない HTML でした。

## テスト

E2E は Chrome のみを対象とします。Playwright の Chromium が必要なため、初回は `npx playwright install chromium` を実行します。テストは `playwright.chromium.executablePath()` で取得した bundled Chromium を専用の永続プロファイルで起動し、その `.app` の絶対パスを JXA の application name として渡します。通常の Google Chrome（`com.google.Chrome`）は起動したままで構いません。テスト用ブラウザーは別 bundle（`Google Chrome for Testing.app` / `com.google.chrome.for.testing`）です。

起動前にテスト用実行ファイルを `pgrep -x` で確認します。既に起動中ならテストは失敗しますが、プロセスを終了させません。起動後は専用 URL の一意な marker が Playwright の context と `getTabList` の両方から見えることを確認し、対象プロセスが不明な場合は操作を中止します。

専用プロファイルの [`Default/Preferences`](../tests/integration/chrome-profile/Default/Preferences) には、Apple Events からの JavaScript 実行を許可する `browser.allow_javascript_apple_events=true` が記録されています。通常実行、画面表示、デバッグ実行は次のコマンドで行います。

```bash
npm run test:e2e
npm run test:e2e -- --headed
npm run test:e2e -- --debug
```

ユニットテスト（`tests/chrome.test.ts`、`tests/safari-arc.test.ts`）は JXA の `Application` を vm 内のモックに差し替えてスクリプトの結果を検証します。実際の JXA やブラウザーは起動しないため、Safari と Arc は macOS 上の実ブラウザーで別途確認します。

## 設計上の参考情報

- 複数のアプリケーションプロセスを扱う JXA の挙動については、[deanishe.net の調査](https://www.deanishe.net/snippet/multiple-app-instances/)を参照してください。プロセス選択の公式仕様ではありません。
- AppleScript/JXA をホストされた CI runner で実行できない環境があるため、E2E は Apple Events を利用できる macOS 環境で実行します。
