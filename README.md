# <img src="matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;matterbridge-switchbot-curtain

[Matterbridge](https://github.com/Luligu/matterbridge)でSwitchBot カーテンをBLE経由でMatterで接続できるようにするためのプラグインです。
SwitchBot カーテン3で動作確認することをしています。

## 初期設定

プラグインのConfigurationの `switchBotDeviceAddresses`
でデバイスのアドレスを追加し、Matterbridgeを再起動してください。

アドレスの例: `e5:8d:00:ff:00:ff`

アドレスが不明な場合はこのプラグインのinfoログでデバイスをスキップしたことが分かるので、アドレスをログから取り出してください。

ログの例: `Skipping SwitchBot device not in configured addresses: e5:8d:00:ff:00:ff`

もしくはSwitchBotアプリで対象デバイスのデバイス情報のBLE MACから取得することもできます。