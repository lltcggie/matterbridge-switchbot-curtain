/**
 * Copyright 2026 lltcggie
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createHash } from 'node:crypto';

import AsyncLock from 'async-lock';
import { bridgedNode, MatterbridgeEndpoint, CommandHandlerData, coverDevice, MatterbridgeDynamicPlatform } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';
import { WindowCovering, PowerSource } from 'matterbridge/matter/clusters';
import { SwitchbotDevice, WoCurtain } from 'node-switchbot';

import { SwitchBotMatterDevice } from './SwitchBotMatterDevice.js';

class SwitchBotCurtainMatterDevice implements SwitchBotMatterDevice {
  private device: WoCurtain;
  private startScan: () => Promise<void>;
  private log: AnsiLogger;
  public readonly name: string = '';

  public RootEndpoint!: MatterbridgeEndpoint;
  public Endpoint!: MatterbridgeEndpoint;

  private refreshLock = new AsyncLock({ timeout: 1000 * 4 });

  constructor(device: SwitchbotDevice, startScan: () => Promise<void>, log: AnsiLogger) {
    this.device = device as WoCurtain;
    this.startScan = startScan;
    this.log = log;

    this.name = `Curtain ${this.device.address.toLowerCase()}`;
  }

  public async createEndpoint(platform: MatterbridgeDynamicPlatform) {
    const idKey = `switchbot-curtain-${this.name}`;

    const hash = createHash('sha256').update(idKey).digest('hex');
    const serial = hash.substring(0, 16);

    this.RootEndpoint = new MatterbridgeEndpoint([bridgedNode], { id: idKey }, platform.config.debug as boolean)
      .createDefaultIdentifyClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer(
        this.name,
        serial,
        platform.matterbridge.aggregatorVendorId,
        platform.matterbridge.aggregatorVendorName,
        `SwitchBot Curtain Device`,
        parseInt(platform.version.replace(/\D/g, '')),
        platform.version === '' ? 'Unknown' : platform.version,
        parseInt(platform.matterbridge.matterbridgeVersion.replace(/\D/g, '')),
        platform.matterbridge.matterbridgeVersion,
      );
    this.RootEndpoint.addRequiredClusterServers();

    this.Endpoint = this.RootEndpoint.addChildDeviceType('main', [coverDevice], { id: `${idKey}-main` }, platform.config.debug as boolean);
    this.Endpoint.addRequiredClusterServers();

    this.Endpoint.createDefaultGroupsClusterServer()
      .createDefaultWindowCoveringClusterServer(
        undefined,
        WindowCovering.WindowCoveringType.Drapery,
        WindowCovering.EndProductType.LateralLeftCurtain, // TODO: 右開きカーテンにどう対応するのか検討
      )
      .createDefaultPowerSourceBatteryClusterServer(50 * 2, PowerSource.BatChargeLevel.Ok);

    this.Endpoint.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.log.debug(`Command identify called identifyTime: ${identifyTime}`);
    });

    this.Endpoint.addCommandHandler('goToLiftPercentage', async (data: CommandHandlerData) => {
      await this.device.runToPos((10000 - data.request.liftPercent100thsValue) / 100);
      // nobleの仕様でdevice.close()などでデバイスに接続した後はスキャンが自動で止まるため、再度スキャンを開始する
      await this.startScan();
    });

    this.Endpoint.addCommandHandler('upOrOpen', async () => {
      await this.device.open();
      // nobleの仕様でdevice.close()などでデバイスに接続した後はスキャンが自動で止まるため、再度スキャンを開始する
      await this.startScan();
    });

    this.Endpoint.addCommandHandler('downOrClose', async () => {
      await this.device.close();
      // nobleの仕様でdevice.close()などでデバイスに接続した後はスキャンが自動で止まるため、再度スキャンを開始する
      await this.startScan();
    });

    this.Endpoint.addCommandHandler('stopMotion', async () => {
      await this.device.pause();
      // nobleの仕様でdevice.close()などでデバイスに接続した後はスキャンが自動で止まるため、再度スキャンを開始する
      await this.startScan();
    });
  }

  public async registerWithPlatform(platform: MatterbridgeDynamicPlatform) {
    platform.setSelectDevice(this.RootEndpoint.serialNumber ?? '', this.RootEndpoint.deviceName ?? '', undefined, 'hub');

    if (platform.validateDevice(this.RootEndpoint.deviceName ?? '')) {
      await platform.registerDevice(this.RootEndpoint);
    }
  }

  public async destroy() {}

  public async handleAdvertisement(ad: any) {
    await this.refreshLock.acquire('refresh', async () => {
      const promises = [];

      const pos = ad.serviceData?.position;
      if (pos !== undefined) {
        const liftPercent100thsValue = 10000 - pos * 100;
        promises.push(this.Endpoint.updateAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths', liftPercent100thsValue, this.Endpoint.log));
      }

      const battery = ad.serviceData?.battery;
      if (battery !== undefined) {
        const batteryValue = battery * 2;
        promises.push(this.Endpoint.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryValue, this.Endpoint.log));

        const chargeLevel = battery >= 20 ? PowerSource.BatChargeLevel.Ok : battery >= 10 ? PowerSource.BatChargeLevel.Warning : PowerSource.BatChargeLevel.Critical;
        promises.push(this.Endpoint.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', chargeLevel, this.Endpoint.log));
      }

      await Promise.all(promises);
    });
  }
}

export { SwitchBotCurtainMatterDevice };
