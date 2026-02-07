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

import { MatterbridgeDynamicPlatform, PlatformConfig, PlatformMatterbridge } from 'matterbridge';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { SwitchBotBLE } from 'node-switchbot';

import { SwitchBotMatterDevice } from './SwitchBotMatterDevice.js';
import switchBotMatterFactory from './SwitchBotMatterFactory.js';

/**
 * This is the standard interface for Matterbridge plugins.
 * Each plugin should export a default function that follows this signature.
 *
 * @param {PlatformMatterbridge} matterbridge - An instance of MatterBridge.
 * @param {AnsiLogger} log - An instance of AnsiLogger. This is used for logging messages in a format that can be displayed with ANSI color codes and in the frontend.
 * @param {PlatformConfig} config - The platform configuration.
 * @returns {SwitchBotPlatform} - An instance of the MatterbridgeAccessory or MatterbridgeDynamicPlatform class. This is the main interface for interacting with the Matterbridge system.
 */
export default function initializePlugin(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig): SwitchBotPlatform {
  return new SwitchBotPlatform(matterbridge, log, config);
}

export class SwitchBotPlatform extends MatterbridgeDynamicPlatform {
  private deviceList: Record<string, SwitchBotMatterDevice> = {};
  private isConfigValid = false;
  private switchBotBLE: SwitchBotBLE | null = null;

  private switchBotDeviceAddresses: string[] = [];

  constructor(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig) {
    // Always call super(matterbridge, log, config)
    super(matterbridge, log, config);

    if (config.switchBotDeviceAddresses) {
      this.switchBotDeviceAddresses = config.switchBotDeviceAddresses as string[];
      // 小文字に統一
      this.switchBotDeviceAddresses = this.switchBotDeviceAddresses.map((addr) => addr.toLowerCase());
    }

    // Verify that Matterbridge is the correct version
    if (this.verifyMatterbridgeVersion === undefined || typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('3.3.0')) {
      throw new Error(
        `This plugin requires Matterbridge version >= "3.3.0". Please update Matterbridge from ${this.matterbridge.matterbridgeVersion} to the latest version in the frontend."`,
      );
    }

    this.isConfigValid = true;
  }

  override async onStart(reason?: string) {
    this.log.debug(`onStart called with reason: ${reason ?? 'none'}`);

    this.switchBotBLE = new SwitchBotBLE();

    if (!this.isConfigValid) {
      throw new Error('Plugin not configured yet, configure first, then restart.');
    }

    await this.ready;
    await this.clearSelect();
    await this.discoverDevices();
  }

  override async onChangeLoggerLevel(logLevel: LogLevel) {
    this.log.debug(`onChangeLoggerLevel called with: ${logLevel}`);
  }

  override async onShutdown(reason?: string) {
    await super.onShutdown(reason);

    this.log.debug(`onShutdown called with reason: ${reason ?? 'none'}`);

    for (const device of Object.values(this.deviceList)) {
      await device.destroy();
    }

    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices();
  }

  private async discoverDevices() {
    this.log.debug('Discovering devices...');

    try {
      const startScan = this.startScan.bind(this);
      const deviceList = await this.switchBotBLE!.discover({ quick: true });
      for (const device of deviceList) {
        const address = device.address.toLowerCase();
        try {
          this.log.debug(`Creating SwitchBot device: ${address}`);

          if (!this.switchBotDeviceAddresses.includes(address)) {
            this.log.info(`Skipping SwitchBot device not in configured addresses: ${address}`);
            continue;
          }

          const matterDevice = await switchBotMatterFactory(device, startScan, this.log);
          if (matterDevice === undefined) {
            this.log.error(`Failed to create SwitchBot device: ${address}`);
            continue;
          }

          await matterDevice.createEndpoint(this);

          this.deviceList[address] = matterDevice;

          await matterDevice.registerWithPlatform(this);
        } catch (error) {
          this.log.error(`Error discovering device ${address}: ${(error as Error).message}`);
        }
      }

      this.switchBotBLE!.onadvertisement = this.onadvertisement.bind(this);
      await startScan();
    } catch (e: any) {
      this.log.error(`Failed to start BLE scanning, Error: ${e.message ?? e}`);
    }
  }

  private async onadvertisement(ad: any) {
    this.deviceList[ad.address.toLowerCase()]?.handleAdvertisement(ad);
  }

  public async startScan() {
    await this.switchBotBLE!.startScan();
  }
}
