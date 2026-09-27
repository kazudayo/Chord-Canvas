# 改修レポート

既存のReact / TypeScriptアプリを拡張しました。既存のキー・和音生成、声部評価、推薦スコア、転回形、セクション、Undo / Redo、保存データ構造を利用しています。理論・Audio・MIDI・State・UIを分離し、バックエンドは追加していません。

## 音楽理論と接続

- 短調のv / VIIは`weak`、導音を含むV / V7は`strong`。強度を推薦スコアにも反映します。
- 借用和音に`sourceMode`、`borrowedDegree`、`possibleFunctions`、`contextualReasons`を保持。ivはPredominant、♭VI・♭VIIは文脈依存として表示します。
- 推薦理由は優先度順で最大3件。G7 → Cでは正格終止、B → Cの導音解決、F → Eの7th下行解決を優先します。専門用語に短い説明を添えます。
- 接続探索は`SectionConnectionContext`に両キーと両端の和音を明示。最初の接続には両キーでの評価を使い、以降は到着キーで評価します。
- 挿入コードに到着キーの`analysisKey`と両キーの`interpretations`を保存。AmならC MajorのviとG Majorのiiが挿入・転回形変更・保存・移調後も保持されます。次の推薦・詳細・終止表示は分析キーを参照します。
- キーの選択変更は従来どおり音高を保ち、セクション全体を新キーで再分析します。音高を変える操作は「曲全体を移調」です。

## ピアノ音源

`PianoSampler`がAudioBufferを再生します。Oscillatorは使用しません。Salamander Grand PianoのC2〜C7を短3度刻みで21個（約1.3 MB）同梱しました。最寄りサンプルからplaybackRateで音高を調整し、Attack、Decay、Release、Velocityゲインを適用します。録音はAlexander Holm氏、CC BY 3.0。出典は音源フォルダのATTRIBUTION.mdと設定画面に記載しています。

初回再生時に並列取得・デコードし、以降はキャッシュ。同音の再打鍵は独立したVoiceとして扱い、離鍵で短い減衰を付けます。読み込み失敗は通知し、再試行できます。

## 再生・Web MIDI・書き出し

共通の`createPlaybackEvents()`が音高、拍位置、長さ、Velocityを生成します。転回形を保ったコード音と1オクターブ下のベース、前コードからのオクターブ移動を抑える配置を使います。BlockとArpeggioもここで決定します。

`AudioEngine`は`NoteOutput`へ時刻付きNote On/Offを渡します。ピアノと外部MIDIで同じスケジューラーを使用し、試聴・通常再生・プリセット試聴も共有します。Pause/Resume、Stop、Loop、バックグラウンド復帰時の過去イベント抑止を維持しています。

Web MIDIは明示的な「MIDIを使用」操作でのみ権限を要求します。出力一覧、更新、チャンネル1〜16、Velocity、C4のTest Note、Panicを提供します。切断時は停止して内蔵ピアノへ戻ります。Stop、出力・チャンネル変更、ページ終了でキュー取消、送信済みノートのNote Off、CC64 / CC123 / CC120を送信します。音量はCC7、VelocityはNoteEventの値です。

音源選択・Output ID・チャンネル・Velocityは独立したlocalStorageキーへ保存し、旧曲データとの互換性を維持。次回起動時はMIDIアクセスを有効にするまで内蔵ピアノを使用します。

MIDI書き出しは同じイベントからSMF Format 0を生成します。480 PPQ、アプリのBPM、4/4、UTF-8セクションマーカー、Note On / Note Offを含み、同時刻のNote Offを次のNote Onより前へ並べます。現在セクションと曲全体を選べます。ループは1周分のみです。

## プリセット

Degreeベースで保存し、現在の主音へ変換。長調・短調で表示を切り替えます。適用後は通常のChordEntryになり、編集・転回形・推薦・Undo / Redoを利用できます。

| 名前                        | Degree                                      |
| --------------------------- | ------------------------------------------- |
| 王道ポップ / ポップパンク   | I V vi IV                                   |
| カノン                      | I V vi iii IV I IV V                        |
| 50s / ドゥーワップ          | I vi IV V                                   |
| ターンアラウンド            | I vi ii V                                   |
| ii-V-I                      | ii V I                                      |
| 王道進行                    | IV V iii vi                                 |
| 小室進行                    | vi IV V I                                   |
| 丸サ / Just the Two of Us系 | IVmaj7 III7 vi7 I7                          |
| 12小節ブルース              | I7 IV7 I7 I7 / IV7 IV7 I7 I7 / V7 IV7 I7 V7 |
| マイナー・ポップ            | i VI III VII                                |
| マイナー終止                | i iv V i                                    |
| アンダルシア                | i VII VI V                                  |

## 主な変更ファイル

既存ファイルを改修：

- `src/music/types.ts`、`chords.ts`、`recommendation.ts`、`modulation.ts`：強度、借用、接続キー、説明。
- `src/audio/engine.ts`：共通NoteOutputスケジューラーへ変更。
- `src/state/workspace.ts`：旧データ補完、追加元、接続キーを含むDegree書き出し。
- `src/components/ChordDetail.tsx`、`Connections.tsx`：機能・両キー表示。
- `src/App.tsx`、`styles.css`：タブ、音源設定、MIDI書き出し、レスポンシブ統合。
- `src/audio/engine.test.ts`：OscillatorモックからNoteOutputモックへ置換。既存4シナリオと検証内容は維持。
- `package.json`、`package-lock.json`：テスト環境と整形ツールを更新。
- `README.md`：操作・運用説明を更新。

追加ファイル：

- `src/music/functions.ts`、`reasons.ts`、`presets.ts`、`enhancements.test.ts`
- `src/audio/events.ts`、`output.ts`、`PianoSampler.ts`、`sampleLoader.ts`、`safety.test.ts`
- `src/midi/devices.ts`、`MidiOutput.ts`、`export.ts`、`midi.test.ts`
- `src/state/sound.ts`
- `src/components/Presets.tsx`、`SoundSettings.tsx`
- `public/assets/audio/piano/*.mp3`（21個）、`ATTRIBUTION.md`
- `IMPLEMENTATION.md`（本書）

## 検証結果

- 改修前46テストを維持。追加40テストと合わせて**6ファイル・86テスト成功**。
- `npm run build`：TypeScript型検査・本番ビルド成功。
- 音楽理論：短調の強弱、借用、二重キー解釈、移調、説明の順位、各プリセットの変換を検証。
- MIDI：ヘッダー、トラック、テンポ、拍子、Note On/Off、480 PPQ、転回形、ベース、Arpeggio、セクションマーカーを独立パーサーで検証。
- 模擬MIDIポートでチャンネル16、Panic、CC7、切断、明示的権限取得、権限拒否・非対応を検証。
- 音源読み込み中の停止、出力切替、21サンプルのキャッシュ、Pitch Shift、Velocity、同音再打鍵、Release、再試行を検証。
- ブラウザ：1440 / 820 / 390 / 320 pxで画面確認。音源設定、試聴・再生、プリセット追加・置換、Undo、MIDI保存操作、設定復元、C→Gの転調・接続適用後の分析キーを確認。確認時のコンソールに警告・エラーなし。
- UI検証で追加したコード・セクションはUndoで戻し、サンプル曲4コードの状態を維持。

## 既知の制限・未検証

- 外部MIDI機器／DAWとの実機接続・受信音は未検証。模擬ポートの送信内容と停止処理を検証済みです。OS側の仮想ポートやDAW受信設定は利用者が行ってください。
- Web MIDIはブラウザ対応・許可・セキュアコンテキスト（HTTPS / localhost）に依存します。非対応でも内蔵音源とMIDI保存は利用できます。
- OS強制終了・機器の物理切断時はNote Offの到達を保証できません。必要な場合は受信側でもPanicしてください。バックグラウンド制限による音切れを完全には防げません。
- ピアノは単一VelocityレイヤーのMP3サンプルです。Velocityは音量で表現し、ダンパー共鳴・ペダル・録音音色の多層切替は未実装。
- 音楽的機能と雰囲気は作曲支援上の近似。声部連結は閉じた配置のオクターブ選択で、完全な四声体ソルバーではありません。
- MIDIは4/4固定、単一トラック・単一チャンネルです。マーカーの日本語表示はDAWによって異なります。音量ミキサーや音源パッチは書き出しません。
- 保存はブラウザ内のみ。クラウド同期、MIDI読み込み、WAV/MP3書き出し、VST/AU直接ロードは実装範囲外です。
