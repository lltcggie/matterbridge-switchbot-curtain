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

import { AnsiLogger } from 'matterbridge/logger';
import { SwitchbotDevice } from 'node-switchbot';

import { SwitchBotMatterDevice } from './SwitchBotMatterDevice.js';
import { SwitchBotCurtainMatterDevice } from './SwitchBotCurtainMatterDevice.js';

export default async function switchBotMatterFactory(device: SwitchbotDevice, startScan: () => Promise<void>, log: AnsiLogger): Promise<SwitchBotMatterDevice | undefined> {
  const deviceType = device.model;
  switch (deviceType) {
    case 'c':
      log.debug(`SwitchBot - switchBotMatterFactory: Detected device type: 'SwitchBotCurtainMatterDevice'`);
      return new SwitchBotCurtainMatterDevice(device, startScan, log);
    default:
      throw new Error(`SwitchBot - switchBotMatterFactory('${device.address}'): Unknown device type: '${deviceType}'`);
  }
}
