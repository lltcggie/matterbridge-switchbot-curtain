# <img src="matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;matterbridge-switchbot-curtain

[Matterbridge](https://github.com/Luligu/matterbridge)でSwitchBot カーテンをBLE経由でMatterで接続できるようにするためのプラグインです。
SwitchBot カーテン3で動作確認することをしています。

## 初期設定

以下のライブラリのインストールが必要です。

```
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
```

その後プラグインをインストールし、プラグインのConfigurationの `switchBotDeviceAddresses`
でデバイスのアドレスを追加し、Matterbridgeを再起動してください。

アドレスの例: `e5:8d:00:ff:00:ff`

アドレスが不明な場合はこのプラグインのinfoログでデバイスをスキップしたことが分かるので、アドレスをログから取り出してください。

ログの例: `Skipping SwitchBot device not in configured addresses: e5:8d:00:ff:00:ff`

もしくはSwitchBotアプリで対象デバイスのデバイス情報のBLE MACから取得することもできます。

## 注意点

プロセスをrootで動かさない場合は以下のコマンドで `node` にケーパビリティの付与が必要です。

```
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
```

systemdでroot以外のユーザーを使用して動かす場合もケーパビリティの付与が必要です。

[公式ドキュメント](https://matterbridge.io/README-SERVICE-OPT.html) に沿ったサービス設定の例

/etc/systemd/system/matterbridge.service
```
[Unit]
Description=matterbridge
After=network.target
Wants=network.target

[Service]
Type=simple
Environment=NODE_ENV=production
Environment="NPM_CONFIG_PREFIX=/opt/matterbridge/.npm-global"
ExecStart=matterbridge --service --nosudo
WorkingDirectory=/opt/matterbridge/Matterbridge
StandardOutput=inherit
StandardError=inherit
Restart=always
User=matterbridge
Group=matterbridge
AmbientCapabilities=CAP_NET_RAW
CapabilityBoundingSet=CAP_NET_RAW
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/opt/matterbridge

[Install]
WantedBy=multi-user.target
```